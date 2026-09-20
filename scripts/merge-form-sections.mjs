import Database from 'better-sqlite3'
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(here, '../.tmp/data.db')
const APPLY = process.argv.includes('--apply')
const PURGE = process.argv.includes('--purge')

const OLD_TYPE = 'sections.newsletter'
const NEW_TYPE = 'sections.form'
const OLD_TABLE = 'components_sections_newsletters'
const NEW_TABLE = 'components_sections_forms'
const OLD_CMPS = 'components_sections_newsletters_cmps'
const NEW_CMPS = 'components_sections_forms_cmps'
const OWNERS = ['pages_cmps', 'insights_cmps']

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

const columns = (name) =>
  db.prepare(`PRAGMA table_info(${name})`).all().map((c) => c.name)

const quote = (name) => `"${name}"`

for (const table of [OLD_TABLE, NEW_TABLE, ...OWNERS]) {
  if (!tableExists(table)) {
    console.error(`Missing table ${table}. Stop Strapi and rerun.`)
    process.exit(1)
  }
}

const ownerColumn = (table) => {
  const cols = columns(table)
  if (cols.includes('cmp_id')) return 'cmp_id'
  if (cols.includes('component_id')) return 'component_id'
  return null
}

const report = { rows: [], addedColumn: false, relabelled: 0, mediaRenamed: 0 }

class DryRun extends Error {}

const run = () => {
  if (!columns(NEW_TABLE).includes('hubspotFormID')) {
    db.prepare(`ALTER TABLE ${NEW_TABLE} ADD COLUMN ${quote('hubspotFormID')} TEXT`).run()
    report.addedColumn = true
  }

  report.relabelled = db
    .prepare(
      `UPDATE ${NEW_TABLE} SET variant = 'default'
       WHERE variant IS NULL OR variant IN ('contact', 'cv')`
    )
    .run().changes

  if (tableExists('files_related_mph')) {
    report.mediaRenamed = db
      .prepare(
        `UPDATE files_related_mph SET field = 'image'
         WHERE related_type = ? AND field = 'media'`
      )
      .run(NEW_TABLE).changes
  }

  const nestedColumns = tableExists(OLD_CMPS)
    ? columns(NEW_CMPS).filter((c) => c !== 'id')
    : []

  for (const owner of OWNERS) {
    if (!tableExists(owner)) continue

    const idColumn = ownerColumn(owner)
    if (!idColumn) continue

    const rows = db
      .prepare(`SELECT rowid AS rid, * FROM ${owner} WHERE component_type = ?`)
      .all(OLD_TYPE)

    for (const row of rows) {
      const band = db
        .prepare(`SELECT * FROM ${OLD_TABLE} WHERE id = ?`)
        .get(row[idColumn])
      if (!band) continue

      const bandColumns = columns(NEW_TABLE).filter((c) => c !== 'id')
      const values = bandColumns.map((c) => {
        if (c === 'variant') return 'compact'
        if (c === 'hubspotFormID') return null
        return band[c] ?? null
      })

      const newId = db
        .prepare(
          `INSERT INTO ${NEW_TABLE} (${bandColumns.map(quote).join(', ')}) VALUES (${bandColumns.map(() => '?').join(', ')})`
        )
        .run(...values).lastInsertRowid

      const nested = tableExists(OLD_CMPS)
        ? db.prepare(`SELECT * FROM ${OLD_CMPS} WHERE entity_id = ?`).all(band.id)
        : []

      for (const cmp of nested) {
        if (cmp.field === 'button') continue
        db.prepare(
          `INSERT INTO ${NEW_CMPS} (${nestedColumns.map(quote).join(', ')}) VALUES (${nestedColumns.map(() => '?').join(', ')})`
        ).run(
          ...nestedColumns.map((c) => (c === 'entity_id' ? newId : (cmp[c] ?? null)))
        )
      }

      db.prepare(
        `UPDATE ${owner} SET component_type = ?, ${idColumn} = ? WHERE rowid = ?`
      ).run(NEW_TYPE, newId, row.rid)

      report.rows.push({
        owner,
        pageRow: row.entity_id,
        from: band.id,
        to: Number(newId),
        nested: nested.length,
      })
    }
  }

  if (PURGE) {
    if (tableExists(OLD_CMPS)) db.prepare(`DELETE FROM ${OLD_CMPS}`).run()
    db.prepare(`DELETE FROM ${OLD_TABLE}`).run()
  }

  if (!APPLY) throw new DryRun()
}

const tx = db.transaction(run)

if (APPLY) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = path.resolve(here, `../.tmp/data.db.bak-merge-forms-${stamp}`)
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
