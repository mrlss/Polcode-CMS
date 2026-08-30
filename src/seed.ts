/**
 * Idempotent demo-data seeder for local development.
 *
 * Run automatically from `src/index.ts` bootstrap when `SEED_DEMO=true`
 * (e.g. `SEED_DEMO=true npm --prefix strapi run develop`). Creates the filter
 * + content collections and a homepage (`slug: "index"`) whose `sections`
 * dynamiczone exercises all 28 section components, so the frontend can render
 * every new block from real Strapi data.
 *
 * Uses the low-level `strapi.db.query` API — works at bootstrap time, no auth
 * needed. Every entry is created published (`publishedAt`) so the frontend's
 * `publicationState: "LIVE"` query returns it.
 */

import type { Core } from "@strapi/strapi";
import type { UID } from "@strapi/types";

type Strapi = Core.Strapi;

const now = new Date();

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

async function upsert(
  strapi: Strapi,
  uid: UID.ContentType,
  where: Record<string, unknown>,
  data: Record<string, unknown>,
): Promise<any> {
  const q = strapi.db.query(uid);
  const existing = await q.findOne({ where });
  if (existing) {
    // Repair entries created before the seed switched to entityService
    // (they may be drafts — publish so LIVE queries return them).
    if (!existing.publishedAt) {
      await q.update({
        where: { id: existing.id },
        data: { publishedAt: now.toISOString() },
      });
    }
    return existing;
  }
  // entityService handles components + relations; `publishedAt` makes it published.
  return strapi.entityService.create(uid, {
    data: { ...data, publishedAt: now.toISOString() },
  });
}

export async function seedDemoData(strapi: Strapi) {
  const log = (msg: string) => console.log(`[seed] ${msg}`);

  // ------------------------------------------------------------------
  // Filter collections (industries / services / technologies / regions / platforms)
  // ------------------------------------------------------------------
  const industry = async (title: string, description: string) =>
    upsert(
      strapi,
      "api::industry.industry",
      { title },
      { title, slug: slugify(title), description },
    );
  const fintech = await industry(
    "FinTech",
    "<p>Payments, banking, insurance platforms.</p>",
  );
  const health = await industry(
    "Healthcare",
    "<p>Compliant, patient-first products.</p>",
  );
  const retail = await industry(
    "Retail",
    "<p>Commerce experiences that convert.</p>",
  );

  const service = async (title: string, link: string) =>
    upsert(
      strapi,
      "api::service.service",
      { title },
      {
        title,
        slug: slugify(title),
        description: `<p>${title} services.</p>`,
        link,
      },
    );
  const svcFrontend = await service("Frontend", "/what-we-do?service=frontend");
  const svcBackend = await service("Backend", "/what-we-do?service=backend");
  const svcDevOps = await service("DevOps", "/what-we-do?service=devops");

  const technology = async (title: string) =>
    upsert(
      strapi,
      "api::technology.technology",
      { title },
      { title, slug: slugify(title) },
    );
  const techReact = await technology("React");
  const techNode = await technology("Node.js");

  const region = async (title: string) =>
    upsert(
      strapi,
      "api::region.region",
      { title },
      { title, slug: slugify(title) },
    );
  const regionEu = await region("Europe");
  await region("North America");

  const platform = async (title: string) =>
    upsert(strapi, "api::platform.platform", { title }, { title });
  const platformClutch = await platform("Clutch");
  const platformAwwwards = await platform("Awwwards");

  // ------------------------------------------------------------------
  // Content collections
  // ------------------------------------------------------------------
  const achievement = async (
    title: string,
    date: string,
    plat: { id: number },
  ) =>
    upsert(
      strapi,
      "api::achievement.achievement",
      { title },
      {
        title,
        date,
        link: "https://clutch.co",
        platform: plat.id,
      },
    );
  const ach1 = await achievement(
    "Top B2B Service Provider",
    "2025-01-01",
    platformClutch,
  );
  const ach2 = await achievement(
    "Awwwards Honorable Mention",
    "2024-06-01",
    platformAwwwards,
  );

  const teamMember = async (
    firstName: string,
    lastName: string,
    position: string,
  ) =>
    upsert(
      strapi,
      "api::team.team",
      { firstName, lastName },
      {
        firstName,
        lastName,
        position,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@polcode.com`,
        description: "<p>Team member bio.</p>",
        socials: [
          {
            __component: "shared.socials",
            title: "LinkedIn",
            link: "https://linkedin.com",
          },
        ],
      },
    );
  const m1 = await teamMember("Anna", "Nowak", "Principal Consultant");
  const m2 = await teamMember("Piotr", "Zieliński", "Engineering Manager");

  const client = async (link: string) =>
    upsert(strapi, "api::client.client", { link }, { link });
  const c1 = await client("https://fintech-labs.io");

  const testimonial = async (
    author: string,
    position: string,
    text: string,
    cl: { id: number } | null,
  ) =>
    upsert(
      strapi,
      "api::testimonial.testimonial",
      { author },
      { author, position, text, client: cl ? cl.id : null },
    );
  const t1 = await testimonial(
    "Maria Kowalski",
    "CPO, FinTech Labs",
    "<p>Delivered on time and above expectations.</p>",
    c1,
  );
  const t2 = await testimonial(
    "Tom Müller",
    "CTO, HealthPlus",
    "<p>A true engineering partner, not a vendor.</p>",
    null,
  );

  const faq = async (title: string, description: string) =>
    upsert(strapi, "api::faq.faq", { title }, { title, description });
  const faq1 = await faq(
    "How does billing work?",
    "<p>Monthly, based on the agreed scope. You only pay for what was delivered.</p>",
  );
  const faq2 = await faq(
    "Do you sign NDAs?",
    "<p>Absolutely. We sign your NDA before any discovery call.</p>",
  );

  const process = async (title: string, description: string) =>
    upsert(strapi, "api::process.process", { title }, { title, description });
  const process1 = await process(
    "Discover",
    "<p>Workshops and research to align on the goal.</p>",
  );
  const process2 = await process(
    "Design",
    "<p>Wireframes and prototypes that are easy to test.</p>",
  );
  const process3 = await process(
    "Develop",
    "<p>Agile delivery with continuous integration.</p>",
  );

  const insight = async (title: string, isFeatured = false) =>
    upsert(
      strapi,
      "api::insight.insight",
      { title },
      {
        title,
        slug: slugify(title),
        description: "<p>Insight body.</p>",
        isFeatured,
      },
    );
  const in1 = await insight("Five lessons from 2026", true);
  const in2 = await insight("Scaling teams without chaos", false);
  const in3 = await insight("The real cost of technical debt", false);

  const useCase = async (title: string) =>
    upsert(
      strapi,
      "api::use-case.use-case",
      { title },
      {
        title,
        slug: slugify(title),
        description: "<p>Use case description.</p>",
      },
    );
  const uc1 = await useCase("Marketplace rebuild");
  const uc2 = await useCase("Payments platform migration");

  const techStack = async (title: string, link: string) =>
    upsert(
      strapi,
      "api::tech-stack.tech-stack",
      { title },
      {
        title,
        slug: slugify(title),
        description: `<p>${title} expertise.</p>`,
        link,
      },
    );
  await techStack("React", "/what-we-do?stack=react");
  await techStack("Next.js", "/what-we-do?stack=nextjs");
  await techStack("TypeScript", "/what-we-do?stack=typescript");
  await techStack("Node.js", "/what-we-do?stack=node");
  await techStack("PostgreSQL", "/what-we-do?stack=postgresql");
  await techStack("GraphQL", "/what-we-do?stack=graphql");
  await techStack("AWS", "/what-we-do?stack=aws");
  await techStack("Docker", "/what-we-do?stack=docker");

  // ------------------------------------------------------------------
  // Demo homepage exercising all 28 sections
  // ------------------------------------------------------------------
  const qPage = strapi.db.query("api::page.page");
  const existingPage = await qPage.findOne({ where: { slug: "index" } });
  if (existingPage) {
    log("demo page 'index' already exists — skipping");
    return;
  }
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

  // Dynamiczone entries are built from loose helpers — typing the array as any
  // keeps the seed readable without fighting Strapi's strict component unions.
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
      achievements: [ach1.id, ach2.id],
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
      ],
    },
    // 4. case-studies (pick: latest)
    {
      __component: "sections.case-studies",
      pick: "latest",
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
      faqs: [faq1.id, faq2.id],
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
      headline: h("Industries we serve"),
      button: btn("All industries", "/case-studies"),
      industries: [fintech.id, health.id, retail.id],
    },
    // 15. insights (pick: latest)
    {
      __component: "sections.insights",
      pick: "latest",
      headline: h("Insights"),
      button: btn("All insights", "/insights"),
      theme: theme("cream"),
      insights: [in1.id, in2.id, in3.id],
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
      person: m1.id,
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
      blocks: [process1.id, process2.id, process3.id],
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
          services: [svcFrontend.id, svcBackend.id, svcDevOps.id],
          relatedUseCases: [uc1.id, uc2.id],
        },
      ],
    },
    // 23. team-grid
    {
      __component: "sections.team-grid",
      headline: h("Meet the team"),
      team: [m1.id, m2.id],
      content: item(
        "Who we are",
        "<p>Built by engineers, designers and PMs.</p>",
      ),
    },
    // 24. team
    {
      __component: "sections.team",
      title: "Team members",
      members: [m1.id, m2.id],
    },
    // 25. tech-stack
    {
      __component: "sections.tech-stack",
      headline: h("Our technology stack"),
      button: btn("See everything", "/what-we-do"),
      blocks: [
        (await techStack("React", "/what-we-do?stack=react")).id,
        (await techStack("Next.js", "/what-we-do?stack=nextjs")).id,
        (await techStack("TypeScript", "/what-we-do?stack=typescript")).id,
        (await techStack("Node.js", "/what-we-do?stack=node")).id,
        (await techStack("PostgreSQL", "/what-we-do?stack=postgresql")).id,
        (await techStack("GraphQL", "/what-we-do?stack=graphql")).id,
        (await techStack("AWS", "/what-we-do?stack=aws")).id,
        (await techStack("Docker", "/what-we-do?stack=docker")).id,
      ],
    },
    // 26. testimonials-clients
    {
      __component: "sections.testimonials-clients",
      headline: h("What our clients say"),
      cards: [t1.id, t2.id],
    },
    // 27. testimonials-team
    {
      __component: "sections.testimonials-team",
      headline: h("Team testimonials"),
      cardsLayout: "carousel",
      cards: [t1.id, t2.id],
    },
    // 28. use-cases (pick: latest)
    {
      __component: "sections.use-cases",
      pick: "latest",
      headline: h("Use cases"),
      button: btn("All use cases", "/use-cases"),
      theme: theme("cream"),
      useCases: [uc1.id, uc2.id],
    },
  ];

  await strapi.entityService.create("api::page.page", {
    data: {
      title: "Home",
      slug: "index",
      showScrollTop: true,
      showSectionsNav: true,
      publishedAt: now.toISOString(),
      sections,
    },
  });

  log(`demo page 'index' created with ${sections.length} sections`);
}
