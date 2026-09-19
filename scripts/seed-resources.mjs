#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";
const DRY_RUN = process.argv.includes("--dry-run");
const REPAIR = new URL("./fix-resource-relations.mjs", import.meta.url).pathname;

const TAGS = [
  "AI",
  "Legacy Modernization",
  "E-commerce",
  "Magento/Adobe Commerce",
  "Software Delivery",
  "Team Augmentation",
  "Product Development",
  "Software Architecture",
  "Cloud & Infrastructure",
  "APIs & Integrations",
  "QA & Testing",
  "Security & Compliance",
  "Performance & Scalability",
  "UX & Accessibility",
  "Developer Experience",
  "PHP",
  "Laravel",
  "Symfony",
  "Node.js",
  "Python",
  "Ruby on Rails",
  "Go",
  "React",
  "Vue.js",
  "Angular",
  "AWS",
  "Healthcare",
  "Fintech",
  "Education/e-learning",
  "Retail",
  "Careers",
  "Engineering Culture",
  "Announcements",
];

const AUDIENCES = [
  {
    key: "decisionMakers",
    title: "For Decision Makers",
    slug: "for-decision-makers",
    sortOrder: 0,
  },
  {
    key: "developers",
    title: "For Developers",
    slug: "for-developers",
    sortOrder: 1,
  },
  {
    key: "candidates",
    title: "For Candidates",
    slug: "for-candidates",
    sortOrder: 2,
  },
  {
    key: "customerStories",
    title: "Customer Stories",
    slug: "customer-stories",
    sortOrder: 3,
  },
];

const AUTHOR = "Anna Kowalska";

const RESOURCE_TYPES = [
  { key: "article", title: "Article", slug: "article", sortOrder: 0, cardLayout: "article" },
  { key: "ebook", title: "eBook", slug: "ebook", sortOrder: 1, cardLayout: "ebook" },
  { key: "podcast", title: "Podcast", slug: "podcast", sortOrder: 2, cardLayout: "podcast" },
];

const RESOURCES = [
  {
    title: "Modernizing Legacy Systems Without Creating Operational Risk",
    audience: "decisionMakers",
    tags: ["Legacy Modernization", "Software Delivery", "Security & Compliance"],
    readDuration: "9 min read",
    description:
      "<p>Modernization programmes rarely fail on technology. They fail on operational risk. Here is how to sequence the work so the business never notices.</p>",
  },
  {
    title:
      "Postman vs. PactumJS: API Testing Tools Compared – Which One Works Best for Your Team?",
    audience: "developers",
    tags: ["QA & Testing", "APIs & Integrations", "Node.js"],
    readDuration: "11 min read",
    description:
      "<p>Both tools will happily call your endpoints. The difference shows up when the suite has to survive a real release cycle.</p>",
  },
  {
    title: "Why Developer Experience Is the New User Experience",
    audience: "candidates",
    tags: ["Developer Experience", "Engineering Culture"],
    readDuration: "6 min read",
    description:
      "<p>The people who write the product deserve the same care as the people who use it. Inside the tooling decisions that decide how good a team can be.</p>",
  },
  {
    title:
      "Building a Magento B2B E-Commerce Platform with Sage ERP Integration",
    audience: "customerStories",
    tags: ["E-commerce", "Magento/Adobe Commerce", "APIs & Integrations"],
    readDuration: "8 min read",
    description:
      "<p>A distributor wanted self-service ordering for thousands of trade accounts — without replacing the ERP that already ran the business.</p>",
  },
  {
    title: "The Hidden Cost of Time & Material in the AI Era",
    audience: "decisionMakers",
    tags: ["Software Delivery", "AI"],
    readDuration: "7 min read",
    description:
      "<p>AI did not make hourly billing fair — it made the question louder. A look at what you are really buying when you buy hours.</p>",
  },
  {
    title:
      "Breaking Down Silos: How to Make Legacy Systems Talk to Modern Tools Through APIs",
    audience: "developers",
    tags: [
      "Legacy Modernization",
      "APIs & Integrations",
      "Software Architecture",
    ],
    readDuration: "10 min read",
    description:
      "<p>The old system is not going anywhere — so give it a voice. Integration patterns that survive the next five years of change.</p>",
  },
  {
    title:
      "“I Just Call to Say I’ll Hire You!” Let’s Talk About the Polcode Recruitment Process",
    audience: "candidates",
    tags: ["Careers", "Engineering Culture"],
    readDuration: "5 min read",
    description:
      "<p>What really happens between your application and the offer, and what each step is actually there to check.</p>",
  },
  {
    title: "How We Controlled AI Hallucinations in a Luxury Travel MVP",
    audience: "customerStories",
    tags: ["AI", "Product Development"],
    readDuration: "9 min read",
    description:
      "<p>An AI itinerary planner is only as good as its worst suggestion. The guardrails that made the output safe to publish.</p>",
  },
  {
    title:
      "Refactor, Replatform, or Rebuild? How to Choose the Right Legacy Modernization Path",
    audience: "decisionMakers",
    tags: ["Legacy Modernization", "Software Architecture"],
    readDuration: "12 min read",
    description:
      "<p>Three paths, three very different budgets. A decision framework built around risk, cost and time-to-value.</p>",
  },
  {
    title: "Automated Testing for Legacy Systems: Preventing Disaster Before It Hits",
    audience: "developers",
    tags: ["Legacy Modernization", "QA & Testing"],
    readDuration: "8 min read",
    description:
      "<p>Before you touch a line of legacy code, build the harness that tells you the truth about it.</p>",
  },
  {
    title: "Excuse me, how do I get there? The Key Importance of Onboarding",
    audience: "candidates",
    tags: ["Careers", "Engineering Culture"],
    readDuration: "6 min read",
    description:
      "<p>The first two weeks decide the next two years. What a good onboarding actually has to cover.</p>",
  },
  {
    title: "AI-Powered Search for Healthcare LMS: A Proof of Concept Journey",
    audience: "customerStories",
    tags: ["AI", "Product Development", "Healthcare"],
    readDuration: "7 min read",
    description:
      "<p>Clinicians do not search like students. A two-month proof of concept that changed how a learning platform is used.</p>",
  },
  {
    title: "The Legacy Modernization Playbook",
    audience: "decisionMakers",
    tags: ["Legacy Modernization", "Software Delivery"],
    kind: "ebook",
    readDuration: "42 pages",
    description:
      "<p>A practical guide to assessing, sequencing and de-risking the modernization of business-critical systems.</p>",
  },
  {
    title: "The CTO's Guide to AI in Software Delivery",
    audience: "decisionMakers",
    tags: ["AI", "Software Delivery", "Team Augmentation"],
    kind: "ebook",
    readDuration: "36 pages",
    description:
      "<p>Where AI-assisted delivery genuinely pays off, where it quietly adds risk, and how to govern it.</p>",
  },
  {
    title: "Team Augmentation Handbook",
    audience: "decisionMakers",
    tags: ["Team Augmentation", "Software Delivery"],
    kind: "ebook",
    readDuration: "28 pages",
    description:
      "<p>How to extend an in-house team without losing ownership of the roadmap, the architecture or the culture.</p>",
  },
  {
    title: "Polcode Podcast #12 — AI-Assisted Delivery in Practice",
    audience: "developers",
    tags: ["AI", "Developer Experience"],
    kind: "podcast",
    duration: "38 min",
    readDuration: "38 min",
    description:
      "<p>What changed in our teams once AI tools became part of the daily workflow, and what stayed exactly the same.</p>",
  },
  {
    title: "Polcode Podcast #11 — Replatforming Without the Drama",
    audience: "decisionMakers",
    tags: ["Legacy Modernization", "Software Architecture"],
    kind: "podcast",
    duration: "44 min",
    readDuration: "44 min",
    description:
      "<p>Two engineers who moved a live platform twice explain the decisions they would not repeat.</p>",
  },
  {
    title: "Polcode Podcast #10 — Building QA into a Legacy Release Train",
    audience: "developers",
    tags: ["QA & Testing", "Legacy Modernization"],
    kind: "podcast",
    duration: "31 min",
    readDuration: "31 min",
    description:
      "<p>How a release train that shipped quarterly got to weekly without adding a single manual regression pass.</p>",
  },
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
      const key = row[idField];
      map.set(key, { ...(map.get(key) ?? {}), [status]: row });
    }
  }
  return map;
}

async function putVersions(collection, documentId, draftData, publishedData) {
  await api(`${STRAPI_URL}/api/${collection}/${documentId}?status=draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: draftData }),
  });
  await api(`${STRAPI_URL}/api/${collection}/${documentId}?status=published`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: publishedData ?? draftData }),
  });
}

const slugify = (value) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const bodyFor = (resource) =>
  [
    `<p>${resource.description.replace(/^<p>|<\/p>$/g, "")}</p>`,
    "<p>This is placeholder seed copy used to exercise the resources list, the article template and its on-page navigation. It is meant to be replaced by the editorial team.</p>",
  ].join("");

if (DRY_RUN) {
  console.log(
    JSON.stringify(
      {
        tags: TAGS.length,
        resources: RESOURCES.length,
        audiences: AUDIENCES.length,
        resourceTypes: RESOURCE_TYPES.map((t) => t.slug),
        kinds: RESOURCES.map((r) => r.kind ?? "article"),
      },
      null,
      1,
    ),
  );
  console.log("\nDry run — nothing written.");
  process.exit(0);
}

const media = (await api(`${STRAPI_URL}/api/upload/files?pagination[pageSize]=5`))
  .filter((file) => file.mime?.startsWith("image/"));
const featuredMedia = media[0]?.id ?? null;

console.log(`Seeding ${TAGS.length} tags…`);
const tagMap = await versionMap("tags");
for (const [index, title] of TAGS.entries()) {
  const existing = tagMap.get(title);
  const data = { title, slug: slugify(title), sortOrder: index };
  if (existing) {
    await putVersions("tags", existing.draft.documentId, data);
  } else {
    const created = await api(`${STRAPI_URL}/api/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    await api(
      `${STRAPI_URL}/api/tags/${created.data.documentId}?status=published`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      },
    );
  }
}

const tags = await versionMap("tags");

console.log(`Seeding ${AUDIENCES.length} audiences…`);
const audienceMap = await versionMap("primary-audiences", "slug");
for (const { key, ...data } of AUDIENCES) {
  const existing = audienceMap.get(data.slug);
  if (existing) {
    await putVersions("audiences", existing.draft.documentId, data);
  } else {
    const created = await api(`${STRAPI_URL}/api/primary-audiences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    await api(
      `${STRAPI_URL}/api/primary-audiences/${created.data.documentId}?status=published`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      },
    );
  }
}

const audiences = await versionMap("primary-audiences", "slug");

console.log(`Seeding ${RESOURCE_TYPES.length} resource types…`);
const resourceTypeMap = await versionMap("resource-types", "slug");
for (const { key, ...data } of RESOURCE_TYPES) {
  const existing = resourceTypeMap.get(data.slug);
  if (existing) {
    await putVersions("resource-types", existing.draft.documentId, data);
  } else {
    const created = await api(`${STRAPI_URL}/api/resource-types`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    await api(
      `${STRAPI_URL}/api/resource-types/${created.data.documentId}?status=published`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      },
    );
  }
}

const resourceTypes = await versionMap("resource-types", "slug");
const authors = await versionMap("authors", "fullName");
const insights = await versionMap("insights");

console.log(`Seeding ${RESOURCES.length} resources…`);
const rows = [];

for (const resource of [...RESOURCES].reverse()) {
  const slug = slugify(resource.title);
  const author = authors.get(AUTHOR);
  const tagRows = resource.tags.map((title) => {
    const entry = tags.get(title);
    if (!entry) throw new Error(`unknown tag: ${title}`);
    return entry;
  });
  const audienceKey = AUDIENCES.find((a) => a.key === resource.audience);
  const audienceRow = audiences.get(audienceKey?.slug);
  if (!audienceRow) throw new Error(`unknown audience: ${resource.audience}`);

  const typeKey = resource.kind ?? "article";
  const typeRow = resourceTypes.get(typeKey);
  if (!typeRow) throw new Error(`unknown resource type: ${typeKey}`);

  const payloadFor = (status) => ({
    title: resource.title,
    slug,
    description: resource.description,
    resourceType: typeRow[status]?.id,
    audience: audienceRow[status]?.id,
    readDuration: resource.readDuration,
    duration: resource.duration,
    author: author?.[status]?.id,
    tags: tagRows.map((row) => row[status]?.id).filter(Boolean),
    featuredMedia,
    sections: [
      {
        __component: "sections.rich-content-body",
        variant: "blogPost",
        showNav: true,
        blocks: [
          {
            type: "wysiwyg",
            title: "Overview",
            addToNav: true,
            content: bodyFor(resource),
          },
          {
            type: "wysiwyg",
            title: "What to take away",
            addToNav: true,
            content:
              "<ul><li>The constraint that matters is rarely the technology.</li><li>Sequence the work so value arrives before risk does.</li><li>Write down the decision, not just the outcome.</li></ul>",
          },
        ],
      },
    ],
  });

  let documentId = insights.get(resource.title)?.draft?.documentId;

  if (!documentId) {
    const created = await api(`${STRAPI_URL}/api/insights`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: payloadFor("draft") }),
    });
    documentId = created.data.documentId;
  }

  await putVersions("insights", documentId, payloadFor("draft"), payloadFor("published"));

  rows.push({
    slug,
    type: typeKey,
    audience: audienceKey.title,
    tags: resource.tags.length,
    documentId,
  });
}

console.table(rows);
console.log(
  `\nDone — ${TAGS.length} tags, ${AUDIENCES.length} audiences, ${RESOURCE_TYPES.length} resource types and ${RESOURCES.length} resources written.`,
);

execFileSync(process.execPath, [REPAIR], { stdio: "inherit" });
