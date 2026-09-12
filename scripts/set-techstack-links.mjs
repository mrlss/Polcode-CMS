#!/usr/bin/env node
/**
 * Point every `tech-stack` entry at a real page — the old seed links
 * (`/what-we-do?stack=…`) target a page that does not exist.
 *
 * Usage (Strapi RUNNING, from the strapi project root):
 *   node scripts/set-techstack-links.mjs [--dry-run]
 *
 * Token: STRAPI_ACCESS_TOKEN, else ../frontend/.env.
 */
import fs from "node:fs";
import path from "node:path";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";
const DRY_RUN = process.argv.includes("--dry-run");

/** Service page each technology belongs to (pages exist under /services/*). */
const PAGE_BY_TITLE = {
  PHP: "backend-development",
  Python: "backend-development",
  "Node.js": "backend-development",
  PostgreSQL: "backend-development",
  GraphQL: "backend-development",
  AWS: "backend-development",
  Docker: "backend-development",
  React: "frontend-development",
  JavaScript: "frontend-development",
  TypeScript: "frontend-development",
  "Next.js": "frontend-development",
  "Tailwind CSS": "frontend-development",
  AngularJS: "frontend-development",
  iOS: "mobile-development",
  Android: "mobile-development",
  WordPress: "ecommerce-development",
  Magento: "ecommerce-development",
  Shopify: "ecommerce-development",
};

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

const { data: entries } = await api(
  `${STRAPI_URL}/api/tech-stacks?pagination[pageSize]=100&fields[0]=title&fields[1]=slug&fields[2]=link`,
);

const results = [];
for (const entry of entries) {
  const page = PAGE_BY_TITLE[entry.title];
  if (!page) {
    results.push({ title: entry.title, status: "no mapping" });
    continue;
  }
  const link = `/services/${page}`;
  if (entry.link === link) {
    results.push({ title: entry.title, status: "already set", link });
    continue;
  }
  if (DRY_RUN) {
    results.push({ title: entry.title, status: "dry-run", link });
    continue;
  }
  await api(`${STRAPI_URL}/api/tech-stacks/${entry.documentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { link } }),
  });
  results.push({
    title: entry.title,
    status: entry.link ? "updated (was stale)" : "updated",
    link,
  });
}

console.table(results);
console.log(
  DRY_RUN
    ? "\nDry run — nothing written."
    : "\nDone — tech-stack links point at real /services/* pages.",
);
