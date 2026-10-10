#!/usr/bin/env node

/*
 * Adds demo client + team testimonials and wires them into the homepage
 * carousels.
 *
 * The `client-testimonials` / `team-testimonials` collections exist but are
 * empty, and the homepage currently only carries a hiring-process carousel, so
 * this script does two things for EVERY homepage version (draft + published):
 *
 *   1. creates the testimonial rows (reusing the already-uploaded
 *      `*-testimonial-0N.svg` media — no new uploads),
 *   2. makes sure a carousel section of the matching `collectionType` exists on
 *      the homepage (created right after the last section if missing) and
 *      points its relation at exactly those rows, in order.
 *
 * Everything is written straight to SQLite so relation order and the
 * draft/published linkage are exact — the content API normalises relation ids
 * to the published rows, which leaves the Content Manager showing empty
 * relations on drafts.
 *
 * Usage (Strapi can stay running):
 *   node scripts/add-testimonials.mjs            # dry run, prints the plan
 *   node scripts/add-testimonials.mjs --apply    # writes (backs up the DB)
 */

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.STRAPI_DB ?? ".tmp/data.db";
const APPLY = process.argv.includes("--apply");
const HOMEPAGE_SLUG = "index";
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

const CLIENT_TESTIMONIALS = [
  {
    author: "Maria Kowalski",
    position: "Chief Product Officer, Fintech Labs",
    text: "<p>Polcode rebuilt our onboarding flow in ten weeks and it paid for itself within the first month. Senior engineers, clear ownership, no babysitting.</p>",
    media: "client-testimonial-01.svg",
    client: "Fintech Labs",
  },
  {
    author: "Tom Müller",
    position: "Chief Technology Officer, HealthPlus",
    text: "<p>A true engineering partner, not a vendor. They understood our compliance constraints and still shipped faster than our in-house team could have.</p>",
    media: "client-testimonial-02.svg",
    client: "HealthPlus",
  },
  {
    author: "Sofia Ricci",
    position: "Chief Executive Officer, TravelHub",
    text: "<p>They turned a legacy booking system into a platform we are genuinely proud of. Migration, a new mobile app, and a 40% drop in support tickets.</p>",
    media: "client-testimonial-03.svg",
    client: "TravelHub",
  },
  {
    author: "David Chen",
    position: "VP Engineering, Retailly",
    text: "<p>Fast, senior, and genuinely invested in our product. Code review, docs, pairing — the quality bar we would expect from our own staff.</p>",
    media: "client-testimonial-04.svg",
    client: "Retailly",
  },
  {
    author: "Ola Jensen",
    position: "Chief Operating Officer, EduDot",
    text: "<p>Reliable delivery across every single sprint. The roadmap they gave us in week one is the roadmap they delivered in month nine.</p>",
    media: "client-testimonial-05.svg",
    client: "EduDot",
  },
  {
    author: "Ravi Patel",
    position: "Head of Product, Manufacturo",
    text: "<p>Our go-to team for anything complex. They untangled a decade of IoT data and gave our operators a dashboard they actually open.</p>",
    media: "client-testimonial-06.svg",
    client: "Manufacturo",
  },
];

const TEAM_TESTIMONIALS = [
  {
    author: "Anna Nowak",
    position: "Principal Consultant",
    text: "<p>Senior people who take real ownership end to end. The kind of team that treats your deadlines as their own.</p>",
    media: "team-testimonial-01.svg",
  },
  {
    author: "Piotr Zieliński",
    position: "Engineering Manager",
    text: "<p>Clear process, zero drama. Every sprint ends with something you can actually use.</p>",
    media: "team-testimonial-02.svg",
  },
  {
    author: "Marta Kowalczyk",
    position: "Head of Design",
    text: "<p>Design that ships — not just decks. Every prototype is tested with real users before a line of code is written.</p>",
    media: "team-testimonial-03.svg",
  },
  {
    author: "Tomasz Lis",
    position: "QA Lead",
    text: "<p>Quality is built in, not bolted on. Automated checks and honest release notes on every single delivery.</p>",
    media: "team-testimonial-04.svg",
  },
  {
    author: "Julia Wiśniewska",
    position: "Delivery Manager",
    text: "<p>Transparent by default. You always know what is done, what is next, and what changed along the way.</p>",
    media: "team-testimonial-05.svg",
  },
  {
    author: "Kacper Mazur",
    position: "Senior Backend Engineer",
    text: "<p>Clean architecture and boring, reliable technology. The most exciting feature is the one that never breaks.</p>",
    media: "team-testimonial-06.svg",
  },
];

const COLLECTIONS = [
  {
    table: "client_testimonials",
    uid: "api::client-testimonial.client-testimonial",
    collectionType: "clientTestimonials",
    headline: "What our clients say",
    entries: CLIENT_TESTIMONIALS,
    linkTable: "components_sections_carousels_client_testimonials_lnk",
    linkColumn: "client_testimonial_id",
    orderColumn: "client_testimonial_ord",
    clientLink: true,
  },
  {
    table: "team_testimonials",
    uid: "api::team-testimonial.team-testimonial",
    collectionType: "teamTestimonials",
    headline: "Team testimonials",
    entries: TEAM_TESTIMONIALS,
    linkTable: "components_sections_carousels_team_testimonials_lnk",
    linkColumn: "team_testimonial_id",
    orderColumn: "team_testimonial_ord",
    clientLink: false,
  },
];

const db = new Database(DB_PATH);
db.pragma("busy_timeout = 8000");

const randomId = () => {
  let out = "";
  for (let i = 0; i < 24; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
};

const stamp = () => new Date().toISOString();

const mediaIdByName = () => {
  const map = new Map();
  for (const row of db
    .prepare("select id, name from files where name is not null")
    .all()) {
    map.set(row.name, row.id);
  }
  return map;
};

const plan = [];
const note = (msg) => plan.push(msg);

const pages = db
  .prepare(
    "select id, document_id, published_at from pages where slug = ? order by published_at is null desc",
  )
  .all(HOMEPAGE_SLUG);

if (pages.length < 2) {
  throw new Error(
    `homepage ("${HOMEPAGE_SLUG}") needs a draft AND a published row — found ${pages.length}`,
  );
}

const draftPage = pages.find((p) => p.published_at === null);
const publishedPage = pages.find((p) => p.published_at !== null);

const clientsByName = new Map();
{
  const rows = db
    .prepare("select id, name, published_at from clients")
    .all();
  for (const row of rows) {
    const key = `${row.name}|${row.published_at === null ? "draft" : "published"}`;
    clientsByName.set(key, row.id);
  }
}

const existingCarousel = (pageId, collectionType) =>
  db
    .prepare(
      `select c.id
         from components_sections_carousels c
         join pages_cmps p
           on p.cmp_id = c.id and p.component_type = 'sections.carousel'
        where p.entity_id = ? and c.collection_type = ?`,
    )
    .get(pageId, collectionType);

const nextSectionOrder = (pageId) => {
  const row = db
    .prepare("select max(\"order\") as maxOrder from pages_cmps where entity_id = ?")
    .get(pageId);
  return (row?.maxOrder ?? 0) + 1;
};

const insertDraftAndPublished = (table, columns, values) => {
  const info = db
    .prepare(
      `insert into ${table} (${columns.join(", ")}) values (${columns
        .map(() => "?")
        .join(", ")})`,
    )
    .run(...values);
  return info.lastInsertRowid;
};

const ensureTestimonial = (collection, entry, mediaIds) => {
  const existing = db
    .prepare(
      `select id, document_id, published_at from ${collection.table} where author = ?`,
    )
    .all(entry.author);

  if (existing.length > 0) {
    const documentId = existing[0].document_id;
    const draft = existing.find((r) => r.published_at === null);
    const published = existing.find((r) => r.published_at !== null);
    note(`  = ${collection.table}: "${entry.author}" already exists (${documentId})`);
    if (!draft || !published) {
      throw new Error(
        `"${entry.author}" exists without a matching draft+published pair — fix it in the admin first`,
      );
    }
    return { documentId, draft: draft.id, published: published.id, created: false };
  }

  const media = mediaIds.get(entry.media);
  if (!media) throw new Error(`media not found: ${entry.media}`);

  note(
    `  + ${collection.table}: "${entry.author}" (${entry.position}) + media ${entry.media}#${media}`,
  );

  if (!APPLY) {
    return { documentId: "(new)", draft: null, published: null, created: true };
  }

  const documentId = randomId();
  const ts = stamp();
  const columns = [
    "document_id",
    "author",
    "position",
    "text",
    "created_at",
    "updated_at",
    "published_at",
    "locale",
  ];
  const draftId = insertDraftAndPublished(collection.table, columns, [
    documentId,
    entry.author,
    entry.position,
    entry.text,
    ts,
    ts,
    null,
    null,
  ]);
  const publishedId = insertDraftAndPublished(collection.table, columns, [
    documentId,
    entry.author,
    entry.position,
    entry.text,
    ts,
    ts,
    new Date().toISOString(),
    null,
  ]);

  for (const relatedId of [draftId, publishedId]) {
    db.prepare(
      `insert into files_related_mph (file_id, related_id, related_type, field, "order")
       values (?, ?, ?, 'media', 1)`,
    ).run(media, relatedId, collection.uid);
  }

  return { documentId, draft: draftId, published: publishedId, created: true };
};

const ensureClientLink = (collection, testimonialId, clientName, version) => {
  const clientId = clientsByName.get(`${clientName}|${version}`);
  if (!clientId) {
    throw new Error(`client "${clientName}" has no ${version} row`);
  }
  db.prepare(
    "delete from client_testimonials_client_lnk where client_testimonial_id = ?",
  ).run(testimonialId);
  db.prepare(
    `insert into client_testimonials_client_lnk (client_testimonial_id, client_id, client_testimonial_ord)
     values (?, ?, 1)`,
  ).run(testimonialId, clientId);
};

const ensureCarousel = (page, collection, testimonialIds) => {
  const version = page.published_at === null ? "draft" : "published";
  let carousel = existingCarousel(page.id, collection.collectionType);

  if (carousel) {
    note(
      `  = homepage (${version}): carousel "${collection.collectionType}" #${carousel.id} already linked`,
    );
  } else {
    note(
      `  + homepage (${version}): new carousel "${collection.collectionType}" ("${collection.headline}") appended as section ${nextSectionOrder(page.id)}`,
    );
    if (!APPLY) return;

    carousel = {
      id: insertDraftAndPublished(
        "components_sections_carousels",
        [
          "collection_type",
          "show_navigation",
          "show_pagination",
          "small_cards",
          "insights_pick",
          "insights_limit",
          "show_logos",
          "anchor",
        ],
        [collection.collectionType, 0, 1, 0, "latest", 5, 1, null],
      ),
    };

    const headlineId = insertDraftAndPublished(
      "components_shared_headlines",
      ["title", "add_count"],
      [collection.headline, 0],
    );

    db.prepare(
      `insert into components_sections_carousels_cmps (entity_id, cmp_id, component_type, field, "order")
       values (?, ?, 'shared.headline', 'headline', null)`,
    ).run(carousel.id, headlineId);

    db.prepare(
      `insert into pages_cmps (entity_id, cmp_id, component_type, field, "order")
       values (?, ?, 'sections.carousel', 'sections', ?)`,
    ).run(page.id, carousel.id, nextSectionOrder(page.id));
  }

  if (!APPLY) return;

  db.prepare(`delete from ${collection.linkTable} where carousel_id = ?`).run(
    carousel.id,
  );
  testimonialIds.forEach((id, index) => {
    db.prepare(
      `insert into ${collection.linkTable} (carousel_id, ${collection.linkColumn}, ${collection.orderColumn})
       values (?, ?, ?)`,
    ).run(carousel.id, id, index + 1);
  });
};

const backup = () => {
  const file = `${DB_PATH}.bak-testimonials-${stamp().replace(/[:.]/g, "-")}`;
  fs.copyFileSync(DB_PATH, file);
  console.log(`backup: ${file}`);
};

const main = () => {
  const mediaIds = mediaIdByName();
  console.log(
    `add-testimonials — ${APPLY ? "APPLY" : "DRY RUN"} (${DB_PATH})`,
  );
  console.log(
    `homepage: draft #${draftPage.id} / published #${publishedPage.id}`,
  );

  for (const collection of COLLECTIONS) {
    console.log(`\n${collection.collectionType} (${collection.entries.length} entries)`);
    const created = collection.entries.map((entry) =>
      ensureTestimonial(collection, entry, mediaIds),
    );

    if (APPLY && collection.clientLink) {
      collection.entries.forEach((entry, index) => {
        ensureClientLink(collection, created[index].draft, entry.client, "draft");
        ensureClientLink(
          collection,
          created[index].published,
          entry.client,
          "published",
        );
      });
    }

    const draftIds = created.map((r) => r.draft);
    const publishedIds = created.map((r) => r.published);
    console.log(
      `  links → draft: ${draftIds.join(", ")}\n          published: ${publishedIds.join(", ")}`,
    );

    ensureCarousel(draftPage, collection, draftIds);
    ensureCarousel(publishedPage, collection, publishedIds);
  }

  if (!APPLY) {
    console.log("\n--- plan ---");
    for (const line of plan) console.log(line);
    console.log("\ndry run — re-run with --apply to write");
    return;
  }

  const counts = COLLECTIONS.map((c) => {
    const rows = db
      .prepare(`select count(*) as n from ${c.table} where published_at is not null`)
      .get();
    const links = db.prepare(`select count(*) as n from ${c.linkTable}`).get();
    return `${c.collectionType}: ${rows.n} published / ${links.n} carousel links`;
  });
  console.log(`\ndone — ${counts.join("; ")}`);
};

if (APPLY) backup();
main();
db.close();
