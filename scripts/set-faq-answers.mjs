#!/usr/bin/env node

/**
 * Fill the FAQ collection with client-ready answers.
 *
 * Every entry gets a full answer (CKEditor HTML) written to BOTH versions of the
 * document — the draft (`PUT /api/faqs/:documentId`) and the published one
 * (`PUT ...?status=published`) — so the CMS preview and the live site match.
 * Documents that only had a published row (invisible in the Content Manager
 * list) get their draft row recreated by the same PUT.
 *
 * Usage (Strapi RUNNING, from the strapi project root):
 *   node scripts/set-faq-answers.mjs [--dry-run]
 *
 * Token: STRAPI_ACCESS_TOKEN, else ../frontend/.env.
 */
import fs from "node:fs";
import path from "node:path";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";
const DRY_RUN = process.argv.includes("--dry-run");

/** Question → answer. Keep the wording conversational; answers render as wysiwyg. */
const ANSWER_BY_TITLE = {
  "How does billing work?":
    "<p>We bill monthly against the agreed scope. Ongoing teams work on a simple time-and-materials basis, while tightly defined phases can be fixed-price. Every invoice comes with a short report of what was delivered, so you always know what you are paying for.</p>",
  "Do you sign NDAs?":
    "<p>Yes. Send yours over before the first discovery call and we will return it signed, usually within one business day. We are also happy to follow your security and data-processing requirements.</p>",
  "How big are your teams?":
    "<p>Most projects run with a small senior squad of 4-8 people: a dedicated project manager, two to four engineers, a designer and a QA specialist. The team grows or shrinks with your roadmap, without changing how you communicate with us.</p>",
  "Which time zones do you cover?":
    "<p>We work from Europe and cover the Americas, keeping at least four hours of overlap with your working day for standups, reviews and workshops.</p>",
  "Which technologies do you use?":
    "<p>We are strongest in React, Next.js, Node.js, TypeScript and PostgreSQL, and we ship native iOS and Android apps. The stack is always chosen for maintainability rather than novelty — if your team already works with something else, we adapt to it.</p>",
  "How does onboarding work?":
    "<p>A structured two-week onboarding: a kick-off workshop to align on goals and scope, access and infrastructure setup, then a first shippable increment by the end of week two. A dedicated project manager becomes your single point of contact from day one.</p>",
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

const list = (status) =>
  api(
    `${STRAPI_URL}/api/faqs?status=${status}&pagination[pageSize]=100&fields[0]=title&fields[1]=description`,
  ).then((r) => r.data.map((entry) => ({ ...entry, version: status })));

const [drafts, published] = await Promise.all([list("draft"), list("published")]);
const documents = new Map();
for (const entry of [...drafts, ...published]) {
  const current = documents.get(entry.documentId) ?? { title: entry.title };
  current[entry.version] = entry;
  documents.set(entry.documentId, current);
}

const results = [];
for (const [documentId, versions] of documents) {
  const title = versions.draft?.title ?? versions.published?.title;
  const description = ANSWER_BY_TITLE[title];
  if (!description) {
    results.push({ title, status: "no mapping" });
    continue;
  }
  if (DRY_RUN) {
    results.push({
      title,
      status: [
        versions.draft ? "draft ok" : "draft MISSING",
        versions.published ? "published ok" : "published MISSING",
      ].join(" / "),
      description: `${description.length} chars`,
    });
    continue;
  }
  await api(`${STRAPI_URL}/api/faqs/${documentId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { title, description } }),
  });
  await api(`${STRAPI_URL}/api/faqs/${documentId}?status=published`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { title, description } }),
  });
  results.push({
    title,
    documentId,
    status: versions.draft ? "draft + published updated" : "draft recreated + published updated",
    description: `${description.length} chars`,
  });
}

console.table(results);
console.log(
  DRY_RUN
    ? "\nDry run — nothing written."
    : `\nDone — ${results.length} FAQ documents filled in.`,
);
