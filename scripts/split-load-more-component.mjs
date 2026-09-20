import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const DB_PATH = path.join(process.cwd(), '.tmp/data.db')
const APPLY = process.argv.includes('--apply')

const db = new Database(DB_PATH)
db.pragma('busy_timeout = 5000')

/*
 * One-shot: `shared.show-more` used to carry both the collapse and the paged
 * configuration. It has been split, so every row configured for paging is
 * copied into `components_shared_load_mores` and its link row re-pointed at the
 * new component type/field.
 *
 * The old columns (`load_chunk`, `initial_items`, `load_more_label`, `mode`) are
 * already gone from the live DB — Strapi drops them on the schema change — so
 * the values below come from the backup taken just before the split:
 * `.tmp/data.db.bak-portfolio-load-more-2026-09-20T10-28-12-192Z`.
 */
const TABLES = {
  insights: 'components_sections_insight_lists_cmps',
  portfolios: 'components_sections_portfolios_cmps',
}

const MIGRATIONS = [
  { src: 'insights', linkId: 996, initial: 6, chunk: 6, label: 'Load more' },
  { src: 'insights', linkId: 1161, initial: 6, chunk: 6, label: 'Load more' },
  { src: 'portfolios', linkId: 198, initial: 2, chunk: 2, label: 'Load more' },
  { src: 'portfolios', linkId: 240, initial: 2, chunk: 2, label: 'Load more' },
]

const rows = MIGRATIONS.map((row) => ({
  ...row,
  current: db
    .prepare(
      `select id, cmp_id, field, component_type from ${TABLES[row.src]} where id = ?`
    )
    .get(row.linkId),
}))

console.log(APPLY ? 'APPLY' : 'DRY RUN')
console.table(rows)

if (!APPLY) {
  console.log('\nPass --apply to write. A backup is taken before any write.')
  db.close()
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = `${DB_PATH}.bak-split-load-more-${stamp}`
fs.copyFileSync(DB_PATH, backup)

const insert = db.prepare(
  `insert into components_shared_load_mores (initial_items, load_chunk, load_more_label)
   values (?, ?, ?)`
)
const relink = {
  insights: db.prepare(
    `update components_sections_insight_lists_cmps
        set cmp_id = ?, component_type = 'shared.load-more', field = 'loadMore'
      where id = ?`
  ),
  portfolios: db.prepare(
    `update components_sections_portfolios_cmps
        set cmp_id = ?, component_type = 'shared.load-more', field = 'loadMore'
      where id = ?`
  ),
}

const run = db.transaction((list) =>
  list.map((row) => {
    const created = insert.run(row.initial, row.chunk, row.label)
    return relink[row.src].run(created.lastInsertRowid, row.linkId)
  })
)

console.log(run(rows))
console.log(`backup: ${backup}`)
db.close()
