/**
 * Idempotent navigation + page scaffolder for local development.
 *
 * Creates the six site navigations (header, header-secondary, social-networks,
 * footer-industries, footer-services, footer-navigation) via the navigation
 * plugin's own admin service (the same code path the admin UI uses), scaffolds
 * a blank page for every route the navigations point to, and seeds matching
 * service / industry taxonomy entries.
 *
 * Runs from `src/index.ts` bootstrap when `SEED_DEMO=true`. Safe to re-run:
 * pages/taxonomy are matched by slug and left untouched if they exist; each
 * navigation is upserted by slug and its item tree reconciled via `put`.
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

// ---------------------------------------------------------------------------
// Content definitions
// ---------------------------------------------------------------------------

const SERVICES = [
  "Web Development",
  "UX / UI Design",
  "Frontend Development",
  "Product Design",
  "Backend Development",
  "Legacy Software Modernization",
  "eCommerce Development",
  "Software Audit",
  "Mobile Development",
  "Team Extension",
].map((title) => ({ title, slug: slugify(title) }));

const INDUSTRIES = [
  "Human Capital & Wellbeing",
  "Marketing & Digital Media",
  "Professional Services & Business",
  "Commerce & Consumer Experience",
  "Mobility & Infrastructure",
].map((title) => ({ title, slug: slugify(title) }));

const SOCIALS = [
  { title: "Facebook", url: "https://www.facebook.com/" },
  { title: "LinkedIn", url: "https://www.linkedin.com/" },
  { title: "Dribbble", url: "https://dribbble.com/" },
  { title: "Instagram", url: "https://www.instagram.com/" },
];

type NavItem = {
  title: string;
  type: "INTERNAL" | "EXTERNAL" | "WRAPPER";
  path?: string;
  externalPath?: string;
  key: string;
  children?: NavItem[];
};

const serviceItems = (pathPrefix: string): NavItem[] =>
  SERVICES.map((s) => ({
    title: s.title,
    type: "INTERNAL",
    path: `/${pathPrefix}/${s.slug}`,
    key: `${pathPrefix}-${s.slug}`,
  }));

const industryItems = (): NavItem[] =>
  INDUSTRIES.map((ind) => ({
    title: ind.title,
    type: "INTERNAL",
    // No dedicated industry pages — every industry links to the Industries
    // section on the homepage (see `sections.industries` anchor).
    path: "/#industries",
    key: `industry-${ind.slug}`,
  }));

const NAVIGATIONS: { name: string; items: NavItem[] }[] = [
  {
    name: "Header",
    items: [
      { title: "Home", type: "INTERNAL", path: "/", key: "home" },
      {
        title: "Services",
        type: "WRAPPER",
        key: "services",
        children: [
          {
            title: "All Services",
            type: "INTERNAL",
            path: "/services",
            key: "all-services",
          },
          ...serviceItems("services"),
        ],
      },
      {
        title: "Industries",
        type: "WRAPPER",
        key: "industries",
        children: industryItems(),
      },
      {
        title: "Technologies",
        type: "WRAPPER",
        path: "/#technologies",
        key: "technologies",
      },
      {
        title: "Case Studies",
        type: "INTERNAL",
        path: "/case-studies",
        key: "case-studies",
      },
    ],
  },
  {
    name: "Header Secondary",
    items: [
      {
        title: "About Us",
        type: "INTERNAL",
        path: "/about-us",
        key: "about-us",
      },
      {
        title: "Resources",
        type: "INTERNAL",
        path: "/resources",
        key: "resources",
      },
      {
        title: "Contact Us",
        type: "INTERNAL",
        path: "/contact-us",
        key: "contact-us",
      },
      { title: "Career", type: "INTERNAL", path: "/career", key: "career" },
    ],
  },
  {
    name: "Social Networks",
    items: SOCIALS.map((s, i) => ({
      title: s.title,
      type: "EXTERNAL" as const,
      externalPath: s.url,
      key: `social-${slugify(s.title)}`,
    })),
  },
  {
    name: "Footer Industries",
    items: industryItems(),
  },
  {
    name: "Footer Services",
    items: serviceItems("services"),
  },
  {
    name: "Footer Navigation",
    items: [
      {
        title: "Services",
        type: "INTERNAL",
        path: "/services",
        key: "footer-nav-services",
      },
      {
        title: "Industries",
        type: "INTERNAL",
        path: "/#industries",
        key: "footer-nav-industries",
      },
      {
        title: "Technologies",
        type: "WRAPPER",
        path: "/#technologies",
        key: "footer-nav-technologies",
      },
      {
        title: "Case Studies",
        type: "INTERNAL",
        path: "/case-studies",
        key: "footer-nav-case-studies",
      },
      {
        title: "About Us",
        type: "INTERNAL",
        path: "/about-us",
        key: "footer-nav-about-us",
      },
      {
        title: "Resources",
        type: "INTERNAL",
        path: "/resources",
        key: "footer-nav-resources",
      },
      {
        title: "Contact Us",
        type: "INTERNAL",
        path: "/contact-us",
        key: "footer-nav-contact-us",
      },
      {
        title: "Career",
        type: "INTERNAL",
        path: "/career",
        key: "footer-nav-career",
      },
    ],
  },
  {
    name: "Footer Legal",
    items: [
      {
        title: "Privacy & Terms",
        type: "INTERNAL",
        path: "/privacy-policy",
        key: "footer-legal-privacy-terms",
      },
      {
        title: "Cookies Policy",
        type: "INTERNAL",
        path: "/privacy-policy",
        key: "footer-legal-cookies-policy",
      },
      // No path → the frontend renders this as a button (cookie-consent
      // trigger) instead of a link.
      {
        title: "Manage Cookies",
        type: "WRAPPER",
        key: "footer-legal-manage-cookies",
      },
    ],
  },
];

const PAGES: { title: string; slug: string }[] = [
  { title: "Services", slug: "services" },
  { title: "Case Studies", slug: "case-studies" },
  { title: "About Us", slug: "about-us" },
  { title: "Resources", slug: "resources" },
  { title: "Contact Us", slug: "contact-us" },
  { title: "Career", slug: "career" },
  ...SERVICES.map((s) => ({ title: s.title, slug: `services/${s.slug}` })),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ensure a (title, slug) entry exists for a content type; returns it. */
async function ensureBySlug(
  strapi: Strapi,
  uid: UID.ContentType,
  entries: { title: string; slug: string }[],
): Promise<{ id: number; documentId: string; slug: string }[]> {
  const q = strapi.db.query(uid);
  const created: { id: number; documentId: string; slug: string }[] = [];

  for (const entry of entries) {
    const existing = (await q.findOne({
      where: { slug: entry.slug },
    })) as { id: number; documentId: string } | null;

    if (existing) {
      created.push({ ...existing, slug: entry.slug });
      continue;
    }

    const doc = (await strapi.entityService.create(uid, {
      data: { ...entry, publishedAt: now.toISOString() },
    })) as { id: number; documentId: string };
    created.push({ ...doc, slug: entry.slug });
  }

  return created;
}

/** Map a NavItem tree into the plugin's item DTO shape (nested `items`). */
const toItemDto = (item: NavItem, order: number): Record<string, unknown> => ({
  title: item.title,
  type: item.type,
  ...(item.path !== undefined ? { path: item.path, isManualPath: true } : {}),
  ...(item.externalPath !== undefined
    ? { externalPath: item.externalPath }
    : {}),
  uiRouterKey: item.key,
  menuAttached: true,
  order,
  collapsed: false,
  autoSync: true,
  ...(item.children && item.children.length
    ? { items: item.children.map((c, i) => toItemDto(c, i)) }
    : {}),
});

/**
 * Upsert a navigation by name (slug derived from name via the plugin's own
 * slugify) and set its item tree.
 *
 * The plugin's admin `put` only *creates* items that carry no `documentId`
 * (and only *updates* those that do) — it never prunes items missing from the
 * payload. To keep the seeder idempotent and canonical, we delete the whole
 * navigation (cascading its items through the plugin's own delete path) and
 * rebuild it with `post` + `put`. Dev-only, `SEED_DEMO=true`.
 */
async function upsertNavigation(
  strapi: Strapi,
  name: string,
  items: NavItem[],
): Promise<{ id: number; documentId: string; slug: string }> {
  const slug = slugify(name);
  const q = strapi.db.query("plugin::navigation.navigation");
  const adminService = strapi.plugin("navigation").service("admin");
  const log = (msg: string) => console.log(`[seed-navigation] ${msg}`);

  const existing = (await q.findOne({ where: { slug } })) as
    | { id: number; documentId: string }
    | undefined;

  if (existing) {
    await adminService.delete({
      auditLog: undefined,
      documentId: existing.documentId,
    });
  }

  const created = (await adminService.post({
    auditLog: undefined,
    payload: { name, visible: true },
  })) as { id: number; documentId: string };

  await adminService.put({
    auditLog: undefined,
    payload: {
      id: created.id,
      documentId: created.documentId,
      locale: "en",
      name,
      visible: true,
      items: items.map((item, i) => toItemDto(item, i)),
    },
  });

  return { ...created, slug };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function seedNavigation(strapi: Strapi) {
  const log = (msg: string) => console.log(`[seed-navigation] ${msg}`);

  // Scaffold pages (blank dynamiczone).
  const pages = await ensureBySlug(strapi, "api::page.page", PAGES);
  log(`pages: ${pages.length} ensured (incl. index)`);

  // Industries have no dedicated pages — they link to the homepage section.
  // Remove any leftover `industries` / `industries/*` pages from earlier seeds.
  const qPage = strapi.db.query("api::page.page");
  const removed = (await qPage.deleteMany({
    where: {
      $or: [{ slug: "industries" }, { slug: { $startsWith: "industries/" } }],
    },
  })) as { count: number };
  if (removed?.count) {
    log(`removed ${removed.count} stale industry page(s)`);
  }

  // Taxonomy entries.
  const services = await ensureBySlug(strapi, "api::service.service", SERVICES);
  const industries = await ensureBySlug(
    strapi,
    "api::industry.industry",
    INDUSTRIES,
  );
  log(`taxonomy: services=${services.length} industries=${industries.length}`);

  // Navigations.
  for (const { name, items } of NAVIGATIONS) {
    await upsertNavigation(strapi, name, items);
    log(
      `navigation '${slugify(name)}' upserted (${items.length} top-level items)`,
    );
  }

  // The plugin auto-creates an empty default "Navigation" (slug `navigation`)
  // on first boot when no navigations exist. It's harmless (frontend consumes
  // by explicit slug), so we leave it in place.
}
