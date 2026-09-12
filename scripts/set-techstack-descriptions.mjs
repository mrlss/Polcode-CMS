#!/usr/bin/env node
/**
 * Give every `tech-stack` entry a description that names the area it belongs to
 * (backend / frontend / mobile / eCommerce development, DevOps & cloud).
 *
 * Usage (Strapi RUNNING, from the strapi project root):
 *   node scripts/set-techstack-descriptions.mjs [--dry-run]
 *
 * Token: STRAPI_ACCESS_TOKEN, else ../frontend/.env.
 */
import fs from "node:fs";
import path from "node:path";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";
const DRY_RUN = process.argv.includes("--dry-run");

/** Title → area label + one-line "what we use it for" (CKEditor HTML). */
const DESCRIPTION_BY_TITLE = {
  // backend development
  PHP: ["Backend development", "APIs, integrations and legacy PHP systems."],
  Python: ["Backend development", "services, automation and data processing."],
  "Node.js": ["Backend development", "fast APIs and real-time services."],
  PostgreSQL: ["Backend development", "relational data, queries and reporting."],
  GraphQL: ["Backend development", "typed APIs and efficient data fetching."],
  // DevOps & cloud
  AWS: ["DevOps & cloud", "infrastructure, deployment and scaling."],
  Docker: ["DevOps & cloud", "containerised builds and consistent environments."],
  // frontend development
  React: ["Frontend development", "component-driven interfaces and design systems."],
  JavaScript: ["Frontend development", "interactive, framework-agnostic UI."],
  TypeScript: ["Frontend development", "type-safe UI and shared contracts."],
  "Next.js": ["Frontend development", "server-rendered React applications."],
  "Tailwind CSS": ["Frontend development", "design-system-driven styling."],
  AngularJS: ["Frontend development", "enterprise single-page applications."],
  // mobile development
  iOS: ["Mobile development", "native apps for iPhone and iPad."],
  Android: ["Mobile development", "native apps for Android devices."],
  // eCommerce development
  WordPress: ["eCommerce & CMS", "content-managed sites and storefronts."],
  Magento: ["eCommerce development", "catalogue, checkout and integrations."],
  Shopify: ["eCommerce development", "headless and themed storefronts."],
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
  `${STRAPI_URL}/api/tech-stacks?pagination[pageSize]=100&fields[0]=title&fields[1]=description`,
);

const results = [];
for (const entry of entries) {
  const [area, detail] = DESCRIPTION_BY_TITLE[entry.title] ?? [];
  if (!area) {
    results.push({ title: entry.title, status: "no mapping" });
    continue;
  }
  // <strong> keeps the area readable in the dimmed row copy.
  const description = `<p><strong>${area}</strong> — ${detail}</p>`;
  if (entry.description === description) {
    results.push({ title: entry.title, status: "already set" });
    continue;
  }
  if (DRY_RUN) {
    results.push({ title: entry.title, status: "dry-run", description });
    continue;
  }
  await api(`${STRAPI_URL}/api/tech-stacks/${entry.documentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { description } }),
  });
  results.push({
    title: entry.title,
    status: entry.description ? "updated" : "added",
    description,
  });
}

console.table(results);
console.log(
  DRY_RUN
    ? "\nDry run — nothing written."
    : `\nDone — ${results.length} tech-stack descriptions set.`,
);
