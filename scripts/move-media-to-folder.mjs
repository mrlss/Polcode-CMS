#!/usr/bin/env node
/**
 * Put freshly uploaded media into a media-library folder (Strapi 5 / sqlite).
 *
 * WHY A DB SCRIPT: the upload plugin exposes folder management under the ADMIN
 * routes only — the content API (`/api/upload*`) always files uploads under the
 * built-in "API Uploads" folder and has no move/update endpoint (PUT → 405), so
 * there is no token-based way to create a folder or move a file.
 *
 * The script mirrors what the plugin's folder service does:
 *   pathId = max(pathId) + 1, path = "/<pathId>", plus a files_folder_lnk row.
 *
 * Usage — Strapi MUST be stopped (sqlite runs in journal_mode=delete):
 *   node scripts/move-media-to-folder.mjs --ids 608-619            # dry run
 *   node scripts/move-media-to-folder.mjs --ids 608-619 --apply    # write
 *   node scripts/move-media-to-folder.mjs --name "React logo" --folder TechStack --apply
 *
 * Options:
 *   --folder <name>   media-library folder to create/reuse (default TechStack)
 *   --ids <list>      file ids, e.g. "608,609" or ranges "608-619"
 *   --name <text>     alternative to --ids: match files by name (SQL LIKE)
 *   --apply           actually write (default = dry run)
 */
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i > -1 ? (argv[i + 1] ?? fallback) : fallback;
};
const APPLY = argv.includes("--apply");
const FOLDER_NAME = flag("--folder", "TechStack");
const IDS_ARG = flag("--ids");
const NAME_LIKE = flag("--name");
const dbPath = path.join(process.cwd(), ".tmp", "data.db");

if (!fs.existsSync(dbPath)) {
  console.error(`DB not found at ${dbPath} — run from the strapi project root.`);
  process.exit(1);
}
if (!IDS_ARG && !NAME_LIKE) {
  console.error("Pass --ids <608-619> or --name <like> (see header).");
  process.exit(1);
}

const log = (m) => console.log(APPLY ? `[apply] ${m}` : `[dry]   ${m}`);

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

// ---- resolve the files ------------------------------------------------------
const ids = [];
if (IDS_ARG) {
  for (const part of IDS_ARG.split(",")) {
    const [from, to] = part.split("-").map((n) => Number(n.trim()));
    if (to === undefined) ids.push(from);
    else for (let i = from; i <= to; i += 1) ids.push(i);
  }
}
const files = ids.length
  ? db
    .prepare(
      `SELECT id, name, url, folder_path FROM files WHERE id IN (${ids
        .map(() => "?")
        .join(",")})`,
    )
    .all(...ids)
  : db
    .prepare("SELECT id, name, url, folder_path FROM files WHERE name LIKE ?")
    .all(`%${NAME_LIKE}%`);

if (!files.length) {
  console.error("No files matched — nothing to do.");
  process.exit(1);
}
console.log(`Files (${files.length}):`);
for (const f of files) console.log(`  #${f.id} ${f.name} (folder ${f.folder_path ?? "-"})`);

// ---- folder (create or reuse) ----------------------------------------------
const template = db
  .prepare("SELECT * FROM upload_folders WHERE name = 'API Uploads'")
  .get();
const note = (name) => {
  const cols = db.prepare("PRAGMA table_info(upload_folders)").all().map((c) => c.name);
  const row = db.prepare("SELECT * FROM upload_folders WHERE name = ?").get(name);
  return row ? Object.fromEntries(cols.map((c) => [c, row[c]])) : null;
};
let folder = note(FOLDER_NAME);

if (!folder) {
  const { max } = db
    .prepare("SELECT MAX(path_id) AS max FROM upload_folders")
    .get();
  const pathId = (max ?? 0) + 1;
  const now = new Date().toISOString();
  log(
    `create folder "${FOLDER_NAME}" (pathId ${pathId}, path /${pathId})` +
    (template ? ` — modelled on "${template.name}"` : ""),
  );
  if (APPLY) {
    const info = db
      .prepare(
        `INSERT INTO upload_folders
           (document_id, name, path_id, path, created_at, updated_at, published_at,
            created_by_id, updated_by_id, locale)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        crypto.randomUUID(),
        FOLDER_NAME,
        pathId,
        `/${pathId}`,
        now,
        now,
        now,
        template?.created_by_id ?? null,
        template?.updated_by_id ?? null,
        template?.locale ?? null,
      );
    folder = note(FOLDER_NAME);
    console.log(`created folder #${info.lastInsertRowid} (${folder.document_id})`);
  } else {
    folder = { id: `(new)`, path: `/${pathId}` };
  }
} else {
  log(`reuse folder "${FOLDER_NAME}" (id ${folder.id}, path ${folder.path})`);
}

const folderId = APPLY ? folder.id : null;
const folderPath = folder.path;

// ---- move the files --------------------------------------------------------
const moveFile = db.prepare("UPDATE files SET folder_path = ?, updated_at = ? WHERE id = ?");
const upsertLink = db.prepare(
  "INSERT INTO files_folder_lnk (file_id, folder_id, file_ord) VALUES (?, ?, ?)",
);
const clearLinks = db.prepare("DELETE FROM files_folder_lnk WHERE file_id = ?");

const run = db.transaction(() => {
  files.forEach((file, index) => {
    log(`move #${file.id} ${file.name} → /${FOLDER_NAME}`);
    moveFile.run(folderPath, new Date().toISOString(), file.id);
    clearLinks.run(file.id);
    upsertLink.run(file.id, folderId, index + 1);
  });
});

if (APPLY) run();
else files.forEach((f) => log(`move #${f.id} ${f.name} → /${FOLDER_NAME}`));

db.close();
console.log(
  APPLY
    ? `\nMoved ${files.length} file(s) into "${FOLDER_NAME}". Start Strapi again.`
    : "\nDry run — nothing written. Re-run with --apply (Strapi stopped).",
);
