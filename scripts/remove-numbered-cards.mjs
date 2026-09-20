import Database from 'better-sqlite3'
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(here, '../.tmp/data.db')
const APPLY = process.argv.includes('--apply')
const PURGE = process.argv.includes('--purge')

const OLD_TYPE = 'sections.cards-large-numerated'
const NEW_TYPE = 'sections.content-numerated'
const OLD_TABLE = 'components_sections_cards_large_numerateds'
const NEW_TABLE = 'components_sections_content_numerateds'
const OLD_CMPS = 'components_sections_cards_large_numerateds_cmps'
const NEW_CMPS = 'components_sections_content_numerateds_cmps'
const OLD_CARD_TABLE = 'components_shared_card_numerateds'
const NEW_ITEM_TABLE = 'components_shared_content_items'
const OWNERS = ['pages_cmps', 'case_studies_cmps', 'insights_cmps']

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

for (const table of [OLD_TABLE, NEW_TABLE, OLD_CMPS, OLD_CARD_TABLE]) {
  if (!tableExists(table)) {
    console.error(`Missing table ${table}. Stop Strapi and rerun.`)
    process.exit(1)
  }
}

const report = { rows: [], cards: 0 }

class DryRun extends Error {}

const run = () => {
  const oldNested = db
    .prepare(`SELECT * FROM ${OLD_CMPS}`)
    .all()

  const newNestedColumns = columns(NEW_CMPS).filter((c) => c !== 'id')
  const cardColumns = columns(OLD_CARD_TABLE).filter((c) => c !== 'id')
  const itemColumns = columns(NEW_ITEM_TABLE).filter((c) => c !== 'id')
  const sharedColumns = itemColumns.filter((c) => cardColumns.includes(c))

  for (const owner of OWNERS) {
    if (!tableExists(owner)) continue

    const ownerCols = columns(owner)
    const idColumn = ownerCols.includes('cmp_id')
      ? 'cmp_id'
      : ownerCols.includes('component_id')
        ? 'component_id'
        : null
    if (!idColumn) continue

    const rows = db
      .prepare(`SELECT rowid AS rid, * FROM ${owner} WHERE component_type = ?`)
      .all(OLD_TYPE)

    for (const row of rows) {
      const section = db
        .prepare(`SELECT * FROM ${OLD_TABLE} WHERE id = ?`)
        .get(row[idColumn])
      if (!section) continue

      const sectionColumns = columns(NEW_TABLE).filter((c) => c !== 'id')
      const values = sectionColumns.map((c) => {
        if (c === 'layout') return 'buttonBelow'
        if (c === 'behavior') return 'static'
        return section[c] ?? null
      })

      const newId = db
        .prepare(
          `INSERT INTO ${NEW_TABLE} (${sectionColumns.map(quote).join(', ')}) VALUES (${sectionColumns.map(() => '?').join(', ')})`
        )
        .run(...values).lastInsertRowid

      const nested = oldNested.filter((c) => c.entity_id === section.id)

      for (const cmp of nested) {
        const isCard = cmp.field === 'cards'

        if (!isCard) {
          db.prepare(
            `INSERT INTO ${NEW_CMPS} (${newNestedColumns.map(quote).join(', ')}) VALUES (${newNestedColumns.map(() => '?').join(', ')})`
          ).run(
            ...newNestedColumns.map((c) =>
              c === 'entity_id' ? newId : (cmp[c] ?? null)
            )
          )
          continue
        }

        const card = db
          .prepare(`SELECT * FROM ${OLD_CARD_TABLE} WHERE id = ?`)
          .get(cmp.cmp_id)
        if (!card) continue

        const itemId = db
          .prepare(
            `INSERT INTO ${NEW_ITEM_TABLE} (${sharedColumns.map(quote).join(', ')}) VALUES (${sharedColumns.map(() => '?').join(', ')})`
          )
          .run(...sharedColumns.map((c) => card[c] ?? null)).lastInsertRowid

        db.prepare(
          `INSERT INTO ${NEW_CMPS} (${newNestedColumns.map(quote).join(', ')}) VALUES (${newNestedColumns.map(() => '?').join(', ')})`
        ).run(
          ...newNestedColumns.map((c) => {
            if (c === 'entity_id') return newId
            if (c === 'cmp_id') return itemId
            if (c === 'field') return 'items'
            if (c === 'component_type') return 'shared.content-item'
            return cmp[c] ?? null
          })
        )

        report.cards += 1
      }

      db.prepare(
        `UPDATE ${owner} SET component_type = ?, ${idColumn} = ? WHERE rowid = ?`
      ).run(NEW_TYPE, newId, row.rid)

      report.rows.push({
        owner,
        pageRow: row.entity_id,
        from: section.id,
        to: Number(newId),
        cards: nested.filter((c) => c.field === 'cards').length,
      })
    }
  }

  if (PURGE) {
    db.prepare(`DELETE FROM ${OLD_CMPS}`).run()
    db.prepare(`DELETE FROM ${OLD_TABLE}`).run()
  }

  if (!APPLY) throw new DryRun()
}

const tx = db.transaction(run)

if (APPLY) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = path.resolve(here, `../.tmp/data.db.bak-remove-numbered-cards-${stamp}`)
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
