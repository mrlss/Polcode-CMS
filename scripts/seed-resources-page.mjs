#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";
const DRY_RUN = process.argv.includes("--dry-run");
const REPAIR = new URL("./fix-resource-relations.mjs", import.meta.url).pathname;

const PAGE_SLUG = "resources";

const AUDIENCE_SLUGS = {
  decisionMakers: "for-decision-makers",
  developers: "for-developers",
  candidates: "for-candidates",
  customerStories: "customer-stories",
};

const strip = (id, navLabel, title, audience) => ({
  __component: "sections.insight-list",
  navItem: { label: navLabel, anchor: id },
  title,
  layout: "carousel",
  audience,
  itemsToShow: 3,
});

const SECTIONS = [
  {
    __component: "sections.page-intro",
    title: "Resources",
    description:
      "<p>For people making technology decisions and the people who have to make them work.</p>",
    showScrollCue: true,
    theme: { background: "white", textColor: "dark" },
  },
  {
    __component: "sections.hub-bar",
    showChips: true,
    scrollToSections: true,
    filters: [{ taxonomy: "audience" }, { taxonomy: "tag", multiple: true }],
    theme: { background: "white", textColor: "dark" },
  },
  {
    __component: "sections.insight-list",
    navItem: { label: "The Latest", anchor: "the-latest" },
    title: "The Latest",
    layout: "featuredCarousel",
    itemsToShow: 3,
    theme: { background: "white", textColor: "dark" },
  },
  strip("for-decision-makers", "For Decision Makers", "For Decision Makers", "decisionMakers"),
  strip("for-developers", "For Developers", "For Developers", "developers"),
  strip("for-candidates", "For Candidates", "For Candidates", "candidates"),
  strip("customer-stories", "Customer Stories", "Customer Stories", "customerStories"),
  {
    __component: "sections.insight-list",
    navItem: { label: "All", anchor: "all-articles" },
    title: "All Articles",
    layout: "gridFiltered",
    showMore: {
      useShowMore: true,
      loadChunk: 6,
      pageSize: 12,
      showMoreLabel: "Show More",
      showLessLabel: "Show Less",
    },
    theme: { background: "white", textColor: "dark" },
  },
  {
    __component: "sections.insight-list",
    navItem: { label: "eBooks", anchor: "ebooks" },
    title: "eBooks",
    layout: "grid",
    resourceType: "ebook",
    itemsToShow: 3,
    button: { title: "View all eBooks", url: "#" },
    theme: { background: "white", textColor: "dark" },
  },
  {
    __component: "sections.insight-list",
    navItem: { label: "Our Podcasts", anchor: "our-podcasts" },
    title: "Our Podcasts",
    layout: "carousel",
    resourceType: "podcast",
    itemsToShow: 3,
    button: { title: "Explore our podcasts", url: "#" },
    theme: { background: "white", textColor: "dark" },
  },
  {
    __component: "sections.newsletter",
    anchor: "newsletter",
    title: "Stay in the loop",
    description:
      "<p>The ideas worth keeping up with, delivered to your inbox.</p>",
    label: "Subscribe to newsletter",
    placeholder: "Enter your email",
    theme: { background: "black", textColor: "light" },
  },
];

const PAGE = {
  title: "Resources",
  slug: PAGE_SLUG,
  showScrollTop: false,
  seo: {
    metaTitle: "Resources | Polcode",
    metaDescription:
      "Engineering articles, eBooks and podcasts for people making technology decisions and the people who have to make them work.",
  },
  sections: SECTIONS,
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

if (DRY_RUN) {
  console.log(
    JSON.stringify(
      {
        slug: PAGE_SLUG,
        sections: SECTIONS.map((s) => s.__component),
        audiences: Object.values(AUDIENCE_SLUGS),
      },
      null,
      1,
    ),
  );
  console.log("\nDry run — nothing written.");
  process.exit(0);
}

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

const audienceRows = await versionMap("primary-audiences");
const resourceTypeRows = await versionMap("resource-types");

for (const key of Object.values(AUDIENCE_SLUGS)) {
  const entry = audienceRows.get(key);
  if (!entry?.draft || !entry?.published)
    throw new Error(`missing audience version: ${key}`);
}
for (const slug of ["article", "ebook", "podcast"]) {
  const entry = resourceTypeRows.get(slug);
  if (!entry?.draft || !entry?.published)
    throw new Error(`missing resource type version: ${slug}`);
}

const sectionsFor = (status) =>
  SECTIONS.map((section) => {
    if (section.audience) {
      return {
        ...section,
        audience: audienceRows.get(AUDIENCE_SLUGS[section.audience])[status].id,
      };
    }
    if (section.resourceType) {
      return {
        ...section,
        resourceType: resourceTypeRows.get(section.resourceType)[status].id,
      };
    }
    return section;
  });

const payloadFor = (status) => ({ ...PAGE, sections: sectionsFor(status) });

const found = (
  await api(
    `${STRAPI_URL}/api/pages?filters[slug][$eq]=${PAGE_SLUG}&status=draft`,
  )
).data[0];

const documentId = found
  ? found.documentId
  : (
    await api(`${STRAPI_URL}/api/pages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: payloadFor("draft") }),
    })
  ).data.documentId;

for (const status of ["draft", "published"]) {
  await api(`${STRAPI_URL}/api/pages/${documentId}?status=${status}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: payloadFor(status) }),
  });
}

console.log(
  `Resources page ${found ? "updated" : "created"}: ${documentId} (${SECTIONS.length} sections)`,
);

execFileSync(process.execPath, [REPAIR], { stdio: "inherit" });

const readBack = {};
for (const status of ["draft", "published"]) {
  const row = (
    await api(
      `${STRAPI_URL}/api/pages/${documentId}?status=${status}&populate[sections][populate]=*`,
    )
  ).data;
  readBack[status] = (row.sections ?? [])
    .filter((s) => s.__component === "sections.insight-list")
    .map((s) => `${s.title}: ${s.audience?.slug ?? s.resourceType?.slug ?? "—"}`);
}

console.log(`  draft     → ${readBack.draft.join(" | ")}`);
console.log(`  published → ${readBack.published.join(" | ")}`);
