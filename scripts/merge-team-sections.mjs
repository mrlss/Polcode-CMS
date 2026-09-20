import Database from 'better-sqlite3'
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(here, '../.tmp/data.db')
const APPLY = process.argv.includes('--apply')
const PURGE = process.argv.includes('--purge')

const SECTION = 'sections'
const OLD_TYPE = 'sections.team-grid'
const NEW_TYPE = 'sections.team'
const OLD_TABLE = 'components_sections_team_grids'
const NEW_TABLE = 'components_sections_teams'
const OLD_LINK = 'components_sections_team_grids_team_lnk'
const NEW_LINK = 'components_sections_teams_members_lnk'
const OLD_CMPS = 'components_sections_team_grids_cmps'
const NEW_CMPS = 'components_sections_teams_cmps'

if (!existsSync(DB_PATH)) {
  console.error(`No database at ${DB_PATH}`)
  process.exit(1)
}

const db = new Database(DB_PATH)
db.pragma('busy_timeout = 5000')

const tableExists = (name) =>
  Boolean(
    db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
      .get(name)
  )

const tableSql = (name) =>
  db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(name)?.sql

const columns = (name) =>
  db.prepare(`PRAGMA table_info(${name})`).all().map((c) => c.name)

const quote = (name) => `"${name}"`

const require_ = (name, label) => {
  if (!tableExists(name)) {
    console.error(`Missing table ${name} (${label}). Stop Strapi after the schema change and rerun.`)
    process.exit(1)
  }
}

require_(OLD_TABLE, 'old team-grid component')
require_(NEW_TABLE, 'merged team component')
require_('pages_cmps', 'page dynamiczone links')

const cmpsColumns = columns('pages_cmps')
const ownerId = cmpsColumns.includes('cmp_id')
  ? 'cmp_id'
  : cmpsColumns.includes('component_id')
    ? 'component_id'
    : null

if (!ownerId) {
  console.error(`pages_cmps has no owner id column (${cmpsColumns.join(', ')})`)
  process.exit(1)
}

const componentIds = new Set(
  db.prepare(`SELECT id FROM ${OLD_TABLE}`).all().map((r) => r.id)
)

const report = {
  rows: [],
  addedColumn: false,
  relabelled: 0,
}

class DryRun extends Error { }

const run = () => {
  if (!columns(NEW_TABLE).includes('variant')) {
    db.prepare(`ALTER TABLE ${NEW_TABLE} ADD COLUMN variant TEXT`).run()
    report.addedColumn = true
  }

  report.relabelled = db
    .prepare(
      `UPDATE ${NEW_TABLE} SET variant = 'rows' WHERE variant IS NULL OR variant = ''`
    )
    .run().changes

  const ownerColumn = (() => {
    if (!tableExists(OLD_LINK)) return null
    const candidates = columns(OLD_LINK).filter((c) => c.endsWith('_id'))
    return (
      candidates.find((c) => {
        const values = db
          .prepare(
            `SELECT DISTINCT ${quote(c)} AS v FROM ${OLD_LINK} WHERE ${quote(c)} IS NOT NULL`
          )
          .all()
          .map((r) => r.v)
        return values.length > 0 && values.every((v) => componentIds.has(v))
      }) ?? null
    )
  })()

  const linkRows = tableExists(OLD_LINK)
    ? db.prepare(`SELECT count(*) AS n FROM ${OLD_LINK}`).get().n
    : 0

  if (linkRows > 0 && !tableExists(NEW_LINK)) {
    throw new Error(
      `${NEW_LINK} does not exist yet. Restart Strapi once with the merged team.json (it creates the table), stop it again and rerun this script.`
    )
  }

  const linkRoles = (table, owner) => {
    const cols = columns(table).filter((c) => c !== 'id')
    const ids = cols.filter((c) => c.endsWith('_id'))
    const resolvedOwner = owner ?? ids[0]
    return {
      owner: resolvedOwner,
      target: ids.find((c) => c !== resolvedOwner) ?? null,
      order: cols.find((c) => c.endsWith('_ord')) ?? null,
    }
  }

  const oldRoles = tableExists(OLD_LINK) ? linkRoles(OLD_LINK, ownerColumn) : null
  const newRoles = tableExists(NEW_LINK) ? linkRoles(NEW_LINK, null) : null

  const rows = db
    .prepare(`SELECT rowid AS rid, * FROM pages_cmps WHERE component_type = ?`)
    .all(OLD_TYPE)

  for (const row of rows) {
    const grid = db
      .prepare(`SELECT * FROM ${OLD_TABLE} WHERE id = ?`)
      .get(row[ownerId])
    if (!grid) continue

    const insertColumns = columns(NEW_TABLE).filter((c) => c !== 'id')
    const values = insertColumns.map((c) =>
      c === 'variant' ? 'grid' : (grid[c] ?? null)
    )
    const newId = db
      .prepare(
        `INSERT INTO ${NEW_TABLE} (${insertColumns.map(quote).join(', ')}) VALUES (${insertColumns.map(() => '?').join(', ')})`
      )
      .run(...values).lastInsertRowid

    const nested = tableExists(OLD_CMPS)
      ? db.prepare(`SELECT * FROM ${OLD_CMPS} WHERE entity_id = ?`).all(grid.id)
      : []
    const nestedColumns = nested.length
      ? columns(NEW_CMPS).filter((c) => c !== 'id')
      : []
    for (const cmp of nested) {
      db.prepare(
        `INSERT INTO ${NEW_CMPS} (${nestedColumns.map(quote).join(', ')}) VALUES (${nestedColumns.map(() => '?').join(', ')})`
      ).run(
        ...nestedColumns.map((c) =>
          c === 'entity_id' ? newId : (cmp[c] ?? null)
        )
      )
    }

    const links =
      oldRoles && newRoles && oldRoles.owner
        ? db
          .prepare(`SELECT * FROM ${OLD_LINK} WHERE ${quote(oldRoles.owner)} = ?`)
          .all(grid.id)
        : []
    for (const link of links) {
      db.prepare(
        `INSERT INTO ${NEW_LINK} (${quote(newRoles.owner)}, ${quote(newRoles.target)}, ${quote(newRoles.order)}) VALUES (?, ?, ?)`
      ).run(
        newId,
        oldRoles.target ? (link[oldRoles.target] ?? null) : null,
        oldRoles.order ? (link[oldRoles.order] ?? null) : null
      )
    }

    db.prepare(
      `UPDATE pages_cmps SET component_type = ?, ${ownerId} = ? WHERE rowid = ?`
    ).run(NEW_TYPE, newId, row.rid)

    report.rows.push({
      pageRow: row.entity_id,
      field: row.field,
      position: row.order,
      from: grid.id,
      to: Number(newId),
      nested: nested.length,
      links: links.length,
      anchor: grid.anchor ?? null,
    })
  }

  if (PURGE) {
    for (const table of [OLD_LINK, OLD_CMPS, OLD_TABLE]) {
      if (tableExists(table)) db.prepare(`DELETE FROM ${table}`).run()
    }
  }

  if (!APPLY) throw new DryRun()
}

const tx = db.transaction(run)

if (APPLY) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = path.resolve(here, `../.tmp/data.db.bak-merge-team-${stamp}`)
  copyFileSync(DB_PATH, backup)
  tx()
  console.log(`backup: ${backup}`)
} else {
  try {
    tx()
  } catch (error) {
    if (!(error instanceof DryRun)) throw error
  }
  console.log('dry run — nothing written (pass --apply to write)')
}

console.log(
  JSON.stringify({ ...report, applied: APPLY, purged: APPLY && PURGE }, null, 2)
)
