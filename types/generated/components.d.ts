import type { Schema, Struct } from '@strapi/strapi';

export interface GlobalError extends Struct.ComponentSchema {
  collectionName: 'components_global_errors';
  info: {
    description: 'Copy shown on the 404 and error screens';
    displayName: 'Error';
  };
  attributes: {
    button: Schema.Attribute.Component<'shared.button', false>;
    description: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultHtml';
        }
      >;
    image: Schema.Attribute.Media<'images'>;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface GlobalFooter extends Struct.ComponentSchema {
  collectionName: 'components_global_footers';
  info: {
    description: 'Site-wide footer content';
    displayName: 'Footer';
  };
  attributes: {
    contactContent: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultHtml';
        }
      >;
    contactTitle: Schema.Attribute.String;
    copyright: Schema.Attribute.String;
    partners: Schema.Attribute.Component<'global.partner', true>;
    partnersTitle: Schema.Attribute.String;
  };
}

export interface GlobalPartner extends Struct.ComponentSchema {
  collectionName: 'components_global_partners';
  info: {
    description: 'Footer partner/technology logo';
    displayName: 'Partner';
  };
  attributes: {
    label: Schema.Attribute.String;
    logo: Schema.Attribute.Media<'images'>;
    url: Schema.Attribute.String;
  };
}

export interface HubBarFilter extends Struct.ComponentSchema {
  collectionName: 'components_hub_bar_filters';
  info: {
    description: 'One filter the bar offers. Audience and Type come from their CMS lists (in their own order), Tag is built from the tags the resources actually use.';
    displayName: 'Filter';
    icon: 'filter';
  };
  attributes: {
    label: Schema.Attribute.String;
    multiple: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    taxonomy: Schema.Attribute.Enumeration<
      ['audience', 'tag', 'resourceType']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'audience'>;
  };
}

export interface PortfolioFilter extends Struct.ComponentSchema {
  collectionName: 'components_portfolio_filters';
  info: {
    description: "One taxonomy dropdown the case list offers. Leave the section's filter list empty for all four (Industries, Services, Technologies, Region).";
    displayName: 'Filter';
    icon: 'filter';
  };
  attributes: {
    label: Schema.Attribute.String;
    taxonomy: Schema.Attribute.Enumeration<
      ['industries', 'services', 'techStack', 'regions']
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'industries'>;
  };
}

export interface RichContentBlock extends Struct.ComponentSchema {
  collectionName: 'components_rich_content_blocks';
  info: {
    description: 'A single article block: WYSIWYG prose (paragraphs/headings/images/video/table/quote/code) or a special widget (carousel / stats / audio).';
    displayName: 'Content Block';
    icon: 'grid';
  };
  attributes: {
    addToNav: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    anchor: Schema.Attribute.String & Schema.Attribute.Unique;
    audio: Schema.Attribute.Media<'audios' | 'videos'>;
    author: Schema.Attribute.String;
    content: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultHtml';
        }
      >;
    image: Schema.Attribute.Media<'images'>;
    images: Schema.Attribute.Media<'images', true>;
    position: Schema.Attribute.String;
    quote: Schema.Attribute.Text;
    stats: Schema.Attribute.Component<'rich-content.stat', true>;
    title: Schema.Attribute.String;
    type: Schema.Attribute.Enumeration<
      ['wysiwyg', 'carousel', 'stats', 'audio', 'blockquote']
    > &
      Schema.Attribute.DefaultTo<'wysiwyg'>;
  };
}

export interface RichContentStat extends Struct.ComponentSchema {
  collectionName: 'components_rich_content_stats';
  info: {
    description: 'A single value + label pair inside a stats block.';
    displayName: 'Stat';
    icon: 'chartBubble';
  };
  attributes: {
    label: Schema.Attribute.Text;
    value: Schema.Attribute.String;
  };
}

export interface SectionsCampaignIntro extends Struct.ComponentSchema {
  collectionName: 'components_sections_intro_showreels';
  info: {
    description: 'Opening block: eyebrow, title, copy (+ optional media and scroll cue)';
    displayName: 'Intro';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    button: Schema.Attribute.Component<'shared.button', false>;
    description: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultHtml';
        }
      >;
    indicatorText: Schema.Attribute.String;
    label: Schema.Attribute.String;
    media: Schema.Attribute.Media<'images' | 'videos'>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
    title: Schema.Attribute.Text;
    variant: Schema.Attribute.Enumeration<['default', 'withMedia']> &
      Schema.Attribute.DefaultTo<'default'>;
  };
}

export interface SectionsCarousel extends Struct.ComponentSchema {
  collectionName: 'components_sections_carousels';
  info: {
    description: 'Collection carousel \u2014 achievements, testimonials, insights or hiring process';
    displayName: 'Carousel';
  };
  attributes: {
    achievements: Schema.Attribute.Relation<
      'oneToMany',
      'api::achievement.achievement'
    >;
    anchor: Schema.Attribute.String;
    button: Schema.Attribute.Component<'shared.button', false>;
    clientTestimonials: Schema.Attribute.Relation<
      'oneToMany',
      'api::client-testimonial.client-testimonial'
    >;
    collectionType: Schema.Attribute.Enumeration<
      [
        'achievements',
        'teamTestimonials',
        'clientTestimonials',
        'insights',
        'hiringProcess',
      ]
    > &
      Schema.Attribute.DefaultTo<'insights'>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    hiringProcessSteps: Schema.Attribute.Relation<
      'oneToMany',
      'api::hiring-process.hiring-process'
    >;
    insights: Schema.Attribute.Relation<'oneToMany', 'api::insight.insight'>;
    insightsLimit: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<5>;
    insightsPick: Schema.Attribute.Enumeration<
      ['latest', 'featured', 'manual']
    > &
      Schema.Attribute.DefaultTo<'latest'>;
    showLogos: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    showNavigation: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    showPagination: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    smallCards: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    teamTestimonials: Schema.Attribute.Relation<
      'oneToMany',
      'api::team-testimonial.team-testimonial'
    >;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsCaseStudies extends Struct.ComponentSchema {
  collectionName: 'components_sections_case_studies';
  info: {
    description: 'Case studies section: featured, latest, next or manual';
    displayName: 'Case Studies';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    button: Schema.Attribute.Component<'shared.button', false>;
    caseStudies: Schema.Attribute.Relation<
      'oneToMany',
      'api::case-study.case-study'
    >;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    limit: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<2>;
    pick: Schema.Attribute.Enumeration<
      ['latest', 'manual', 'next', 'featured']
    > &
      Schema.Attribute.DefaultTo<'latest'>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsContentColorBoxes extends Struct.ComponentSchema {
  collectionName: 'components_sections_content_color_boxes';
  info: {
    description: 'Grid of coloured boxes, each one optionally expandable';
    displayName: 'Color Boxes';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    boxes: Schema.Attribute.Component<'shared.color-box', true>;
    description: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultHtml';
        }
      >;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    subtitle: Schema.Attribute.String;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsContentImageLeft extends Struct.ComponentSchema {
  collectionName: 'components_sections_content_image_lefts';
  info: {
    description: 'Image on the left, content on the right \u2014 numbered items or rich text';
    displayName: 'Image Left + Content';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    blocks: Schema.Attribute.Component<'shared.content-item', true>;
    button: Schema.Attribute.Component<'shared.button', false>;
    content: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultHtml';
        }
      >;
    contentTitle: Schema.Attribute.Text &
      Schema.Attribute.DefaultTo<'At PolCode, authenticity means taking responsibility for our impact on the world. We don\u2019t just build digital products; we ensure they contribute to a sustainable future. Our ESG strategy is built on the same trust we give our clients:'>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    media: Schema.Attribute.Media<'images' | 'videos'>;
    portraitImage: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    subtitle: Schema.Attribute.String;
    theme: Schema.Attribute.Component<'shared.theme', false>;
    variant: Schema.Attribute.Enumeration<
      ['NumeratedBlocks', 'WysiwygContent']
    > &
      Schema.Attribute.DefaultTo<'WysiwygContent'>;
  };
}

export interface SectionsContentNumerated extends Struct.ComponentSchema {
  collectionName: 'components_sections_content_numerateds';
  info: {
    description: 'Numbered rows of content, always open or expandable';
    displayName: 'Numbered Content';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    behavior: Schema.Attribute.Enumeration<['static', 'expandable']> &
      Schema.Attribute.DefaultTo<'static'>;
    button: Schema.Attribute.Component<'shared.button', false>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    items: Schema.Attribute.Component<'shared.content-item', true>;
    layout: Schema.Attribute.Enumeration<['buttonBelow', 'buttonOnSide']> &
      Schema.Attribute.DefaultTo<'buttonBelow'>;
    subtitle: Schema.Attribute.String;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsCta extends Struct.ComponentSchema {
  collectionName: 'components_shared_ctas';
  info: {
    description: 'Call-to-action block: label, title, description, buttons, background image, text color';
    displayName: 'CTA';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    backgroundImage: Schema.Attribute.Media<'images'>;
    buttons: Schema.Attribute.Component<'shared.button', true>;
    description: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultHtml';
        }
      >;
    label: Schema.Attribute.String;
    mediaMobile: Schema.Attribute.Media<'images'>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
    title: Schema.Attribute.String;
  };
}

export interface SectionsFaq extends Struct.ComponentSchema {
  collectionName: 'components_sections_faqs';
  info: {
    description: 'FAQ section';
    displayName: 'FAQ';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    faqs: Schema.Attribute.Relation<'oneToMany', 'api::faq.faq'>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsForm extends Struct.ComponentSchema {
  collectionName: 'components_sections_forms';
  info: {
    description: 'Contact form (default / hero) or newsletter sign-up (compact)';
    displayName: 'Forms';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    description: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultHtml';
        }
      >;
    hubspotFormID: Schema.Attribute.String;
    image: Schema.Attribute.Media<'images'>;
    label: Schema.Attribute.String;
    theme: Schema.Attribute.Component<'shared.theme', false>;
    title: Schema.Attribute.String;
    variant: Schema.Attribute.Enumeration<['default', 'hero', 'compact']> &
      Schema.Attribute.DefaultTo<'default'>;
  };
}

export interface SectionsHero extends Struct.ComponentSchema {
  collectionName: 'components_sections_heroes';
  info: {
    description: 'Hero section \u2014 default (large heading), two columns, with carousel or with showreel';
    displayName: 'Hero';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    button: Schema.Attribute.Component<'shared.button', false>;
    carousel: Schema.Attribute.Component<'shared.hero-promo', true>;
    description: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultHtml';
        }
      >;
    image: Schema.Attribute.Media<'images'>;
    indicatorText: Schema.Attribute.String;
    label: Schema.Attribute.String;
    media: Schema.Attribute.Media<'images' | 'videos'>;
    showreel: Schema.Attribute.Component<'shared.showreel', false>;
    subtitle: Schema.Attribute.String;
    theme: Schema.Attribute.Component<'shared.theme', false>;
    title: Schema.Attribute.Text;
    variant: Schema.Attribute.Enumeration<
      ['default', 'withCarousel', 'withShowreel', 'twoColumns']
    > &
      Schema.Attribute.DefaultTo<'default'>;
  };
}

export interface SectionsHubBar extends Struct.ComponentSchema {
  collectionName: 'components_sections_hub_bars';
  info: {
    description: 'Sticky bar for a hub page: one chip per section that carries a Nav item, plus the filters of the filterable list on the page. It has no fields of its own \u2014 place it directly under the section it should stick below. Without a filterable list it shows the chips only.';
    displayName: 'Hub Bar';
    icon: 'list';
  };
  attributes: {
    filters: Schema.Attribute.Component<'hub-bar.filter', true>;
    scrollToSections: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<true>;
    showChips: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsIndustries extends Struct.ComponentSchema {
  collectionName: 'components_sections_industries';
  info: {
    description: 'Industries grid, each one linking to its filtered case list';
    displayName: 'Industries';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    button: Schema.Attribute.Component<'shared.button', false>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    industries: Schema.Attribute.Relation<
      'oneToMany',
      'api::industry.industry'
    >;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsInsightList extends Struct.ComponentSchema {
  collectionName: 'components_sections_insight_lists';
  info: {
    description: 'Resources hub list: a single featured card, a swipeable row, or a filterable paged grid (All Articles, audience strips, eBooks, Podcasts). Fill in a hand-picked list or an audience to narrow it \u2014 leave both empty for the newest resources.';
    displayName: 'Resource List';
    icon: 'list';
  };
  attributes: {
    audience: Schema.Attribute.Relation<
      'manyToOne',
      'api::primary-audience.primary-audience'
    >;
    button: Schema.Attribute.Component<'shared.button', false>;
    insights: Schema.Attribute.Relation<'manyToMany', 'api::insight.insight'>;
    itemsToShow: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<3>;
    layout: Schema.Attribute.Enumeration<
      ['featured', 'featuredCarousel', 'carousel', 'grid', 'gridFiltered']
    > &
      Schema.Attribute.DefaultTo<'grid'>;
    loadMore: Schema.Attribute.Component<'shared.load-more', false>;
    navItem: Schema.Attribute.Component<'shared.nav-item', false>;
    resourceType: Schema.Attribute.Relation<
      'manyToOne',
      'api::resource-type.resource-type'
    >;
    theme: Schema.Attribute.Component<'shared.theme', false>;
    title: Schema.Attribute.String;
  };
}

export interface SectionsIntersectionFloatingBoxes
  extends Struct.ComponentSchema {
  collectionName: 'components_sections_intersection_floating_boxes';
  info: {
    description: 'Full-width media with statistic cards floating over it';
    displayName: 'Floating Boxes over Media';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    blocks: Schema.Attribute.Component<'shared.floating-card', true>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    media: Schema.Attribute.Media<'images' | 'videos'>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsIntersectionMedia extends Struct.ComponentSchema {
  collectionName: 'components_sections_intersection_media';
  info: {
    description: 'Full-width media with a title and a button overlaid on top';
    displayName: 'Media with Overlay';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    button: Schema.Attribute.Component<'shared.button', false>;
    media: Schema.Attribute.Media<'images' | 'videos'>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
    title: Schema.Attribute.String;
  };
}

export interface SectionsPageIntro extends Struct.ComponentSchema {
  collectionName: 'components_sections_page_intros';
  info: {
    description: 'Hub opening: eyebrow label, H1, intro copy, full-width hairline and an optional scroll cue.';
    displayName: 'Page Intro';
    icon: 'heading';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    description: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultHtml';
        }
      >;
    label: Schema.Attribute.String;
    showScrollCue: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
    title: Schema.Attribute.String;
  };
}

export interface SectionsPerson extends Struct.ComponentSchema {
  collectionName: 'components_sections_people';
  info: {
    description: 'Person detail';
    displayName: 'Person';
  };
  attributes: {
    address: Schema.Attribute.Text;
    anchor: Schema.Attribute.String;
    button: Schema.Attribute.Component<'shared.button', false>;
    email: Schema.Attribute.Email;
    person: Schema.Attribute.Relation<'oneToOne', 'api::team.team'>;
    socials: Schema.Attribute.Component<'shared.socials', true>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsPortfolio extends Struct.ComponentSchema {
  collectionName: 'components_sections_portfolios';
  info: {
    description: 'Featured + other case studies with taxonomy filters and optional show-more/less';
    displayName: 'Portfolio';
    icon: 'briefcase';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    featuredCases: Schema.Attribute.Relation<
      'oneToMany',
      'api::case-study.case-study'
    >;
    filters: Schema.Attribute.Component<'portfolio.filter', true>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    listMode: Schema.Attribute.Enumeration<['showMore', 'loadMore', 'none']> &
      Schema.Attribute.DefaultTo<'showMore'>;
    loadMore: Schema.Attribute.Component<'shared.load-more', false>;
    manualCasesControl: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    otherCases: Schema.Attribute.Relation<
      'oneToMany',
      'api::case-study.case-study'
    >;
    showMore: Schema.Attribute.Component<'shared.show-more', false>;
    sort: Schema.Attribute.Enumeration<['asc', 'desc']> &
      Schema.Attribute.DefaultTo<'asc'>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsProcess extends Struct.ComponentSchema {
  collectionName: 'components_sections_processes';
  info: {
    description: 'Numbered process steps picked from the Process collection';
    displayName: 'Process Steps';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    blocks: Schema.Attribute.Relation<'oneToMany', 'api::process.process'>;
    button: Schema.Attribute.Component<'shared.button', false>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsProgressCards extends Struct.ComponentSchema {
  collectionName: 'components_sections_progress_cards';
  info: {
    description: 'Milestone progress cards';
    displayName: 'Progress Cards';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    cards: Schema.Attribute.Component<'shared.card-milestone', true>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsRichContentBody extends Struct.ComponentSchema {
  collectionName: 'components_sections_rich_content_bodies';
  info: {
    description: 'Article body: ordered WYSIWYG chunks + special widgets (carousel/stats/audio), with an optional internal sections nav.';
    displayName: 'Rich Content Body';
    icon: 'file';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    blocks: Schema.Attribute.Component<'rich-content.block', true>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    showNav: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
    variant: Schema.Attribute.Enumeration<['post', 'article', 'blogPost']> &
      Schema.Attribute.DefaultTo<'post'>;
  };
}

export interface SectionsServicesGroup extends Struct.ComponentSchema {
  collectionName: 'components_sections_services_groups';
  info: {
    description: 'Grouped services (variant: groups) or a flat list of picked services';
    displayName: 'Services Group';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    button: Schema.Attribute.Component<'shared.button', false>;
    groups: Schema.Attribute.Component<'shared.service-group', false>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    services: Schema.Attribute.Relation<'oneToMany', 'api::service.service'>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
    variant: Schema.Attribute.Enumeration<['servicesGroup', 'servicesList']> &
      Schema.Attribute.DefaultTo<'servicesGroup'>;
  };
}

export interface SectionsTeam extends Struct.ComponentSchema {
  collectionName: 'components_sections_teams';
  info: {
    description: 'Team members as an animated rail (rows) or a card grid (grid)';
    displayName: 'Team';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    content: Schema.Attribute.Component<'shared.content-item', false>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    members: Schema.Attribute.Relation<'oneToMany', 'api::team.team'>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
    title: Schema.Attribute.String;
    variant: Schema.Attribute.Enumeration<['rows', 'grid']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'grid'>;
  };
}

export interface SectionsTechStack extends Struct.ComponentSchema {
  collectionName: 'components_sections_tech_stacks';
  info: {
    description: 'Tech stack section: full-width hover rows, either paginated with a Show more/less toggle or listed in full with a CTA button';
    displayName: 'Tech Stack';
  };
  attributes: {
    anchor: Schema.Attribute.String;
    blocks: Schema.Attribute.Relation<
      'oneToMany',
      'api::tech-stack.tech-stack'
    >;
    button: Schema.Attribute.Component<'shared.button', false>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    listMode: Schema.Attribute.Enumeration<['showMore', 'none']> &
      Schema.Attribute.DefaultTo<'showMore'>;
    showMore: Schema.Attribute.Component<'shared.show-more', false>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SharedButton extends Struct.ComponentSchema {
  collectionName: 'components_shared_buttons';
  info: {
    description: 'Reusable CTA button: title, optional scroll-to, and a single link target (external URL or internal Page / Case Study / Insight / Service)';
    displayName: 'Button';
  };
  attributes: {
    caseStudy: Schema.Attribute.Relation<
      'oneToOne',
      'api::case-study.case-study'
    >;
    insight: Schema.Attribute.Relation<'oneToOne', 'api::insight.insight'>;
    linkType: Schema.Attribute.Enumeration<
      ['url', 'page', 'caseStudy', 'insight', 'service']
    > &
      Schema.Attribute.DefaultTo<'url'>;
    page: Schema.Attribute.Relation<'oneToOne', 'api::page.page'>;
    scrollTo: Schema.Attribute.String;
    service: Schema.Attribute.Relation<'oneToOne', 'api::service.service'>;
    title: Schema.Attribute.String;
    url: Schema.Attribute.String;
    variant: Schema.Attribute.Enumeration<
      [
        'light',
        'dark',
        'ghostLight',
        'ghostDark',
        'solidLight',
        'solidDark',
        'link',
      ]
    >;
  };
}

export interface SharedCardMilestone extends Struct.ComponentSchema {
  collectionName: 'components_shared_card_milestones';
  info: {
    description: 'One milestone card: title + copy';
    displayName: 'Milestone Card';
  };
  attributes: {
    description: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultHtml';
        }
      >;
    label: Schema.Attribute.String;
    media: Schema.Attribute.Media<'images' | 'videos'>;
    title: Schema.Attribute.String;
  };
}

export interface SharedColorBox extends Struct.ComponentSchema {
  collectionName: 'components_shared_color_boxes';
  info: {
    description: 'One coloured box: title, eyebrow and its items (optionally expandable)';
    displayName: 'Color Box';
  };
  attributes: {
    blocks: Schema.Attribute.Component<'shared.content-item', true>;
    expandable: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    label: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface SharedContentItem extends Struct.ComponentSchema {
  collectionName: 'components_shared_content_items';
  info: {
    description: 'Title + wysiwyg + optional button';
    displayName: 'Content Item';
  };
  attributes: {
    button: Schema.Attribute.Component<'shared.button', false>;
    description: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultHtml';
        }
      >;
    title: Schema.Attribute.String;
  };
}

export interface SharedFloatingCard extends Struct.ComponentSchema {
  collectionName: 'components_shared_floating_cards';
  info: {
    description: 'Card for floating boxes';
    displayName: 'Floating Card';
  };
  attributes: {
    description: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultHtml';
        }
      >;
    media: Schema.Attribute.Media<'images' | 'videos'>;
    suffix: Schema.Attribute.String;
    title: Schema.Attribute.String;
    value: Schema.Attribute.Float;
  };
}

export interface SharedHeadline extends Struct.ComponentSchema {
  collectionName: 'components_shared_headlines';
  info: {
    description: 'Reusable headline with optional index/count prefix';
    displayName: 'Headline';
  };
  attributes: {
    addCount: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    title: Schema.Attribute.String;
  };
}

export interface SharedHeroPromo extends Struct.ComponentSchema {
  collectionName: 'components_shared_hero_promos';
  info: {
    description: 'One small promo slide inside the hero carousel';
    displayName: 'Hero Promo Slide';
  };
  attributes: {
    button: Schema.Attribute.Component<'shared.button', false>;
    label: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface SharedLoadMore extends Struct.ComponentSchema {
  collectionName: 'components_shared_load_mores';
  info: {
    description: 'Paged list: render the first batch and add another one per click. No collapse.';
    displayName: 'Load more';
    icon: 'chevronDown';
  };
  attributes: {
    initialItems: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<6>;
    loadChunk: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<6>;
    loadMoreLabel: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Load more'>;
  };
}

export interface SharedNavItem extends Struct.ComponentSchema {
  collectionName: 'components_shared_nav_items';
  info: {
    description: 'One entry of the on-page menu: the label to show and the anchor of the section it scrolls to.';
    displayName: 'Nav Item';
    icon: 'list';
  };
  attributes: {
    anchor: Schema.Attribute.String & Schema.Attribute.Required;
    label: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: 'Reusable SEO metadata (metaTitle, metaDescription, socialImage)';
    displayName: 'SEO';
  };
  attributes: {
    metaDescription: Schema.Attribute.Text;
    metaTitle: Schema.Attribute.String;
    socialImage: Schema.Attribute.Media<'images'>;
  };
}

export interface SharedServiceGroup extends Struct.ComponentSchema {
  collectionName: 'components_shared_service_groups';
  info: {
    description: 'Group title, the services to feature, and an optional override for the related-cases carousel.';
    displayName: 'Service Group';
  };
  attributes: {
    relatedCaseStudies: Schema.Attribute.Relation<
      'oneToMany',
      'api::case-study.case-study'
    >;
    services: Schema.Attribute.Relation<'oneToMany', 'api::service.service'>;
    title: Schema.Attribute.String;
  };
}

export interface SharedShowMore extends Struct.ComponentSchema {
  collectionName: 'components_shared_show_mores';
  info: {
    description: "Collapse settings: how many items stay visible and the toggle's labels. Whether the toggle is used at all comes from the section's `List ending` field.";
    displayName: 'Show more / less';
    icon: 'chevronDown';
  };
  attributes: {
    itemsToShow: Schema.Attribute.Integer &
      Schema.Attribute.SetMinMax<
        {
          min: 1;
        },
        number
      > &
      Schema.Attribute.DefaultTo<5>;
    showLessLabel: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Show less'>;
    showMoreLabel: Schema.Attribute.String &
      Schema.Attribute.DefaultTo<'Show more'>;
  };
}

export interface SharedShowreel extends Struct.ComponentSchema {
  collectionName: 'components_shared_showreels';
  info: {
    description: 'Video with a cover image and an optional native-controls toggle';
    displayName: 'Showreel';
  };
  attributes: {
    cover: Schema.Attribute.Media<'images'>;
    showControls: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    video: Schema.Attribute.Media<'videos'>;
  };
}

export interface SharedSocials extends Struct.ComponentSchema {
  collectionName: 'components_shared_socials';
  info: {
    description: 'Social link: title + url';
    displayName: 'Socials';
  };
  attributes: {
    link: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface SharedTheme extends Struct.ComponentSchema {
  collectionName: 'components_shared_themes';
  info: {
    description: 'Section background colour + text contrast';
    displayName: 'Section Theme';
  };
  attributes: {
    background: Schema.Attribute.Enumeration<
      ['white', 'black', 'cream', 'purple']
    > &
      Schema.Attribute.DefaultTo<'white'>;
    headerTheme: Schema.Attribute.Enumeration<['light', 'dark']>;
    textColor: Schema.Attribute.Enumeration<['light', 'dark']> &
      Schema.Attribute.DefaultTo<'dark'>;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'global.error': GlobalError;
      'global.footer': GlobalFooter;
      'global.partner': GlobalPartner;
      'hub-bar.filter': HubBarFilter;
      'portfolio.filter': PortfolioFilter;
      'rich-content.block': RichContentBlock;
      'rich-content.stat': RichContentStat;
      'sections.campaign-intro': SectionsCampaignIntro;
      'sections.carousel': SectionsCarousel;
      'sections.case-studies': SectionsCaseStudies;
      'sections.content-color-boxes': SectionsContentColorBoxes;
      'sections.content-image-left': SectionsContentImageLeft;
      'sections.content-numerated': SectionsContentNumerated;
      'sections.cta': SectionsCta;
      'sections.faq': SectionsFaq;
      'sections.form': SectionsForm;
      'sections.hero': SectionsHero;
      'sections.hub-bar': SectionsHubBar;
      'sections.industries': SectionsIndustries;
      'sections.insight-list': SectionsInsightList;
      'sections.intersection-floating-boxes': SectionsIntersectionFloatingBoxes;
      'sections.intersection-media': SectionsIntersectionMedia;
      'sections.page-intro': SectionsPageIntro;
      'sections.person': SectionsPerson;
      'sections.portfolio': SectionsPortfolio;
      'sections.process': SectionsProcess;
      'sections.progress-cards': SectionsProgressCards;
      'sections.rich-content-body': SectionsRichContentBody;
      'sections.services-group': SectionsServicesGroup;
      'sections.team': SectionsTeam;
      'sections.tech-stack': SectionsTechStack;
      'shared.button': SharedButton;
      'shared.card-milestone': SharedCardMilestone;
      'shared.color-box': SharedColorBox;
      'shared.content-item': SharedContentItem;
      'shared.floating-card': SharedFloatingCard;
      'shared.headline': SharedHeadline;
      'shared.hero-promo': SharedHeroPromo;
      'shared.load-more': SharedLoadMore;
      'shared.nav-item': SharedNavItem;
      'shared.seo': SharedSeo;
      'shared.service-group': SharedServiceGroup;
      'shared.show-more': SharedShowMore;
      'shared.showreel': SharedShowreel;
      'shared.socials': SharedSocials;
      'shared.theme': SharedTheme;
    }
  }
}
