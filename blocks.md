Case Studies Filters = InsightsFilter (Case Studies collection)
Case Studies = Insights (Default + featured + More Cases)

<!-- CallToAction = CallToAction (2 variants) -->

<!-- Contacts - Contacts (2 variants + short) -->
<!-- ContentImageLeft - ContentImageLeft (about us approach) -->
<!-- Team - Team (Team collection) -->
<!-- Insights - Insights (Insights collection picker) -->

How We Hire - ContentCards (Slider/Grid/Collection pick??)

<!-- - Achievements - Achievements collection picker -->
  <!-- - ContentExpandable (default/expandable) \* FAQ/Our values? -->
  <!-- - Hero Rich (Careers page + about??) -->
<!-- - Hero Main - homepage -->
<!-- - Hero SVG Coverflow -->
<!-- - Hero Two Columns -->
<!-- - ContentIntro - (careers to about) -->
  <!-- - ContentColorBoxes (static/expandable) -->
  <!-- - HR Team (Team collection) -->
<!-- - Sales block -->
<!-- - Team Testimonials -->
<!-- - Clients Testimonials -->

- Resources Filters - (Resources collection)
  <!-- - ContentProgressCards -->
  <!-- - ContentNumeratedBlocks - About Pillars -->
  <!-- - Service Showcase - services page -->
  <!-- - Services - (services collection picker) -->
  <!-- - Tech stack - (Tech stack collection picker) -->
  <!-- - Stacked cards content -->
  <!-- - Intersection Floating Boxes -->
  <!-- - Intersection Media = ContentFullScreenImage (about FS) -->
- Vacancies

Collections
Industries - used for filtering

- title
- slug (based on title)

Services - used for filtering

- title
- slug (based on title)

Technologies used for filtering

- title
- slug (based on title)

Regions - used for filtering

- title
- slug (based on title)

Case Studies

- \*SEO - create reusable Component: metaTitle, metaDescription, socialImage
- \*slug for URL, bind to title
- \*title - text
- label - text
- description-wysiwyg
- shortTitle - text
- shortDescription - wysiwyg
- featuredMedia - Image/Video
- isFeatured - boolean (false default)
- logo - Image
- industries - one-to-many to Industries
- services - one-to-many to Services
- Technologies - one-to-many to Technologies
- Regions - one-to-many to Regions

Platforms
-title - text
-logo - image

Achievements

- link
- title - text
- data - datepicker
- platform - relation to the Platforms
- media - image or video

Testimonials

- author-text
- position - text
- media - image or video
- text - wysiwyg

Clients
-logo - image
-link
-testimonial (collection picker from Testimonials)

Team
-media-image
-position-text
-email-email field
-description-wysiwyg
-socials (repeatable field of component to create: Title/Link->title-text,link-text)
-firstName
-lastName

Industries (expand existing)
-title-text
-description-wysiwyg
-media - image or video
-relatedCases - collection picker from Case Studies

Tech stack
-title-text
-slug-uuid to title (for filtering purpose)
-description-wysiwyg
-image
-link - will be used as search-params pass based on slug, e.g. stack=react

Services (expand existing)
-title-text
-slug-uuid to title (for filtering purpose)
-description-wysiwyg
-media-image
-link - will be used as search-params pass based on slug,e.g. service=frontend

Sections

Content Numerated Static/Expand
-headline
-button
-layout: buttonBelow/buttonOnSide
-behavior: static/expandable
-repeatable of component to create Title/wysiwyg

- title
- description
- button

Content Image Numerated static
-headline
-subtitle-text
-button
-media - image/video
-blocks -> repeatable title/wysiwyg component

FAQ
headline component
theme component
relation to faq many

Use Cases
headline component
pick: latest/manual
IF latest selected we select 5 of latest, otherwise use relation to use cases many
theme component
button component

Case Studies
pick: latest/manual
IF latest selected we select 5 of latest, otherwise use relation to Case Studies many
headline component
theme component
button component

Insights
pick: latest/manual
IF latest selected we select 5 of latest, otherwise use relation to Insights many
headline component
theme component
button component

Hero Two Columns
-title-text
-description-text long
-button
-label-text
-indicator-text

Cards Large Numerated
headline
cardsLayout: carousel/grid - default to carousel
cards: repeatable for component to create Card Numerated

Testimonials Team
headline
cardsLayout: carousel/grid - default to carousel
cards: repeatable for collection Testimonials

Testimonials Clients
-headline
-cards: repeatable for collection Testimonials

Team Grid
headline
team - collection to team
content

- title -text
- description - wysiwyg
- button

Progress Cards
-headline
-cards -> repeatable component to do Card Milestone

Content Color Boxes
-headline
-subtitle-text
-description
-repeatable of component to create Color Box:

- title - text
- label - text
- expandable - bool:false
- blocks - repeatable of
  - title
  - wysiwyg

Content Image Left
headline
label - text
media - image/video
title - text
content - wysiwyg
button

Hero Rich
-title - long text
-description - wysiwyg
-button
-label
-variant: titleAbove/titleBelow
-carousel

- title
  -button

Hero SVG
-title-text
-image-image

Form

- variant: contact/cv
- title - text
- description - wysiwyg
- label - text
- media - image/video - only of variant Contact choosen

Person
-person - relation to team, one
-address - long text
-email - email

- socials - repeatable Title/Link component
  -button

Team
-title - text
-members - picker to Team collection

Process
-headline
-blocks -> create collection Process(title,description-wysiwyg,media-image) and pick from it many
-button

Services Group
-headline
-groups
-title
-services - picker from collection
-relatedUseCases - picker for use cases collection

Industries
headline
button
industries: collection picker from industries

Tech Stack
headline
button
blocks: collection picker from tech stack collection
load-more - how can we do it as a button variant or functionality??

Intro Showreel
-title-text
-button
-media-image/video
-label-text
-description-wysiwyg
showreel - create component with video and poster fields

Intersection Floating Boxes
headline
media-image/video
blocks: component to do Floating Card, repeatable

Intersection Media
title-text
button
media-image/video
