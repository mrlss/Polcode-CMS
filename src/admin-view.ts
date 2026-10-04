import type { Core } from "@strapi/strapi";
import fs from "node:fs";
import path from "node:path";

interface FieldCopy {
  label?: string;
  description?: string;
  placeholder?: string;
}

type CopyMap = Record<string, Record<string, FieldCopy>>;

/* Tips repeated across every section component. */
const ANCHOR_TIP =
  'Section id / URL hash (e.g. "industries" → #industries). It is also what a Nav item targets, so it must be unique on the page.';
const THEME_TIP = "Section background + text colour.";
const MEDIA_TIP = "Image or video shown in this section.";
const BUTTON_TIP = "Optional call to action.";
const HEADLINE_TIP =
  "Small label above / beside the section title. Leave empty to render the title alone.";

/**
 * Field hints shown in the Content Manager edit view. Strapi keeps these in the
 * content-manager configuration (not in the schema), which is why a schema
 * `description` only appears in the Content-Type Builder — this module is the
 * single place where the editorial copy for the edit view lives.
 */
const COPY: CopyMap = {
  "api::page.page": {
    title: {
      description:
        "Page name shown in the admin list. Used as the browser title unless SEO overrides it.",
    },
    slug: {
      description:
        "URL segment for this page: 'index' renders the homepage at '/', any other value renders '/<slug>'. One segment only — no slashes.",
    },
    seo: {
      description:
        "Optional search + social overrides. Everything falls back to the title and intro copy above.",
    },
    showScrollTop: {
      description: "Show the 'scroll to top' button on this page.",
    },
    sections: {
      description:
        "Page content, top to bottom. The first section is the page hero and renders the H1.",
    },
  },
  "api::case-study.case-study": {
    slug: {
      description:
        "URL segment for this case study, appended to its parent page's path.",
    },
    parent: {
      description:
        "Optional parent page. The public URL is the parent's path plus this slug. Leave empty to publish at the site root ('/<slug>').",
    },
    seo: {
      description:
        "Optional search + social overrides. Everything falls back to the short title and short description.",
    },
    sections: {
      description:
        "Case study body, top to bottom. The hero (title, logo, media, taxonomies) is generated from the fields above.",
    },
  },
  "api::insight.insight": {
    slug: {
      description:
        "URL segment for this resource, appended to its parent page's path.",
    },
    parent: {
      description:
        "Optional parent page. The public URL is the parent's path plus this slug. Leave empty to publish at the site root ('/<slug>').",
    },
    readDuration: {
      label: "Reading / listening time",
      description:
        'Free text shown in the detail meta line and the article aside. Articles: "6 min read" · podcasts: "38 min" · eBooks: "42 pages".',
    },
    seo: {
      description:
        "Optional search + social overrides. Everything falls back to the title and description.",
    },
    sections: {
      description:
        "Article body, top to bottom. The hero (title, author, cover) is generated from the fields above.",
    },
  },
  "api::service.service": {
    slug: {
      description:
        "URL segment for this service, appended to its parent page's path.",
    },
    parent: {
      description:
        "Optional parent page. The public URL is the parent's path plus this slug (e.g. Services + 'web-development' → /services/web-development). Leave empty to publish at the site root ('/<slug>').",
    },
    seo: {
      description:
        "Optional search + social overrides. Everything falls back to the title and description.",
    },
    sections: {
      description:
        "Service page content, top to bottom. The hero (title, description, thumbnail) is generated from the fields above.",
    },
  },
  "shared.theme": {
    background: {
      description:
        "Section background: white, cream, black or purple. Black and purple flip the text and the ghost buttons to their light variant.",
    },
    textColor: {
      description:
        "Text colour inside the section. 'light' = white text (used on dark backgrounds).",
    },
    headerTheme: {
      description:
        "Text colour of the header bar while this section is under it. Leave empty to follow the section's text colour.",
    },
  },
  "shared.button": {
    title: { placeholder: "Button label" },
    variant: {
      description:
        "Visual style. Leave it on 'none' to let the section theme pick a contrasting variant automatically.",
    },
    scrollTo: {
      description:
        "Scrolls to a section of the same page (the target section's 'Nav item' anchor). Takes precedence over the link target below.",
    },
    linkType: {
      description:
        "Where the button goes: an external or relative URL, or a page / case study / insight / service picked below.",
    },
    url: { description: "Used when Link type = URL." },
    page: { description: "Used when Link type = Page." },
    caseStudy: { description: "Used when Link type = Case study." },
    insight: { description: "Used when Link type = Insight." },
    service: { description: "Used when Link type = Service." },
  },
  "shared.nav-item": {
    label: {
      description:
        "Chip label in the page's on-page menu. Keep it short (e.g. 'All', 'eBooks').",
    },
    anchor: {
      description:
        "Target id, without the '#'. It also becomes the section's DOM id, so it must be unique on the page.",
    },
  },
  "shared.show-more": {
    itemsToShow: {
      description:
        "How many items render up front. Everything after them stays collapsed behind the toggle.",
    },
    showMoreLabel: { description: "Label of the collapsed toggle." },
    showLessLabel: { description: "Label of the expanded toggle." },
  },
  "shared.load-more": {
    initialItems: {
      description: "How many items render up front, before the first click.",
    },
    loadChunk: { description: "How many items one click adds." },
    loadMoreLabel: { description: "Label of the Load more button." },
  },
  "sections.page-intro": {
    anchor: {
      description:
        "DOM id / URL hash for this section (e.g. 'intro' → #intro).",
    },
    label: { description: "Small eyebrow above the title." },
    title: { description: "Page title, rendered as the H1." },
    description: { description: "Intro paragraph under the title." },
    showScrollCue: { description: "Show the 'Scroll down' cue." },
    theme: { description: "Section background + text colour." },
  },
  "sections.insight-list": {
    navItem: {
      label: "On-page nav entry",
      description:
        "This section's entry in the page's on-page menu. Leave it empty to keep the section out of the menu.",
    },
    title: {
      description:
        "Section heading. Leave empty to render the list without one (and out of the on-page menu when no Nav item is set).",
    },
    layout: {
      description:
        "Presented as one large card, a large card per slide, a swipeable row, a static grid, or a grid with filters + paging.",
    },
    audience: {
      description:
        "Narrow the list to one primary audience. Leave empty to use every audience.",
    },
    insights: {
      description:
        "A hand-picked list, in your order. Takes precedence over the audience and the type.",
    },
    resourceType: {
      description:
        "Narrow the list to one resource type (Article, eBook, Podcast…). Leave empty for every type.",
    },
    itemsToShow: {
      description:
        "How many resources to render: slides when it is a carousel, cards otherwise. Ignored by the filterable grid, which pages from the CMS.",
    },
    showMore: {
      label: "Show more / less",
      description: "Paging + toggle labels for the filterable grid.",
    },
    button: { description: "Optional call to action under the list." },
    theme: { description: "Section background + text colour." },
  },
  "sections.hub-bar": {
    showChips: {
      label: "Show section chips",
      description:
        "One chip per section that carries a Nav item. Turn off for a bar that only offers the filters.",
    },
    scrollToSections: {
      label: "Chips scroll to sections",
      description:
        "A chip click scrolls to its section. Switch off to keep the chips as a read-only indicator.",
    },
    filters: {
      label: "Filters",
      description:
        "Which filters the bar offers, in order. Leave empty for Audience + Tag. Needs a filterable list (Layout: grid with filters) on the same page.",
    },
    theme: { description: "Bar background + text colour." },
  },
  "hub-bar.filter": {
    taxonomy: {
      label: "Taxonomy",
      description:
        "Audience = primary audience list, Tag = controlled tag list, Type = resource type. A Type filter is hidden when the list it filters already pins one.",
    },
    label: {
      description:
        "Optional label for this filter's pill. Leave empty for the taxonomy's default (Audience / Tag / Type).",
    },
    multiple: {
      label: "Allow multiple picks",
      description:
        "Off = pick one value (radio list). On = pick several at once (checkbox list) — the results match any of the picked values.",
    },
  },
  "portfolio.filter": {
    taxonomy: {
      label: "Taxonomy",
      description:
        "Industries = case-study industries, Services = case-study services, Technologies = tech stack, Region = regions.",
    },
    label: {
      description:
        "Optional label for this dropdown. Leave empty for the taxonomy's default (Industries / Services / Technologies / Region).",
    },
  },
  "api::achievement.achievement": {
    title: { label: "Achievement" },
    date: { label: "Date awarded" },
    platform: {
      label: "Platform",
      description:
        "Where it was awarded. Manage the list of platforms under Platforms.",
    },
    link: {
      label: "External link",
      description: "Optional link to the announcement.",
    },
    media: { label: "Image / video", description: "Shown on the card." },
  },
  "api::author.author": {
    fullName: {
      label: "Full name",
      description: "Shown next to every article this author writes.",
    },
    insights: {
      label: "Resources",
      description: "Every resource that credits this author.",
    },
  },
  "api::client.client": {
    name: { label: "Client name" },
    link: {
      label: "Website",
      description: "Optional link to the client's site.",
    },
    logo: {
      label: "Logo",
      description: "Used in the client rows and on the testimonial cards.",
    },
    testimonials: {
      label: "Testimonials",
      description: "Every testimonial that belongs to this client.",
    },
  },
  "api::client-testimonial.client-testimonial": {
    author: { label: "Author name" },
    position: { label: "Author role", placeholder: "CTO, Acme" },
    text: { label: "Testimonial" },
    media: {
      label: "Image / video",
      description: "Optional portrait or office shot.",
    },
    client: {
      label: "Client",
      description:
        "Which client this quote comes from — it also brings in the logo shown on the card.",
    },
  },
  "api::faq.faq": {
    title: { label: "Question" },
    description: { label: "Answer" },
  },
  "api::hiring-process.hiring-process": {
    title: { label: "Step title" },
    description: { label: "Step description" },
  },
  "api::industry.industry": {
    title: { label: "Industry" },
    slug: {
      description:
        "Used by the Case Studies filter (?cases_industries=<slug>). Changing it breaks existing links.",
    },
    description: { label: "Description" },
    media: { label: "Image / video" },
    relatedCases: {
      label: "Case studies",
      description: "Every case study tagged with this industry.",
    },
  },
  "api::platform.platform": {
    title: { label: "Platform name" },
    logo: { label: "Logo" },
    achievements: {
      label: "Achievements",
      description: "Every award listed under this platform.",
    },
  },
  "api::primary-audience.primary-audience": {
    title: { label: "Audience" },
    slug: {
      description:
        "Used by the Audience filter and its links. Changing it breaks existing links.",
    },
    description: {
      label: "Editorial note",
      description:
        "What belongs to this audience. A guideline for editors, not shown on the site.",
    },
    insights: {
      label: "Resources",
      description: "Every resource assigned to this audience.",
    },
  },
  "api::process.process": {
    title: { label: "Step title" },
    description: { label: "Step description" },
    media: { label: "Image" },
  },
  "api::region.region": {
    title: { label: "Region" },
    slug: {
      description:
        "Used by the Region filter. Changing it breaks existing links.",
    },
    caseStudies: {
      label: "Case studies",
      description: "Every case study delivered in this region.",
    },
  },
  "api::resource-type.resource-type": {
    title: { label: "Type name" },
    slug: {
      description:
        "Used by the Type filter. Changing it breaks existing links.",
    },
    cardLayout: {
      label: "Card layout",
      description:
        "Which built-in resource shape this type behaves like. It decides the extra fields a resource of this type shows (an eBook's cover image, for example) and how its card is rendered. Reuse one of the three for a new type.",
    },
    insights: {
      label: "Resources",
      description: "Every resource of this type.",
    },
  },
  "api::tag.tag": {
    title: { label: "Tag" },
    slug: {
      description: "Used by the Tag filter. Changing it breaks existing links.",
    },
    insights: {
      label: "Resources",
      description: "Every resource with this tag.",
    },
  },
  "api::team.team": {
    firstName: { label: "First name" },
    lastName: { label: "Last name" },
    position: { label: "Role", placeholder: "Senior Frontend Developer" },
    email: { label: "Email" },
    media: { label: "Photo" },
    description: { label: "Bio" },
    socials: { label: "Social links" },
  },
  "api::team-testimonial.team-testimonial": {
    author: { label: "Author name" },
    position: { label: "Author role" },
    text: { label: "Testimonial" },
    media: { label: "Image / video", description: "Optional portrait." },
  },
  "api::tech-stack.tech-stack": {
    title: { label: "Technology" },
    slug: {
      description:
        "Used by the Technologies filter. Changing it breaks existing links.",
    },
    description: { label: "Description" },
    image: { label: "Logo" },
    link: {
      label: "External link",
      description: "Optional documentation or product page.",
    },
    services: { label: "Services", description: "Services that use it." },
    caseStudies: {
      label: "Case studies",
      description: "Case studies that use it.",
    },
  },
  "api::global.global": {
    footer: {
      description:
        "Site-wide footer content. Navigation links come from the footer navigations, not from here.",
    },
    error: {
      description:
        "Copy for the 404 / error screens. Consumed by the frontend error pages.",
    },
  },
  "shared.seo": {
    metaTitle: {
      label: "Meta title",
      description:
        "Browser tab + search result title. Around 60 characters. Leave empty to use the entry's own title.",
    },
    metaDescription: {
      label: "Meta description",
      description:
        "Search result summary, around 155 characters. Leave empty to fall back to the intro copy.",
    },
    socialImage: {
      label: "Social share image",
      description:
        "Shown when the page is shared (1200×630). Leave empty to fall back to the entry's image.",
    },
  },
  "shared.headline": {
    title: { label: "Headline" },
    addCount: {
      label: "Show the item count",
      description: 'Appends the number of items, e.g. "Industries (12)".',
    },
  },
  "shared.socials": {
    title: { label: "Network", placeholder: "LinkedIn" },
    link: { label: "Profile URL" },
  },
  "shared.content-item": {
    title: { label: "Title" },
    description: { label: "Copy" },
    button: { description: BUTTON_TIP },
  },
  "shared.card-milestone": {
    title: { label: "Title" },
    description: { label: "Copy" },
  },
  "shared.color-box": {
    title: { label: "Title" },
    label: { label: "Eyebrow label" },
    expandable: {
      label: "Expandable",
      description:
        'Off: the box is always open. On: it opens on click ("+" / "−").',
    },
    blocks: { label: "Items", description: "Content shown inside the box." },
  },
  "shared.floating-card": {
    title: { label: "Title" },
    value: {
      label: "Figure",
      description:
        "Number the box counts up to on reveal (e.g. 1.7). Leave empty for a text-only box.",
    },
    suffix: {
      label: "Suffix",
      description: 'Written straight after the figure: "k+", "+", "%" …',
    },
    description: { label: "Copy" },
    media: {
      label: "Image / video",
      description: "Optional, shown beside the copy.",
    },
  },
  "shared.hero-promo": {
    title: { label: "Title" },
    label: { label: "Eyebrow label" },
    button: { description: BUTTON_TIP },
  },
  "shared.service-group": {
    title: { label: "Group title" },
    services: {
      label: "Services",
      description:
        "The carousel's cases come from here: every case study attached to these services is collected for the group.",
    },
    relatedCaseStudies: {
      label: "Related case studies (override)",
      description:
        "Leave empty for the automatic selection described above. As soon as you pick one case here, the automatic selection is switched off and the carousel shows exactly these, in this order.",
    },
  },
  "shared.showreel": {
    video: { label: "Video" },
    cover: {
      label: "Cover image",
      description: "Thumbnail shown until the video is played.",
    },
    showControls: {
      label: "Show video controls",
      description:
        "Expose the video's own play/pause/scrub controls while it plays.",
    },
  },
  "global.footer": {
    contactTitle: { label: "Contact heading" },
    contactContent: { label: "Contact details" },
    partnersTitle: { label: "Partners heading" },
    partners: { label: "Partners" },
    copyright: {
      label: "Copyright",
      description: "[[year_now]] is replaced with the current year.",
    },
  },
  "global.partner": {
    label: { label: "Name" },
    url: { label: "Website" },
    logo: { label: "Logo" },
  },
  "global.error": {
    title: { label: "Title" },
    image: {
      label: "Image",
      description: "Optional illustration shown next to the message.",
    },
    description: { label: "Description" },
    button: {
      label: "Button",
      description: "Where the visitor should go next.",
    },
  },
  "rich-content.block": {
    type: {
      label: "Block type",
      description:
        "wysiwyg = free prose (headings, paragraphs, images, tables…), carousel = image slider, stats = figures row, audio = player, blockquote = pull quote with a portrait.",
    },
    title: {
      label: "Heading",
      description:
        "Rendered as the block's heading and reused as its entry in the sections nav.",
    },
    addToNav: { label: "Add to the sections nav" },
    content: { label: "Text" },
    images: { label: "Images" },
    stats: { label: "Stats" },
    audio: { label: "Audio" },
    image: {
      label: "Quote image",
      description: "Small portrait shown with the quote.",
    },
    quote: { label: "Quote" },
    author: { label: "Quote author" },
    position: { label: "Author role" },
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
  },
  "rich-content.stat": {
    value: { label: "Value", placeholder: "98%" },
    label: { label: "Label" },
  },
  "sections.hero": {
    variant: {
      label: "Layout",
      description:
        "default = one large heading (+ optional media), withCarousel = heading + promo slides, withShowreel = heading + video, twoColumns = heading left, copy and button right.",
    },
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    label: { label: "Eyebrow label" },
    title: { label: "Title" },
    subtitle: { label: "Subtitle" },
    description: { label: "Copy" },
    media: { label: "Image / video", description: MEDIA_TIP },
    image: { label: "Secondary image" },
    indicatorText: {
      label: "Scroll cue text",
      description: 'Small hint under the hero, e.g. "Scroll".',
    },
    button: { description: BUTTON_TIP },
    carousel: {
      label: "Promo slides",
      description: "Small promo cards that slide inside the hero.",
    },
    showreel: {
      label: "Showreel",
      description: "Video + cover shown in the withShowreel layout.",
    },
    theme: { description: THEME_TIP },
  },
  "sections.campaign-intro": {
    variant: {
      label: "Layout",
      description: "default = text only, withMedia = text + image/video.",
    },
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    label: { label: "Eyebrow label" },
    title: { label: "Title" },
    description: { label: "Copy" },
    media: { label: "Image / video", description: MEDIA_TIP },
    indicatorText: { label: "Scroll cue text" },
    button: { description: BUTTON_TIP },
    theme: { description: THEME_TIP },
  },
  "sections.cta": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    label: { label: "Eyebrow label" },
    title: { label: "Title" },
    description: { label: "Copy" },
    buttons: {
      label: "Buttons",
      description: "Shown side by side, in this order.",
    },
    backgroundImage: { label: "Background image" },
    mediaMobile: {
      label: "Background image (mobile)",
      description:
        "Optional portrait crop. Empty = the main background is used.",
    },
    theme: { description: THEME_TIP },
  },
  "sections.carousel": {
    collectionType: {
      label: "Collection",
      description:
        "What the carousel shows. Only the relation that matches this choice is used.",
    },
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    headline: { description: HEADLINE_TIP },
    insightsPick: {
      label: "Insights to show",
      description:
        "latest = newest first, featured = the ones flagged Featured, manual = pick them below.",
    },
    insightsLimit: { label: "How many insights" },
    insights: { label: "Hand-picked insights" },
    achievements: { label: "Achievements" },
    teamTestimonials: { label: "Team testimonials" },
    clientTestimonials: { label: "Client testimonials" },
    hiringProcessSteps: { label: "Hiring process steps" },
    showNavigation: { label: "Show arrows" },
    showPagination: { label: "Show dots" },
    showLogos: { label: "Show client logos" },
    smallCards: { label: "Small cards" },
    button: { description: BUTTON_TIP },
    theme: { description: THEME_TIP },
  },
  "sections.case-studies": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    headline: { description: HEADLINE_TIP },
    pick: {
      label: "Which case studies",
      description:
        "latest = newest, featured = flagged Featured, next = the ones after the current project (project pages only), manual = pick them below.",
    },
    limit: { label: "How many" },
    caseStudies: { label: "Hand-picked case studies" },
    button: { description: BUTTON_TIP },
    theme: { description: THEME_TIP },
  },
  "sections.content-color-boxes": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    headline: { description: HEADLINE_TIP },
    subtitle: { label: "Subtitle" },
    description: { label: "Copy" },
    boxes: { label: "Color boxes" },
    theme: { description: THEME_TIP },
  },
  "sections.content-image-left": {
    variant: {
      label: "Layout",
      description:
        "WysiwygContent = one rich-text column next to the image, NumeratedBlocks = a list of items next to the image.",
    },
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    headline: { description: HEADLINE_TIP },
    subtitle: { label: "Subtitle" },
    media: { label: "Image / video", description: MEDIA_TIP },
    description: { label: "Copy" },
    blocks: { label: "Items" },
    button: { description: BUTTON_TIP },
    theme: { description: THEME_TIP },
  },
  "sections.content-numerated": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    headline: { description: HEADLINE_TIP },
    subtitle: { label: "Subtitle" },
    layout: {
      label: "Layout",
      description:
        "buttonBelow = button under the list, buttonOnSide = button next to the subtitle.",
    },
    behavior: {
      label: "Behaviour",
      description:
        "static = everything visible, expandable = items open on click.",
    },
    items: {
      label: "Items",
      description: "Numbered automatically, in this order.",
    },
    button: { description: BUTTON_TIP },
    theme: { description: THEME_TIP },
  },
  "sections.faq": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    headline: { description: HEADLINE_TIP },
    faqs: {
      label: "FAQ items",
      description:
        "Shown as an accordion, in this order. Manage the questions under FAQ.",
    },
    theme: { description: THEME_TIP },
  },
  "sections.form": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    variant: {
      label: "Layout",
      description:
        "default = contact form, hero = contact form with the wordmark band, compact = newsletter band.",
    },
    title: { label: "Title" },
    description: { label: "Copy" },
    hubspotFormID: {
      label: "HubSpot form ID",
      description:
        "Form ID pasted from HubSpot (leave empty for the built-in form).",
    },
    image: { label: "Image", description: MEDIA_TIP },
    label: { label: "Eyebrow", description: "Newsletter layout only." },
    theme: { description: THEME_TIP },
  },
  "sections.industries": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    headline: { description: HEADLINE_TIP },
    industries: { label: "Industries", description: "Shown in this order." },
    button: { description: BUTTON_TIP },
    theme: { description: THEME_TIP },
  },
  "sections.intersection-floating-boxes": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    headline: { description: HEADLINE_TIP },
    media: {
      label: "Background image / video",
      description: "Full-width media the cards float over.",
    },
    blocks: { label: "Floating cards" },
    theme: { description: THEME_TIP },
  },
  "sections.intersection-media": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    title: { label: "Overlay title" },
    media: { label: "Background image / video" },
    button: { description: BUTTON_TIP },
    theme: { description: THEME_TIP },
  },
  "sections.person": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    person: {
      label: "Team member",
      description: "Photo, role and bio come from the Team entry.",
    },
    address: { label: "Address" },
    email: { label: "Email" },
    socials: { label: "Social links" },
    button: { description: BUTTON_TIP },
    theme: { description: THEME_TIP },
  },
  "sections.process": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    headline: { description: HEADLINE_TIP },
    blocks: {
      label: "Process steps",
      description: "Shown in this order. Manage the steps under Process.",
    },
    button: { description: BUTTON_TIP },
    theme: { description: THEME_TIP },
  },
  "sections.progress-cards": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    headline: { description: HEADLINE_TIP },
    cards: {
      label: "Cards",
      description: "Drives the horizontal progress bar.",
    },
    theme: { description: THEME_TIP },
  },
  "sections.rich-content-body": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    variant: {
      label: "Rhythm",
      description:
        "post = case-study spacing (large gaps + hairline), article = tighter legal/content pages, blogPost = article rhythm with an aside (share + metadata) above the sections nav.",
    },
    headline: { description: HEADLINE_TIP },
    blocks: {
      label: "Blocks",
      description:
        "Render top to bottom; each one can add itself to the sections nav.",
    },
    showNav: { label: "Show the sections nav" },
    theme: { description: THEME_TIP },
  },
  "sections.services-group": {
    variant: {
      label: "Layout",
      description:
        "servicesGroup = grouped accordion with a cases carousel per group, servicesList = a flat list of picked services.",
    },
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    headline: { description: HEADLINE_TIP },
    services: {
      label: "Services",
      description: "Used by the flat list layout.",
    },
    groups: {
      label: "Service groups",
      description: "Used by the grouped layout.",
    },
    button: { description: BUTTON_TIP },
    theme: { description: THEME_TIP },
  },
  "sections.team": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    variant: {
      label: "Behaviour",
      description:
        "Rows = the scroll-driven rail (title + members). Grid = the card grid (headline + intro copy).",
    },
    title: { label: "Title", description: "Shown above the rail (rows only)." },
    members: { label: "Team members", description: "Shown in this order." },
    headline: { description: HEADLINE_TIP },
    content: {
      label: "Intro copy",
      description: "Optional title + copy above the grid (grid only).",
    },
    theme: { description: THEME_TIP },
  },
  "sections.tech-stack": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    headline: { description: HEADLINE_TIP },
    blocks: {
      label: "Technologies",
      description: "Shown as hover rows, in this order.",
    },
    listMode: {
      label: "List ending",
      description:
        "`showMore`: collapse the technologies behind the toggle. `none`: list every technology and use the button below instead.",
    },
    showMore: {
      description:
        "Toggle labels + how many technologies stay visible. Used when List ending is `showMore`.",
    },
    button: { description: BUTTON_TIP },
    theme: { description: THEME_TIP },
  },
  "sections.portfolio": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    headline: { description: HEADLINE_TIP },
    featuredCases: {
      label: "Featured cases",
      description: "Always visible, in this order.",
    },
    otherCases: {
      label: "Other cases",
      description: "Revealed by Show more. Empty = every remaining case study.",
    },
    listMode: {
      label: "List ending",
      description:
        "`showMore`: other cases behind a Show more/less toggle. `loadMore`: page them with the Load more button. `none`: list every other case with no control.",
    },
    sort: {
      label: "Sort order",
      description: "How the automatic case list is sorted.",
    },
    manualCasesControl: {
      label: "Manual case control",
      description: "On: only the picked cases are listed, in your order.",
    },
    filters: {
      label: "Filters",
      description:
        "Which taxonomy dropdowns the list offers, in order. Leave empty for all four (Industries, Services, Technologies, Region).",
    },
    showMore: {
      description:
        "Toggle labels + how many other cases stay visible. Used when List ending is `showMore`.",
    },
    theme: { description: THEME_TIP },
  },
  "sections.vacancies-list": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    headline: { description: HEADLINE_TIP },
    intro: {
      description:
        "Intro copy above the list. The positions themselves come from Traffit and cannot be edited here.",
    },
    emptyState: {
      label: "No positions message",
      description:
        "Shown instead of the list when Traffit has no published positions, or is temporarily unreachable. Always fill this in — otherwise the section renders as an empty gap.",
    },
    listMode: {
      label: "List ending",
      description:
        "`showMore`: collapse the list behind a toggle once it gets long. `none`: always list every open position.",
    },
    showMore: {
      description:
        "How many positions stay visible and the toggle's labels. Used when List ending is `showMore`.",
    },
    button: { description: BUTTON_TIP },
    theme: { description: THEME_TIP },
  },
  "sections.vacancy-details": {
    anchor: { label: "Anchor (URL hash)", description: ANCHOR_TIP },
    headline: {
      description:
        "Optional. Leave empty and the position title from Traffit becomes the page heading — recommended, so a retitled position never needs editing here.",
    },
    applyLabel: {
      label: "Apply button text",
      description: "Opens the application form in Traffit.",
    },
    applyNote: {
      label: "Apply note",
      description:
        "Reassurance under the apply button (e.g. \"We reply to every application\"). Optional.",
    },
    backLabel: {
      label: "Back link text",
      description: "Link back to the vacancies list.",
    },
    emptyState: {
      label: "Missing position message",
      description:
        "Fallback copy for a position that is no longer published. In practice those pages return 404, so this is only a safety net.",
    },
    theme: { description: THEME_TIP },
  },
  "api::vacancy-page.vacancy-page": {
    title: { description: "Name shown in the admin sidebar. Not visible on the website." },
    seo: {
      description:
        "Fallback search + social copy. The position title and description from Traffit are used first, so these only fill the gaps.",
    },
    sections: {
      description:
        "The blocks that build every vacancy page, top to bottom. Keep exactly one 'Vacancy details' block — that is where the live position renders — and wrap it with any of the other blocks. Everything here is shared by all positions; per-position text is edited in Traffit.",
    },
  },
};

/**
 * Attributes the admin renders on its own (sidebar / Information panel), so
 * they are deliberately kept out of `layouts.edit` — Strapi's own default
 * layouts omit them too. Their labels still come from `metadatas`.
 */
const SYSTEM_ATTRIBUTES = new Set([
  "id",
  "documentId",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
  "publishedAt",
  "locale",
  "localizations",
]);

/** Edit-view rows per model. `null` = keep Strapi's order. */
const EDIT_LAYOUT: Record<string, string[][]> = {
  "api::page.page": [
    ["seo"],
    ["title", "slug"],
    ["showScrollTop"],
    ["sections"],
  ],
  "api::case-study.case-study": [
    ["seo"],
    ["title", "slug"],
    ["parent"],
    ["label", "foreground"],
    ["shortTitle", "shortDescription"],
    ["description"],
    ["featuredMedia", "logo"],
    ["industries", "regions"],
    ["services", "techStack"],
    ["isFeatured"],
    ["sections"],
  ],
  "api::insight.insight": [
    ["seo"],
    ["title", "slug"],
    ["parent"],
    ["resourceType", "audience"],
    ["description"],
    ["featuredMedia", "cover"],
    ["author", "readDuration"],
    ["tags"],
    ["isFeatured"],
    ["sections"],
  ],
  "api::service.service": [
    ["seo"],
    ["title", "slug"],
    ["parent"],
    ["description"],
    ["media", "thumbnailImage"],
    ["caseStudies", "techStack"],
    ["sections"],
  ],
  "sections.page-intro": [
    ["anchor", "showScrollCue"],
    ["title"],
    ["description"],
    ["label"],
    ["theme"],
  ],
  "sections.insight-list": [
    ["navItem"],
    ["title"],
    ["layout", "itemsToShow"],
    ["audience", "resourceType"],
    ["insights"],
    ["showMore"],
    ["button"],
    ["theme"],
  ],
  "sections.hub-bar": [
    ["showChips", "scrollToSections"],
    ["filters"],
    ["theme"],
  ],
  "hub-bar.filter": [["taxonomy", "label"], ["multiple"]],
  "sections.portfolio": [
    ["anchor"],
    ["headline"],
    ["listMode"],
    ["sort", "manualCasesControl"],
    ["filters"],
    ["featuredCases"],
    ["showMore"],
    ["otherCases"],
    ["theme"],
  ],
  "portfolio.filter": [["taxonomy", "label"]],
  "sections.vacancies-list": [
    ["anchor"],
    ["headline"],
    ["intro"],
    ["listMode"],
    ["showMore"],
    ["emptyState"],
    ["button"],
    ["theme"],
  ],
  "sections.vacancy-details": [
    ["anchor"],
    ["headline"],
    ["applyLabel", "backLabel"],
    ["applyNote"],
    ["emptyState"],
    ["theme"],
  ],
  "api::vacancy-page.vacancy-page": [
    ["title", "seo"],
    ["sections"],
  ],
  "api::achievement.achievement": [
    ["title", "date"],
    ["platform"],
    ["link"],
    ["media"],
  ],
  "api::author.author": [["fullName"], ["insights"]],
  "api::client.client": [["name", "link"], ["logo"], ["testimonials"]],
  "api::client-testimonial.client-testimonial": [
    ["author", "position"],
    ["text"],
    ["media"],
    ["client"],
  ],
  "api::faq.faq": [["title"], ["description"]],
  "api::hiring-process.hiring-process": [["title"], ["description"]],
  "api::industry.industry": [
    ["title", "slug"],
    ["description"],
    ["media"],
    ["relatedCases"],
  ],
  "api::platform.platform": [["title"], ["logo"], ["achievements"]],
  "api::primary-audience.primary-audience": [
    ["title", "slug"],
    ["description"],
    ["insights"],
  ],
  "api::process.process": [["title"], ["description"], ["media"]],
  "api::region.region": [["title", "slug"], ["caseStudies"]],
  "api::resource-type.resource-type": [
    ["title", "slug"],
    ["cardLayout"],
    ["insights"],
  ],
  "api::tag.tag": [["title", "slug"], ["insights"]],
  "api::team.team": [
    ["firstName", "lastName"],
    ["position"],
    ["email"],
    ["media"],
    ["description"],
    ["socials"],
  ],
  "api::team-testimonial.team-testimonial": [
    ["author", "position"],
    ["text"],
    ["media"],
  ],
  "api::tech-stack.tech-stack": [
    ["title", "slug"],
    ["description"],
    ["image"],
    ["link"],
    ["services", "caseStudies"],
  ],
  "api::global.global": [["footer"], ["error"]],
  "shared.seo": [["metaTitle"], ["metaDescription"], ["socialImage"]],
  "shared.theme": [["background", "textColor"], ["headerTheme"]],
  "shared.headline": [["title", "addCount"]],
  "shared.nav-item": [["label", "anchor"]],
  "shared.socials": [["title", "link"]],
  "shared.button": [
    ["title", "variant"],
    ["scrollTo"],
    ["linkType"],
    ["url"],
    ["page"],
    ["caseStudy"],
    ["insight"],
    ["service"],
  ],
  "shared.show-more": [["itemsToShow"], ["showMoreLabel", "showLessLabel"]],
  "shared.load-more": [["initialItems", "loadChunk"], ["loadMoreLabel"]],
  "shared.content-item": [["title"], ["description"], ["button"]],
  "shared.card-milestone": [["title"], ["description"]],
  "shared.color-box": [["title", "label"], ["blocks"], ["expandable"]],
  "shared.floating-card": [
    ["title"],
    ["value", "suffix"],
    ["description"],
    ["media"],
  ],
  "shared.hero-promo": [["title"], ["label"], ["button"]],
  "shared.service-group": [["title"], ["services"], ["relatedCaseStudies"]],
  "shared.showreel": [["video", "cover"], ["showControls"]],
  "global.footer": [
    ["contactTitle"],
    ["contactContent"],
    ["partnersTitle"],
    ["partners"],
    ["copyright"],
  ],
  "global.partner": [["label"], ["url"], ["logo"]],
  "global.error": [["title", "image"], ["description"], ["button"]],
  "rich-content.block": [
    ["type", "title"],
    ["content"],
    ["images"],
    ["stats"],
    ["audio"],
    ["quote", "author"],
    ["position"],
    ["image"],
    ["addToNav", "anchor"],
  ],
  "rich-content.stat": [["value"], ["label"]],
  "sections.hero": [
    ["variant", "anchor"],
    ["label", "title"],
    ["subtitle", "indicatorText"],
    ["description"],
    ["media", "image"],
    ["button"],
    ["carousel"],
    ["showreel"],
    ["theme"],
  ],
  "sections.campaign-intro": [
    ["variant", "anchor"],
    ["label", "title"],
    ["description"],
    ["media", "indicatorText"],
    ["button"],
    ["theme"],
  ],
  "sections.cta": [
    ["anchor"],
    ["label", "title"],
    ["description"],
    ["buttons"],
    ["backgroundImage", "mediaMobile"],
    ["theme"],
  ],
  "sections.carousel": [
    ["collectionType", "anchor"],
    ["headline"],
    ["insightsPick", "insightsLimit"],
    ["insights"],
    ["achievements"],
    ["teamTestimonials"],
    ["clientTestimonials"],
    ["hiringProcessSteps"],
    ["showNavigation", "showPagination"],
    ["showLogos", "smallCards"],
    ["button"],
    ["theme"],
  ],
  "sections.case-studies": [
    ["anchor"],
    ["headline"],
    ["pick", "limit"],
    ["caseStudies"],
    ["button"],
    ["theme"],
  ],
  "sections.content-color-boxes": [
    ["anchor"],
    ["headline", "subtitle"],
    ["description"],
    ["boxes"],
    ["theme"],
  ],
  "sections.content-image-left": [
    ["variant", "anchor"],
    ["headline", "subtitle"],
    ["media"],
    ["description"],
    ["blocks"],
    ["button"],
    ["theme"],
  ],
  "sections.content-numerated": [
    ["anchor"],
    ["headline", "subtitle"],
    ["layout", "behavior"],
    ["items"],
    ["button"],
    ["theme"],
  ],
  "sections.faq": [["anchor"], ["headline"], ["faqs"], ["theme"]],
  "sections.form": [
    ["variant", "anchor"],
    ["title", "description"],
    ["hubspotFormID"],
    ["image", "label"],
    ["theme"],
  ],
  "sections.industries": [
    ["anchor"],
    ["headline"],
    ["industries"],
    ["button"],
    ["theme"],
  ],
  "sections.intersection-floating-boxes": [
    ["anchor"],
    ["headline"],
    ["media"],
    ["blocks"],
    ["theme"],
  ],
  "sections.intersection-media": [
    ["anchor"],
    ["title"],
    ["media"],
    ["button"],
    ["theme"],
  ],
  "sections.person": [
    ["anchor"],
    ["person"],
    ["address", "email"],
    ["socials"],
    ["button"],
    ["theme"],
  ],
  "sections.process": [
    ["anchor"],
    ["headline"],
    ["blocks"],
    ["button"],
    ["theme"],
  ],
  "sections.progress-cards": [["anchor"], ["headline"], ["cards"], ["theme"]],
  "sections.rich-content-body": [
    ["anchor"],
    ["variant"],
    ["headline"],
    ["blocks"],
    ["showNav"],
    ["theme"],
  ],
  "sections.services-group": [
    ["variant", "anchor"],
    ["headline"],
    ["services"],
    ["groups"],
    ["button"],
    ["theme"],
  ],
  "sections.team": [
    ["anchor"],
    ["variant"],
    ["title"],
    ["members"],
    ["headline"],
    ["content"],
    ["theme"],
  ],
  "sections.tech-stack": [
    ["anchor"],
    ["headline"],
    ["blocks"],
    ["listMode"],
    ["showMore"],
    ["button"],
    ["theme"],
  ],
};

const ACRONYMS = ["seo", "url", "id", "cta", "faq"];

function humanize(name: string): string {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .split(" ");
  const sentence = words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (ACRONYMS.includes(lower)) return lower.toUpperCase();
      return index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : lower;
    })
    .join(" ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/**
 * Applies the editorial copy + edit-view layout to the Content Manager
 * configuration. Idempotent — only writes when something actually changes.
 */
export async function setAdminViewCopy(strapi: Core.Strapi) {
  const report: Record<string, unknown>[] = [];
  const plugin = strapi.plugin("content-manager");
  const contentTypesService = plugin.service("content-types");
  const componentsService = plugin.service("components");
  const fieldSizes = plugin.service("field-sizes");

  const sizeOf = (attribute: any, wanted: number): number => {
    const type = fieldSizes.hasFieldSize(attribute?.customField)
      ? attribute.customField
      : attribute?.type;
    const { default: fallback, isResizable } = fieldSizes.getFieldSize(type);
    return isResizable ? wanted : fallback;
  };

  const applyTo = async (
    schema: any,
    isComponent: boolean,
  ): Promise<{ changed: boolean; wrote: boolean; label?: string }> => {
    const service = isComponent ? componentsService : contentTypesService;
    const configuration = await service.findConfiguration(schema);
    if (!configuration) return { changed: false, wrote: false };
    const copy = COPY[schema.uid] ?? {};
    const metadatas: Record<string, any> = { ...configuration.metadatas };
    let changed = false;

    for (const name of Object.keys(schema.attributes as object)) {
      const current = metadatas[name] ?? { edit: {}, list: {} };
      const fields: FieldCopy = copy[name] ?? {};
      const edit = { ...current.edit };

      const label = fields.label;
      if (label) {
        if (edit.label !== label) {
          edit.label = label;
          changed = true;
        }
      } else if (!edit.label || edit.label === name) {
        const fallback = humanize(name);
        if (edit.label !== fallback) {
          edit.label = fallback;
          changed = true;
        }
      }
      for (const key of ["description", "placeholder"] as const) {
        const value = fields[key];
        if (value && edit[key] !== value) {
          edit[key] = value;
          changed = true;
        }
      }

      metadatas[name] = { ...current, edit };
    }

    let layouts = configuration.layouts;
    const rows = EDIT_LAYOUT[schema.uid];
    if (rows) {
      const attributes = schema.attributes as Record<string, any>;
      const placed = new Set(rows.flat());
      const missing = Object.keys(attributes).filter(
        (name) => !placed.has(name) && !SYSTEM_ATTRIBUTES.has(name),
      );

      const nextEdit = [
        ...rows
          .filter((row) => row.every((name) => name in attributes))
          .map((row) =>
            row.map((name) => ({
              name,
              size: sizeOf(attributes[name], Math.round(12 / row.length)),
            })),
          ),
        // Every remaining editorial field gets its own row at the bottom.
        ...missing.map((name) => [
          { name, size: sizeOf(attributes[name], 12) },
        ]),
      ].filter((row) => Array.isArray(row) && row.length > 0);

      const currentEdit = JSON.stringify(configuration.layouts?.edit ?? []);
      if (JSON.stringify(nextEdit) !== currentEdit) {
        layouts = { ...configuration.layouts, edit: nextEdit };
        changed = true;
      }
    }

    if (!changed)
      return {
        changed: false,
        wrote: false,
        label: metadatas.layout?.edit?.label,
      };

    await service.updateConfiguration(schema, {
      ...configuration,
      metadatas,
      layouts,
    });
    strapi.log.info(`[admin-view] copy applied to ${schema.uid}`);
    return {
      changed: true,
      wrote: true,
      label: metadatas.layout?.edit?.label,
    };
  };

  for (const schema of Object.values(strapi.contentTypes)) {
    if (!schema.uid.startsWith("api::")) continue;
    try {
      const result = await applyTo(schema, false);
      report.push({ uid: schema.uid, ...result });
    } catch (error: any) {
      report.push({ uid: schema.uid, error: error?.message });
    }
  }

  for (const schema of Object.values(strapi.components)) {
    if (!COPY[schema.uid] && !EDIT_LAYOUT[schema.uid]) continue;
    try {
      const result = await applyTo(schema, true);
      report.push({ uid: schema.uid, ...result });
    } catch (error: any) {
      report.push({ uid: schema.uid, error: error?.message });
    }
  }

  try {
    fs.writeFileSync(
      path.join(process.cwd(), ".tmp", "admin-view.json"),
      JSON.stringify(report, null, 1),
    );
  } catch {
    /* diagnostics only */
  }
}
