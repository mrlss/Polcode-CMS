#!/usr/bin/env node
/**
 * Attach the Figma 2x TechStack logos to the matching `tech-stack` entries.
 *
 * Source images come from the local figmosha export:
 *   cd tools/figma-mcp && node export-techstack-tiles.mjs 280:425 ./out/techstack
 *
 * Usage (Strapi RUNNING, from the strapi project root):
 *   node scripts/upload-techstack-logos.mjs [--dry-run] [--force] [--dir <path>]
 *
 * Token: STRAPI_ACCESS_TOKEN, else the value from ../frontend/.env. It needs
 * upload + tech-stack update permissions.
 *
 * NOTE: the content-API upload endpoint always files media under the built-in
 * "API Uploads" folder (`api-upload-folder` service) — media-library folders can
 * only be assigned through the admin API, so the media folder step is separate.
 */
import fs from "node:fs";
import path from "node:path";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";
const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const dirFlag = process.argv.indexOf("--dir");
const OUT_DIR = path.resolve(
  dirFlag > -1 ? process.argv[dirFlag + 1] : "../tools/figma-mcp/out/techstack",
);

/** Exported Figma file (slug) → `tech-stack` title in the CMS. */
const TITLE_BY_FILE = {
  php: "PHP",
  reacjs: "React",
  ios: "iOS",
  phyton: "Python",
  "tailwing-css": "Tailwind CSS",
  wordpress: "WordPress",
  postgresql: "PostgreSQL",
  angularjs: "AngularJS",
  javascript: "JavaScript",
  android: "Android",
  shopify: "Shopify",
  magento: "Magento",
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
  throw new Error(
    "STRAPI_ACCESS_TOKEN not set (env var or ../frontend/.env)",
  );
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

const entries = await api(
  `${STRAPI_URL}/api/tech-stacks?pagination[pageSize]=100&populate=image&fields[0]=title&fields[1]=slug`,
);
const byTitle = new Map(
  entries.data.map((entry) => [entry.title, entry]),
);
console.log(`CMS tech-stack entries: ${byTitle.size}`);

const files = fs
  .readdirSync(OUT_DIR)
  .filter((f) => f.endsWith(".png"))
  .sort();

const results = [];
for (const file of files) {
  const slug = path.basename(file, ".png");
  const title = TITLE_BY_FILE[slug];
  const entry = title ? byTitle.get(title) : null;

  if (!title) {
    console.warn(`skip ${file}: not in TITLE_BY_FILE`);
    continue;
  }
  if (!entry) {
    console.warn(`skip ${file}: no tech-stack entry titled "${title}"`);
    continue;
  }
  if (entry.image && !FORCE) {
    console.log(`skip ${title}: already has media (use --force to replace)`);
    results.push({ title, status: "kept existing" });
    continue;
  }

  const buffer = fs.readFileSync(path.join(OUT_DIR, file));
  if (DRY_RUN) {
    console.log(`[dry] would upload ${file} → ${title} (${Math.round(buffer.length / 1024)} KB)`);
    results.push({ title, status: "dry-run" });
    continue;
  }

  const form = new FormData();
  form.append("files", new Blob([buffer], { type: "image/png" }), file);
  form.append(
    "fileInfo",
    JSON.stringify({ name: `${title} logo`, alternativeText: `${title} logo` }),
  );
  const uploaded = await api(`${STRAPI_URL}/api/upload`, {
    method: "POST",
    body: form,
  });
  const media = Array.isArray(uploaded) ? uploaded[0] : uploaded;

  await api(`${STRAPI_URL}/api/tech-stacks/${entry.documentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { image: media.id } }),
  });

  console.log(
    `uploaded ${file.padEnd(18)} → ${title.padEnd(14)} file #${media.id} ${media.width}x${media.height}`,
  );
  results.push({ title, status: "updated", fileId: media.id, url: media.url });
}

console.table(results);
console.log(
  DRY_RUN
    ? "\nDry run — nothing written. Re-run without --dry-run to apply."
    : "\nDone. Uploads land in the media library's “API Uploads” folder.",
);
