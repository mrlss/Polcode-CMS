#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";
const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

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
    /* keep raw text for the error message */
  }
  if (!res.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${url} → ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)
      }`,
    );
  }
  return body;
}

const qs = (params) =>
  Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

const listAll = async (collection, status, query = {}) =>
  (
    await api(
      `${STRAPI_URL}/api/${collection}?${qs({ status, ...query })}`,
    )
  ).data;

const AUDIENCE_SLUGS = [
  "for-decision-makers",
  "for-developers",
  "for-candidates",
  "customer-stories",
];

const TYPE_SLUGS = ["article", "ebook", "podcast"];

const problems = [];
const flag = (message) => {
  problems.push(message);
  console.log(`  ✗ ${message}`);
};

console.log(`\n=== 1. Resources page sections (draft vs published) \n`);
const found = await listAll("pages", "draft", {
  "filters[slug][$eq]": "resources",
  "pagination[pageSize]": 5,
});
if (!found.length) throw new Error("resources page not found (draft)");
const documentId = found[0].documentId;

const pageVersions = {};
for (const status of ["draft", "published"]) {
  pageVersions[status] = (
    await api(
      `${STRAPI_URL}/api/pages/${documentId}?${qs({
        status,
        "populate[sections][populate]": "*",
      })}`,
    )
  ).data;
}

const sectionRows = (version, status) =>
  (version.sections ?? [])
    .filter((s) => s.__component === "sections.insight-list")
    .map((s) => ({
      status,
      id: s.id,
      title: s.title,
      layout: s.layout,
      itemsToShow: s.itemsToShow,
      audience: s.audience?.slug ?? null,
      resourceType: s.resourceType?.slug ?? null,
      picks: (s.insights ?? []).length,
      navItem: s.navItem?.anchor ?? null,
      loadMore: Boolean(s.loadMore?.loadChunk),
    }));

const sections = [
  ...sectionRows(pageVersions.draft, "draft"),
  ...sectionRows(pageVersions.published, "published"),
];
console.table(sections);

const pickFilters = (status, layout) =>
  sections
    .filter((s) => s.status === status && (!layout || s.layout === layout))
    .map((s) => `${s.title}=${s.audience ?? s.resourceType ?? "—"}`)
    .join(" | ");

console.log(`  draft     filters: ${pickFilters("draft")}`);
console.log(`  published filters: ${pickFilters("published")}`);

const expectAudience = {
  "For Decision Makers": "for-decision-makers",
  "For Developers": "for-developers",
  "For Candidates": "for-candidates",
  "Customer Stories": "customer-stories",
};
const expectType = { eBooks: "ebook", "Our Podcasts": "podcast" };

for (const status of ["draft", "published"]) {
  for (const row of sections.filter((s) => s.status === status)) {
    const wantA = expectAudience[row.title];
    const wantT = expectType[row.title];
    if (wantA && row.audience !== wantA)
      flag(`[${status}] "${row.title}" audience=${row.audience}, expected ${wantA}`);
    if (wantT && row.resourceType !== wantT)
      flag(
        `[${status}] "${row.title}" resourceType=${row.resourceType}, expected ${wantT}`,
      );
    if (!wantA && !wantT && !row.audience && !row.resourceType && !["The Latest", "All Articles"].includes(row.title))
      flag(`[${status}] "${row.title}" has no audience and no resource type`);
    if (!row.navItem) flag(`[${status}] "${row.title}" has no navItem anchor`);
    if (row.layout === "gridFiltered" && row.itemsToShow === null)
      flag(`[${status}] "${row.title}" gridFiltered without itemsToShow`);
  }
}

console.log(`\n=== 2. Insight relations (draft vs published) \n`);
const insightQuery = {
  "pagination[pageSize]": 300,
  "sort[0]": "publishedAt:desc",
  populate: "*",
};
const gaps = [];
for (const status of ["draft", "published"]) {
  const rows = await listAll("insights", status, insightQuery);
  console.log(`  ${status}: ${rows.length} insights`);
  for (const row of rows) {
    const missing = [
      !row.audience?.slug && "audience",
      !row.resourceType?.slug && "resourceType",
      !(row.tags ?? []).length && "tags",
      !row.author?.id && "author",
      !row.featuredMedia?.id && "featuredMedia",
      !row.readDuration && "readDuration",
    ].filter(Boolean);
    if (missing.length)
      gaps.push({ status, title: row.title, missing: missing.join(",") });
  }
}
if (gaps.length) {
  console.table(gaps);
  flag(`${gaps.length} insight version(s) with missing relations`);
} else {
  console.log("  ✓ every insight version has audience, resourceType, tags, author, media");
}

console.log(`\n=== 3. What each filter resolves to (published) \n`);
const newest = async (query, size = 3) =>
  (
    await listAll("insights", "published", {
      ...query,
      "sort[0]": "publishedAt:desc",
      "pagination[pageSize]": size,
      populate: "resourceType",
    })
  ).map((row) => `${row.title} [${row.resourceType?.slug ?? "?"}]`);

const total = await listAll("insights", "published", {
  "pagination[pageSize]": 1,
  "pagination[withCount]": true,
});
const expected = {};
for (const slug of AUDIENCE_SLUGS) {
  expected[`audience:${slug}`] = await newest({
    "filters[audience][slug][$eq]": slug,
  });
}
for (const slug of TYPE_SLUGS) {
  expected[`type:${slug}`] = await newest({
    "filters[resourceType][slug][$eq]": slug,
  });
}
expected["newest:all"] = await newest({});

for (const [key, rows] of Object.entries(expected)) {
  console.log(`  ${key}`);
  for (const row of rows) console.log(`      ${row}`);
  if (!rows.length) flag(`${key} resolves to nothing`);
}

console.log(`\n=== 4. Cross-check the rendered /resources page \n`);
let html = "";
try {
  html = await (await fetch(`${SITE_URL}/resources`)).text();
} catch (error) {
  flag(`could not fetch ${SITE_URL}/resources — ${error.message}`);
}
if (html) {
  const stripped = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ");
  for (const [key, rows] of Object.entries(expected)) {
    const missing = rows
      .map((row) => row.replace(/\s*\[[^\]]*\]$/, ""))
      .filter((title) => !stripped.includes(title));
    if (missing.length) flag(`${key}: not rendered → ${missing.join(" / ")}`);
    else console.log(`  ✓ ${key}: ${rows.length}/${rows.length} rendered`);
  }

  const sortOrder = await listAll("insights", "published", {
    "pagination[pageSize]": 300,
    "sort[0]": "publishedAt:desc",
    fields: ["title", "publishedAt"],
  });
  const allTitles = sortOrder.map((row) => row.title);
  const renderedOrder = allTitles.filter((title) =>
    stripped.includes(title.replace(/’/g, "’")),
  );
  console.log(`  published insights: ${allTitles.length}`);
  console.log(
    `  rendered (in CMS order): ${renderedOrder.length === allTitles.length ? "all" : `${renderedOrder.length}/${allTitles.length}`}`,
  );
}

console.log(
  `\n${problems.length ? `✗ ${problems.length} problem(s) found` : "✓ all checks passed"}\n`,
);
process.exit(problems.length ? 1 : 0);
