#!/usr/bin/env node

/*
 * Adds two more steps to the `process` collection and appends them to the
 * homepage "Process Steps" section, for both the draft and the published
 * version of the page.
 *
 * The section is a relation, and the frontend numbers the cards by relation
 * order (`pad2(index)`), so the link rows are rewritten in full — the existing
 * steps keep their order and the new ones land at the end.
 *
 * Usage (Strapi can stay running):
 *   node scripts/add-process-steps.mjs            # dry run, prints the plan
 *   node scripts/add-process-steps.mjs --apply    # writes (backs up the DB)
 */

import Database from "better-sqlite3";
import fs from "node:fs";

const DB_PATH = process.env.STRAPI_DB ?? ".tmp/data.db";
const APPLY = process.argv.includes("--apply");
const HOMEPAGE_SLUG = "index";
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

const STEPS = [
  {
    title: "Monitor",
    description:
      "<p>Continuous monitoring, alerting and reporting on live product metrics.</p>",
  },
  {
    title: "Evolve",
    description:
      "<p>Roadmap iteration as the product, its traffic and its team grow.</p>",
  },
];

const db = new Database(DB_PATH);
db.pragma("busy_timeout = 8000");

const randomId = () => {
  let out = "";
  for (let i = 0; i < 24; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
};

const stamp = () => new Date().toISOString();

const plan = [];
const note = (msg) => plan.push(msg);

const pages = db
  .prepare(
    "select id, published_at from pages where slug = ? order by published_at is null desc",
  )
  .all(HOMEPAGE_SLUG);

if (pages.length < 2) {
  throw new Error(
    `homepage ("${HOMEPAGE_SLUG}") needs a draft AND a published row — found ${pages.length}`,
  );
}

const draftPage = pages.find((p) => p.published_at === null);
const publishedPage = pages.find((p) => p.published_at !== null);

const ensureStep = (step) => {
  const existing = db
    .prepare("select id, published_at from processes where title = ?")
    .all(step.title);

  if (existing.length > 0) {
    const draft = existing.find((r) => r.published_at === null);
    const published = existing.find((r) => r.published_at !== null);
    note(`  = process "${step.title}" already exists`);
    if (!draft || !published) {
      throw new Error(
        `process "${step.title}" exists without a draft+published pair — fix it in the admin first`,
      );
    }
    return { title: step.title, draft: draft.id, published: published.id };
  }

  note(`  + process "${step.title}" — ${step.description}`);
  if (!APPLY) return { title: step.title, draft: null, published: null };

  const documentId = randomId();
  const ts = stamp();
  const insert = db.prepare(
    `insert into processes (document_id, title, description, created_at, updated_at, published_at, locale)
     values (?, ?, ?, ?, ?, ?, null)`,
  );
  const draftId = insert.run(
    documentId,
    step.title,
    step.description,
    ts,
    ts,
    null,
  ).lastInsertRowid;
  const publishedId = insert.run(
    documentId,
    step.title,
    step.description,
    ts,
    ts,
    new Date().toISOString(),
  ).lastInsertRowid;

  return { title: step.title, draft: draftId, published: publishedId };
};

const processSectionId = (pageId) => {
  const row = db
    .prepare(
      "select cmp_id from pages_cmps where entity_id = ? and component_type = 'sections.process' limit 1",
    )
    .get(pageId);
  if (!row) {
    throw new Error(`homepage #${pageId} has no "sections.process" section`);
  }
  return row.cmp_id;
};

const currentOrder = (sectionId) =>
  db
    .prepare(
      "select inv_process_id, process_ord from components_sections_processes_blocks_lnk where process_id = ? order by process_ord",
    )
    .all(sectionId);

const appendSteps = (version, page, steps) => {
  const sectionId = processSectionId(page.id);
  const existing = currentOrder(sectionId);
  const existingIds = new Set(existing.map((r) => r.inv_process_id));
  const wanted = steps.map((step) => step[version]);

  if (wanted.every((id) => existingIds.has(id))) {
    note(`  = homepage (${version}): section #${sectionId} already links both steps`);
    return;
  }

  const ordered = [...existing.map((r) => r.inv_process_id)];
  for (const id of wanted) {
    if (!ordered.includes(id)) ordered.push(id);
  }

  note(
    `  ${version}: homepage section #${sectionId} blocks ${ordered.join(", ")}`,
  );
  if (!APPLY) return;

  const statement = db.prepare(
    `insert into components_sections_processes_blocks_lnk (process_id, inv_process_id, process_ord)
     values (?, ?, ?)`,
  );
  const write = db.transaction((ids) => {
    db.prepare(
      "delete from components_sections_processes_blocks_lnk where process_id = ?",
    ).run(sectionId);
    ids.forEach((id, index) => statement.run(sectionId, id, index + 1));
  });
  write(ordered);
};

const main = () => {
  console.log(
    `add-process-steps — ${APPLY ? "APPLY" : "DRY RUN"} (${DB_PATH})`,
  );
  console.log(
    `homepage: draft #${draftPage.id} / published #${publishedPage.id}`,
  );

  console.log(`\nprocess steps (${STEPS.length} new)`);
  const created = STEPS.map(ensureStep);

  console.log("\nhomepage links");
  appendSteps(
    "draft",
    draftPage,
    created.map((s) => s.draft),
  );
  appendSteps(
    "published",
    publishedPage,
    created.map((s) => s.published),
  );

  if (!APPLY) {
    console.log("\n--- plan ---");
    for (const line of plan) console.log(line);
    console.log("\ndry run — re-run with --apply to write");
    return;
  }

  const total = db
    .prepare("select count(*) as n from processes where published_at is not null")
    .get();
  console.log(`\ndone — processes: ${total.n} published`);
};

if (APPLY) {
  const file = `${DB_PATH}.bak-process-steps-${stamp().replace(/[:.]/g, "-")}`;
  fs.copyFileSync(DB_PATH, file);
  console.log(`backup: ${file}`);
}

main();
db.close();
