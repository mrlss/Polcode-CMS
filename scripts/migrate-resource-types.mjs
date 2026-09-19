#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";
const DRY_RUN = process.argv.includes("--dry-run");
const DUMP = ".tmp/resource-kinds.json";

const TYPES = [
  { title: "Article", slug: "article", sortOrder: 0, cardLayout: "article" },
  { title: "eBook", slug: "ebook", sortOrder: 1, cardLayout: "ebook" },
  { title: "Podcast", slug: "podcast", sortOrder: 2, cardLayout: "podcast" },
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

const json = (method, data) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ data }),
});

async function versionMap(collection, idField = "slug") {
  const map = new Map();
  for (const status of ["draft", "published"]) {
    const rows = (
      await api(
        `${STRAPI_URL}/api/${collection}?status=${status}&pagination[pageSize]=300&fields[0]=documentId&fields[1]=${idField}`,
      )
    ).data;
    for (const row of rows) {
      map.set(row[idField], { ...(map.get(row[idField]) ?? {}), [status]: row });
    }
  }
  return map;
}

async function ensureResourceTypes() {
  console.log(`Ensuring ${TYPES.length} resource types…`);
  let types = await versionMap("resource-types");
  for (const data of TYPES) {
    const existing = types.get(data.slug);
    if (existing) {
      for (const status of ["draft", "published"]) {
        if (existing[status]) {
          await api(
            `${STRAPI_URL}/api/resource-types/${existing[status].documentId}?status=${status}`,
            json("PUT", data),
          );
        }
      }
    } else {
      const created = await api(
        `${STRAPI_URL}/api/resource-types`,
        json("POST", data),
      );
      await api(
        `${STRAPI_URL}/api/resource-types/${created.data.documentId}?status=published`,
        json("PUT", data),
      );
    }
  }
  types = await versionMap("resource-types");
  return types;
}

const dump = JSON.parse(fs.readFileSync(DUMP, "utf8"));

if (DRY_RUN) {
  const counts = dump.reduce((acc, row) => {
    acc[row.kind] = (acc[row.kind] ?? 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify({ insights: dump.length, kinds: counts }, null, 1));
  console.log("\nDry run — nothing written.");
  process.exit(0);
}

const types = await ensureResourceTypes();

console.log(`Linking ${dump.length} resources to their type…`);
for (const row of dump) {
  const entry = types.get(row.kind);
  if (!entry?.draft || !entry?.published) {
    throw new Error(`missing resource type row for "${row.kind}"`);
  }

  for (const status of ["draft", "published"]) {
    const current = (
      await api(
        `${STRAPI_URL}/api/insights/${row.documentId}?status=${status}&populate=*`,
      )
    ).data;

    await api(
      `${STRAPI_URL}/api/insights/${row.documentId}?status=${status}`,
      json("PUT", {
        title: current.title,
        slug: current.slug,
        description: current.description,
        isFeatured: current.isFeatured,
        readDuration: current.readDuration,
        duration: current.duration,
        audioUrl: current.audioUrl,
        downloadUrl: current.downloadUrl,
        audience: current.audience?.id,
        tags: (current.tags ?? []).map((t) => t.id),
        author: current.author?.id,
        featuredMedia: current.featuredMedia?.id,
        resourceType: entry[status].id,
      }),
    );
  }
}

console.log(
  `Done — ${TYPES.length} resource types, ${dump.length} resources linked.`,
);
