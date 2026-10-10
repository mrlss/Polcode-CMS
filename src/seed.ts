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
    if (!existing.publishedAt) {
      await q.update({
        where: { id: existing.id },
        data: { publishedAt: now.toISOString() },
      });
    }
    return existing;
  }
  return strapi.entityService.create(uid, {
    data: { ...data, publishedAt: now.toISOString() },
  });
}

export async function seedDemoData(strapi: Strapi) {
  const log = (msg: string) => console.log(`[seed] ${msg}`);

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

  const clientTestimonial = async (
    author: string,
    position: string,
    text: string,
    cl: { id: number },
  ) =>
    upsert(
      strapi,
      "api::client-testimonial.client-testimonial",
      { author },
      { author, position, text, client: cl.id },
    );
  const t1 = await clientTestimonial(
    "Maria Kowalski",
    "CPO, FinTech Labs",
    "<p>Delivered on time and above expectations.</p>",
    c1,
  );

  const teamTestimonial = async (
    author: string,
    position: string,
    text: string,
  ) =>
    upsert(
      strapi,
      "api::team-testimonial.team-testimonial",
      { author },
      { author, position, text },
    );
  const t2 = await teamTestimonial(
    "Tom Müller",
    "CTO, HealthPlus",
    "<p>A true engineering partner, not a vendor.</p>",
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
    {
      __component: "sections.cta",
      label: "CTA",
      title: "Let's build something great",
      description: "<p>Tell us about your project — we reply within 24h.</p>",
      buttons: [btn("Get in touch")],
      theme: theme("white"),
    },
    {
      __component: "sections.carousel",
      collectionType: "achievements",
      headline: h("Recognition"),
      theme: theme("cream"),
      achievements: [ach1.id, ach2.id],
    },
    {
      __component: "sections.content-numerated",
      headline: h("Why teams choose us"),
      items: [
        item("Senior talent", "<p>No juniors learning on your budget.</p>"),
        item("Fast delivery", "<p>Small batches shipped weekly.</p>"),
        item("Transparent pricing", "<p>Fixed scope, honest estimates.</p>"),
        item("Long-term partners", "<p>We stay after launch.</p>"),
      ],
    },
    {
      __component: "sections.case-studies",
      pick: "latest",
      limit: 5,
      headline: h("Case studies"),
      button: btn("All cases", "/case-studies"),
      theme: theme("cream"),
      caseStudies: [],
    },
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
    {
      __component: "sections.faq",
      headline: h("Frequently asked questions"),
      theme: theme("cream"),
      faqs: [faq1.id, faq2.id],
    },
    {
      __component: "sections.form",
      variant: "default",
      title: "Contact us",
      description: "<p>Tell us about your project.</p>",
    },
    {
      __component: "sections.hero",
      variant: "default",
      title: "Built on a simple idea",
      description: "<p>Great software comes from small, empowered teams.</p>",
      label: "About",
      button: btn("Our story", "/about"),
    },
    {
      __component: "sections.hero",
      variant: "twoColumns",
      label: "Our approach",
      title: "Crafted for the web",
      description: "<p>Design and engineering under one roof.</p>",
      button: btn("See how we work", "/about-us"),
      indicatorText: "Discover what we do",
      theme: theme("black"),
    },
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
    {
      __component: "sections.industries",
      headline: h("Industries we serve"),
      button: btn("All industries", "/case-studies"),
      industries: [fintech.id, health.id, retail.id],
    },
    {
      __component: "sections.carousel",
      collectionType: "insights",
      headline: h("Insights"),
      button: btn("All insights", "/insights"),
      theme: theme("cream"),
      insightsPick: "manual",
      insights: [in1.id, in2.id, in3.id],
    },
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
    {
      __component: "sections.intersection-media",
      title: "Full-screen moment",
      button: btn("Explore", "/what-we-do"),
    },
    {
      __component: "sections.campaign-intro",
      variant: "default",
      label: "About service",
      title: "Web Engineering for Scalable Digital Foundations",
      description:
        "<p>Building high-performance, secure, and future-proof web applications designed to support complex business logic and rapid growth.</p>",
      button: btn("Discuss Your Project", "/contact-us"),
      indicatorText: "Scroll down",
    },
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
    {
      __component: "sections.process",
      headline: h("How we work"),
      button: btn("Start a project"),
      blocks: [process1.id, process2.id, process3.id],
    },
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
    {
      __component: "sections.services-group",
      headline: h("What we offer"),
      groups: [
        {
          __component: "shared.service-group",
          title: "Product Engineering",
          services: [svcFrontend.id, svcBackend.id, svcDevOps.id],
          relatedCaseStudies: [],
        },
      ],
    },
    {
      __component: "sections.team",
      variant: "grid",
      headline: h("Meet the team"),
      members: [m1.id, m2.id],
      content: item(
        "Who we are",
        "<p>Built by engineers, designers and PMs.</p>",
      ),
    },
    {
      __component: "sections.team",
      variant: "rows",
      title: "Team members",
      members: [m1.id, m2.id],
    },
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
    {
      __component: "sections.carousel",
      collectionType: "clientTestimonials",
      showLogos: true,
      headline: h("What our clients say"),
      clientTestimonials: [t1.id],
    },
    {
      __component: "sections.carousel",
      collectionType: "teamTestimonials",
      headline: h("Team testimonials"),
      teamTestimonials: [t2.id],
    },
  ];

  await strapi.entityService.create("api::page.page", {
    data: {
      title: "Home",
      slug: "index",
      showScrollTop: true,
      publishedAt: now.toISOString(),
      sections,
    },
  });

  log(`demo page 'index' created with ${sections.length} sections`);
}
