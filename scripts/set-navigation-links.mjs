#!/usr/bin/env node

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.STRAPI_DB ?? ".tmp/data.db";
const APPLY = process.argv.includes("--apply");
const LINK_PARENTS = process.argv.includes("--link-parents");
const RELATE = process.argv.includes("--relate");
const NAV_SLUGS = ["header", "footer-services", "footer-industries"];
const CASES_FILTER_PARAM = "cases_industries";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.error(
    [
      "Usage: node scripts/set-navigation-links.mjs [--apply] [--link-parents] [--relate]",
      "",
      "Derives the links of the header, footer-services and footer-industries",
      "navigations from the CMS records (parent page + slug, hub page + filter)",
      "and writes them onto the navigation items. Dry run unless --apply.",
      "--link-parents also points entries with no hub page at the hub.",
      "--relate links every service/industry item to its source entity (the",
      "navigation plugin's `related` morph) and turns auto-sync off for it, so",
      "the plugin never overwrites the derived path. Page items are linked to",
      "their page the same way.",
      "Stop Strapi before --apply (sqlite journal_mode=delete).",
    ].join("\n"),
  );
  process.exit(0);
}

const dbPath = path.resolve(DB_PATH);
if (!fs.existsSync(dbPath)) {
  console.error(`DB not found at ${dbPath} — run from the strapi project root.`);
  process.exit(1);
}

const log = (message) =>
  console.log(APPLY ? `[apply] ${message}` : `[dry]   ${message}`);
const slugify = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
  .all()
  .map((row) => row.name);

for (const required of [
  "navigations",
  "navigations_items",
  "pages",
  "services",
  "industries",
]) {
  if (!tables.includes(required)) {
    console.error(`table '${required}' not found.`);
    process.exit(1);
  }
}

const columnsOf = (table) =>
  db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((column) => column.name);

const linkColumnsOf = (linkTable) => {
  const idColumns = columnsOf(linkTable).filter(
    (column) => column !== "id" && column.endsWith("_id"),
  );
  const target =
    idColumns.find(
      (column) => column.startsWith("inv_") || column === "page_id",
    ) ?? idColumns[1];
  return { owner: idColumns.find((column) => column !== target), target };
};

const linkPairs = (linkTable) => {
  const pairs = [];
  if (!tables.includes(linkTable)) return pairs;
  const { owner, target } = linkColumnsOf(linkTable);
  if (!owner || !target) return pairs;
  for (const row of db.prepare(`SELECT * FROM ${linkTable}`).all()) {
    pairs.push([row[owner], row[target]]);
  }
  return pairs;
};

const linkToHub = (table, linkTable) => {
  const { owner, target } = linkColumnsOf(linkTable);
  if (!owner || !target) return 0;

  const pageRows = db
    .prepare("SELECT id, slug, published_at FROM pages")
    .all();
  const hubSlug =
    db
      .prepare(
        `SELECT p.slug AS slug FROM ${linkTable} l JOIN pages p ON p.id = l.${target} WHERE l.${target} IS NOT NULL LIMIT 1`,
      )
      .get()?.slug ?? null;
  if (!hubSlug) return 0;

  const pageIdFor = (status) =>
    pageRows.find(
      (page) => page.slug === hubSlug && (page.published_at ? 1 : 0) === status,
    )?.id ?? null;
  const statusById = new Map(
    pageRows.map((page) => [page.id, page.published_at ? 1 : 0]),
  );

  const existing = new Map();
  for (const link of db
    .prepare(
      `SELECT id, ${owner} AS owner, ${target} AS target FROM ${linkTable} WHERE ${target} IS NOT NULL`,
    )
    .all()) {
    const rows = existing.get(link.owner) ?? [];
    rows.push(link);
    existing.set(link.owner, rows);
  }
  const insert = db.prepare(
    `INSERT INTO ${linkTable} (${owner}, ${target}) VALUES (?, ?)`,
  );
  const update = db.prepare(
    `UPDATE ${linkTable} SET ${target} = ? WHERE id = ?`,
  );
  const remove = db.prepare(`DELETE FROM ${linkTable} WHERE id = ?`);

  let changed = 0;
  for (const row of db
    .prepare(`SELECT id, published_at FROM ${table}`)
    .all()) {
    const status = row.published_at ? 1 : 0;
    const desired = pageIdFor(status);
    if (!desired) continue;

    const links = existing.get(row.id) ?? [];
    const correct = links.filter((link) => link.target === desired);
    const wrong = links.filter((link) => link.target !== desired);
    if (correct.length === 1 && wrong.length === 0) continue;

    if (correct.length > 0) {
      for (const link of wrong) remove.run(link.id);
      for (const link of correct.slice(1)) remove.run(link.id);
    } else {
      const [first, ...rest] = wrong;
      update.run(desired, first.id);
      for (const link of rest) remove.run(link.id);
    }
    changed += 1;
  }

  return changed;
};

const rowsOf = (table) =>
  db.prepare(`SELECT id, slug, title FROM ${table}`).all();

const pageSlugById = new Map(
  db
    .prepare("SELECT id, slug FROM pages")
    .all()
    .map((page) => [page.id, page.slug]),
);

const pagePath = (slug) => (!slug || slug === "index" ? "/" : `/${slug}`);
const entryPath = (parentSlug, slug) =>
  parentSlug && parentSlug !== "index" ? `/${parentSlug}/${slug}` : `/${slug}`;

const serviceRows = rowsOf("services");
const industryRows = rowsOf("industries");

let servicePaths = new Map();
let casesHubPath = pagePath(null);

const resolvePaths = () => {
  servicePaths = new Map();
  const parentByRow = new Map(linkPairs("services_parent_lnk"));
  for (const service of serviceRows) {
    if (!service.slug) continue;
    const parentSlug = pageSlugById.get(parentByRow.get(service.id)) ?? null;
    const known = servicePaths.get(service.slug);
    if (!known || (known === `/${service.slug}` && parentSlug)) {
      servicePaths.set(service.slug, entryPath(parentSlug, service.slug));
    }
  }

  const caseStudyHubSlug =
    linkPairs("case_studies_parent_lnk")
      .map(([, pageId]) => pageSlugById.get(pageId))
      .find(Boolean) ?? null;
  casesHubPath = pagePath(caseStudyHubSlug);
};

resolvePaths();

const pageSlugByPath = new Map(
  db
    .prepare("SELECT slug FROM pages")
    .all()
    .map((page) => [page.slug === "index" ? "/" : `/${page.slug}`, page.slug]),
);

const bySlug = (list, slug) => list.find((row) => row.slug === slug) ?? null;
const byTitle = (list, title) => {
  const lower = String(title ?? "").toLowerCase();
  return (
    list.find((row) => row.title === title) ??
    list.find((row) => String(row.title).toLowerCase() === lower) ??
    bySlug(list, slugify(title))
  );
};

const navs = db
  .prepare(
    `SELECT * FROM navigations WHERE slug IN (${NAV_SLUGS.map(() => "?").join(", ")})`,
  )
  .all(...NAV_SLUGS);

if (navs.length === 0) {
  console.error(`No navigations found for: ${NAV_SLUGS.join(", ")}`);
  process.exit(1);
}

const items = db.prepare("SELECT * FROM navigations_items").all();
const itemById = new Map(items.map((item) => [item.id, item]));
const navIdByItem = new Map(linkPairs("navigations_items_master_lnk"));
const parentIdByItem = new Map(linkPairs("navigations_items_parent_lnk"));
const childrenOf = (id) => items.filter((item) => parentIdByItem.get(item.id) === id);
const descendants = (root) => {
  const out = [root];
  for (const child of childrenOf(root.id)) out.push(...descendants(child));
  return out;
};

const scopeOf = (slug) =>
  slug === "footer-services"
    ? "service"
    : slug === "footer-industries"
      ? "industry"
      : "auto";

const lastSegment = (value) =>
  value
    ? (value.replace(/[?#].*$/, "").split("/").filter(Boolean).pop() ?? null)
    : null;

const targetOf = (item, scope) => {
  const current = item.path ?? "";
  const segment = lastSegment(current);
  const service =
    byTitle(serviceRows, item.title) ??
    (servicePaths.has(segment) ? bySlug(serviceRows, segment) : null);
  const industry =
    byTitle(industryRows, item.title) ??
    (bySlug(industryRows, segment) ? bySlug(industryRows, segment) : null);

  const isServiceScope = scope === "service";
  const isIndustryScope = scope === "industry";
  const looksLikeService =
    current.startsWith("/services") || servicePaths.has(segment);
  const looksLikeIndustry =
    current.startsWith("/#industries") ||
    current.startsWith("/industries") ||
    current.includes(CASES_FILTER_PARAM);

  if ((isServiceScope || (scope === "auto" && looksLikeService)) && service) {
    const path = servicePaths.get(service.slug);
    if (path) return { kind: "service", slug: service.slug, path };
  }

  if ((isIndustryScope || (scope === "auto" && looksLikeIndustry)) && industry) {
    return {
      kind: "industry",
      slug: industry.slug,
      path: `${casesHubPath}?${CASES_FILTER_PARAM}=${industry.slug}`,
    };
  }

  return null;
};

const navItemsOf = (nav) => {
  const owned = items.filter((item) => navIdByItem.get(item.id) === nav.id);
  const ownedIds = new Set(owned.map((item) => item.id));
  const roots = owned.filter(
    (item) => !ownedIds.has(parentIdByItem.get(item.id)),
  );
  return (roots.length ? roots : owned).flatMap((root) => descendants(root));
};

const looksLikeDetail = (value) =>
  /^\/(services|industries)\//.test(value) || value.startsWith("/#industries");

const collectChanges = () => {
  const found = [];

  for (const nav of navs) {
    const scope = scopeOf(nav.slug);
    const navItems = navItemsOf(nav);

    log(
      `navigation '${nav.slug}' (${nav.document_id ?? nav.id}) — ${navItems.length} items`,
    );

    for (const item of navItems) {
      if (item.type !== "INTERNAL") continue;
      const target = targetOf(item, scope);
      if (!target || target.path === item.path) {
        if (!target && looksLikeDetail(item.path ?? "")) {
          log(`  unmatched: ${item.title} (${item.path})`);
        }
        continue;
      }
      found.push({ nav: nav.slug, item, path: target.path, kind: target.kind, slug: target.slug });
    }
  }

  return found;
};

const collectMatches = () => {
  const found = [];

  for (const nav of navs) {
    const scope = scopeOf(nav.slug);
    for (const item of navItemsOf(nav)) {
      if (item.type !== "INTERNAL") continue;
      const target = targetOf(item, scope);
      if (target) {
        found.push({ item, kind: target.kind, slug: target.slug });
        continue;
      }
      const pageSlug = pageSlugByPath.get(item.path ?? "");
      if (pageSlug) found.push({ item, kind: "page", slug: pageSlug });
    }
  }

  return found;
};

const RELATED_TYPES = {
  service: "api::service.service",
  industry: "api::industry.industry",
  page: "api::page.page",
};

const RELATED_TABLES = {
  service: "services",
  industry: "industries",
  page: "pages",
};

const relateMatches = () => {
  const morphTable = "navigations_items_related_mph";
  if (!tables.includes(morphTable)) return 0;

  const rowIdOf = (table, slug) =>
    db
      .prepare(
        `SELECT id FROM ${table} WHERE slug = ? AND published_at IS NOT NULL`,
      )
      .get(slug)?.id ??
    db.prepare(`SELECT id FROM ${table} WHERE slug = ?`).get(slug)?.id ??
    null;
  const existing = db.prepare(
    `SELECT id FROM ${morphTable} WHERE navigation_item_id = ? AND field = 'related'`,
  );
  const insert = db.prepare(
    `INSERT INTO ${morphTable} (navigation_item_id, related_id, related_type, field, "order") VALUES (?, ?, ?, 'related', 1)`,
  );
  const update = db.prepare(
    `UPDATE ${morphTable} SET related_id = ?, related_type = ? WHERE id = ?`,
  );
  const stopSync = db.prepare(
    "UPDATE navigations_items SET auto_sync = 0 WHERE id = ?",
  );

  let linked = 0;
  for (const match of collectMatches()) {
    const rowId = rowIdOf(RELATED_TABLES[match.kind], match.slug);
    if (!rowId) continue;
    const type = RELATED_TYPES[match.kind];
    const known = existing.get(match.item.id);
    if (known) update.run(rowId, type, known.id);
    else insert.run(match.item.id, rowId, type);
    stopSync.run(match.item.id);
    linked += 1;
  }

  return linked;
};

const printChanges = (list) => {
  for (const change of list) {
    console.log(
      `  ${change.nav.padEnd(17)} ${String(change.item.title).padEnd(38)} ${change.item.path || "(empty)"
      } -> ${change.path}`,
    );
  }
};

let changes = collectChanges();

if (!APPLY) {
  printChanges(changes);
  log(`${changes.length} item(s) would change — re-run with --apply to write`);
  db.close();
  process.exit(0);
}

const backup = `${dbPath}.bak-nav-links-${new Date()
  .toISOString()
  .replace(/[:.]/g, "-")}`;
fs.copyFileSync(dbPath, backup);
log(`backup written to ${backup}`);

if (LINK_PARENTS) {
  const linkedServices = linkToHub("services", "services_parent_lnk");
  const linkedCases = linkToHub("case_studies", "case_studies_parent_lnk");
  const linkedInsights = linkToHub("insights", "insights_parent_lnk");
  log(
    `hub parents linked: ${linkedServices} service row(s), ${linkedCases} case-study row(s), ${linkedInsights} insight row(s)`,
  );
  if (linkedServices || linkedCases || linkedInsights) {
    resolvePaths();
    changes = collectChanges();
  }
}

if (RELATE) {
  log(`related sources linked: ${relateMatches()} item(s)`);
}

if (changes.length === 0) {
  log("nothing to change");
  db.close();
  process.exit(0);
}

printChanges(changes);

const setsUpdatedAt = columnsOf("navigations_items").includes("updated_at")
  ? ", updated_at = ?"
  : "";
const update = db.prepare(
  `UPDATE navigations_items SET path = ?${setsUpdatedAt} WHERE id = ?`,
);
const now = new Date().toISOString();

db.transaction(() => {
  for (const change of changes) {
    if (setsUpdatedAt) update.run(change.path, now, change.item.id);
    else update.run(change.path, change.item.id);
  }
})();

log(`${changes.length} item(s) updated`);
db.close();
