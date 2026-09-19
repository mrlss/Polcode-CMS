#!/usr/bin/env node

/**
 * Move nested page slugs onto the `parent` relation.
 *
 * Pages used to carry their whole path in `slug` (`services/web-development`).
 * URL building now walks the `parent` chain instead, so this migration:
 *
 *   1. deletes the blank scaffolded `services/<service>` pages — the Services
 *      content type owns those URLs now (`--keep-pages` skips this);
 *   2. creates any missing ancestor page for a nested slug;
 *   3. rewrites each nested page to `slug = <last segment>` +
 *      `parent = <ancestor documentId>`;
 *   4. points every service / case study / insight without a parent at its hub
 *      page (Services, Case Studies, Resources).
 *
 * Idempotent: re-running finds nothing to do.
 *
 * Usage (Strapi RUNNING, from the strapi project root):
 *   node scripts/migrate-page-parents.mjs [--dry-run] [--keep-pages]
 *
 * Token: STRAPI_ACCESS_TOKEN, else ../frontend/.env.
 */
import fs from "node:fs";
import path from "node:path";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";
const DRY_RUN = process.argv.includes("--dry-run");
const KEEP_PAGES = process.argv.includes("--keep-pages");

/** Content types that hang off a hub page. */
const COLLECTIONS = [
  { gql: "services", endpoint: "services", hub: "services" },
  { gql: "caseStudies", endpoint: "case-studies", hub: "case-studies" },
  { gql: "insights", endpoint: "insights", hub: "resources" },
];

function readToken() {
  if (process.env.STRAPI_ACCESS_TOKEN) return process.env.STRAPI_ACCESS_TOKEN;
  const envPath = path.resolve("../frontend/.env");
  if (fs.existsSync(envPath)) {
    const match = fs
      .readFileSync(envPath, "utf8")
      .match(/^STRAPI_ACCESS_TOKEN=(.*)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("STRAPI_ACCESS_TOKEN not set (env var or ../frontend/.env)");
}

const token = readToken();

async function api(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw text */
  }
  if (!res.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${url} → ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)
      }`,
    );
  }
  return body;
}

async function graphql(query) {
  const body = await api(`${STRAPI_URL}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (body?.errors?.length) {
    throw new Error(`GraphQL: ${JSON.stringify(body.errors)}`);
  }
  return body.data;
}

const humanize = (segment) =>
  segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const { pages, ...collections } = await graphql(`
  {
    pages(status: DRAFT, pagination: { limit: -1 }) {
      documentId
      title
      slug
      parent { documentId }
      sections { __typename }
    }
    services(status: DRAFT, pagination: { limit: -1 }) {
      documentId
      slug
      title
      parent { documentId }
    }
    caseStudies(status: DRAFT, pagination: { limit: -1 }) {
      documentId
      slug
      title
      parent { documentId }
    }
    insights(status: DRAFT, pagination: { limit: -1 }) {
      documentId
      slug
      title
      parent { documentId }
    }
  }
`);

const byPath = new Map(pages.map((page) => [page.slug, page]));
const nested = pages.filter((page) => page.slug.includes("/"));

/* Resolved public path — walks `parent` so pages already migrated to a leaf
   slug + parent are seen as nested too. */
const byDocumentId = new Map(pages.map((page) => [page.documentId, page]));
const resolvedPath = (page, seen = new Set()) => {
  const parentId = page.parent?.documentId;
  const parent = parentId ? byDocumentId.get(parentId) : null;
  if (!parent || seen.has(page.documentId)) return page.slug;
  seen.add(page.documentId);
  return `${resolvedPath(parent, seen)}/${page.slug}`.replace(/^\//, "");
};

console.log(
  `${pages.length} pages (${nested.length} with a nested slug)${DRY_RUN ? " — DRY RUN" : ""
  }\n`,
);

/* 1 — blank scaffolded service pages are superseded by the Services type. */
const serviceSlugs = new Set(
  (collections.services ?? []).map((service) => service.slug),
);
const superseded = pages.filter((page) => {
  if ((page.sections ?? []).length) return false;
  const path = resolvedPath(page);
  return (
    path.startsWith("services/") &&
    serviceSlugs.has(path.slice("services/".length))
  );
});

if (!KEEP_PAGES) {
  for (const page of superseded) {
    console.log(
      `${DRY_RUN ? "would delete" : "deleting"} blank page '${page.slug}' (${page.documentId
      }) — the service owns this URL`,
    );
    if (!DRY_RUN) await api(`${STRAPI_URL}/api/pages/${page.documentId}`, {
      method: "DELETE",
    });
  }
} else if (superseded.length) {
  console.log(
    `keeping ${superseded.length} blank service page(s) (--keep-pages): they shadow the service detail route\n`,
  );
}

const removed = new Set(superseded.map((page) => page.documentId));
for (const page of superseded) byPath.delete(page.slug);
/* 2 + 3 — ancestors, then leaf slug + parent link. */
const ensureAncestor = async (segments) => {
  const target = segments.join("/");
  const existing = byPath.get(target);
  if (existing) return existing.documentId;

  const title = humanize(segments[segments.length - 1]);
  const parent = segments.length > 1 ? await ensureAncestor(segments.slice(0, -1)) : null;
  console.log(
    `${DRY_RUN ? "would create" : "creating"} ancestor page '${target}' ('${title}')`,
  );
  if (DRY_RUN) return `dry-run:${target}`;

  const created = await api(`${STRAPI_URL}/api/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: {
        title,
        slug: segments[segments.length - 1],
        ...(parent ? { parent: { connect: [{ documentId: parent }] } } : {}),
      },
    }),
  });
  const page = {
    documentId: created.data.documentId,
    title,
    slug: segments[segments.length - 1],
  };
  byPath.set(target, page);
  return page.documentId;
};

for (const page of nested) {
  if (removed.has(page.documentId)) continue;

  const segments = page.slug.split("/");
  const leaf = segments[segments.length - 1];
  const parentDocumentId = await ensureAncestor(segments.slice(0, -1));

  console.log(
    `${DRY_RUN ? "would move" : "moving"} '${page.slug}' → '${leaf}' under '${segments.slice(0, -1).join("/")
    }'`,
  );
  if (DRY_RUN) continue;

  await api(`${STRAPI_URL}/api/pages/${page.documentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: {
        slug: leaf,
        parent: { connect: [{ documentId: parentDocumentId }] },
      },
    }),
  });
}

/* 4 — every content-type entry hangs off its hub page. */
for (const { gql, endpoint, hub } of COLLECTIONS) {
  const rows = collections[gql] ?? [];
  const orphans = rows.filter((row) => !row.parent?.documentId);
  const hubPage = byPath.get(hub);

  if (!hubPage) {
    console.log(`no '${hub}' page found — skipping ${rows.length} ${endpoint}`);
    continue;
  }
  if (!orphans.length) {
    console.log(`${endpoint}: all ${rows.length} already have a parent`);
    continue;
  }

  console.log(
    `${DRY_RUN ? "would link" : "linking"} ${orphans.length}/${rows.length
    } ${endpoint} to '${hub}'`,
  );
  if (DRY_RUN) continue;

  for (const row of orphans) {
    await api(`${STRAPI_URL}/api/${endpoint}/${row.documentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: { parent: { connect: [{ documentId: hubPage.documentId }] } },
      }),
    });
  }
}

console.log(`\ndone${DRY_RUN ? " (dry run — nothing written)" : ""}`);
