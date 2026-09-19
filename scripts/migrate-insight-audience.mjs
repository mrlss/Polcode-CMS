#!/usr/bin/env node

import fs from "node:fs";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";
const DRY_RUN = process.argv.includes("--dry-run");
const DUMP = ".tmp/audience-keys.json";

const AUDIENCES = [
  {
    key: "decisionMakers",
    title: "For Decision Makers",
    slug: "for-decision-makers",
    sortOrder: 0,
    description:
      "Content primarily written to support business, technology, product, investment, or operational decisions.",
  },
  {
    key: "developers",
    title: "For Developers",
    slug: "for-developers",
    sortOrder: 1,
    description:
      "Technical content focused on engineering, architecture, development practices, tools, frameworks, implementation, or technical problem-solving.",
  },
  {
    key: "candidates",
    title: "For Candidates",
    slug: "for-candidates",
    sortOrder: 2,
    description:
      "Content about working at Polcode, careers, recruitment, people, engineering culture, and developer experience.",
  },
  {
    key: "customerStories",
    title: "Customer Stories",
    slug: "customer-stories",
    sortOrder: 3,
    description:
      "Editorial content built around a specific client, project, product, or real-world implementation.",
  },
];

function readToken() {
  if (process.env.STRAPI_ACCESS_TOKEN) return process.env.STRAPI_ACCESS_TOKEN;
  const match = fs
    .readFileSync("../frontend/.env", "utf8")
    .match(/^STRAPI_ACCESS_TOKEN=(.*)$/m);
  if (!match) throw new Error("STRAPI_ACCESS_TOKEN not found");
  return match[1].trim().replace(/^["']|["']$/g, "");
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
      `${init.method ?? "GET"} ${url} → ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`,
    );
  }
  return body;
}

const json = (method, data) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ data }),
});

const listAll = async (collection, status, fields) =>
  (
    await api(
      `${STRAPI_URL}/api/${collection}?status=${status}&pagination[pageSize]=300&${fields
        .map((f, i) => `fields[${i}]=${f}`)
        .join("&")}`,
    )
  ).data;

async function versionMap(collection, idField = "title") {
  const map = new Map();
  for (const status of ["draft", "published"]) {
    for (const row of await listAll(collection, status, [
      "documentId",
      idField,
    ])) {
      map.set(row[idField], { ...(map.get(row[idField]) ?? {}), [status]: row });
    }
  }
  return map;
}

const dump = JSON.parse(fs.readFileSync(DUMP, "utf8"));
const byDocument = new Map();
for (const row of dump) {
  byDocument.set(row.documentId, row);
}

if (DRY_RUN) {
  console.log(
    JSON.stringify(
      {
        audiences: AUDIENCES.length,
        insights: byDocument.size,
        keys: [...new Set(dump.map((r) => r.audienceKey))].sort(),      },
      null,
      1,
    ),
  );
  console.log("\nDry run — nothing written.");
  process.exit(0);
}

console.log(`Ensuring ${AUDIENCES.length} audiences…`);
let audiences = await versionMap("primary-audiences", "slug");
for (const entry of AUDIENCES) {
  const { key, ...data } = entry;
  const existing = audiences.get(data.slug);
  if (existing) {
    for (const status of ["draft", "published"]) {
      if (existing[status]) {
        await api(
          `${STRAPI_URL}/api/primary-audiences/${existing[status].documentId}?status=${status}`,
          json("PUT", data),
        );
      }
    }
  } else {
    const created = await api(`${STRAPI_URL}/api/primary-audiences`, json("POST", data));
    await api(
      `${STRAPI_URL}/api/primary-audiences/${created.data.documentId}?status=published`,
      json("PUT", data),
    );
  }
}

audiences = await versionMap("primary-audiences", "slug");
const rows = [];

for (const [documentId, row] of byDocument) {
  const audienceIndex = AUDIENCES.findIndex((a) => a.key === row.audienceKey);
  const audience = audiences.get(AUDIENCES[audienceIndex]?.slug);
  if (!audience) throw new Error(`unknown audience key: ${row.audienceKey}`);

  for (const status of ["draft", "published"]) {
    await api(
      `${STRAPI_URL}/api/insights/${documentId}?status=${status}`,
      json("PUT", {
        title: row.title,
        slug: row.slug,
        audience: audience[status]?.id,
      }),
    );
  }

  rows.push({
    documentId,
    title: row.title,
    audience: AUDIENCES[audienceIndex].title,
  });
}

console.table(rows);
console.log(
  `\nDone — ${audiences.size} audiences, ${rows.length} insights linked.`,
);
