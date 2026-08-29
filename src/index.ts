import type { Core } from "@strapi/strapi";
import type { UID } from "@strapi/types";

/**
 * Content-manager configuration helper: human-readable, editor-friendly
 * field labels for the admin Layout mode. Strapi stores these labels in DB
 * config (not schema files), so we set them here idempotently on boot.
 */
const toMeta = (edit: string, list?: string) => ({
  edit: { label: edit, editable: true, visible: true },
  list: {
    label: list ?? edit,
    searchable: true,
    filterable: true,
    sortable: true,
  },
});

const CONTENT_TYPE_LABELS: Record<
  string,
  Record<string, ReturnType<typeof toMeta>>
> = {
  "api::case-study.case-study": {
    seo: toMeta("SEO"),
    slug: toMeta("Slug"),
    title: toMeta("Title"),
    label: toMeta("Label"),
    description: toMeta("Description"),
    shortTitle: toMeta("Short title"),
    shortDescription: toMeta("Short description"),
    featuredMedia: toMeta("Featured media"),
    isFeatured: toMeta("Featured"),
    logo: toMeta("Logo"),
    industries: toMeta("Industries"),
    services: toMeta("Services"),
    technologies: toMeta("Technologies"),
    regions: toMeta("Regions"),
  },
  "api::industry.industry": {
    title: toMeta("Title"),
    slug: toMeta("Slug"),
    description: toMeta("Description"),
    media: toMeta("Media"),
    relatedCases: toMeta("Related cases"),
  },
  "api::service.service": {
    title: toMeta("Title"),
    slug: toMeta("Slug"),
    description: toMeta("Description"),
    media: toMeta("Media"),
    link: toMeta("Link"),
    caseStudies: toMeta("Case studies"),
  },
  "api::technology.technology": {
    title: toMeta("Title"),
    slug: toMeta("Slug"),
    caseStudies: toMeta("Case studies"),
  },
  "api::region.region": {
    title: toMeta("Title"),
    slug: toMeta("Slug"),
    caseStudies: toMeta("Case studies"),
  },
  "api::platform.platform": {
    title: toMeta("Title"),
    logo: toMeta("Logo"),
    achievements: toMeta("Achievements"),
  },
  "api::achievement.achievement": {
    link: toMeta("Link"),
    title: toMeta("Title"),
    date: toMeta("Date"),
    platform: toMeta("Platform"),
    media: toMeta("Media"),
  },
  "api::testimonial.testimonial": {
    author: toMeta("Author"),
    position: toMeta("Position"),
    media: toMeta("Media"),
    text: toMeta("Text"),
    client: toMeta("Client"),
  },
  "api::client.client": {
    name: toMeta("Name"),
    logo: toMeta("Logo"),
    link: toMeta("Link"),
    testimonials: toMeta("Testimonials"),
  },
  "api::team.team": {
    media: toMeta("Media"),
    position: toMeta("Position"),
    email: toMeta("Email"),
    description: toMeta("Description"),
    socials: toMeta("Socials"),
    firstName: toMeta("First name"),
    lastName: toMeta("Last name"),
  },
  "api::faq.faq": {
    title: toMeta("Title"),
    description: toMeta("Description"),
  },
  "api::tech-stack.tech-stack": {
    title: toMeta("Title"),
    slug: toMeta("Slug"),
    description: toMeta("Description"),
    image: toMeta("Image"),
    link: toMeta("Link"),
  },
  "api::page.page": {
    title: toMeta("Title"),
    slug: toMeta("Slug"),
    seo: toMeta("SEO"),
    showScrollTop: toMeta("Show scroll-top button"),
    showSectionsNav: toMeta("Show sections nav"),
    sections: toMeta("Sections"),
  },
  "api::insight.insight": {
    title: toMeta("Title"),
    slug: toMeta("Slug"),
    seo: toMeta("SEO"),
    description: toMeta("Description"),
    featuredMedia: toMeta("Featured media"),
    isFeatured: toMeta("Featured"),
  },
  "api::use-case.use-case": {
    title: toMeta("Title"),
    slug: toMeta("Slug"),
    seo: toMeta("SEO"),
    description: toMeta("Description"),
    featuredMedia: toMeta("Featured media"),
  },
  "api::process.process": {
    title: toMeta("Title"),
    description: toMeta("Description"),
    media: toMeta("Media"),
  },
  "api::global.global": {
    footer: toMeta("Footer"),
  },
};

const COMPONENT_LABELS: Record<
  string,
  Record<string, ReturnType<typeof toMeta>>
> = {
  "shared.seo": {
    metaTitle: toMeta("Meta title"),
    metaDescription: toMeta("Meta description"),
    socialImage: toMeta("Social image"),
  },
  "shared.socials": {
    title: toMeta("Title"),
    link: toMeta("Link"),
  },
  "shared.button": {
    title: toMeta("Title"),
    variant: toMeta("Variant"),
    scrollTo: toMeta("Scroll to"),
    linkType: toMeta("Link type"),
    url: toMeta("URL"),
    page: toMeta("Page"),
    caseStudy: toMeta("Case study"),
    insight: toMeta("Insight"),
  },
  "sections.cta": {
    label: toMeta("Label"),
    title: toMeta("Title"),
    description: toMeta("Description"),
    buttons: toMeta("Buttons"),
    backgroundImage: toMeta("Background image"),
    theme: toMeta("Theme"),
  },
  "shared.headline": {
    title: toMeta("Title"),
    addCount: toMeta("Add count"),
  },
  "shared.theme": {
    background: toMeta("Background"),
    textColor: toMeta("Text color"),
  },
  "sections.achievements": {
    headline: toMeta("Headline"),
    theme: toMeta("Theme"),
    achievements: toMeta("Achievements"),
  },
  "shared.content-item": {
    title: toMeta("Title"),
    description: toMeta("Description"),
    button: toMeta("Button"),
  },
  "shared.card-numerated": {
    title: toMeta("Title"),
    description: toMeta("Description"),
    media: toMeta("Media"),
  },
  "shared.card-milestone": {
    title: toMeta("Title"),
    description: toMeta("Description"),
  },
  "shared.color-box": {
    title: toMeta("Title"),
    label: toMeta("Label"),
    expandable: toMeta("Expandable"),
    blocks: toMeta("Blocks"),
  },
  "shared.showreel": {
    video: toMeta("Video"),
    poster: toMeta("Poster"),
  },
  "shared.floating-card": {
    title: toMeta("Title"),
    description: toMeta("Description"),
    media: toMeta("Media"),
  },
  "shared.service-group": {
    title: toMeta("Title"),
    services: toMeta("Services"),
    relatedUseCases: toMeta("Related use cases"),
  },
  "sections.content-numerated": {
    headline: toMeta("Headline"),
    button: toMeta("Button"),
    layout: toMeta("Layout"),
    behavior: toMeta("Behavior"),
    items: toMeta("Items"),
  },
  "sections.content-image-numerated": {
    headline: toMeta("Headline"),
    subtitle: toMeta("Subtitle"),
    button: toMeta("Button"),
    media: toMeta("Media"),
    blocks: toMeta("Blocks"),
  },
  "sections.faq": {
    headline: toMeta("Headline"),
    theme: toMeta("Theme"),
    faqs: toMeta("FAQs"),
  },
  "sections.use-cases": {
    headline: toMeta("Headline"),
    theme: toMeta("Theme"),
    button: toMeta("Button"),
    pick: toMeta("Pick"),
    useCases: toMeta("Use cases"),
  },
  "sections.case-studies": {
    pick: toMeta("Pick"),
    headline: toMeta("Headline"),
    theme: toMeta("Theme"),
    button: toMeta("Button"),
    caseStudies: toMeta("Case studies"),
  },
  "sections.insights": {
    pick: toMeta("Pick"),
    headline: toMeta("Headline"),
    theme: toMeta("Theme"),
    button: toMeta("Button"),
    insights: toMeta("Insights"),
  },
  "sections.hero-two-columns": {
    title: toMeta("Title"),
    description: toMeta("Description"),
    button: toMeta("Button"),
    label: toMeta("Label"),
    indicatorText: toMeta("Indicator text"),
  },
  "sections.cards-large-numerated": {
    headline: toMeta("Headline"),
    cardsLayout: toMeta("Cards layout"),
    cards: toMeta("Cards"),
  },
  "sections.testimonials-team": {
    headline: toMeta("Headline"),
    cardsLayout: toMeta("Cards layout"),
    cards: toMeta("Cards"),
  },
  "sections.testimonials-clients": {
    headline: toMeta("Headline"),
    cards: toMeta("Cards"),
  },
  "sections.team-grid": {
    headline: toMeta("Headline"),
    team: toMeta("Team"),
    content: toMeta("Content"),
  },
  "sections.progress-cards": {
    headline: toMeta("Headline"),
    cards: toMeta("Cards"),
  },
  "sections.content-color-boxes": {
    headline: toMeta("Headline"),
    subtitle: toMeta("Subtitle"),
    description: toMeta("Description"),
    boxes: toMeta("Boxes"),
  },
  "sections.content-image-left": {
    headline: toMeta("Headline"),
    label: toMeta("Label"),
    media: toMeta("Media"),
    title: toMeta("Title"),
    content: toMeta("Content"),
    button: toMeta("Button"),
  },
  "sections.hero-rich": {
    title: toMeta("Title"),
    description: toMeta("Description"),
    button: toMeta("Button"),
    label: toMeta("Label"),
    variant: toMeta("Variant"),
    carousel: toMeta("Carousel"),
  },
  "sections.hero-svg": {
    title: toMeta("Title"),
    image: toMeta("Image"),
  },
  "sections.form": {
    variant: toMeta("Variant"),
    title: toMeta("Title"),
    description: toMeta("Description"),
    label: toMeta("Label"),
    media: toMeta("Media"),
  },
  "sections.person": {
    person: toMeta("Person"),
    address: toMeta("Address"),
    email: toMeta("Email"),
    socials: toMeta("Socials"),
    button: toMeta("Button"),
  },
  "sections.team": {
    title: toMeta("Title"),
    members: toMeta("Members"),
  },
  "sections.process": {
    headline: toMeta("Headline"),
    blocks: toMeta("Blocks"),
    button: toMeta("Button"),
  },
  "sections.services-group": {
    headline: toMeta("Headline"),
    groups: toMeta("Groups"),
  },
  "sections.industries": {
    headline: toMeta("Headline"),
    button: toMeta("Button"),
    industries: toMeta("Industries"),
  },
  "sections.tech-stack": {
    headline: toMeta("Headline"),
    button: toMeta("Button"),
    blocks: toMeta("Blocks"),
  },
  "sections.intro-showreel": {
    title: toMeta("Title"),
    button: toMeta("Button"),
    media: toMeta("Media"),
    label: toMeta("Label"),
    description: toMeta("Description"),
    showreel: toMeta("Showreel"),
  },
  "sections.intersection-floating-boxes": {
    headline: toMeta("Headline"),
    media: toMeta("Media"),
    blocks: toMeta("Blocks"),
  },
  "sections.intersection-media": {
    title: toMeta("Title"),
    button: toMeta("Button"),
    media: toMeta("Media"),
  },
};

const EMPTY_CONFIG = {
  settings: {},
  metadatas: {},
  layouts: { list: [], edit: [] },
};

export default {
  register() {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    try {
      // Strapi 5.52 exposes content-manager configuration via the
      // content-types / components services (no top-level `configuration` service).
      const cmContentTypes = strapi
        .plugin("content-manager")
        .service("content-types");

      // Main field used by the admin to label related entries in pickers.
      // Default to `title`; override for types that don't have one.
      const MAIN_FIELD_OVERRIDES: Record<string, string> = {
        "api::testimonial.testimonial": "author",
        "api::team.team": "firstName",
        "api::client.client": "name",
      };

      const mainFieldFor = (uid: string): string | undefined => {
        if (MAIN_FIELD_OVERRIDES[uid]) return MAIN_FIELD_OVERRIDES[uid];
        const schema = strapi.contentType(uid as UID.ContentType);
        return schema && "title" in schema.attributes ? "title" : undefined;
      };

      // Relation fields resolve their picker label from the field's OWN
      // metadata `mainField` (admin: `metadata.mainField || settings.mainField`,
      // where `settings` is only populated for component attributes). Without it
      // the picker falls back to the documentId → set it on every relation field
      // (content types AND components), including block-level section pickers.
      const applyRelationMainFields = (
        attributes: Record<string, any>,
        metadatas: Record<string, any>,
      ) => {
        for (const [name, attr] of Object.entries(attributes)) {
          if (attr.type !== "relation" || !attr.target) continue;
          const display = mainFieldFor(attr.target);
          if (!display) continue;
          const m = metadatas[name] ?? {};
          metadatas[name] = {
            ...m,
            edit: { ...(m.edit ?? {}), mainField: display },
            list: { ...(m.list ?? {}), mainField: display },
          };
        }
      };

      for (const [uid, fields] of Object.entries(CONTENT_TYPE_LABELS)) {
        const schema = strapi.contentType(uid as UID.ContentType);
        if (!schema) continue;
        const current =
          (await cmContentTypes.findConfiguration(schema)) || EMPTY_CONFIG;
        const metadatas = { ...current.metadatas };
        for (const [field, meta] of Object.entries(fields)) {
          metadatas[field] = { ...(metadatas[field] || {}), ...meta };
        }
        applyRelationMainFields(schema.attributes, metadatas);
        const mainField =
          MAIN_FIELD_OVERRIDES[uid] ??
          ("title" in schema.attributes ? "title" : undefined);
        await cmContentTypes.updateConfiguration(schema, {
          ...current,
          uid,
          metadatas,
          settings: mainField
            ? { ...current.settings, mainField }
            : current.settings,
        });
      }

      const cmComponents = strapi
        .plugin("content-manager")
        .service("components");
      for (const [uid, fields] of Object.entries(COMPONENT_LABELS)) {
        const schema = strapi.components[uid as UID.Component];
        if (!schema) continue;
        const current =
          (await cmComponents.findConfiguration(schema)) || EMPTY_CONFIG;
        const metadatas = { ...current.metadatas };
        for (const [field, meta] of Object.entries(fields)) {
          metadatas[field] = { ...(metadatas[field] || {}), ...meta };
        }
        applyRelationMainFields(schema.attributes, metadatas);
        await cmComponents.updateConfiguration(schema, {
          ...current,
          uid,
          metadatas,
        });
      }
    } catch (error) {
      console.warn("Could not apply content-manager labels:", error);
    }

    // Content Manager Organizer — pre-seed a default sidebar grouping so the
    // admin is organized on first launch. Fully editable later in
    // Settings → Content Manager Organizer (drag & drop, persisted to DB).
    try {
      const organizerQuery = strapi.db.query(
        "plugin::content-manager-organizer.content-manager-configuration",
      );
      const existingOrg = await organizerQuery.findOne({
        where: { key: "main" },
      });
      if (!existingOrg) {
        await organizerQuery.create({
          data: {
            key: "main",
            config: {
              stripNumericPrefix: true,
              sortBy: "alphabetical",
              groups: [
                {
                  id: "content",
                  label: "Content",
                  defaultExpanded: true,
                  kind: "collectionType",
                  items: ["case-study", "use-case", "insight", "faq"],
                },
                {
                  id: "company",
                  label: "Company",
                  defaultExpanded: true,
                  kind: "collectionType",
                  items: [
                    "team",
                    "client",
                    "achievement",
                    "testimonial",
                    "process",
                  ],
                },
                {
                  id: "taxonomies",
                  label: "Taxonomies",
                  defaultExpanded: false,
                  kind: "collectionType",
                  items: [
                    "industry",
                    "service",
                    "technology",
                    "region",
                    "platform",
                  ],
                },
                {
                  id: "site",
                  label: "Site",
                  defaultExpanded: false,
                  kind: "collectionType",
                  items: ["page", "tech-stack"],
                },
              ],
            },
          },
        });
        console.log("[organizer] seeded default sidebar groups");
      }
    } catch (error: any) {
      console.warn(
        "Could not seed content-manager-organizer config:",
        error?.message,
      );
    }

    // Idempotent local demo data — opt-in via SEED_DEMO=true
    if (process.env.SEED_DEMO === "true") {
      try {
        const { seedContent, seedGlobals } = await import("./seed-content");
        await seedContent(strapi);
        await seedGlobals(strapi);
      } catch (error: any) {
        console.warn("Could not seed demo data:", error?.message);
        if (error?.details?.errors) {
          error.details.errors.forEach((e: any) =>
            console.warn("[seed] detail:", JSON.stringify(e)),
          );
        }
      }

      // Idempotent navigations + page scaffold (runs after content so the
      // demo homepage already exists and nav links resolve).
      try {
        const { seedNavigation } = await import("./seed-navigation");
        await seedNavigation(strapi);
      } catch (error: any) {
        console.warn("Could not seed navigations:", error?.message);
        if (error?.details?.errors) {
          error.details.errors.forEach((e: any) =>
            console.warn("[seed-navigation] detail:", JSON.stringify(e)),
          );
        }
      }
    }
  },
};
