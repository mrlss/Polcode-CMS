#!/usr/bin/env node

import fs from 'node:fs'

const arg = (name) => {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : null
}

const BASE_URL = (arg('url') ?? process.env.STRAPI_URL ?? 'http://localhost:1337').replace(/\/+$/, '')
const PAGE_ID = arg('page') ?? 'ur5w7roc8bptz4qnxzlwdiiu'
const APPLY = process.argv.includes('--apply')

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(
    [
      'Usage: node scripts/seed-vacancy-content.mjs [options]',
      '',
      'Fills the Vacancy page single type with the detail template and puts the',
      'Vacancies list block on the careers page. Dry run unless --apply.',
      '',
      'Options:',
      '  --url=<origin>    Strapi origin (default http://localhost:1337)',
      '  --page=<id>       careers page documentId',
      '  --initial-items=N cards visible before the first click (default 6)',
      '  --apply           write the changes',
      '',
      'Token: STRAPI_ACCESS_TOKEN env, else STRAPI_API_TOKEN in .env, else',
      'STRAPI_ACCESS_TOKEN in ../frontend/.env.',
    ].join('\n')
  )
  process.exit(0)
}

const envValue = (file, pattern) => {
  if (!fs.existsSync(file)) return null
  const match = fs.readFileSync(file, 'utf8').match(pattern)
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null
}

const token =
  process.env.STRAPI_ACCESS_TOKEN ??
  arg('token') ??
  envValue('.env', /^STRAPI_API_TOKEN=(.*)$/m) ??
  envValue('../frontend/.env', /^STRAPI_ACCESS_TOKEN=(.*)$/m) ??
  envValue('.env', /^#\s*STRAPI_API_TOKEN=(.*)$/m)

if (!token) {
  console.error('No token found — set STRAPI_API_TOKEN in strapi/.env.')
  process.exit(1)
}

const request = async (method, suffix, body) => {
  const response = await fetch(`${BASE_URL}${suffix}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await response.text()
  let parsed = text
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    /* keep the raw body */
  }
  return { status: response.status, body: parsed }
}

const DROP_KEYS = new Set([
  'id',
  'documentId',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'locale',
])

const RELATION_KEYS = new Set(['set', 'connect', 'disconnect'])

const isMedia = (value) =>
  value && typeof value === 'object' && typeof value.url === 'string' && value.id

const relationIds = (items) =>
  (Array.isArray(items) ? items : []).map((item) =>
    item && typeof item === 'object' ? { id: item.id } : item
  )

/**
 * A dynamic-zone entry needs `__component` as its FIRST key, nested components
 * must not carry ids, and media / relations must be sent as bare ids.
 */
const writable = (value) => {
  if (Array.isArray(value)) return value.map(writable)

  if (value && typeof value === 'object') {
    if (isMedia(value)) return { id: value.id }

    if (typeof value.__component === 'string') {
      const output = { __component: value.__component }
      for (const [key, item] of Object.entries(value)) {
        if (key === '__component' || DROP_KEYS.has(key)) continue
        output[key] = writable(item)
      }
      return output
    }

    const keys = Object.keys(value)
    if (keys.length === 1 && RELATION_KEYS.has(keys[0])) {
      return { [keys[0]]: relationIds(value[keys[0]]) }
    }

    if (value.documentId && value.id) return { id: value.id }

    const output = {}
    for (const [key, item] of Object.entries(value)) {
      if (DROP_KEYS.has(key)) continue
      output[key] = writable(item)
    }
    return output
  }

  return value
}

const log = (message) => console.log(APPLY ? `[apply] ${message}` : `[dry]   ${message}`)

const VACANCY_PAGE = {
  title: 'Vacancy page',
  seo: {
    metaTitle: 'Open position at Polcode',
    metaDescription: 'Join Polcode — see the full description, location and how to apply.',
  },
  sections: [
    {
      __component: 'sections.vacancy-details',
      anchor: 'details',
      linkTarget: 'application',
      buttonLabel: 'Apply now',
      buttonNote:
        '<p>We reply to every application, usually within a few working days.</p>',
      backLabel: 'All open positions',
      emptyState:
        '<p>This position is no longer open. Take a look at our other openings.</p>',
      theme: { background: 'white', textColor: 'dark' },
    },
    {
      __component: 'sections.cta',
      anchor: 'speculative',
      label: 'Nothing quite right?',
      title: 'Send us your CV anyway',
      description:
        '<p>We keep good people in mind for what comes next.</p>',
      theme: { background: 'black', textColor: 'light' },
    },
  ],
}

const VACANCIES_BLOCK = {
  __component: 'sections.vacancies-list',
  anchor: 'openings',
  headline: { title: 'Open positions', addCount: true },
  intro:
    '<p>Every open role is listed below. The list updates itself straight from our recruitment system.</p>',
  emptyState:
    '<p>There are no open positions right now. Send us your CV anyway — we keep good people in mind for what comes next.</p>',
  listMode: 'loadMore',
  loadMore: { initialItems: 6, loadChunk: 6, loadMoreLabel: 'Load more' },
  theme: { background: 'white', textColor: 'dark' },
}

const INITIAL_ITEMS = Number(arg('initial-items') ?? 6)

/* An empty single type answers 404 on this Strapi version, so 404 means "not
   created yet" rather than "route missing". */
const existingTemplate = await request('GET', '/api/vacancy-page')
if (existingTemplate.status !== 200 && existingTemplate.status !== 404) {
  console.error(
    `Cannot read the Vacancy page single type (HTTP ${existingTemplate.status}) — is the schema deployed on ${BASE_URL}?`
  )
  process.exit(1)
}

log(
  `vacancy page: ${existingTemplate.body?.data ? 'exists' : 'empty'
  } → ${VACANCY_PAGE.sections.length} template sections`
)

if (APPLY) {
  const written = await request('PUT', '/api/vacancy-page', { data: VACANCY_PAGE })
  log(`vacancy page → HTTP ${written.status}`)
  if (written.status !== 200) {
    console.error(JSON.stringify(written.body).slice(0, 600))
  }
}

const page = await request(
  'GET',
  `/api/pages/${PAGE_ID}?populate[sections][populate]=*`
)

if (page.status !== 200) {
  console.error(`Cannot read page ${PAGE_ID} (HTTP ${page.status}).`)
  process.exit(1)
}

const pageData = page.body?.data ?? {}
const sections = pageData.sections ?? []

const existingBlock = sections.find(
  (section) => section?.__component === 'sections.vacancies-list'
)

const nextSections = existingBlock
  ? sections.map((section) =>
    section?.__component === 'sections.vacancies-list'
      ? {
        ...section,
        loadMore: { ...(section.loadMore ?? {}), initialItems: INITIAL_ITEMS },
      }
      : section
  )
  : [
    ...sections,
    {
      ...VACANCIES_BLOCK,
      loadMore: { ...VACANCIES_BLOCK.loadMore, initialItems: INITIAL_ITEMS },
    },
  ]

const changed =
  !existingBlock ||
  (existingBlock.loadMore?.initialItems ?? 6) !== INITIAL_ITEMS

log(
  `page "${pageData.slug ?? PAGE_ID}": ${sections.length} sections, vacancies block ${existingBlock ? 'present' : 'missing → appending'
  }, initialItems ${INITIAL_ITEMS}`
)

if (APPLY && changed) {
  const written = await request('PUT', `/api/pages/${PAGE_ID}`, {
    data: {
      title: pageData.title,
      slug: pageData.slug,
      sections: nextSections.map(writable),
    },
  })
  log(`page ${PAGE_ID} → HTTP ${written.status}`)
  if (written.status !== 200) {
    console.error(JSON.stringify(written.body).slice(0, 600))
  }
}

console.log(APPLY ? '\nDone.' : '\nDry run — nothing written.')
