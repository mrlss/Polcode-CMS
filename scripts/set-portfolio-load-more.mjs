import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const DB_PATH = path.join(process.cwd(), '.tmp/data.db')
const APPLY = process.argv.includes('--apply')
const CASES_MORE_IDS = [235, 239]

const flag = (name) => {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

const pageSizeArg = flag('pageSize')
const initialArg = flag('initial')
const pageSize = pageSizeArg === null ? null : Number(pageSizeArg)
const initialItems =
  initialArg === null || initialArg === 'none' ? null : Number(initialArg)

const db = new Database(DB_PATH)
db.pragma('busy_timeout = 5000')

const rows = CASES_MORE_IDS.map((id) =>
  db
    .prepare(
      `select m.id, m.mode, m.load_more_label, m.page_size, m.initial_items,
              c.field, c.entity_id
         from components_shared_show_mores m
         left join components_sections_portfolios_cmps c
           on c.cmp_id = m.id and c.component_type = 'shared.show-more'
        where m.id = ?`
    )
    .get(id)
)

console.log(APPLY ? 'APPLY' : 'DRY RUN')
console.table(rows)
console.log({ pageSize, initialItems })

if (!APPLY) {
  console.log('\nPass --apply to write. The backup is taken before any write.')
  db.close()
  process.exit(0)
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backup = `${DB_PATH}.bak-portfolio-load-more-${stamp}`
fs.copyFileSync(DB_PATH, backup)

const sets = [`mode = 'loadMore'`, `load_more_label = 'Load more'`]
const values = []
if (pageSize !== null) {
  sets.push('page_size = ?')
  values.push(pageSize)
}
if (initialArg !== null) {
  sets.push('initial_items = ?')
  values.push(initialItems)
}

const update = db.prepare(
  `update components_shared_show_mores set ${sets.join(', ')} where id = ?`
)

const run = db.transaction((ids) => ids.map((id) => update.run(...values, id)))

const result = run(CASES_MORE_IDS)
console.log(result)
console.log(`backup: ${backup}`)
db.close()
