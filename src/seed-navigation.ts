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
  relatedType?: string;
  relatedDocumentId?: string;
  children?: NavItem[];
};

type NavEntry = { title: string; slug: string; documentId: string };

type NavLinks = {
  servicePath: (slug: string) => string;
  industryHref: (slug: string) => string;
  serviceHubPath: string;
  casesHubPath: string;
  serviceHubSlug: string | null;
  casesHubSlug: string | null;
  serviceEntries: NavEntry[];
  industryEntries: NavEntry[];
  pageIds: Map<string, string>;
};

const CASES_FILTER_PARAM = "cases_industries";

const serviceItems = (
  servicePath: NavLinks["servicePath"],
  serviceEntries: NavEntry[],
): NavItem[] =>
  serviceEntries.map((service) => ({
    title: service.title,
    type: "INTERNAL",
    path: servicePath(service.slug),
    key: `services-${service.slug}`,
    relatedType: "api::service.service",
    relatedDocumentId: service.documentId,
  }));

const industryItems = (
  industryHref: NavLinks["industryHref"],
  industryEntries: NavEntry[],
): NavItem[] =>
  industryEntries.map((industry) => ({
    title: industry.title,
    type: "INTERNAL" as const,
    // No dedicated industry pages — the Cases listing renders each industry
    // through its own filter, on the hub page the case studies live under.
    path: industryHref(industry.slug),
    key: `industry-${industry.slug}`,
    relatedType: "api::industry.industry",
    relatedDocumentId: industry.documentId,
  }));

const navigations = ({
  servicePath,
  industryHref,
  serviceHubPath,
  casesHubPath,
  serviceHubSlug,
  casesHubSlug,
  serviceEntries,
  industryEntries,
  pageIds,
}: NavLinks): { name: string; items: NavItem[] }[] => [
  {
    name: "Header",
    items: [
      {
        title: "Home",
        type: "INTERNAL",
        path: "/",
        key: "home",
        relatedType: "api::page.page",
        relatedDocumentId: pageIds.get("index"),
      },
      {
        title: "Services",
        type: "WRAPPER",
        key: "services",
        children: [
          {
            title: "All Services",
            type: "INTERNAL",
            path: serviceHubPath,
            key: "all-services",
            relatedType: "api::page.page",
            relatedDocumentId: serviceHubSlug
              ? pageIds.get(serviceHubSlug)
              : undefined,
          },
          ...serviceItems(servicePath, serviceEntries),
        ],
      },
      {
        title: "Industries",
        type: "WRAPPER",
        key: "industries",
        children: industryItems(industryHref, industryEntries),
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
        path: casesHubPath,
        key: "case-studies",
        relatedType: "api::page.page",
        relatedDocumentId: casesHubSlug ? pageIds.get(casesHubSlug) : undefined,
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
    items: industryItems(industryHref, industryEntries),
  },
  {
    name: "Footer Services",
    items: serviceItems(servicePath, serviceEntries),
  },
  {
    name: "Footer Navigation",
    items: [
      {
        title: "Services",
        type: "INTERNAL",
        path: serviceHubPath,
        key: "footer-nav-services",
        relatedType: "api::page.page",
        relatedDocumentId: serviceHubSlug
          ? pageIds.get(serviceHubSlug)
          : undefined,
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
        path: casesHubPath,
        key: "footer-nav-case-studies",
        relatedType: "api::page.page",
        relatedDocumentId: casesHubSlug ? pageIds.get(casesHubSlug) : undefined,
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
];

/** Hub page each content type is listed under (see the `parent` relation). */
const CONTENT_TYPE_PARENTS: { collection: UID.ContentType; slug: string }[] = [
  { collection: "api::service.service", slug: "services" },
  { collection: "api::case-study.case-study", slug: "case-studies" },
  { collection: "api::insight.insight", slug: "resources" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Every entry of a collection (draft + published rows deduped by slug). */
async function collectionEntries(
  strapi: Strapi,
  uid: UID.ContentType,
  fallback: { title: string; slug: string }[],
): Promise<NavEntry[]> {
  const rows = (await strapi.db.query(uid).findMany({
    orderBy: { title: "asc" },
  })) as NavEntry[];
  const bySlug = new Map<string, NavEntry>();

  for (const row of rows) {
    if (row.slug && !bySlug.has(row.slug)) bySlug.set(row.slug, row);
  }

  if (bySlug.size === 0) {
    return fallback.map((entry) => ({ ...entry, documentId: "" }));
  }

  return [...bySlug.values()].sort((a, b) =>
    a.title.localeCompare(b.title, "en", { sensitivity: "base" }),
  );
}

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
  ...(item.relatedType && item.relatedDocumentId
    ? {
        related: {
          __type: item.relatedType,
          documentId: item.relatedDocumentId,
        },
        autoSync: false,
      }
    : { autoSync: true }),
  uiRouterKey: item.key,
  menuAttached: true,
  order,
  collapsed: false,
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

  // Every content type sits under its hub page, so URLs come from the parent
  // chain instead of a hardcoded prefix. A relation link must point at the row
  // OF ITS OWN VERSION — a draft-page link on a published row resolves to null
  // and drops the entry to a root-level URL — so pick the matching page row.
  for (const { collection, slug } of CONTENT_TYPE_PARENTS) {
    const pageRows = (await qPage.findMany({ where: { slug } })) as {
      id: number;
      publishedAt: string | null;
    }[];
    if (pageRows.length === 0) continue;

    const draftPage = pageRows.find((page) => !page.publishedAt) ?? pageRows[0];
    const publishedPage =
      pageRows.find((page) => page.publishedAt) ?? pageRows[0];

    const rows = (await strapi.db.query(collection).findMany({
      populate: { parent: true },
    })) as {
      id: number;
      publishedAt: string | null;
      parent?: { id: number; publishedAt: string | null } | null;
    }[];
    let linked = 0;

    for (const row of rows) {
      const parent = row.publishedAt ? publishedPage : draftPage;
      const parentMatches =
        row.parent?.id && !!row.parent.publishedAt === !!row.publishedAt;
      if (parentMatches) continue;

      await strapi.db.query(collection).update({
        where: { id: row.id },
        data: { parent: parent.id },
      });
      linked += 1;
    }

    log(`parent '${slug}': ${linked} of ${rows.length} ${collection} linked`);
  }

  // Navigations. Every path comes from the CMS: a page is its own slug, an
  // entry is `parent page slug + slug`, and a filtered listing hangs off the
  // hub page its content type is parented to.
  const pagePath = (slug: string | null): string =>
    !slug || slug === "index" ? "/" : `/${slug}`;
  const entryPath = (parentSlug: string | null, slug: string): string =>
    parentSlug && parentSlug !== "index"
      ? `/${parentSlug}/${slug}`
      : `/${slug}`;

  const parentSlugsOf = async (uid: UID.ContentType) => {
    const rows = (await strapi.db.query(uid).findMany({
      populate: { parent: true },
    })) as { slug: string; parent?: { slug: string } | null }[];
    const bySlug = new Map<string, string>();
    for (const row of rows) {
      if (row.parent?.slug && !bySlug.has(row.slug)) {
        bySlug.set(row.slug, row.parent.slug);
      }
    }
    return bySlug;
  };

  const hubSlugOf = (
    parents: Map<string, string>,
    uid: UID.ContentType,
  ): string | null =>
    [...parents.values()][0] ??
    CONTENT_TYPE_PARENTS.find((entry) => entry.collection === uid)?.slug ??
    null;

  const serviceParents = await parentSlugsOf("api::service.service");
  const caseStudyParents = await parentSlugsOf("api::case-study.case-study");
  const serviceHubSlug = hubSlugOf(serviceParents, "api::service.service");
  const casesHubSlug = hubSlugOf(
    caseStudyParents,
    "api::case-study.case-study",
  );
  const serviceHubPath = pagePath(serviceHubSlug);
  const casesHubPath = pagePath(casesHubSlug);

  const documentIdsOf = (rows: { slug: string; documentId: string }[]) =>
    new Map(rows.map((row) => [row.slug, row.documentId]));

  const serviceEntries = await collectionEntries(
    strapi,
    "api::service.service",
    SERVICES,
  );
  const industryEntries = await collectionEntries(
    strapi,
    "api::industry.industry",
    INDUSTRIES,
  );

  for (const { name, items } of navigations({
    serviceHubPath,
    casesHubPath,
    serviceHubSlug,
    casesHubSlug,
    serviceEntries,
    industryEntries,
    pageIds: new Map([
      ...documentIdsOf(pages),
      ...documentIdsOf(
        (await qPage.findMany({ where: { slug: "index" } })) as {
          slug: string;
          documentId: string;
        }[],
      ),
    ]),
    servicePath: (slug) => entryPath(serviceParents.get(slug) ?? null, slug),
    industryHref: (slug) => `${casesHubPath}?${CASES_FILTER_PARAM}=${slug}`,
  })) {
    await upsertNavigation(strapi, name, items);
    log(
      `navigation '${slugify(name)}' upserted (${
        items.length
      } top-level items)`,
    );
  }

  // The plugin auto-creates an empty default "Navigation" (slug `navigation`)
  // on first boot when no navigations exist. It's harmless (frontend consumes
  // by explicit slug), so we leave it in place.
}
