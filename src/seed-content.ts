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

  const technologies = await ensureCollection(
    strapi,
    "api::technology.technology",
    (e) => e.title,
    [
      { title: "React", slug: "react" },
      { title: "Node.js", slug: "node-js" },
      { title: "TypeScript", slug: "typescript" },
      { title: "PostgreSQL", slug: "postgresql" },
      { title: "GraphQL", slug: "graphql" },
      { title: "AWS", slug: "aws" },
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
        "<p>Monthly, based on the agreed scope. You only pay for what was delivered.</p>",
    },
    {
      title: "Do you sign NDAs?",
      description:
        "<p>Absolutely. We sign your NDA before any discovery call.</p>",
    },
    {
      title: "How big are your teams?",
      description: "<p>Small, senior squads of 4-8 people per project.</p>",
    },
    {
      title: "Which time zones do you cover?",
      description:
        "<p>Europe and the Americas, with overlap for daily syncs.</p>",
    },
    {
      title: "Which technologies do you use?",
      description:
        "<p>React, Next.js, Node.js, TypeScript and PostgreSQL first.</p>",
    },
    {
      title: "How does onboarding work?",
      description:
        "<p>A structured two-week onboarding with a dedicated PM.</p>",
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

  const testimonials = await ensureCollection(
    strapi,
    "api::testimonial.testimonial",
    (e) => e.author,
    [
      {
        author: "Maria Kowalski",
        position: "CPO, FinTech Labs",
        text: "<p>Delivered on time and above expectations.</p>",
        client: clients[0].id,
      },
      {
        author: "Tom Müller",
        position: "CTO, HealthPlus",
        text: "<p>A true engineering partner, not a vendor.</p>",
        client: clients[1].id,
      },
      {
        author: "Sofia Ricci",
        position: "CEO, TravelHub",
        text: "<p>They turned a legacy system into a platform we are proud of.</p>",
        client: clients[3].id,
      },
      {
        author: "David Chen",
        position: "VP Engineering, Retailly",
        text: "<p>Fast, senior, and genuinely invested in our product.</p>",
        client: clients[2].id,
      },
      {
        author: "Ola Jensen",
        position: "COO, Edudot",
        text: "<p>Reliable delivery across every single sprint.</p>",
        client: clients[4].id,
      },
      {
        author: "Ravi Patel",
        position: "Product Lead, Manufacturo",
        text: "<p>Our go-to team for anything complex.</p>",
        client: clients[5].id,
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

  const useCases = await ensureCollection(
    strapi,
    "api::use-case.use-case",
    (e) => e.title,
    [
      {
        title: "Marketplace rebuild",
        slug: "marketplace-rebuild",
        description: "<p>Use case description.</p>",
      },
      {
        title: "Payments platform migration",
        slug: "payments-platform-migration",
        description: "<p>Use case description.</p>",
      },
      {
        title: "Loyalty app redesign",
        slug: "loyalty-app-redesign",
        description: "<p>Use case description.</p>",
      },
      {
        title: "Booking engine modernization",
        slug: "booking-engine-modernization",
        description: "<p>Use case description.</p>",
      },
      {
        title: "Cloud data warehouse",
        slug: "cloud-data-warehouse",
        description: "<p>Use case description.</p>",
      },
      {
        title: "CRM migration",
        slug: "crm-migration",
        description: "<p>Use case description.</p>",
      },
    ],
  );

  const caseStudies = await ensureCollection(
    strapi,
    "api::case-study.case-study",
    (e) => e.title,
    [
      {
        title: "FinTech platform revamp",
        slug: "fintech-platform-revamp",
        label: "Case study",
        shortTitle: "FinTech platform revamp",
        shortDescription: "<p>Short description.</p>",
        description: "<p>Full case study description.</p>",
        isFeatured: true,
        industries: [industries[0].id],
        services: [services[0].id],
        technologies: [technologies[0].id],
        regions: [regions[0].id],
      },
      {
        title: "Retail e-commerce launch",
        slug: "retail-e-commerce-launch",
        label: "Case study",
        shortTitle: "Retail e-commerce launch",
        shortDescription: "<p>Short description.</p>",
        description: "<p>Full case study description.</p>",
        isFeatured: false,
        industries: [industries[2].id],
        services: [services[0].id],
        technologies: [technologies[0].id],
        regions: [regions[1].id],
      },
      {
        title: "Healthcare patient portal",
        slug: "healthcare-patient-portal",
        label: "Case study",
        shortTitle: "Healthcare patient portal",
        shortDescription: "<p>Short description.</p>",
        description: "<p>Full case study description.</p>",
        isFeatured: false,
        industries: [industries[1].id],
        services: [services[1].id],
        technologies: [technologies[3].id],
        regions: [regions[0].id],
      },
      {
        title: "Travel booking engine",
        slug: "travel-booking-engine",
        label: "Case study",
        shortTitle: "Travel booking engine",
        shortDescription: "<p>Short description.</p>",
        description: "<p>Full case study description.</p>",
        isFeatured: false,
        industries: [industries[3].id],
        services: [services[4].id],
        technologies: [technologies[2].id],
        regions: [regions[3].id],
      },
      {
        title: "Manufacturing IoT dashboard",
        slug: "manufacturing-iot-dashboard",
        label: "Case study",
        shortTitle: "Manufacturing IoT dashboard",
        shortDescription: "<p>Short description.</p>",
        description: "<p>Full case study description.</p>",
        isFeatured: false,
        industries: [industries[4].id],
        services: [services[5].id],
        technologies: [technologies[5].id],
        regions: [regions[2].id],
      },
      {
        title: "EdTech LMS platform",
        slug: "edtech-lms-platform",
        label: "Case study",
        shortTitle: "EdTech LMS platform",
        shortDescription: "<p>Short description.</p>",
        description: "<p>Full case study description.</p>",
        isFeatured: false,
        industries: [industries[5].id],
        services: [services[2].id],
        technologies: [technologies[1].id],
        regions: [regions[4].id],
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
    `collections: industries=${industries.length} services=${services.length} technologies=${technologies.length} regions=${regions.length} platforms=${platforms.length} achievements=${achievements.length} clients=${clients.length} faqs=${faqs.length} processes=${processes.length} team=${teamMembers.length} testimonials=${testimonials.length} insights=${insights.length} useCases=${useCases.length} caseStudies=${caseStudies.length} techStack=${techStack.length}`,
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
    linkType: "internal",
    url,
    variant: "dark",
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
    // 2. achievements
    {
      __component: "sections.achievements",
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
      headline: h("Case studies"),
      button: btn("All cases", "/case-studies"),
      theme: theme("cream"),
      caseStudies: caseStudies.map((e) => e.id),
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
    // 6. content-image-left
    {
      __component: "sections.content-image-left",
      headline: h("About our approach"),
      label: "About",
      title: "People first",
      content: "<p>Small, empowered teams that own the outcome.</p>",
      button: btn("Our story", "/about"),
    },
    // 7. content-image-numerated
    {
      __component: "sections.content-image-numerated",
      headline: h("How we deliver"),
      subtitle: "<p>Approach</p>",
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
    // 11. hero-rich
    {
      __component: "sections.hero-rich",
      title: "Built on a simple idea",
      description: "<p>Great software comes from small, empowered teams.</p>",
      label: "About",
      variant: "titleAbove",
      button: btn("Our story", "/about"),
      carousel: [
        item("People first", "<p>We invest in the team.</p>"),
        item("Quality as habit", "<p>Tests every day.</p>"),
      ],
    },
    // 12. hero-svg
    { __component: "sections.hero-svg", title: "Crafted for the web" },
    // 13. hero-two-columns
    {
      __component: "sections.hero-two-columns",
      title: "Software that moves your business forward",
      description: "<p>We design, build and scale digital products.</p>",
      label: "Polcode",
      indicatorText: "Scroll to explore",
      button: btn("Get in touch"),
    },
    // 14. industries
    {
      __component: "sections.industries",
      anchor: "industries",
      headline: h("Industries we serve"),
      button: btn("All industries", "/case-studies"),
      industries: industries.map((e) => e.id),
    },
    // 15. insights (pick: latest)
    {
      __component: "sections.insights",
      pick: "latest",
      headline: h("Insights"),
      button: btn("All insights", "/insights"),
      theme: theme("cream"),
      insights: insights.map((e) => e.id),
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
          relatedUseCases: useCases.map((e) => e.id),
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
    // 26. testimonials-clients
    {
      __component: "sections.testimonials-clients",
      headline: h("What our clients say"),
      cards: testimonials.map((e) => e.id),
    },
    // 27. testimonials-team
    {
      __component: "sections.testimonials-team",
      headline: h("Team testimonials"),
      cardsLayout: "carousel",
      cards: testimonials.map((e) => e.id),
    },
    // 28. use-cases (pick: latest)
    {
      __component: "sections.use-cases",
      pick: "latest",
      headline: h("Use cases"),
      button: btn("All use cases", "/use-cases"),
      theme: theme("cream"),
      useCases: useCases.map((e) => e.id),
    },
  ];

  // Recreate the demo page so the dynamiczone is rebuilt from scratch.
  // (Dev-only seeder — avoids Strapi 5.52's flaky update-merge on dynamiczone
  // relations, which left stale partial links on repeated updates.)
  const qPage = strapi.db.query("api::page.page");
  await qPage.deleteMany({ where: { slug: "index" } });
  const pageData = {
    title: "Home",
    slug: "index",
    showScrollTop: true,
    showSectionsNav: true,
    publishedAt: now.toISOString(),
    sections,
  };
  await strapi.entityService.create("api::page.page", { data: pageData });
  log(`demo page 'index' (re)created with ${sections.length} sections`);
}

/**
 * Seed the `Globals` single type (api::global.global) with the footer content
 * (contact block, partners, copyright, legal links). Partner logos are
 * uploaded from `seed-assets/` so they become real Strapi media.
 *
 * Idempotent: deletes the single type (draft + published) then recreates it
 * published, so re-running `SEED_DEMO=true` always reflects the seed values.
 */
export async function seedGlobals(strapi: Strapi) {
  const log = (msg: string) => console.log(`[seed-globals] ${msg}`);
  const uid = "api::global.global";

  // Delete all rows (draft + published) then recreate — same idempotency
  // strategy as the demo homepage.
  const q = strapi.db.query(uid);
  await q.deleteMany({});

  // Upload partner logos from `<cwd>/seed-assets/` → real media ids.
  // `process.cwd()` (the strapi project root under `npm run develop`) is used
  // because the seeder runs from `dist/src/` where `__dirname` is unreliable.
  const assetsDir = path.join(process.cwd(), "seed-assets");
  const assets: { file: string; alt: string }[] = [
    { file: "partners01.png", alt: "Twilio" },
    { file: "partners02.png", alt: "Adobe Solution Partner" },
    { file: "partners03.png", alt: "AWS Cloud Contact Center" },
  ];
  const uploadService = strapi.plugin("upload").service("upload");
  const logoIds: (number | null)[] = [];
  for (const asset of assets) {
    const filePath = path.join(assetsDir, asset.file);
    if (!fs.existsSync(filePath)) {
      log(`seed asset missing, skipping: ${filePath}`);
      logoIds.push(null);
      continue;
    }
    const uploaded = await uploadService.upload({
      data: { fileInfo: { alternativeText: asset.alt } },
      files: {
        filepath: filePath,
        originalFilename: asset.file,
        mimetype: "image/png",
        size: fs.statSync(filePath).size,
      },
    });
    logoIds.push(uploaded?.[0]?.id ?? null);
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
