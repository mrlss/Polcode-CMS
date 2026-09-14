/**
 * Creates the `privacy-policy` page (the general-content template) with one
 * `sections.rich-content-body` section: the page title as the section headline,
 * `showNav` on (so the left column / mobile select render from the article
 * headings) and one WYSIWYG block per section of the design's menu.
 *
 * The menu is the design's own list (01 … 20); the body copy under each heading
 * is a short placeholder sentence — swap it for the approved policy text in the
 * CMS (Content Manager → Pages → Privacy Policy → Blocks).
 *
 * Usage (Strapi running, from the strapi project root):
 *   node scripts/seed-privacy-policy.mjs
 */
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const ORIGIN = process.env.STRAPI_URL ?? "http://localhost:1337";
const dbPath = path.join(process.cwd(), ".tmp", "data.db");

if (!fs.existsSync(dbPath)) {
  console.error(`DB not found at ${dbPath} — run from the strapi project root.`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });
// Strapi 5 stores API tokens encrypted, so the DB cannot hand one over: the
// script takes `STRAPI_TOKEN` (or the value in the frontend's env) instead.
const token =
  process.env.STRAPI_TOKEN ?? readFrontendToken() ?? null;
db.close();

function readFrontendToken() {
  for (const file of ["../frontend/.env.local", "../frontend/.env"]) {
    const candidate = path.join(process.cwd(), file);
    if (!fs.existsSync(candidate)) continue;
    const match = fs
      .readFileSync(candidate, "utf8")
      .match(/^STRAPI_ACCESS_TOKEN\s*=\s*"?([^"\n]+)"?/m);
    if (match) return match[1].trim();
  }
  return null;
}
if (!token) {
  console.error(
    "No full-access API token found. Create one in Settings → API Tokens, or pass STRAPI_TOKEN."
  );
  process.exit(1);
}

/** The design's menu (frame 1:13874) — heading + its paragraph. */
const SECTIONS = [
  ["Purpose of this notice", "This section explains what this policy covers and who it applies to."],
  ["Who are we?", "This section identifies the company behind the website and the services it provides."],
  ["Definitions", "This section lists the terms used across the policy and what they mean here."],
  ["Rules of using the Website", "This section describes the rules for using the website and its content."],
  ["How you can contact us?", "This section lists the channels you can use to reach us with questions."],
  ["Use of our Site", "This section explains how the website may be used and what is not allowed."],
  ["Providing electronic services", "This section covers the electronic services we provide through the website."],
  ["Contact Form and email correspondence", "This section describes what happens to the data you send through the form or by email."],
  ["Job applications", "This section explains how we handle applications and recruitment data."],
  ["Polcode's Talent Pool", "This section describes the talent pool and how to join or leave it."],
  ["Newsletter (Polcode's blog)", "This section covers the newsletter, subscriptions and how to unsubscribe."],
  [
    "Information about processing personal data for people associated with our Clients (Client's personnel)",
    "This section describes how we process data of people associated with our clients.",
  ],
  ["LINK application demo version", "This section covers the demo application and the data processed while using it."],
  ["Cookies, Site traffic data and information about your computer", "This section explains cookies, analytics and what we record about your device."],
  ["Social Media", "This section describes our social media profiles and the data processed there."],
  ["Your rights", "This section lists your rights and how to exercise them."],
  ["Data processing duration", "This section explains how long we keep data and why."],
  ["Transmission of data outside the EEA", "This section covers transfers outside the EEA and the safeguards we apply."],
  ["Data recipients", "This section lists the categories of recipients we share data with."],
  ["Security", "This section describes the measures we use to keep data secure."],
];

const blocks = SECTIONS.map(([title, body]) => ({
  // A repeatable component (not a dynamic zone) — no `__component` key here.
  type: "wysiwyg",
  title,
  addToNav: true,
  content: `<h2>${title.replace(/'/g, "&rsquo;")}</h2>\n<p>${body}</p>`,
}));

const payload = {
  data: {
    title: "Privacy Policy",
    slug: "privacy-policy",
    showScrollTop: true,
    showSectionsNav: false,
    sections: [
      {
        __component: "sections.rich-content-body",
        anchor: "privacy-policy",
        showNav: true,
        headline: { title: "Privacy Policy" },
        theme: { background: "white", textColor: "dark" },
        blocks,
      },
    ],
  },
};

const existing = await fetch(
  `${ORIGIN}/api/pages?filters[slug][$eq]=privacy-policy&status=published`,
  { headers: { Authorization: `Bearer ${token}` } }
).then((r) => r.json());

const found = existing?.data?.[0];

const response = await fetch(
  found
    ? `${ORIGIN}/api/pages/${found.documentId}?status=published`
    : `${ORIGIN}/api/pages?status=published`,
  {
    method: found ? "PUT" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }
);

const result = await response.json();

if (!response.ok) {
  console.error("Failed:", response.status, JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(
  `${found ? "Updated" : "Created"} page "${result.data?.title}" (documentId ${result.data?.documentId}) —`,
  `http://localhost:3000/privacy-policy`
);
