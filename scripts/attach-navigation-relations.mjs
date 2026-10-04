#!/usr/bin/env node

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const CLOUD_URL =
  process.env.CLOUD_CMS_URL ?? "https://original-desk-e673ad0b47.strapiapp.com";
const APPLY = process.argv.includes("--apply");
const NAV_ARG = process.argv.find((arg) => arg.startsWith("--navs="));
const NAV_SLUGS = (
  NAV_ARG
    ? NAV_ARG.slice("--navs=".length)
    : "header,footer-services,footer-industries"
)
  .split(",")
  .map((slug) => slug.trim())
  .filter(Boolean);

const RELATED_SOURCES = {
  "api::service.service": { table: "services" },
  "api::industry.industry": { table: "industries" },
  "api::page.page": { table: "pages" },
};

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.error(
    [
      "Usage: node scripts/attach-navigation-relations.mjs [--apply] [--navs=a,b]",
      "",
      "Re-attaches the source entities of the local navigation items on a remote",
      "CMS (a transfer moves the items but not their `related` morph links).",
      "Targets are matched by slug through the navigation admin API; nothing is",
      "deleted. Dry run unless --apply.",
      "",
      "Tokens: CLOUD_ADMIN_TOKEN (else the commented STRAPI_ADMIN_TOKEN in .env)",
      "and CLOUD_API_TOKEN (else STRAPI_ACCESS_TOKEN in ../frontend/.env).",
    ].join("\n"),
  );
  process.exit(0);
}

const envValue = (file, pattern) => {
  if (!fs.existsSync(file)) return null;
  const match = fs.readFileSync(file, "utf8").match(pattern);
  return match ? match[1].trim() : null;
};

const adminToken =
  process.env.CLOUD_ADMIN_TOKEN ??
  envValue(".env", /^CLOUD_ADMIN_TOKEN=(.*)$/m) ??
  envValue(".env", /^#\s*STRAPI_ADMIN_TOKEN=(.*)$/m);
const apiToken =
  process.env.CLOUD_API_TOKEN ??
  envValue("../frontend/.env", /^STRAPI_ACCESS_TOKEN=(.*)$/m);

if (!adminToken || !apiToken) {
  console.error("Missing CLOUD_ADMIN_TOKEN or CLOUD_API_TOKEN.");
  process.exit(1);
}

const dbPath = path.resolve(process.env.STRAPI_DB ?? ".tmp/data.db");
if (!fs.existsSync(dbPath)) {
  console.error(`DB not found at ${dbPath} — run from the strapi project root.`);
  process.exit(1);
}

const log = (message) =>
  console.log(APPLY ? `[apply] ${message}` : `[dry]   ${message}`);
const db = new Database(dbPath, { readonly: true });
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
  .all()
  .map((row) => row.name);

const localRelations = new Map();

if (tables.includes("navigations_items_related_mph")) {
  const rows = db
    .prepare(
      `SELECT i.ui_router_key AS key, m.related_type AS type, m.related_id AS rowId
       FROM navigations_items_related_mph m
       JOIN navigations_items i ON i.id = m.navigation_item_id
       WHERE m.related_type IS NOT NULL`,
    )
    .all();

  for (const row of rows) {
    const source = RELATED_SOURCES[row.type];
    if (!source || !row.key) continue;
    const target = db
      .prepare(`SELECT slug FROM ${source.table} WHERE id = ?`)
      .get(row.rowId);
    if (target?.slug) {
      localRelations.set(row.key, { type: row.type, slug: target.slug });
    }
  }
}

log(`local navigation items with a source: ${localRelations.size}`);
if (localRelations.size === 0) {
  console.error("Nothing to attach — no related rows in the local database.");
  process.exit(1);
}

const cloudGraphql = async (query) => {
  const response = await fetch(`${CLOUD_URL}/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ query }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.errors) {
    throw new Error(
      `GraphQL ${response.status}: ${JSON.stringify(body?.errors ?? body).slice(0, 300)}`,
    );
  }
  return body.data;
};

const fields = "documentId slug";
const data = await cloudGraphql(`query {
  services(pagination: { limit: -1 }) { ${fields} }
  industries(pagination: { limit: -1 }) { ${fields} }
  pages(pagination: { limit: -1 }) { ${fields} }
}`);

const cloudDocumentId = {
  "api::service.service": new Map(),
  "api::industry.industry": new Map(),
  "api::page.page": new Map(),
};

for (const row of data.services ?? []) {
  cloudDocumentId["api::service.service"].set(row.slug, row.documentId);
}
for (const row of data.industries ?? []) {
  cloudDocumentId["api::industry.industry"].set(row.slug, row.documentId);
}
for (const row of data.pages ?? []) {
  cloudDocumentId["api::page.page"].set(row.slug, row.documentId);
}

const adminFetch = async (method, suffix, body) => {
  const response = await fetch(`${CLOUD_URL}${suffix}`, {
    method,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let parsed = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* keep the raw body */
  }
  return { status: response.status, body: parsed };
};

const probe = await adminFetch("GET", "/navigation");
if (probe.status !== 200) {
  console.error(
    `Cloud navigation admin API not reachable (HTTP ${probe.status}) — the token needs access to the navigation plugin.`,
  );
  process.exit(1);
}

const list = Array.isArray(probe.body)
  ? probe.body
  : (probe.body?.data ?? []);
const bySlug = new Map(list.map((nav) => [nav.slug, nav]));

const walk = (items, visit) => {
  for (const item of items ?? []) {
    visit(item);
    walk(item.items, visit);
  }
};

const pending = [];

for (const slug of NAV_SLUGS) {
  const nav = bySlug.get(slug);
  if (!nav) {
    log(`cloud navigation '${slug}' not found — skip`);
    continue;
  }

  const changed = [];
  walk(nav.items, (item) => {
    const local = localRelations.get(item.uiRouterKey);
    if (!local) return;

    const documentId = cloudDocumentId[local.type]?.get(local.slug);
    if (!documentId) {
      changed.push({
        problem: `${local.type} /${local.slug} is missing on the cloud`,
      });
      return;
    }

    const current = item.related?.documentId ?? item.relatedDocumentId ?? null;
    if (current === documentId && item.autoSync === false) return;

    item.related = { __type: local.type, documentId };
    item.autoSync = false;
    item.updated = true;
    changed.push({ item, type: local.type, slug: local.slug });
  });

  if (changed.length === 0) {
    log(`cloud navigation '${slug}': already complete`);
    continue;
  }

  for (const entry of changed) {
    if (entry.problem) {
      log(`  ! ${entry.problem}`);
      continue;
    }
    log(
      `  ${slug}  ${String(entry.item.title).padEnd(34)} -> ${entry.type} /${entry.slug}`,
    );
  }

  pending.push({ nav, changed: changed.filter((entry) => !entry.problem) });
}

if (pending.length === 0) {
  log("nothing to attach");
  process.exit(0);
}

const total = pending.reduce((sum, entry) => sum + entry.changed.length, 0);

if (!APPLY) {
  log(`${total} item(s) would be attached — re-run with --apply`);
  process.exit(0);
}

for (const { nav, changed } of pending) {
  const result = await adminFetch("PUT", `/navigation/${nav.documentId}`, {
    id: nav.id,
    documentId: nav.documentId,
    locale: nav.locale ?? "en",
    name: nav.name,
    visible: nav.visible ?? true,
    items: nav.items,
  });

  if (result.status !== 200) {
    console.error(
      `PUT ${nav.slug} failed (HTTP ${result.status}): ${JSON.stringify(result.body).slice(0, 300)}`,
    );
    continue;
  }
  log(`cloud navigation '${nav.slug}': ${changed.length} item(s) attached`);
}

const verify = await adminFetch("GET", "/navigation");
const verifyList = Array.isArray(verify.body)
  ? verify.body
  : (verify.body?.data ?? []);
let attached = 0;
let expected = 0;
for (const nav of verifyList) {
  walk(nav.items, (item) => {
    if (!localRelations.has(item.uiRouterKey)) return;
    expected += 1;
    if (item.related?.documentId) attached += 1;
  });
}
log(`verified: ${attached}/${expected} navigation items carry a source`);
