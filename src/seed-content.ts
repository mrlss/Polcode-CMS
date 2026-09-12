/**
 * Idempotent content seeder for local development.
 *
 * Ensures every content collection has at least `TARGET` published entries and
 * upserts a demo homepage (`slug: "index"`) whose `sections` dynamiczone
 * exercises all 28 section components with rich, 6-item content so the
 * frontend renders every block from real Strapi data.
 *
 * Run from `src/index.ts` bootstrap when `SEED_DEMO=true`.
 * Safe to re-run: existing entries are matched by key and left untouched.
 */

import type { Core } from "@strapi/strapi";
import type { UID } from "@strapi/types";
import fs from "fs";
import path from "path";

type Strapi = Core.Strapi;

const TARGET = 6;
const now = new Date();

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

type Entry = { id: number; documentId: string } & Record<string, any>;

/**
 * Ensure at least `target` entries exist for a content type.
 * Creates any of the provided `items` (matched by `keyOf`) that are missing.
 * Returns up to `target` entries (existing first, then created).
 */
async function ensureCollection(
  strapi: Strapi,
  uid: UID.ContentType,
  keyOf: (e: Entry) => string,
  items: Record<string, unknown>[],
  target: number = TARGET,
): Promise<Entry[]> {
  const q = strapi.db.query(uid);

  // Read every row for the collection, keeping one entry per document and
  // preferring the PUBLISHED row (Strapi 5.52 stores a draft + published row
  // per document). Numeric relation ids must point at published rows or Strapi
  // drops them when persisting dynamiczone components.
  const readPublished = async (): Promise<Entry[]> => {
    const all = (await q.findMany({})) as Entry[];
    const byDoc = new Map<string, Entry>();
    for (const e of all) {
      const cur = byDoc.get(e.documentId);
      if (!cur || (cur.publishedAt == null && e.publishedAt != null)) {
        byDoc.set(e.documentId, e);
      }
    }
    return [...byDoc.values()];
  };

  let entries = await readPublished();
  const seen = new Set<string>(entries.map(keyOf));

  for (const item of items) {
    if (entries.length >= target) break;
    const key = keyOf(item as Entry);
    if (seen.has(key)) continue;
    await strapi.entityService.create(uid, {
      data: { ...item, publishedAt: now.toISOString() },
    });
    seen.add(key);
    entries = await readPublished();
  }

  entries.sort((a, b) => a.id - b.id);
  return entries.slice(0, target);
}

/**
 * Upload a single file from `<cwd>/seed-assets/` and return its media id
 * (or null when the file is missing). `process.cwd()` is the strapi project
 * root because the seeder runs from `dist/src/` where `__dirname` is
 * unreliable.
 *
 * Reuses an existing upload with the same original filename (Strapi's upload
 * service never dedupes by name, so calling `upload` unconditionally created a
 * duplicate media row on every `SEED_DEMO=true` boot). The newest existing row
 * is preferred — that is the canonical copy the live content already points at.
 */
async function uploadAsset(
  strapi: Strapi,
  file: string,
  alternativeText: string,
): Promise<number | null> {
  const filePath = path.join(process.cwd(), "seed-assets", file);
  if (!fs.existsSync(filePath)) {
    console.log(`[seed-content] seed asset missing, skipping: ${filePath}`);
    return null;
  }
  const existing = await strapi.db
    .query("plugin::upload.file")
    .findOne({ where: { name: file }, orderBy: [{ id: "desc" }] });
  if (existing) return existing.id;

  const ext = path.extname(file).slice(1);
  const mimetype = ext === "svg" ? "image/svg+xml" : `image/${ext}`;
  const uploadService = strapi.plugin("upload").service("upload");
  const uploaded = await uploadService.upload({
    data: { fileInfo: { alternativeText } },
    files: {
      filepath: filePath,
      originalFilename: file,
      mimetype,
      size: fs.statSync(filePath).size,
    },
  });
  return uploaded?.[0]?.id ?? null;
}

export async function seedContent(strapi: Strapi) {
  const log = (msg: string) => console.log(`[seed-content] ${msg}`);

  // ------------------------------------------------------------------
  // Filter collections
  // ------------------------------------------------------------------
  const industries = await ensureCollection(
    strapi,
    "api::industry.industry",
    (e) => e.title,
    [
      {
        title: "FinTech",
        slug: "fintech",
        description: "<p>Payments, banking, insurance platforms.</p>",
      },
      {
        title: "Healthcare",
        slug: "healthcare",
        description: "<p>Compliant, patient-first products.</p>",
      },
      {
        title: "Retail",
        slug: "retail",
        description: "<p>Commerce experiences that convert.</p>",
      },
      {
        title: "Travel & Mobility",
        slug: "travel-mobility",
        description: "<p>Booking, logistics and fleet software.</p>",
      },
      {
        title: "Manufacturing",
        slug: "manufacturing",
        description: "<p>IoT, production analytics and ERP.</p>",
      },
      {
        title: "EdTech",
        slug: "edtech",
        description: "<p>Learning platforms and assessment tools.</p>",
      },
    ],
  );

  const services = await ensureCollection(
    strapi,
    "api::service.service",
    (e) => e.title,
    [
      {
        title: "Frontend",
        slug: "frontend",
        description: "<p>Frontend services.</p>",
        link: "/what-we-do?service=frontend",
      },
      {
        title: "Backend",
        slug: "backend",
        description: "<p>Backend services.</p>",
        link: "/what-we-do?service=backend",
      },
      {
        title: "DevOps",
        slug: "devops",
        description: "<p>DevOps services.</p>",
        link: "/what-we-do?service=devops",
      },
      {
        title: "Product Design",
        slug: "product-design",
        description: "<p>Product design services.</p>",
        link: "/what-we-do?service=design",
      },
      {
        title: "QA & Testing",
        slug: "qa-testing",
        description: "<p>QA and testing services.</p>",
        link: "/what-we-do?service=qa",
      },
      {
        title: "Cloud & Data",
        slug: "cloud-data",
        description: "<p>Cloud and data services.</p>",
        link: "/what-we-do?service=cloud",
      },
    ],
  );

  const regions = await ensureCollection(
    strapi,
    "api::region.region",
    (e) => e.title,
    [
      { title: "Europe", slug: "europe" },
      { title: "North America", slug: "north-america" },
      { title: "Middle East", slug: "middle-east" },
      { title: "Asia-Pacific", slug: "asia-pacific" },
      { title: "Latin America", slug: "latin-america" },
      { title: "Africa", slug: "africa" },
    ],
  );

  const platforms = await ensureCollection(
    strapi,
    "api::platform.platform",
    (e) => e.title,
    [
      { title: "Clutch" },
      { title: "Awwwards" },
      { title: "Google Partner" },
      { title: "Microsoft Partner" },
      { title: "AWS Partner" },
      { title: "DesignRush" },
    ],
  );

  // ------------------------------------------------------------------
  // Content collections
  // ------------------------------------------------------------------
  const achievements = await ensureCollection(
    strapi,
    "api::achievement.achievement",
    (e) => e.title,
    [
      {
        title: "Top B2B Service Provider",
        date: "2025-01-01",
        link: "https://clutch.co",
        platform: platforms[0].id,
      },
      {
        title: "Awwwards Honorable Mention",
        date: "2024-06-01",
        link: "https://clutch.co",
        platform: platforms[1].id,
      },
      {
        title: "Clutch Global Leader",
        date: "2024-12-10",
        link: "https://clutch.co",
        platform: platforms[0].id,
      },
      {
        title: "Best Mobile App 2024",
        date: "2024-04-20",
        link: "https://clutch.co",
        platform: platforms[1].id,
      },
      {
        title: "Top Rated on Clutch",
        date: "2023-09-01",
        link: "https://clutch.co",
        platform: platforms[0].id,
      },
      {
        title: "DesignRush Best Agency",
        date: "2023-05-05",
        link: "https://clutch.co",
        platform: platforms[5].id,
      },
    ],
  );

  const clients = await ensureCollection(
    strapi,
    "api::client.client",
    (e) => e.link,
    [
      { name: "Fintech Labs", link: "https://fintech-labs.io" },
      { name: "HealthPlus", link: "https://healthplus.de" },
      { name: "Retailly", link: "https://retailly.com" },
      { name: "TravelHub", link: "https://travelhub.io" },
      { name: "EduDot", link: "https://edudot.org" },
      { name: "Manufacturo", link: "https://manufacturo.com" },
    ],
  );

  // ensureCollection only creates — backfill names on pre-existing clients so
  // the admin relation picker shows a label instead of the documentId.
  const clientNamesByLink: Record<string, string> = {
    "https://fintech-labs.io": "Fintech Labs",
    "https://healthplus.de": "HealthPlus",
    "https://retailly.com": "Retailly",
    "https://travelhub.io": "TravelHub",
    "https://edudot.org": "EduDot",
    "https://manufacturo.com": "Manufacturo",
  };
  const clientRows = (await strapi.db
    .query("api::client.client")
    .findMany({})) as Entry[];
  for (const row of clientRows) {
    const name = clientNamesByLink[row.link];
    if (name && row.name !== name) {
      await strapi.documents("api::client.client").update({
        documentId: row.documentId,
        status: "published",
        data: { name },
      });
    }
  }

  const faqs = await ensureCollection(strapi, "api::faq.faq", (e) => e.title, [
    {
      title: "How does billing work?",
      description:
        "<p>We bill monthly against the agreed scope. Ongoing teams work on a simple time-and-materials basis, while tightly defined phases can be fixed-price. Every invoice comes with a short report of what was delivered, so you always know what you are paying for.</p>",
    },
    {
      title: "Do you sign NDAs?",
      description:
        "<p>Yes. Send yours over before the first discovery call and we will return it signed, usually within one business day. We are also happy to follow your security and data-processing requirements.</p>",
    },
    {
      title: "How big are your teams?",
      description:
        "<p>Most projects run with a small senior squad of 4-8 people: a dedicated project manager, two to four engineers, a designer and a QA specialist. The team grows or shrinks with your roadmap, without changing how you communicate with us.</p>",
    },
    {
      title: "Which time zones do you cover?",
      description:
        "<p>We work from Europe and cover the Americas, keeping at least four hours of overlap with your working day for standups, reviews and workshops.</p>",
    },
    {
      title: "Which technologies do you use?",
      description:
        "<p>We are strongest in React, Next.js, Node.js, TypeScript and PostgreSQL, and we ship native iOS and Android apps. The stack is always chosen for maintainability rather than novelty — if your team already works with something else, we adapt to it.</p>",
    },
    {
      title: "How does onboarding work?",
      description:
        "<p>A structured two-week onboarding: a kick-off workshop to align on goals and scope, access and infrastructure setup, then a first shippable increment by the end of week two. A dedicated project manager becomes your single point of contact from day one.</p>",
    },
  ]);

  const processes = await ensureCollection(
    strapi,
    "api::process.process",
    (e) => e.title,
    [
      {
        title: "Discover",
        description: "<p>Workshops and research to align on the goal.</p>",
      },
      {
        title: "Design",
        description: "<p>Wireframes and prototypes that are easy to test.</p>",
      },
      {
        title: "Develop",
        description: "<p>Agile delivery with continuous integration.</p>",
      },
      {
        title: "Launch",
        description: "<p>Zero-downtime releases with full monitoring.</p>",
      },
      {
        title: "Optimize",
        description: "<p>Measure, iterate and improve every sprint.</p>",
      },
      {
        title: "Support",
        description: "<p>Long-term care with SLAs and 24/7 coverage.</p>",
      },
    ],
  );

  const teamMembers = await ensureCollection(
    strapi,
    "api::team.team",
    (e) => `${e.firstName}${e.lastName}`,
    [
      {
        firstName: "Anna",
        lastName: "Nowak",
        position: "Principal Consultant",
        email: "anna.nowak@polcode.com",
        description: "<p>Team member bio.</p>",
        socials: [
          {
            __component: "shared.socials",
            title: "LinkedIn",
            link: "https://linkedin.com",
          },
        ],
      },
      {
        firstName: "Piotr",
        lastName: "Zieliński",
        position: "Engineering Manager",
        email: "piotr.zielinski@polcode.com",
        description: "<p>Team member bio.</p>",
        socials: [
          {
            __component: "shared.socials",
            title: "LinkedIn",
            link: "https://linkedin.com",
          },
        ],
      },
      {
        firstName: "Marta",
        lastName: "Kowalczyk",
        position: "Head of Design",
        email: "marta.kowalczyk@polcode.com",
        description: "<p>Team member bio.</p>",
        socials: [
          {
            __component: "shared.socials",
            title: "LinkedIn",
            link: "https://linkedin.com",
          },
        ],
      },
      {
        firstName: "Jan",
        lastName: "Nowicki",
        position: "Senior Full-Stack Engineer",
        email: "jan.nowicki@polcode.com",
        description: "<p>Team member bio.</p>",
        socials: [
          {
            __component: "shared.socials",
            title: "LinkedIn",
            link: "https://linkedin.com",
          },
        ],
      },
      {
        firstName: "Eva",
        lastName: "Müller",
        position: "Delivery Lead",
        email: "eva.muller@polcode.com",
        description: "<p>Team member bio.</p>",
        socials: [
          {
            __component: "shared.socials",
            title: "LinkedIn",
            link: "https://linkedin.com",
          },
        ],
      },
      {
        firstName: "Tomasz",
        lastName: "Lis",
        position: "QA Lead",
        email: "tomasz.lis@polcode.com",
        description: "<p>Team member bio.</p>",
        socials: [
          {
            __component: "shared.socials",
            title: "LinkedIn",
            link: "https://linkedin.com",
          },
        ],
      },
    ],
  );

  // Upload testimonial placeholder visuals (`seed-assets/*.svg`) as real media
  // so every item below is fully populated (text + media + client).
  const uploadTestimonialMedia = (prefix: string) =>
    Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        uploadAsset(
          strapi,
          `${prefix}-${String(i + 1).padStart(2, "0")}.svg`,
          `Testimonial visual ${i + 1}`,
        ),
      ),
    );
  const clientMedia = await uploadTestimonialMedia("client-testimonial");
  const teamMedia = await uploadTestimonialMedia("team-testimonial");

  // Match by client NAME (not array index) — ensureCollection returns entries
  // ordered by DB id, which may differ from the seed list order above.
  const clientIdByName = (name: string) =>
    clients.find((c) => c.name === name)?.id;

  const clientTestimonials = await ensureCollection(
    strapi,
    "api::client-testimonial.client-testimonial",
    (e) => e.author,
    [
      {
        author: "Maria Kowalski",
        position: "Chief Product Officer, Fintech Labs",
        text: "<p>Polcode rebuilt our onboarding flow in ten weeks and it paid for itself within the first month. Senior engineers, clear ownership, no babysitting.</p>",
        client: clientIdByName("Fintech Labs"),
        media: clientMedia[0],
      },
      {
        author: "Tom Müller",
        position: "Chief Technology Officer, HealthPlus",
        text: "<p>A true engineering partner, not a vendor. They understood our compliance constraints and still shipped faster than our in-house team could have.</p>",
        client: clientIdByName("HealthPlus"),
        media: clientMedia[1],
      },
      {
        author: "Sofia Ricci",
        position: "Chief Executive Officer, TravelHub",
        text: "<p>They turned a legacy booking system into a platform we are genuinely proud of. Migration, a new mobile app, and a 40% drop in support tickets.</p>",
        client: clientIdByName("TravelHub"),
        media: clientMedia[2],
      },
      {
        author: "David Chen",
        position: "VP Engineering, Retailly",
        text: "<p>Fast, senior, and genuinely invested in our product. Code review, docs, pairing — the quality bar we would expect from our own staff.</p>",
        client: clientIdByName("Retailly"),
        media: clientMedia[3],
      },
      {
        author: "Ola Jensen",
        position: "Chief Operating Officer, EduDot",
        text: "<p>Reliable delivery across every single sprint. The roadmap they gave us in week one is the roadmap they delivered in month nine.</p>",
        client: clientIdByName("EduDot"),
        media: clientMedia[4],
      },
      {
        author: "Ravi Patel",
        position: "Head of Product, Manufacturo",
        text: "<p>Our go-to team for anything complex. They untangled a decade of IoT data and gave our operators a dashboard they actually open.</p>",
        client: clientIdByName("Manufacturo"),
        media: clientMedia[5],
      },
      {
        author: "Lena Fischer",
        position: "Head of Product, Fintech Labs",
        text: "<p>The second project we did with them, because the first one shipped on time. Their discovery phase alone saved us from building the wrong thing.</p>",
        client: clientIdByName("Fintech Labs"),
        media: clientMedia[6],
      },
      {
        author: "Marco Bianchi",
        position: "Chief Technology Officer, TravelHub",
        text: "<p>They scaled our checkout for Black Friday without a single incident. Real engineers who measure things and tell you the truth.</p>",
        client: clientIdByName("TravelHub"),
        media: clientMedia[7],
      },
    ],
    8,
  );

  const teamTestimonials = await ensureCollection(
    strapi,
    "api::team-testimonial.team-testimonial",
    (e) => e.author,
    [
      {
        author: "Anna Nowak",
        position: "Principal Consultant",
        text: "<p>Senior people who take real ownership end to end. The kind of team that treats your deadlines as their own.</p>",
        media: teamMedia[0],
      },
      {
        author: "Piotr Zieliński",
        position: "Engineering Manager",
        text: "<p>Clear process, zero drama. Every sprint ends with something you can actually use.</p>",
        media: teamMedia[1],
      },
      {
        author: "Marta Kowalczyk",
        position: "Head of Design",
        text: "<p>Design that ships — not just decks. Every prototype is tested with real users before a line of code is written.</p>",
        media: teamMedia[2],
      },
      {
        author: "Tomasz Lis",
        position: "QA Lead",
        text: "<p>Quality is built in, not bolted on. Automated checks and honest release notes on every single delivery.</p>",
        media: teamMedia[3],
      },
      {
        author: "Julia Wiśniewska",
        position: "Delivery Manager",
        text: "<p>Transparent by default. You always know what is done, what is next, and what changed along the way.</p>",
        media: teamMedia[4],
      },
      {
        author: "Kacper Mazur",
        position: "Senior Backend Engineer",
        text: "<p>Clean architecture and boring, reliable technology. The most exciting feature is the one that never breaks.</p>",
        media: teamMedia[5],
      },
      {
        author: "Natalia Szymańska",
        position: "DevOps Engineer",
        text: "<p>Environments that deploy themselves. We spend our time improving the product instead of fighting servers.</p>",
        media: teamMedia[6],
      },
      {
        author: "Jan Nowicki",
        position: "Business Analyst",
        text: "<p>We start from the business question, not the ticket. That is why so many of our projects outlive the original scope.</p>",
        media: teamMedia[7],
      },
    ],
    8,
  );

  const hiringProcesses = await ensureCollection(
    strapi,
    "api::hiring-process.hiring-process",
    (e) => e.title,
    [
      {
        title: "Apply",
        description:
          "<p>Tell us about yourself and the kind of problems you enjoy solving. We reply within a few days, always.</p>",
      },
      {
        title: "Intro call",
        description:
          "<p>A relaxed chat about your experience, the role and the team. You get a clear picture of what we build and how we work.</p>",
      },
      {
        title: "Technical interview",
        description:
          "<p>A practical conversation with the engineers you would work with — no whiteboard puzzles, just real problem solving.</p>",
      },
      {
        title: "Take-home task",
        description:
          "<p>A small, realistic piece of work with a generous timebox. We pay for your time and review it together.</p>",
      },
      {
        title: "Team fit & offer",
        description:
          "<p>Meet a few future teammates, then receive a written offer with transparent salary and benefits.</p>",
      },
      {
        title: "Onboarding",
        description:
          "<p>A structured first month: equipment, access, a buddy, and a 30-60-90 plan so you can ramp up fast.</p>",
      },
    ],
  );

  const insights = await ensureCollection(
    strapi,
    "api::insight.insight",
    (e) => e.title,
    [
      {
        title: "Five lessons from 2026",
        slug: "five-lessons-from-2026",
        description: "<p>Insight body.</p>",
        isFeatured: true,
      },
      {
        title: "Scaling teams without chaos",
        slug: "scaling-teams-without-chaos",
        description: "<p>Insight body.</p>",
        isFeatured: false,
      },
      {
        title: "The real cost of technical debt",
        slug: "the-real-cost-of-technical-debt",
        description: "<p>Insight body.</p>",
        isFeatured: false,
      },
      {
        title: "Designing for performance",
        slug: "designing-for-performance",
        description: "<p>Insight body.</p>",
        isFeatured: false,
      },
      {
        title: "The future of headless CMS",
        slug: "the-future-of-headless-cms",
        description: "<p>Insight body.</p>",
        isFeatured: false,
      },
      {
        title: "Hiring senior engineers",
        slug: "hiring-senior-engineers",
        description: "<p>Insight body.</p>",
        isFeatured: false,
      },
    ],
  );

  const techStack = await ensureCollection(
    strapi,
    "api::tech-stack.tech-stack",
    (e) => e.title,
    [
      {
        title: "React",
        slug: "react",
        description: "<p>React expertise.</p>",
        link: "/what-we-do?stack=react",
      },
      {
        title: "Next.js",
        slug: "next-js",
        description: "<p>Next.js expertise.</p>",
        link: "/what-we-do?stack=nextjs",
      },
      {
        title: "TypeScript",
        slug: "typescript",
        description: "<p>TypeScript expertise.</p>",
        link: "/what-we-do?stack=typescript",
      },
      {
        title: "Node.js",
        slug: "node-js",
        description: "<p>Node.js expertise.</p>",
        link: "/what-we-do?stack=node",
      },
      {
        title: "PostgreSQL",
        slug: "postgresql",
        description: "<p>PostgreSQL expertise.</p>",
        link: "/what-we-do?stack=postgresql",
      },
      {
        title: "GraphQL",
        slug: "graphql",
        description: "<p>GraphQL expertise.</p>",
        link: "/what-we-do?stack=graphql",
      },
      {
        title: "AWS",
        slug: "aws",
        description: "<p>AWS expertise.</p>",
        link: "/what-we-do?stack=aws",
      },
      {
        title: "Docker",
        slug: "docker",
        description: "<p>Docker expertise.</p>",
        link: "/what-we-do?stack=docker",
      },
    ],
    8,
  );

  log(
    `collections: industries=${industries.length} services=${services.length} regions=${regions.length} platforms=${platforms.length} achievements=${achievements.length} clients=${clients.length} faqs=${faqs.length} processes=${processes.length} team=${teamMembers.length} clientTestimonials=${clientTestimonials.length} teamTestimonials=${teamTestimonials.length} insights=${insights.length} techStack=${techStack.length}`,
  );

  // ------------------------------------------------------------------
  // Demo homepage exercising all 28 sections
  // ------------------------------------------------------------------
  const h = (title: string, addCount = false) => ({
    __component: "shared.headline",
    title,
    addCount,
  });
  const btn = (title: string, url = "/contact-us") => ({
    __component: "shared.button",
    title,
    linkType: "url",
    url,
  });
  const theme = (background: string, textColor = "dark") => ({
    __component: "shared.theme",
    background,
    textColor,
  });
  const item = (title: string, description: string) => ({
    __component: "shared.content-item",
    title,
    description,
  });

  const sections: any[] = [
    // 1. cta
    {
      __component: "sections.cta",
      label: "CTA",
      title: "Let's build something great",
      description: "<p>Tell us about your project — we reply within 24h.</p>",
      buttons: [btn("Get in touch")],
      theme: theme("white"),
    },
    // 2. achievements (carousel)
    {
      __component: "sections.carousel",
      collectionType: "achievements",
      headline: h("Recognition"),
      theme: theme("cream"),
      achievements: achievements.map((e) => e.id),
    },
    // 3. cards-large-numerated
    {
      __component: "sections.cards-large-numerated",
      headline: h("Why teams choose us"),
      cardsLayout: "carousel",
      cards: [
        {
          __component: "shared.card-numerated",
          title: "Senior talent",
          description: "<p>No juniors learning on your budget.</p>",
        },
        {
          __component: "shared.card-numerated",
          title: "Fast delivery",
          description: "<p>Small batches shipped weekly.</p>",
        },
        {
          __component: "shared.card-numerated",
          title: "Transparent pricing",
          description: "<p>Fixed scope, honest estimates.</p>",
        },
        {
          __component: "shared.card-numerated",
          title: "Long-term partners",
          description: "<p>We stay after launch.</p>",
        },
        {
          __component: "shared.card-numerated",
          title: "Senior talent",
          description: "<p>No juniors learning on your budget.</p>",
        },
        {
          __component: "shared.card-numerated",
          title: "Fast delivery",
          description: "<p>Small batches shipped weekly.</p>",
        },
      ],
    },
    // 4. case-studies (pick: latest)
    {
      __component: "sections.case-studies",
      pick: "latest",
      limit: 5,
      headline: h("Case studies"),
      button: btn("All cases", "/case-studies"),
      theme: theme("cream"),
      caseStudies: [],
    },
    // 5. content-color-boxes
    {
      __component: "sections.content-color-boxes",
      headline: h("What we value"),
      subtitle: "<p>Principles</p>",
      description: "<p>A few things that shape our work.</p>",
      boxes: [
        {
          __component: "shared.color-box",
          title: "Transparency",
          label: "Principle",
          expandable: false,
          blocks: [
            item("Open books", "<p>Honest estimates, no surprises.</p>"),
          ],
        },
        {
          __component: "shared.color-box",
          title: "Why quality matters",
          label: "Principle",
          expandable: true,
          blocks: [
            item("Craft", "<p>We sweat the details.</p>"),
            item("Reviews", "<p>Code review every single day.</p>"),
          ],
        },
      ],
    },
    // 6. content-image-left — “How we deliver” (NumeratedBlocks variant)
    {
      __component: "sections.content-image-left",
      headline: h("How we deliver"),
      variant: "NumeratedBlocks",
      subtitle: "Approach",
      button: btn("Work with us"),
      blocks: [
        item(
          "Understand",
          "<p>Dig into the problem before proposing a solution.</p>",
        ),
        item("Build", "<p>Small, tested increments shipped continuously.</p>"),
        item(
          "Measure",
          "<p>Data decides what we keep, cut or double down on.</p>",
        ),
      ],
    },
    // 8. content-numerated (expandable)
    {
      __component: "sections.content-numerated",
      headline: h("Our pillars"),
      layout: "buttonBelow",
      behavior: "expandable",
      items: [
        item("Craft", "<p>Attention to detail in everything we ship.</p>"),
        item("Partnership", "<p>We win when our clients win.</p>"),
      ],
    },
    // 9. faq
    {
      __component: "sections.faq",
      headline: h("Frequently asked questions"),
      theme: theme("cream"),
      faqs: faqs.map((e) => e.id),
    },
    // 10. form (contact)
    {
      __component: "sections.form",
      variant: "contact",
      title: "Contact us",
      description: "<p>Tell us about your project.</p>",
      label: "Get in touch",
    },
    // 11. hero (default)
    {
      __component: "sections.hero",
      variant: "default",
      headingSize: "large",
      title: "Built on a simple idea",
      description: "<p>Great software comes from small, empowered teams.</p>",
      label: "About",
      button: btn("Our story", "/about"),
    },
    // 12. hero (simple)
    {
      __component: "sections.hero",
      variant: "simple",
      title: "Crafted for the web",
      theme: theme("black"),
    },
    // 13. hero (with carousel)
    {
      __component: "sections.hero",
      variant: "withCarousel",
      title: "Software that moves your business forward",
      description: "<p>We design, build and scale digital products.</p>",
      carousel: [
        {
          __component: "shared.hero-promo",
          label: "Start a project",
          title: "Let's build together",
          button: btn("Get in touch", "/contact-us"),
        },
        {
          __component: "shared.hero-promo",
          label: "See our work",
          title: "Explore case studies",
          button: btn("All cases", "/case-studies"),
        },
      ],
    },
    // 14. industries
    {
      __component: "sections.industries",
      anchor: "industries",
      headline: h("Industries we serve"),
      button: btn("All industries", "/case-studies"),
      industries: industries.map((e) => e.id),
    },
    // 15. insights (carousel)
    {
      __component: "sections.carousel",
      collectionType: "insights",
      headline: h("Insights"),
      button: btn("All insights", "/insights"),
      theme: theme("cream"),
      insightsPick: "latest",
      insightsLimit: 5,
    },
    // 16. intersection-floating-boxes
    {
      __component: "sections.intersection-floating-boxes",
      headline: h("Outcomes at a glance"),
      blocks: [
        {
          __component: "shared.floating-card",
          title: "98% on-time delivery",
          description: "<p>Across the last 100 projects.</p>",
        },
        {
          __component: "shared.floating-card",
          title: "4.9 / 5 client rating",
          description: "<p>From 200+ reviews.</p>",
        },
        {
          __component: "shared.floating-card",
          title: "120+ projects shipped",
          description: "<p>Across 20 industries.</p>",
        },
      ],
    },
    // 17. intersection-media
    {
      __component: "sections.intersection-media",
      title: "Full-screen moment",
      button: btn("Explore", "/what-we-do"),
    },
    // 18. intro-showreel
    {
      __component: "sections.intro-showreel",
      title: "A glimpse of what we build",
      description: "<p>Three minutes of products, teams and outcomes.</p>",
      label: "Showreel",
      button: btn("Watch", "#showreel"),
    },
    // 19. person
    {
      __component: "sections.person",
      person: teamMembers[0].id,
      address: "<p>Erdbergstrasse 10/67, 1030 Wien</p>",
      email: "anna.nowak@polcode.com",
      socials: [
        {
          __component: "shared.socials",
          title: "LinkedIn",
          link: "https://linkedin.com",
        },
      ],
      button: btn("Book a call"),
    },
    // 20. process
    {
      __component: "sections.process",
      headline: h("How we work"),
      button: btn("Start a project"),
      blocks: processes.map((e) => e.id),
    },
    // 21. progress-cards
    {
      __component: "sections.progress-cards",
      headline: h("Milestones"),
      cards: [
        {
          __component: "shared.card-milestone",
          title: "Kick-off",
          description: "<p>Assemble the team.</p>",
        },
        {
          __component: "shared.card-milestone",
          title: "Discovery",
          description: "<p>Validate direction.</p>",
        },
        {
          __component: "shared.card-milestone",
          title: "Delivery",
          description: "<p>Iterative releases.</p>",
        },
        {
          __component: "shared.card-milestone",
          title: "Scale",
          description: "<p>Grow what works.</p>",
        },
      ],
    },
    // 22. services-group
    {
      __component: "sections.services-group",
      headline: h("What we offer"),
      groups: [
        {
          __component: "shared.service-group",
          title: "Product Engineering",
          services: services.map((e) => e.id),
          relatedCaseStudies: [],
        },
      ],
    },
    // 23. team-grid
    {
      __component: "sections.team-grid",
      headline: h("Meet the team"),
      team: teamMembers.map((e) => e.id),
      content: item(
        "Who we are",
        "<p>Built by engineers, designers and PMs.</p>",
      ),
    },
    // 24. team
    {
      __component: "sections.team",
      title: "Team members",
      members: teamMembers.map((e) => e.id),
    },
    // 25. tech-stack
    {
      __component: "sections.tech-stack",
      anchor: "technologies",
      headline: h("Our technology stack"),
      button: btn("See everything", "/what-we-do"),
      blocks: techStack.map((e) => e.id),
    },
    // 26. testimonials-clients (carousel)
    {
      __component: "sections.carousel",
      collectionType: "clientTestimonials",
      showLogos: true,
      headline: h("What our clients say"),
      clientTestimonials: clientTestimonials.map((e) => e.id),
    },
    // 27. testimonials-team (carousel)
    {
      __component: "sections.carousel",
      collectionType: "teamTestimonials",
      headline: h("Team testimonials"),
      teamTestimonials: teamTestimonials.map((e) => e.id),
    },
  ];

  // Only create the demo homepage if none exists. Never delete/recreate an
  // existing homepage — that would wipe CMS-authored content on every boot.
  const qPage = strapi.db.query("api::page.page");
  const existingHome = (await qPage.findOne({ where: { slug: "index" } })) as {
    id: number;
  } | null;
  if (existingHome) {
    log("homepage 'index' already exists — leaving it untouched");
    return;
  }
  const pageData = {
    title: "Home",
    slug: "index",
    showScrollTop: true,
    showSectionsNav: true,
    publishedAt: now.toISOString(),
    sections,
  };
  await strapi.entityService.create("api::page.page", { data: pageData });
  log(`demo page 'index' created with ${sections.length} sections`);
}

/**
 * Seed the `Globals` single type (api::global.global) with the footer content
 * (contact block, partners, copyright, legal links). Partner logos are
 * uploaded from `seed-assets/` so they become real Strapi media.
 *
 * Idempotent: deletes the single type then recreates it published, so
 * re-running `SEED_DEMO=true` always reflects the seed values. Deletion goes
 * through the documents service so the nested footer/partner component rows
 * (and their media links) are cascade-deleted too — a raw `db.query.deleteMany`
 * left orphaned component rows behind on every run.
 */
export async function seedGlobals(strapi: Strapi) {
  const log = (msg: string) => console.log(`[seed-globals] ${msg}`);
  const uid = "api::global.global";

  // Delete the document(s) via the documents service so components cascade.
  const docs = await strapi.documents(uid).findMany({});
  for (const doc of docs) {
    await strapi.documents(uid).delete({ documentId: doc.documentId });
  }

  // Partner logos from `<cwd>/seed-assets/` → real media ids (`uploadAsset`
  // reuses the existing upload by name, so no duplicate rows across boots).
  const assets: { file: string; alt: string }[] = [
    { file: "partners01.png", alt: "Twilio" },
    { file: "partners02.png", alt: "Adobe Solution Partner" },
    { file: "partners03.png", alt: "AWS Cloud Contact Center" },
  ];
  const logoIds: (number | null)[] = [];
  for (const asset of assets) {
    logoIds.push(await uploadAsset(strapi, asset.file, asset.alt));
  }

  await strapi.entityService.create(
    uid as UID.ContentType,
    {
      data: {
        footer: {
          contactTitle: "Contact",
          contactContent:
            "<p>PolCode Sp. z o.o.</p><p>Al. Jerozolimskie 94<br>00-807 Warszawa<br>Poland</p><p>VAT-ID: PL7010440690</p>",
          partnersTitle: "We are partners of:",
          partners: [
            { label: "Twilio", url: "#", logo: logoIds[0] },
            { label: "Adobe Solution Partner", url: "#", logo: logoIds[1] },
            { label: "AWS Cloud Contact Center", url: "#", logo: logoIds[2] },
          ],
          copyright: "©[[year_now]] Polcode Sp. z o.o. All rights reserved.",
        },
        publishedAt: now.toISOString(),
      },
    } as never,
  );
  log("globals (footer) seeded & published");
}
