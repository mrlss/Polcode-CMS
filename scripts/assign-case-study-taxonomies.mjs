#!/usr/bin/env node

/**
 * Tag every case study with a random tech stack, set of services and region.
 *
 * The case-study filter drop-downs (industry / service / technology / region)
 * and the "related cases" links are built from these relations, so the demo
 * content needs them populated across the board.
 *
 * ADDITIVE on purpose: whatever is already linked stays, the random picks are
 * added on top (the services relation is the same one the service side owns, so
 * this never drops what `assign-service-case-studies.mjs` just wrote).
 *
 * Relation targets are resolved through their DRAFT row by Strapi, so a target
 * that only has a published row is unlinkable and invisible in the Content
 * Manager — the script recreates those drafts first.
 *
 * Usage (Strapi RUNNING, from the strapi project root):
 *   node scripts/assign-case-study-taxonomies.mjs [--dry-run] [--seed=1234]
 *
 * Token: STRAPI_ACCESS_TOKEN, else ../frontend/.env.
 */
import fs from "node:fs";
import path from "node:path";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";
const DRY_RUN = process.argv.includes("--dry-run");
const SEED = Number(
  (process.argv.find((a) => a.startsWith("--seed=")) ?? "").split("=")[1] ??
  20260912,
);

/** Counts to draw, as [count, weight]. Tech stack and services only. */
const TECH_WEIGHTS = [
  [2, 30],
  [3, 40],
  [4, 30],
];
const SERVICE_WEIGHTS = [
  [1, 30],
  [2, 45],
  [3, 25],
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

/** mulberry32 — same seed, same assignment, so re-runs are predictable. */
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(SEED);

function pickCount(weights) {
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [count, weight] of weights) {
    roll -= weight;
    if (roll <= 0) return count;
  }
  return weights[0][0];
}

function shuffle(items) {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/** `count` distinct items, shuffled. */
const pickDistinct = (items, count) =>
  shuffle(items).slice(0, Math.min(count, items.length));

const caseStudyQuery =
  "fields[0]=title&fields[1]=slug&pagination[pageSize]=100" +
  "&populate[services][fields][0]=title" +
  "&populate[techStack][fields][0]=title" +
  "&populate[regions][fields][0]=title";

const list = (status) =>
  api(`${STRAPI_URL}/api/case-studies?status=${status}&${caseStudyQuery}`).then(
    (r) => r.data.map((entry) => ({ ...entry, version: status })),
  );

const ids = (value) => {
  const rows = Array.isArray(value) ? value : value ? [value] : [];
  return rows.map((row) => row.documentId).filter(Boolean);
};

/**
 * A relation target must exist in the version being written — linking a
 * published-only entry from a draft document is rejected with
 * "Document with id … not found". So every pool is read in both versions and
 * each PUT only sends the ids that version can actually hold.
 * Returns documentId → { title, draft, published }.
 */
const readPool = async (path) => {
  const query = "pagination[pageSize]=100&fields[0]=title&fields[1]=slug";
  const [drafts, published] = await Promise.all([
    api(`${STRAPI_URL}/api/${path}?status=draft&${query}`).then((r) => r.data),
    api(`${STRAPI_URL}/api/${path}?status=published&${query}`).then(
      (r) => r.data,
    ),
  ]);
  const pool = new Map();
  for (const [entry, version] of [
    ...drafts.map((e) => [e, "draft"]),
    ...published.map((e) => [e, "published"]),
  ]) {
    const current = pool.get(entry.documentId) ?? {
      title: entry.title,
      slug: entry.slug,
    };
    current[version] = true;
    pool.set(entry.documentId, current);
  }
  return pool;
};

/**
 * Strapi resolves a relation target through its DRAFT row, so a target that
 * only has a published row cannot be linked at all (and is invisible in the
 * Content Manager list). PUT the entry back to recreate the missing draft.
 */
const ensureDrafts = async (path, pool) => {
  const orphans = [...pool.entries()].filter(
    ([, entry]) => entry.published && !entry.draft,
  );
  for (const [documentId, entry] of orphans) {
    if (DRY_RUN) {
      console.log(`· would recreate the draft of ${entry.title} (${path})`);
      continue;
    }
    await api(`${STRAPI_URL}/api/${path}/${documentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { title: entry.title, slug: entry.slug } }),
    });
    entry.draft = true;
    console.log(`· recreated the draft of ${entry.title} (${path})`);
  }
};

const [drafts, published, techStacks, services, regions] = await Promise.all([
  list("draft"),
  list("published"),
  readPool("tech-stacks"),
  readPool("services"),
  readPool("regions"),
]);

if (!drafts.length) throw new Error("No case studies found");
if (!techStacks.size || !services.size || !regions.size) {
  throw new Error("Tech stacks, services and regions are all required");
}

await ensureDrafts("tech-stacks", techStacks);
await ensureDrafts("services", services);
await ensureDrafts("regions", regions);

console.log(
  `\n${drafts.length} case studies · ${techStacks.size} tech stacks · ` +
  `${services.size} services · ${regions.size} regions (seed ${SEED})\n`,
);

/** Random picks a version can hold (`versions` = the ones it has a row for). */
const pickFrom = (pool, count, version) => {
  const usable = [...pool.keys()].filter((key) => pool.get(key)[version]);
  return pickDistinct(usable, count);
};

const titles = (pool, keys) => keys.map((key) => pool.get(key)?.title).join(", ");

const byDocumentId = new Map();
for (const entry of [...drafts, ...published]) {
  const current = byDocumentId.get(entry.documentId) ?? { entries: {} };
  current.entries[entry.version] = entry;
  byDocumentId.set(entry.documentId, current);
}

const results = [];
for (const [documentId, { entries }] of byDocumentId) {
  const entry = entries.draft ?? entries.published;
  // Union of both versions so nothing that only lived on one of them is lost.
  const beforeTech = [
    ...new Set([
      ...ids(entries.draft?.techStack),
      ...ids(entries.published?.techStack),
    ]),
  ];
  const beforeServices = [
    ...new Set([
      ...ids(entries.draft?.services),
      ...ids(entries.published?.services),
    ]),
  ];

  const freshTech = pickFrom(techStacks, pickCount(TECH_WEIGHTS), "published");
  const freshServices = pickFrom(
    services,
    pickCount(SERVICE_WEIGHTS),
    "published",
  );
  // Many-to-one: a case study carries a single region.
  const region = pickFrom(regions, 1, "published")[0];

  const techStack = [...new Set([...beforeTech, ...freshTech])];
  const linkedServices = [...new Set([...beforeServices, ...freshServices])];

  const summary = {
    caseStudy: entry.title,
    techStack: titles(techStacks, techStack),
    services: titles(services, linkedServices),
    region: titles(regions, [region]),
  };

  if (DRY_RUN) {
    results.push(summary);
    continue;
  }

  // `title`/`slug` are required, so a partial PUT is rejected — send them back.
  const payload = (version) => ({
    title: entry.title,
    slug: entry.slug,
    // Drop anything this version has no row for.
    techStack: techStack.filter((id) => techStacks.get(id)?.[version]),
    services: linkedServices.filter((id) => services.get(id)?.[version]),
    regions: regions.get(region)?.[version] ? region : undefined,
  });

  await api(`${STRAPI_URL}/api/case-studies/${documentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: payload("draft") }),
  });
  await api(`${STRAPI_URL}/api/case-studies/${documentId}?status=published`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: payload("published") }),
  });

  results.push(summary);
}

console.table(results);
console.log(
  DRY_RUN
    ? "\nDry run — nothing written."
    : `\nDone — taxonomies assigned to ${results.length} case studies.`,
);
