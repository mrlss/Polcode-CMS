#!/usr/bin/env node

/*
 * Fills the Globals `error` component (title / image / description / button)
 * used by the frontend error + 404 screens.
 *
 * The Globals single type already carries the footer, and a REST `PUT` replaces
 * the whole document, so the script reads the current footer back and sends it
 * again together with the new `error` component — for both the draft and the
 * published version.
 *
 * Usage (Strapi must be RUNNING):
 *   node scripts/seed-global-error.mjs            # dry run
 *   node scripts/seed-global-error.mjs --apply
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";
const DB_PATH = process.env.STRAPI_DB ?? ".tmp/data.db";
const APPLY = process.argv.includes("--apply");

const ERROR_CONTENT = {
  title: "Something went wrong",
  description:
    "<p>The page you are looking for does not exist, or it has been moved. Head back to the homepage and try again.</p>",
  imageName: "client-testimonial-01.svg",
  button: {
    title: "Back to homepage",
    variant: "dark",
    linkType: "url",
    url: "/",
  },
};

const readToken = () => {
  if (process.env.STRAPI_ACCESS_TOKEN) return process.env.STRAPI_ACCESS_TOKEN;
  const envPath = path.resolve("../frontend/.env");
  if (fs.existsSync(envPath)) {
    const match = fs
      .readFileSync(envPath, "utf8")
      .match(/^STRAPI_ACCESS_TOKEN=(.*)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("STRAPI_ACCESS_TOKEN not set (env var or ../frontend/.env)");
};

const token = readToken();

const api = async (url, init = {}) => {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
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
};

const mediaId = (name) => {
  const db = new Database(DB_PATH, { readonly: true });
  const row = db
    .prepare("select id from files where name = ? order by id desc limit 1")
    .get(name);
  db.close();
  if (!row) throw new Error(`media not found: ${name}`);
  return row.id;
};

const footerPayload = (footer) => {
  if (!footer) return undefined;
  return {
    contactTitle: footer.contactTitle,
    contactContent: footer.contactContent,
    partnersTitle: footer.partnersTitle,
    copyright: footer.copyright,
    partners: (footer.partners ?? []).map((partner) => ({
      label: partner.label,
      url: partner.url,
      logo: partner.logo?.id ?? null,
    })),
  };
};

const POPULATE =
  "populate[footer][populate][partners][populate][logo]=true&populate[error][populate][image]=true&populate[error][populate][button]=true";

const readGlobals = async (status) => {
  const query = status === "draft" ? `?status=draft&${POPULATE}` : `?${POPULATE}`;
  const { data } = await api(`${STRAPI_URL}/api/global${query}`);
  return data;
};

const main = async () => {
  console.log(`seed-global-error — ${APPLY ? "APPLY" : "DRY RUN"} (${STRAPI_URL})`);

  const imageId = mediaId(ERROR_CONTENT.imageName);
  const payloadError = {
    title: ERROR_CONTENT.title,
    description: ERROR_CONTENT.description,
    image: imageId,
    button: ERROR_CONTENT.button,
  };

  for (const status of ["draft", "published"]) {
    const current = await readGlobals(status);
    if (!current) {
      throw new Error(`Globals has no ${status} row`);
    }
    console.log(
      `\n${status}: documentId ${current.documentId} — footer ${current.footer ? "present" : "empty"
      }, error ${current.error ? "present" : "empty"}`,
    );
    console.log(JSON.stringify({ error: payloadError }, null, 2));

    if (!APPLY) continue;

    const body = { data: { footer: footerPayload(current.footer), error: payloadError } };
    const query = status === "draft" ? "?status=draft" : "";
    const result = await api(`${STRAPI_URL}/api/global${query}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    console.log(
      `  → saved: title "${result.data?.error?.title}", image ${result.data?.error?.image?.url ?? "none"
      }, button "${result.data?.error?.button?.title}"`,
    );
  }

  if (!APPLY) {
    console.log("\ndry run — re-run with --apply to write");
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
