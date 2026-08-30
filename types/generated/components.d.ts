import type { Schema, Struct } from '@strapi/strapi';

export interface GlobalContentTypeUrl extends Struct.ComponentSchema {
  collectionName: 'components_global_content_type_urls';
  info: {
    description: 'Maps a content-type detail page (case studies, insights) to its public URL prefix.';
    displayName: 'Content Type URL';
    icon: 'link';
  };
  attributes: {
    kind: Schema.Attribute.Enumeration<['caseStudy', 'insight']> &
      Schema.Attribute.DefaultTo<'caseStudy'>;
    path: Schema.Attribute.String;
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

export interface RichContentBlock extends Struct.ComponentSchema {
  collectionName: 'components_rich_content_blocks';
  info: {
    description: 'A single article block: WYSIWYG prose (paragraphs/headings/images/video/table/quote/code) or a special widget (carousel / stats / audio).';
    displayName: 'Block';
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

export interface SectionsAchievements extends Struct.ComponentSchema {
  collectionName: 'components_sections_achievements';
  info: {
    description: 'Achievements section: headline + a picker of achievement entries';
    displayName: 'Achievements';
  };
  attributes: {
    achievements: Schema.Attribute.Relation<
      'oneToMany',
      'api::achievement.achievement'
    >;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsCardsLargeNumerated extends Struct.ComponentSchema {
  collectionName: 'components_sections_cards_large_numerateds';
  info: {
    description: 'Numerated cards, carousel or grid';
    displayName: 'Cards Large Numerated';
  };
  attributes: {
    cards: Schema.Attribute.Component<'shared.card-numerated', true>;
    cardsLayout: Schema.Attribute.Enumeration<['carousel', 'grid']> &
      Schema.Attribute.DefaultTo<'carousel'>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsCaseStudies extends Struct.ComponentSchema {
  collectionName: 'components_sections_case_studies';
  info: {
    description: 'Case studies section, latest or manual';
    displayName: 'Case Studies';
  };
  attributes: {
    button: Schema.Attribute.Component<'shared.button', false>;
    caseStudies: Schema.Attribute.Relation<
      'oneToMany',
      'api::case-study.case-study'
    >;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    pick: Schema.Attribute.Enumeration<['latest', 'manual', 'next']> &
      Schema.Attribute.DefaultTo<'latest'>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsContentColorBoxes extends Struct.ComponentSchema {
  collectionName: 'components_sections_content_color_boxes';
  info: {
    description: 'Color boxes section';
    displayName: 'Content Color Boxes';
  };
  attributes: {
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
    description: 'Image left + content right';
    displayName: 'Content Image Left';
  };
  attributes: {
    button: Schema.Attribute.Component<'shared.button', false>;
    content: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultHtml';
        }
      >;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    label: Schema.Attribute.String;
    media: Schema.Attribute.Media<'images' | 'videos'>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
    title: Schema.Attribute.String;
  };
}

export interface SectionsContentImageNumerated extends Struct.ComponentSchema {
  collectionName: 'components_sections_content_image_numerateds';
  info: {
    description: 'Numerated content with image';
    displayName: 'Content Image Numerated';
  };
  attributes: {
    blocks: Schema.Attribute.Component<'shared.content-item', true>;
    button: Schema.Attribute.Component<'shared.button', false>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    media: Schema.Attribute.Media<'images' | 'videos'>;
    subtitle: Schema.Attribute.String;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsContentNumerated extends Struct.ComponentSchema {
  collectionName: 'components_sections_content_numerateds';
  info: {
    description: 'Numerated content, static or expandable';
    displayName: 'Content Numerated';
  };
  attributes: {
    behavior: Schema.Attribute.Enumeration<['static', 'expandable']> &
      Schema.Attribute.DefaultTo<'static'>;
    button: Schema.Attribute.Component<'shared.button', false>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    items: Schema.Attribute.Component<'shared.content-item', true>;
    layout: Schema.Attribute.Enumeration<['buttonBelow', 'buttonOnSide']> &
      Schema.Attribute.DefaultTo<'buttonBelow'>;
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
    faqs: Schema.Attribute.Relation<'oneToMany', 'api::faq.faq'>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsForm extends Struct.ComponentSchema {
  collectionName: 'components_sections_forms';
  info: {
    description: 'Contact or CV form section';
    displayName: 'Form';
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
    theme: Schema.Attribute.Component<'shared.theme', false>;
    title: Schema.Attribute.String;
    variant: Schema.Attribute.Enumeration<['contact', 'cv']> &
      Schema.Attribute.DefaultTo<'contact'>;
  };
}

export interface SectionsHeroRich extends Struct.ComponentSchema {
  collectionName: 'components_sections_hero_riches';
  info: {
    description: 'Rich hero with title variant and carousel';
    displayName: 'Hero Rich';
  };
  attributes: {
    button: Schema.Attribute.Component<'shared.button', false>;
    carousel: Schema.Attribute.Component<'shared.content-item', true>;
    description: Schema.Attribute.RichText &
      Schema.Attribute.CustomField<
        'plugin::ckeditor5.CKEditor',
        {
          preset: 'defaultHtml';
        }
      >;
    label: Schema.Attribute.String;
    theme: Schema.Attribute.Component<'shared.theme', false>;
    title: Schema.Attribute.Text;
    variant: Schema.Attribute.Enumeration<['titleAbove', 'titleBelow']> &
      Schema.Attribute.DefaultTo<'titleAbove'>;
  };
}

export interface SectionsHeroSvg extends Struct.ComponentSchema {
  collectionName: 'components_sections_hero_svgs';
  info: {
    description: 'Hero with SVG/image';
    displayName: 'Hero SVG';
  };
  attributes: {
    image: Schema.Attribute.Media<'images'>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
    title: Schema.Attribute.String;
  };
}

export interface SectionsHeroTwoColumns extends Struct.ComponentSchema {
  collectionName: 'components_sections_hero_two_columns';
  info: {
    description: 'Two-column hero';
    displayName: 'Hero Two Columns';
  };
  attributes: {
    button: Schema.Attribute.Component<'shared.button', false>;
    description: Schema.Attribute.Text;
    indicatorText: Schema.Attribute.String;
    label: Schema.Attribute.String;
    theme: Schema.Attribute.Component<'shared.theme', false>;
    title: Schema.Attribute.String;
  };
}

export interface SectionsIndustries extends Struct.ComponentSchema {
  collectionName: 'components_sections_industries';
  info: {
    description: 'Industries section';
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

export interface SectionsInsights extends Struct.ComponentSchema {
  collectionName: 'components_sections_insights';
  info: {
    description: 'Insights section, latest or manual';
    displayName: 'Insights';
  };
  attributes: {
    button: Schema.Attribute.Component<'shared.button', false>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    insights: Schema.Attribute.Relation<'oneToMany', 'api::insight.insight'>;
    pick: Schema.Attribute.Enumeration<['latest', 'manual']> &
      Schema.Attribute.DefaultTo<'latest'>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsIntersectionFloatingBoxes
  extends Struct.ComponentSchema {
  collectionName: 'components_sections_intersection_floating_boxes';
  info: {
    description: 'Floating cards over media';
    displayName: 'Intersection Floating Boxes';
  };
  attributes: {
    blocks: Schema.Attribute.Component<'shared.floating-card', true>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    media: Schema.Attribute.Media<'images' | 'videos'>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsIntersectionMedia extends Struct.ComponentSchema {
  collectionName: 'components_sections_intersection_media';
  info: {
    description: 'Media with title + button overlay';
    displayName: 'Intersection Media';
  };
  attributes: {
    button: Schema.Attribute.Component<'shared.button', false>;
    media: Schema.Attribute.Media<'images' | 'videos'>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
    title: Schema.Attribute.String;
  };
}

export interface SectionsIntroShowreel extends Struct.ComponentSchema {
  collectionName: 'components_sections_intro_showreels';
  info: {
    description: 'Showreel intro';
    displayName: 'Intro Showreel';
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
    label: Schema.Attribute.String;
    media: Schema.Attribute.Media<'images' | 'videos'>;
    showreel: Schema.Attribute.Component<'shared.showreel', false>;
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
    featuredCases: Schema.Attribute.Relation<
      'oneToMany',
      'api::case-study.case-study'
    >;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    manualCasesControl: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    otherCases: Schema.Attribute.Relation<
      'oneToMany',
      'api::case-study.case-study'
    >;
    showMoreLess: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    sort: Schema.Attribute.Enumeration<['asc', 'desc']> &
      Schema.Attribute.DefaultTo<'asc'>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsProcess extends Struct.ComponentSchema {
  collectionName: 'components_sections_processes';
  info: {
    description: 'Process steps section';
    displayName: 'Process';
  };
  attributes: {
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
    blocks: Schema.Attribute.Component<'rich-content.block', true>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    showNav: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsServicesGroup extends Struct.ComponentSchema {
  collectionName: 'components_sections_services_groups';
  info: {
    description: 'Grouped services with related use cases';
    displayName: 'Services Group';
  };
  attributes: {
    groups: Schema.Attribute.Component<'shared.service-group', true>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsTeam extends Struct.ComponentSchema {
  collectionName: 'components_sections_teams';
  info: {
    description: 'Team members section';
    displayName: 'Team';
  };
  attributes: {
    members: Schema.Attribute.Relation<'oneToMany', 'api::team.team'>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
    title: Schema.Attribute.String;
  };
}

export interface SectionsTeamGrid extends Struct.ComponentSchema {
  collectionName: 'components_sections_team_grids';
  info: {
    description: 'Team members grid';
    displayName: 'Team Grid';
  };
  attributes: {
    content: Schema.Attribute.Component<'shared.content-item', false>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    team: Schema.Attribute.Relation<'oneToMany', 'api::team.team'>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsTechStack extends Struct.ComponentSchema {
  collectionName: 'components_sections_tech_stacks';
  info: {
    description: 'Tech stack section with load-more button';
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
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsTestimonialsClients extends Struct.ComponentSchema {
  collectionName: 'components_sections_testimonials_clients';
  info: {
    description: 'Client testimonials';
    displayName: 'Testimonials Clients';
  };
  attributes: {
    cards: Schema.Attribute.Relation<
      'oneToMany',
      'api::testimonial.testimonial'
    >;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SectionsTestimonialsTeam extends Struct.ComponentSchema {
  collectionName: 'components_sections_testimonials_teams';
  info: {
    description: 'Team testimonials, carousel or grid';
    displayName: 'Testimonials Team';
  };
  attributes: {
    cards: Schema.Attribute.Relation<
      'oneToMany',
      'api::testimonial.testimonial'
    >;
    cardsLayout: Schema.Attribute.Enumeration<['carousel', 'grid']> &
      Schema.Attribute.DefaultTo<'carousel'>;
    headline: Schema.Attribute.Component<'shared.headline', false>;
    theme: Schema.Attribute.Component<'shared.theme', false>;
  };
}

export interface SharedButton extends Struct.ComponentSchema {
  collectionName: 'components_shared_buttons';
  info: {
    description: 'Reusable CTA button: title, optional scroll-to, and a single link target (external URL or internal Page / Case Study / Insight)';
    displayName: 'Button';
  };
  attributes: {
    caseStudy: Schema.Attribute.Relation<
      'oneToOne',
      'api::case-study.case-study'
    >;
    insight: Schema.Attribute.Relation<'oneToOne', 'api::insight.insight'>;
    linkType: Schema.Attribute.Enumeration<
      ['url', 'page', 'caseStudy', 'insight']
    > &
      Schema.Attribute.DefaultTo<'url'>;
    page: Schema.Attribute.Relation<'oneToOne', 'api::page.page'>;
    scrollTo: Schema.Attribute.String;
    title: Schema.Attribute.String;
    url: Schema.Attribute.String;
  };
}

export interface SharedCardMilestone extends Struct.ComponentSchema {
  collectionName: 'components_shared_card_milestones';
  info: {
    description: 'Milestone card for progress';
    displayName: 'Card Milestone';
  };
  attributes: {
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

export interface SharedCardNumerated extends Struct.ComponentSchema {
  collectionName: 'components_shared_card_numerateds';
  info: {
    description: 'Numbered card';
    displayName: 'Card Numerated';
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
    title: Schema.Attribute.String;
  };
}

export interface SharedColorBox extends Struct.ComponentSchema {
  collectionName: 'components_shared_color_boxes';
  info: {
    description: 'Expandable color box with content-item blocks';
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
    title: Schema.Attribute.String;
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

export interface SharedSectionsNavController extends Struct.ComponentSchema {
  collectionName: 'components_shared_sections_nav_controllers';
  info: {
    description: "Opts a block into the sections nav (label only \u2014 the scroll target is the block's own `anchor`).";
    displayName: 'Sections Nav Controller';
    icon: 'list';
  };
  attributes: {
    label: Schema.Attribute.String;
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
    description: 'Group title + services + related use cases';
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

export interface SharedShowreel extends Struct.ComponentSchema {
  collectionName: 'components_shared_showreels';
  info: {
    description: 'Video with poster image';
    displayName: 'Showreel';
  };
  attributes: {
    poster: Schema.Attribute.Media<'images'>;
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
    description: 'Section background color + text contrast';
    displayName: 'Theme';
  };
  attributes: {
    background: Schema.Attribute.Enumeration<
      ['white', 'black', 'cream', 'purple']
    > &
      Schema.Attribute.DefaultTo<'white'>;
    textColor: Schema.Attribute.Enumeration<['light', 'dark']> &
      Schema.Attribute.DefaultTo<'dark'>;
  };
}

export interface TestTest extends Struct.ComponentSchema {
  collectionName: 'components_test_tests';
  info: {
    displayName: 'test';
  };
  attributes: {
    case_studies: Schema.Attribute.Relation<
      'oneToMany',
      'api::case-study.case-study'
    >;
    test: Schema.Attribute.Boolean;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'global.content-type-url': GlobalContentTypeUrl;
      'global.footer': GlobalFooter;
      'global.partner': GlobalPartner;
      'rich-content.block': RichContentBlock;
      'rich-content.stat': RichContentStat;
      'sections.achievements': SectionsAchievements;
      'sections.cards-large-numerated': SectionsCardsLargeNumerated;
      'sections.case-studies': SectionsCaseStudies;
      'sections.content-color-boxes': SectionsContentColorBoxes;
      'sections.content-image-left': SectionsContentImageLeft;
      'sections.content-image-numerated': SectionsContentImageNumerated;
      'sections.content-numerated': SectionsContentNumerated;
      'sections.cta': SectionsCta;
      'sections.faq': SectionsFaq;
      'sections.form': SectionsForm;
      'sections.hero-rich': SectionsHeroRich;
      'sections.hero-svg': SectionsHeroSvg;
      'sections.hero-two-columns': SectionsHeroTwoColumns;
      'sections.industries': SectionsIndustries;
      'sections.insights': SectionsInsights;
      'sections.intersection-floating-boxes': SectionsIntersectionFloatingBoxes;
      'sections.intersection-media': SectionsIntersectionMedia;
      'sections.intro-showreel': SectionsIntroShowreel;
      'sections.person': SectionsPerson;
      'sections.portfolio': SectionsPortfolio;
      'sections.process': SectionsProcess;
      'sections.progress-cards': SectionsProgressCards;
      'sections.rich-content-body': SectionsRichContentBody;
      'sections.services-group': SectionsServicesGroup;
      'sections.team': SectionsTeam;
      'sections.team-grid': SectionsTeamGrid;
      'sections.tech-stack': SectionsTechStack;
      'sections.testimonials-clients': SectionsTestimonialsClients;
      'sections.testimonials-team': SectionsTestimonialsTeam;
      'shared.button': SharedButton;
      'shared.card-milestone': SharedCardMilestone;
      'shared.card-numerated': SharedCardNumerated;
      'shared.color-box': SharedColorBox;
      'shared.content-item': SharedContentItem;
      'shared.floating-card': SharedFloatingCard;
      'shared.headline': SharedHeadline;
      'shared.sections-nav-controller': SharedSectionsNavController;
      'shared.seo': SharedSeo;
      'shared.service-group': SharedServiceGroup;
      'shared.showreel': SharedShowreel;
      'shared.socials': SharedSocials;
      'shared.theme': SharedTheme;
      'test.test': TestTest;
    }
  }
}
