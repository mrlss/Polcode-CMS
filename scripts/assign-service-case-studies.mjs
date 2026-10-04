#!/usr/bin/env node

/**
 * Give every service a random set of related case studies.
 *
 * The service group's "related case studies" carousel derives its cards from
 * the case studies tagged on the group's services (see
 * `frontend/src/blocks/ServicesGroup/groupCases.ts`), so this is what gives
 * those carousels content beyond the few services an editor had touched.
 *
 * Each service gets between one and four distinct case studies. Both versions
 * of the document are written (draft and `?status=published`) so the Content
 * Manager preview and the live site agree.
 *
 * Usage (Strapi RUNNING, from the strapi project root):
 *   node scripts/assign-service-case-studies.mjs [--seed=1234] [--apply]
 *
 * Dry run by default — pass --apply to write.
 *
 * Token: STRAPI_ACCESS_TOKEN, else ../frontend/.env.
 */
import fs from "node:fs";
import path from "node:path";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";
const DRY_RUN = !process.argv.includes("--apply");
const SEED = Number(
  (process.argv.find((a) => a.startsWith("--seed=")) ?? "").split("=")[1] ??
  20260912,
);

/** How many case studies a service gets: [count, weight]. */
const COUNT_WEIGHTS = [
  [1, 25],
  [2, 35],
  [3, 25],
  [4, 15],
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

function pickCount() {
  const total = COUNT_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [count, weight] of COUNT_WEIGHTS) {
    roll -= weight;
    if (roll <= 0) return count;
  }
  return 1;
}

/** `count` distinct entries, shuffled (Fisher-Yates on a copy). */
function pickDistinct(items, count) {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}

const servicesQuery =
  "pagination[pageSize]=100&fields[0]=title&fields[1]=slug" +
  "&populate[caseStudies][fields][0]=title";
const caseStudiesQuery =
  "pagination[pageSize]=100&fields[0]=title&fields[1]=slug";

const [services, caseStudies] = await Promise.all([
  api(`${STRAPI_URL}/api/services?${servicesQuery}`).then((r) => r.data),
  api(`${STRAPI_URL}/api/case-studies?${caseStudiesQuery}`).then((r) => r.data),
]);

if (!services.length) throw new Error("No services found");
if (!caseStudies.length) throw new Error("No case studies found");

console.log(
  `${services.length} services × ${caseStudies.length} case studies (seed ${SEED})\n`,
);

const results = [];
for (const service of services) {
  const before = (service.caseStudies ?? []).map((c) => c.title);
  const picked = pickDistinct(caseStudies, pickCount());
  const labels = picked.map((c) => c.title);

  if (DRY_RUN) {
    results.push({
      service: service.title,
      was: before.join(", ") || "—",
      becomes: labels.join(", "),
    });
    continue;
  }

  // `title`/`slug` are required, so a partial PUT is rejected — send them back.
  const data = {
    title: service.title,
    slug: service.slug,
    caseStudies: picked.map((c) => c.documentId),
  };

  await api(`${STRAPI_URL}/api/services/${service.documentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  await api(
    `${STRAPI_URL}/api/services/${service.documentId}?status=published`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    },
  );

  results.push({
    service: service.title,
    was: before.join(", ") || "—",
    becomes: labels.join(", "),
  });
}

console.table(results);
console.log(
  DRY_RUN
    ? "\nDry run — nothing written."
    : `\nDone — case studies assigned to ${results.length} services.`,
);
