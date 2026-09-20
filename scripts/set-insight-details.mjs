#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const STRAPI_URL = process.env.STRAPI_URL ?? "http://localhost:1337";
const DRY_RUN = process.argv.includes("--dry-run");

const INSIGHT_SLUG =
  "from-liability-to-asset-modernizing-legacy-systems-through-automated-testing";

const AUTHORS = ["Anna Kowalska", "Marek Nowak", "Julia Zielińska"];

const INSIGHT_AUTHOR = "Anna Kowalska";
const INSIGHT_TAGS = [
  "Legacy Modernization",
  "QA & Testing",
  "Software Delivery",
];
const INSIGHT_AUDIENCE = "for-decision-makers";
const INSIGHT_KIND = "article";
const READ_DURATION = "4 min read";

const DESCRIPTION =
  "<p>Maintaining legacy codebases without modern safety nets introduces severe operational risks, high regression costs, and human error. This article outlines a precise framework for wrapping critical logic in a protective layer of automated testing—transforming fragile digital infrastructure into a stable, risk-free platform for future scalability and business growth.</p>";

const BLOCKS = [
  {
    title: "The goal is simple: stop guessing and start knowing.",
    content: [
      "<p>Maintaining legacy systems often feels like walking through a minefield. One wrong step in the source code can trigger a chain reaction of failures across a platform that has been stable for years. For many organizations, these systems are the backbone of their operations, yet they lack the modern safety nets—like comprehensive test coverage—that contemporary frameworks provide.</p>",
      "<p>The challenge isn't just about writing new code; it is about ensuring that the old, critical logic remains intact while the world around it changes. The danger of manual regression testing in these environments is that it is inherently prone to human error and high costs.</p>",
      "<figure><img src=\"/uploads/img002_b810935c28.jpg\" alt=\"A build pipeline reporting failing checks\" /></figure>",
    ].join(""),
  },
  {
    title: "The Hidden Cost of Technical Debt",
    content: [
      "<p>Effective automation in legacy contexts requires a strategic, layered approach rather than a &ldquo;rip and replace&rdquo; mentality. Starting with high-level integration tests or &ldquo;characterization tests&rdquo; allows teams to document existing behavior <em>before</em> changing a single line of code. This creates a baseline of truth.</p>",
      "<p>Once the outer boundaries are secure, developers can begin isolating specific modules for unit testing, slowly peeling back the layers of technical debt. This systematic de-risking process ensures that the transition to modern standards is both smooth and secure.</p>",
      "<p>Beyond the technical benefits, automated testing restores the &ldquo;human&rdquo; element of development. Instead of spending hours in tedious manual cycles, your team can focus on what they do best: designing elegant solutions and solving complex problems.</p>",
    ].join(""),
  },
  {
    title: "True reliability is built one automated test at a time.",
    content: [
      "<ul>",
      "<li><strong>Early Detection:</strong> Catching failures in the CI/CD pipeline before they reach production.</li>",
      "<li><strong>Documentation by Code:</strong> Using tests to explain how the legacy system actually functions.</li>",
      "<li><strong>Risk Mitigation:</strong> Reducing the &ldquo;fear factor&rdquo; associated with updating old dependencies.</li>",
      "<li><strong>Scalability:</strong> Ensuring the system can handle new traffic without breaking old logic.</li>",
      "<li><strong>Efficiency:</strong> Freeing up human talent to focus on innovation rather than manual QA.</li>",
      "<li><strong>Consistency:</strong> Providing the same level of scrutiny to every update, every single time.</li>",
      "<li><strong>Trust:</strong> Building a reliable platform that stakeholders can count on for years to come.</li>",
      "</ul>",
    ].join(""),
  },
  {
    title: "Columns",
    content: [
      "<p>In an era where technology moves at the &ldquo;absolute edge of possible,&rdquo; staying stagnant is not an option. However, moving forward requires a solid foundation. Automated testing provides that ground, bridging the gap between aging infrastructure and modern innovation.</p>",
      "<div class=\"wysiwyg-columns\">",
      "<p>Our engineers began with a comprehensive technical audit, deep-diving into the existing codebase, system architecture, and internal documentation. This wasn't just about reading code; it involved identifying hidden technical debt, assessing security protocols, and understanding the logic behind legacy modules.</p>",
      "<p>Following the audit, we established a structured transition roadmap with clear milestones. This plan allowed us to assume full responsibility for the core product in phases, ensuring that domain knowledge was solidified before moving to the next level of complexity.</p>",
      "</div>",
    ].join(""),
  },
  {
    title: "Embedded Code",
    content: [
      "<p>A minimum viable harness: characterize the critical path from the outside before touching production code.</p>",
      "<pre><code>describe('invoice totals', () =&gt; {\n  it('keeps rounding stable', async () =&gt; {\n    const invoice = await billing.create(fixtures.legacyInvoice)\n    expect(invoice.total).toBe('1234.56')\n  })\n})</code></pre>",
    ].join(""),
  },
  {
    title: "Table",
    content: [
      "<table>",
      "<thead><tr><th>Layer</th><th>Target</th><th>Rationale</th></tr></thead>",
      "<tbody>",
      "<tr><td>Domain logic</td><td>80&ndash;90%</td><td>Cheapest place to catch regressions.</td></tr>",
      "<tr><td>Integration</td><td>Critical paths</td><td>Covers serialization and permissions.</td></tr>",
      "<tr><td>End to end</td><td>5&ndash;10 flows</td><td>Guards the money journeys only.</td></tr>",
      "</tbody>",
      "</table>",
    ].join(""),
  },
];

const SECTION_ANCHORS = [
  "the-goal-is-simple",
  "the-hidden-cost-of-technical-debt",
  "true-reliability",
  "columns",
  "embedded-code",
  "table",
];

const SECTIONS = [
  {
    __component: "sections.rich-content-body",
    showNav: true,
    variant: "blogPost",
    blocks: BLOCKS.map((block, i) => ({
      type: "wysiwyg",
      title: block.title,
      anchor: SECTION_ANCHORS[i],
      addToNav: true,
      content: block.content,
    })),
  },
  {
    __component: "sections.form",
    variant: "compact",
    title: "Sign up for the Latest PolCode News",
    label: "Subscribe to news",
    description:
      "<p>Join our newsletter to stay up to date. No spam, ever.</p>",
    theme: { background: "black", textColor: "light" },
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

const listByField = (collection, status, field) =>
  api(
    `${STRAPI_URL}/api/${collection}?status=${status}&pagination[pageSize]=200&fields[0]=${field}&fields[1]=documentId`,
  ).then((r) => r.data);

async function ensureByField(collection, field, value) {
  const rows = await listByField(collection, "draft", field);
  const found = rows.find((r) => r[field] === value);
  if (found) return found.documentId;

  const created = await api(`${STRAPI_URL}/api/${collection}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { [field]: value } }),
  });
  return created.data.documentId;
}

async function versionIds(collection, field, value) {
  const ids = {};
  for (const status of ["draft", "published"]) {
    const rows = await listByField(collection, status, field);
    ids[status] = rows.find((r) => r[field] === value)?.id;
  }
  return ids;
}

const summary = [];

for (const fullName of AUTHORS) {
  if (!DRY_RUN) {
    const documentId = await ensureByField("authors", "fullName", fullName);
    await api(`${STRAPI_URL}/api/authors/${documentId}?status=published`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { fullName } }),
    });
  }
  const ids = await versionIds("authors", "fullName", fullName);
  summary.push({
    entity: `author:${fullName}`,
    draft: ids.draft,
    published: ids.published,
  });
}

for (const title of INSIGHT_TAGS) {
  const ids = await versionIds("tags", "title", title);
  summary.push({
    entity: `tag:${title}`,
    draft: ids.draft,
    published: ids.published,
  });
}

const authorIds = await versionIds("authors", "fullName", INSIGHT_AUTHOR);
const tagIdPairs = await Promise.all(
  INSIGHT_TAGS.map((title) => versionIds("tags", "title", title)),
);
const audienceIds = await versionIds("audiences", "slug", INSIGHT_AUDIENCE);

const insight = (
  await api(
    `${STRAPI_URL}/api/insights?filters[slug][$eq]=${INSIGHT_SLUG}&status=draft&populate=featuredMedia`,
  )
).data[0];

if (!insight) throw new Error(`insight not found: ${INSIGHT_SLUG}`);

const payloadFor = (status) => ({
  title: insight.title,
  slug: INSIGHT_SLUG,
  readDuration: READ_DURATION,
  audience: audienceIds[status],
  kind: INSIGHT_KIND,
  description: DESCRIPTION,
  author: authorIds[status],
  tags: tagIdPairs.map((p) => p[status]).filter(Boolean),
  featuredMedia: insight.featuredMedia?.id,
  sections: SECTIONS,
});

if (DRY_RUN) {
  console.log(
    JSON.stringify(
      { summary, insight: insight.documentId, sections: SECTIONS.length },
      null,
      1,
    ),
  );
  console.log("\nDry run — nothing written.");
} else {
  for (const status of ["draft", "published"]) {
    const suffix = status === "published" ? "?status=published" : "?status=draft";
    await api(`${STRAPI_URL}/api/insights/${insight.documentId}${suffix}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: payloadFor(status) }),
    });
  }
  console.table(summary);
  console.log(`\nDone — ${insight.documentId} updated (draft + published).`);
}
