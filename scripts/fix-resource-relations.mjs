#!/usr/bin/env node

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";
const DB_PATH = process.env.STRAPI_DB ?? ".tmp/data.db";
const DRY_RUN = process.argv.includes("--dry-run");

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

const json = (method, data) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ data }),
});

const qs = (params) =>
  Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

async function listAll(collection, status, query = {}) {
  const rows = [];
  let page = 1;
  for (; ;) {
    const res = await api(
      `${STRAPI_URL}/api/${collection}?${qs({
        status,
        "pagination[pageSize]": 100,
        "pagination[page]": page,
        ...query,
      })}`,
    );
    rows.push(...res.data);
    const info = res.meta?.pagination;
    if (!info || page >= info.pageCount) break;
    page += 1;
  }
  return rows;
}

async function versionMap(collection, idField) {
  const map = new Map();
  for (const status of ["draft", "published"]) {
    for (const row of await listAll(collection, status, {
      "fields[0]": "documentId",
      "fields[1]": idField,
    })) {
      map.set(row[idField], {
        ...(map.get(row[idField]) ?? {}),
        [status]: row,
      });
    }
  }
  return map;
}

const AUDIENCE_SLUGS = {
  decisionMakers: "for-decision-makers",
  developers: "for-developers",
  candidates: "for-candidates",
  customerStories: "customer-stories",
};

/*
 * The demo insights that come from `src/seed-content.ts` were created before
 * the resource taxonomy existed and were later re-written field-by-field by a
 * one-off migration, so their audience / tags / read time / media are gone.
 * This is the intended taxonomy for them — every other insight already has a
 * complete published version to copy from.
 */
const CONTENT_INSIGHTS = [
  {
    title: "Five lessons from 2026",
    audience: AUDIENCE_SLUGS.decisionMakers,
    tags: ["Software Delivery", "Engineering Culture"],
    readDuration: "6 min read",
    author: "Anna Kowalska",
  },
  {
    title: "Scaling teams without chaos",
    audience: AUDIENCE_SLUGS.decisionMakers,
    tags: ["Team Augmentation", "Engineering Culture"],
    readDuration: "4 min read",
    author: "Julia Zielińska",
  },
  {
    title: "The real cost of technical debt",
    audience: AUDIENCE_SLUGS.decisionMakers,
    tags: ["Legacy Modernization", "Software Architecture"],
    readDuration: "8 min read",
    author: "Marek Nowak",
  },
  {
    title: "Designing for performance",
    audience: AUDIENCE_SLUGS.developers,
    tags: ["Performance & Scalability", "UX & Accessibility"],
    readDuration: "6 min read",
    author: "Anna Kowalska",
  },
  {
    title: "The future of headless CMS",
    audience: AUDIENCE_SLUGS.decisionMakers,
    tags: ["Software Architecture", "APIs & Integrations"],
    readDuration: "5 min read",
    author: "Marek Nowak",
  },
  {
    title: "Hiring senior engineers",
    audience: AUDIENCE_SLUGS.candidates,
    tags: ["Careers", "Engineering Culture"],
    readDuration: "7 min read",
    author: "Julia Zielińska",
  },
];

const audiences = await versionMap("primary-audiences", "slug");
const resourceTypes = await versionMap("resource-types", "slug");
const tags = await versionMap("tags", "title");
const authors = await versionMap("authors", "fullName");

const mediaFiles = (
  await api(`${STRAPI_URL}/api/upload/files?pagination[pageSize]=5`)
).filter((file) => file.mime?.startsWith("image/"));
const fallbackMedia = mediaFiles[0]?.id ?? null;

console.log("=== 1. Fill the taxonomy of the content-seeded insights\n");

const insights = await versionMap("insights", "title");

for (const want of CONTENT_INSIGHTS) {
  const entry = insights.get(want.title);
  if (!entry?.draft || !entry?.published) {
    console.log(`  · "${want.title}" — skipped (no draft+published pair)`);
    continue;
  }

  const audience = audiences.get(want.audience);
  const type = resourceTypes.get("article");
  const author = authors.get(want.author);
  const tagRows = want.tags.map((title) => tags.get(title)).filter(Boolean);
  if (!audience || !type) throw new Error(`missing taxonomy row for "${want.title}"`);

  const changes = {};

  for (const status of ["draft", "published"]) {
    const current = (
      await api(
        `${STRAPI_URL}/api/insights/${entry[status].documentId}?${qs({
          status,
          populate: "*",
        })}`,
      )
    ).data;

    const missing = [];
    if (!current.audience) missing.push("audience");
    if (!current.resourceType) missing.push("resourceType");
    if (!(current.tags ?? []).length) missing.push("tags");
    if (!current.author) missing.push("author");
    if (!current.readDuration) missing.push("readDuration");
    if (!current.featuredMedia) missing.push("featuredMedia");
    if (!missing.length) continue;

    const data = {
      title: current.title,
      slug: current.slug,
      description: current.description,
      isFeatured: current.isFeatured,
      readDuration: current.readDuration ?? want.readDuration,
      audience: audience[status].id,
      resourceType: type[status].id,
      tags: tagRows.map((row) => row[status].id),
      author: author?.[status]?.id,
      featuredMedia: current.featuredMedia?.id ?? fallbackMedia,
    };

    if (!DRY_RUN) {
      await api(
        `${STRAPI_URL}/api/insights/${entry[status].documentId}?status=${status}`,
        json("PUT", data),
      );
    }
    changes[status] = missing.join(", ");
  }

  console.log(
    Object.keys(changes).length
      ? `  ${DRY_RUN ? "would fill" : "filled"} "${want.title}": ${Object.entries(
        changes,
      )
        .map(([status, fields]) => `${status} → ${fields}`)
        .join(" | ")}`
      : `  ✓ "${want.title}"`,
  );
}

console.log("\n=== 2. Point every relation link at the row of its own version\n");

const db = new Database(DB_PATH);
db.pragma("busy_timeout = 10000");

const LINK_TABLES = [
  {
    table: "insights_audience_lnk",
    source: "insights",
    sourceCol: "insight_id",
    target: "audiences",
    targetCol: "primary_audience_id",
  },
  {
    table: "insights_resource_type_lnk",
    source: "insights",
    sourceCol: "insight_id",
    target: "resource_types",
    targetCol: "resource_type_id",
  },
  {
    table: "insights_tags_lnk",
    source: "insights",
    sourceCol: "insight_id",
    target: "tags",
    targetCol: "tag_id",
  },
  {
    table: "insights_author_lnk",
    source: "insights",
    sourceCol: "insight_id",
    target: "authors",
    targetCol: "author_id",
  },
  {
    table: "components_sections_insight_lists_audience_lnk",
    source: "components_sections_insight_lists",
    sourceCol: "insight_list_id",
    target: "audiences",
    targetCol: "primary_audience_id",
  },
  {
    table: "components_sections_insight_lists_resource_type_lnk",
    source: "components_sections_insight_lists",
    sourceCol: "insight_list_id",
    target: "resource_types",
    targetCol: "resource_type_id",
  },
];

const tableExists = (name) =>
  Boolean(
    db
      .prepare("select 1 from sqlite_master where type='table' and name=?")
      .get(name),
  );

const versionRows = (table) => {
  const map = new Map();
  for (const row of db
    .prepare(`select id, document_id, published_at from ${table}`)
    .all()) {
    const entry = map.get(row.document_id) ?? {};
    entry[row.published_at == null ? "draft" : "published"] = row.id;
    map.set(row.document_id, entry);
  }
  return map;
};

const targets = new Map(
  [...new Set(LINK_TABLES.map((spec) => spec.target))].map((table) => [
    table,
    versionRows(table),
  ]),
);

const insightVersions = db
  .prepare("select id, published_at from insights")
  .all()
  .reduce((acc, row) => acc.set(row.id, row.published_at != null), new Map());

const componentVersions = db
  .prepare(
    `select c.cmp_id as id,
            sum(case when p.published_at is null then 1 else 0 end) as drafts
       from pages_cmps c join pages p on p.id = c.entity_id
      where c.component_type = 'sections.insight-list'
      group by c.cmp_id`,
  )
  .all()
  .reduce(
    (acc, row) => acc.set(row.id, row.drafts === 0),
    new Map(),
  );

const isPublishedSource = (spec, id) =>
  spec.source === "insights"
    ? insightVersions.get(id) === true
    : componentVersions.get(id) === true;

const documentOf = new Map();
for (const spec of LINK_TABLES) {
  if (documentOf.has(spec.target)) continue;
  const map = new Map();
  for (const row of db
    .prepare(`select id, document_id from ${spec.target}`)
    .all()) {
    map.set(row.id, row.document_id);
  }
  documentOf.set(spec.target, map);
}

let repointed = 0;
let removed = 0;

for (const spec of LINK_TABLES) {
  if (!tableExists(spec.table)) continue;
  const rows = db
    .prepare(
      `select id, ${spec.sourceCol} as sourceId, ${spec.targetCol} as targetId
         from ${spec.table}`,
    )
    .all();

  for (const row of rows) {
    const wantPublished = isPublishedSource(spec, row.sourceId);

    if (row.targetId == null) {
      const alternative = db
        .prepare(
          `select count(*) as n from ${spec.table}
            where ${spec.sourceCol} = ? and ${spec.targetCol} is not null`,
        )
        .get(row.sourceId).n;
      if (alternative) {
        if (!DRY_RUN)
          db.prepare(`delete from ${spec.table} where id = ?`).run(row.id);
        removed += 1;
      }
      continue;
    }

    const documentId = documentOf.get(spec.target).get(row.targetId);
    const desired = targets.get(spec.target).get(documentId)?.[
      wantPublished ? "published" : "draft"
    ];
    if (!desired || desired === row.targetId) continue;

    const duplicate = db
      .prepare(
        `select id from ${spec.table}
          where ${spec.sourceCol} = ? and ${spec.targetCol} = ?`,
      )
      .get(row.sourceId, desired);

    if (duplicate) {
      if (!DRY_RUN)
        db.prepare(`delete from ${spec.table} where id = ?`).run(row.id);
      removed += 1;
    } else {
      if (!DRY_RUN)
        db
          .prepare(
            `update ${spec.table} set ${spec.targetCol} = ? where id = ?`,
          )
          .run(desired, row.id);
      repointed += 1;
    }
  }
}

console.log(
  `  ${DRY_RUN ? "would repoint" : "repointed"} ${repointed} link(s), ${DRY_RUN ? "would drop" : "dropped"
  } ${removed} duplicate/null link(s)`,
);

const stale = [];
for (const spec of LINK_TABLES) {
  if (!tableExists(spec.table)) continue;
  for (const row of db
    .prepare(
      `select ${spec.sourceCol} as sourceId, ${spec.targetCol} as targetId
         from ${spec.table}`,
    )
    .all()) {
    if (row.targetId == null) continue;
    const wantPublished = isPublishedSource(spec, row.sourceId);
    const documentId = documentOf.get(spec.target).get(row.targetId);
    const desired = targets.get(spec.target).get(documentId)?.[
      wantPublished ? "published" : "draft"
    ];
    if (desired !== row.targetId)
      stale.push(`${spec.table}#${row.sourceId}`);
  }
}

console.log(
  stale.length
    ? `  ✗ still mismatched: ${stale.join(", ")}`
    : "  ✓ every link matches its own version",
);

db.close();
