/**
 * One-off cleanup: remove the hundreds of duplicate media rows created by the
 * demo seeder (`seed-content.ts`) — partner logos + testimonial SVGs re-uploaded
 * on every `SEED_DEMO=true` boot.
 *
 *  - Keeps ONE canonical file per seed asset (the max-id copy — which is what
 *    the live Globals footer already points at).
 *  - Re-points any real content (clients/achievements/process/sections.cta)
 *    that referenced a duplicate copy onto the canonical file.
 *  - Removes the dead Globals component chain (old footer/partner component
 *    rows + join rows + their media refs) that `deleteMany` never cascaded.
 *  - Deletes the physical files in `public/uploads` for removed rows.
 *
 * Usage (from the strapi project root, with Strapi STOPPED):
 *   node scripts/cleanup-duplicate-media.mjs          # dry run (prints plan)
 *   node scripts/cleanup-duplicate-media.mjs --apply  # execute
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const APPLY = process.argv.includes("--apply");
const dbPath = path.join(process.cwd(), ".tmp", "data.db");
const uploadsDir = path.join(process.cwd(), "public", "uploads");

if (!fs.existsSync(dbPath)) {
  console.error(`DB not found at ${dbPath} — run from the strapi project root.`);
  process.exit(1);
}

const db = new Database(dbPath);
const ph = (n) => new Array(n).fill("?").join(",");

const log = (m) => console.log(APPLY ? `[apply] ${m}` : `[dry]   ${m}`);

// ---- 1. live Globals chain (the only footer/partner rows we keep) ----------
const liveGlobals = db.prepare("SELECT id FROM globals").all();
if (!liveGlobals.length) {
  console.error("No globals rows found — aborting (nothing to anchor to).");
  process.exit(1);
}
const liveGlobalsIds = liveGlobals.map((r) => r.id);
const liveFooterIds = db
  .prepare(
    `SELECT cmp_id FROM globals_cmps WHERE entity_id IN (${ph(
      liveGlobalsIds.length,
    )}) AND field = 'footer'`,
  )
  .all(...liveGlobalsIds)
  .map((r) => r.cmp_id);
const livePartnerIds = db
  .prepare(
    `SELECT cmp_id FROM components_global_footers_cmps WHERE entity_id IN (${ph(
      liveFooterIds.length,
    )}) AND field = 'partners'`,
  )
  .all(...liveFooterIds)
  .map((r) => r.cmp_id);
log(
  `live chain: globals=${liveGlobalsIds.length} footers=${liveFooterIds.length} partners=${livePartnerIds.length} ` +
  `(footers ${liveFooterIds.join(",")}, partners ${livePartnerIds.join(",")})`,
);

// ---- 2. canonical + duplicate file ids per seed asset ----------------------
const seedNames = db
  .prepare(
    `SELECT DISTINCT name FROM files WHERE name LIKE 'partners0%.png' OR name LIKE '%-testimonial-%.svg' ORDER BY name`,
  )
  .all()
  .map((r) => r.name);
log(`seed asset names: ${seedNames.length}`);

const canonical = {};
const toDelete = [];
for (const name of seedNames) {
  const ids = db
    .prepare("SELECT id FROM files WHERE name = ? ORDER BY id")
    .all(name)
    .map((r) => r.id);
  canonical[name] = ids[ids.length - 1]; // max id = what live Globals uses
  toDelete.push(...ids.slice(0, -1));
}
log(
  `duplicate file rows to delete: ${toDelete.length}  → keep canonical ids: ${Object.values(
    canonical,
  ).join(", ")}`,
);

// gather physical paths BEFORE rows are removed
const physical = [];
if (toDelete.length) {
  const rows = db
    .prepare(`SELECT id, url FROM files WHERE id IN (${ph(toDelete.length)})`)
    .all(...toDelete);
  for (const r of rows) {
    if (r.url) physical.push(path.join(uploadsDir, path.basename(r.url)));
  }
}
log(`physical upload files to delete: ${physical.length}`);

if (!APPLY) {
  console.log("\nDry run — no changes made. Re-run with --apply to execute.");
  process.exit(0);
}

// ---- 3. execute ------------------------------------------------------------
const run = db.transaction(() => {
  // 3a. drop the dead Globals component chain (deleteMany never cascaded these)
  db.prepare(
    `DELETE FROM files_related_mph WHERE related_type = 'global.partner' AND related_id NOT IN (${ph(
      livePartnerIds.length,
    )})`,
  ).run(...livePartnerIds);
  db.prepare(
    `DELETE FROM components_global_partners WHERE id NOT IN (${ph(
      livePartnerIds.length,
    )})`,
  ).run(...livePartnerIds);
  db.prepare(
    `DELETE FROM components_global_footers_cmps WHERE entity_id NOT IN (${ph(
      liveFooterIds.length,
    )})`,
  ).run(...liveFooterIds);
  db.prepare(
    `DELETE FROM globals_cmps WHERE entity_id NOT IN (${ph(
      liveGlobalsIds.length,
    )})`,
  ).run(...liveGlobalsIds);
  db.prepare(
    `DELETE FROM components_global_footers WHERE id NOT IN (${ph(
      liveFooterIds.length,
    )})`,
  ).run(...liveFooterIds);

  // 3b. re-point any real-content reference to a duplicate copy → canonical
  for (const name of seedNames) {
    db.prepare(
      `UPDATE files_related_mph SET file_id = ? WHERE file_id IN (SELECT id FROM files WHERE name = ? AND id <> ?)`,
    ).run(canonical[name], name, canonical[name]);
  }

  // 3c. delete duplicate file rows (+ leftover links)
  if (toDelete.length) {
    db.prepare(
      `DELETE FROM files_folder_lnk WHERE file_id IN (${ph(toDelete.length)})`,
    ).run(...toDelete);
    db.prepare(
      `DELETE FROM files_related_mph WHERE file_id IN (${ph(toDelete.length)})`,
    ).run(...toDelete);
    db.prepare(
      `DELETE FROM files WHERE id IN (${ph(toDelete.length)})`,
    ).run(...toDelete);
  }
});
run();

// ---- 4. remove physical files -------------------------------------------------
let removedFiles = 0;
for (const p of physical) {
  try {
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      removedFiles++;
    }
  } catch (e) {
    console.warn(`  ! could not delete ${p}: ${e.message}`);
  }
}

log(
  `done: deleted ${toDelete.length} duplicate file rows, ${removedFiles} physical file(s).`,
);
db.close();
