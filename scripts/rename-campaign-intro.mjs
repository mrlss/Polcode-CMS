/**
 * One-off migration: `sections.intro-showreel` → `sections.campaign-intro`.
 *
 * The component file was renamed (`intro-showreel.json` → `campaign-intro.json`),
 * but `collectionName` is deliberately still `components_sections_intro_showreels`
 * so the existing component table — and every row in it — is reused. What does
 * NOT follow automatically is the dynamic-zone bookkeeping: every `*_cmps` join
 * table stores the component UID in `component_type`, so existing page sections
 * still point at the old UID and would silently disappear from the API.
 *
 * Usage (from the strapi project root, with Strapi STOPPED):
 *   node scripts/rename-campaign-intro.mjs          # dry run (prints counts)
 *   node scripts/rename-campaign-intro.mjs --apply  # rewrite component_type
 *
 * Same thing without this script (sqlite3 CLI), if you prefer:
 *   sqlite3 .tmp/data.db "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_cmps';"
 *   # then, for each table:
 *   sqlite3 .tmp/data.db "UPDATE <table> SET component_type='sections.campaign-intro' WHERE component_type='sections.intro-showreel';"
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const APPLY = process.argv.includes("--apply");
const FROM = "sections.intro-showreel";
const TO = "sections.campaign-intro";

const dbPath = path.join(process.cwd(), ".tmp", "data.db");
if (!fs.existsSync(dbPath)) {
  console.error(`DB not found at ${dbPath} — run from the strapi project root.`);
  process.exit(1);
}

const db = new Database(dbPath);
const log = (m) => console.log(APPLY ? `[apply] ${m}` : `[dry]   ${m}`);

// Every dynamic-zone join table is named `<something>_cmps`.
const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%\\_cmps' ESCAPE '\\'"
  )
  .all()
  .map((r) => r.name);

if (!tables.length) {
  console.error("No *_cmps join tables found — is this the right database?");
  process.exit(1);
}

let total = 0;
for (const table of tables) {
  const { n } = db
    .prepare(`SELECT COUNT(*) AS n FROM "${table}" WHERE component_type = ?`)
    .get(FROM);
  if (!n) continue;
  total += n;
  log(`${table}: ${n} row(s)`);
  if (APPLY) {
    db.prepare(
      `UPDATE "${table}" SET component_type = ? WHERE component_type = ?`
    ).run(TO, FROM);
  }
}

if (!total) {
  log(`nothing to migrate — no "${FROM}" rows found`);
} else {
  log(`${total} row(s) → ${TO} ${APPLY ? "(done)" : "(dry run)"}`);
}

// The component rows themselves live in `components_sections_intro_showreels`
// and need no change: only the UID in `component_type` is stale.
const { n: componentRows } = db
  .prepare("SELECT COUNT(*) AS n FROM components_sections_intro_showreels")
  .get();
log(
  `${componentRows} component row(s) in components_sections_intro_showreels (untouched) — ` +
    "rows without a `variant` fall back to `default`."
);

db.close();
