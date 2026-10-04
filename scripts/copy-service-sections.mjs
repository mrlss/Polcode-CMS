#!/usr/bin/env node

import fs from 'node:fs'

const CLOUD_URL =
  process.env.CLOUD_CMS_URL ?? 'https://original-desk-e673ad0b47.strapiapp.com'
const APPLY = process.argv.includes('--apply')

const arg = (name) => {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : null
}

const SOURCE_SLUG = arg('from') ?? 'web-development'
const SOURCE_ID = arg('from-id')
const ONLY = (arg('to') ?? '')
  .split(',')
  .map((slug) => slug.trim())
  .filter(Boolean)

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(
    [
      'Usage: node scripts/copy-service-sections.mjs [options]',
      '',
      'Copies the `sections` dynamic zone from one service entry to every other',
      'service entry on the cloud CMS. Dry run unless --apply.',
      '',
      'Options:',
      '  --from=<slug>        source service slug (default: web-development)',
      '  --from-id=<id>       source documentId (overrides --from)',
      '  --to=a,b,c           only these target slugs (default: all others)',
      '  --apply              write the changes',
      '',
      'Tokens: CLOUD_ADMIN_TOKEN (else CLOUD_ADMIN_TOKEN / commented',
      'STRAPI_ADMIN_TOKEN in .env) and CLOUD_API_TOKEN (else',
      'STRAPI_ACCESS_TOKEN in ../frontend/.env).',
    ].join('\n'),
  )
  process.exit(0)
}

const envValue = (file, pattern) => {
  if (!fs.existsSync(file)) return null
  const match = fs.readFileSync(file, 'utf8').match(pattern)
  return match ? match[1].trim() : null
}

const token =
  process.env.CLOUD_API_TOKEN ??
  envValue('../frontend/.env', /^STRAPI_ACCESS_TOKEN=(.*)$/m) ??
  process.env.CLOUD_ADMIN_TOKEN ??
  envValue('.env', /^CLOUD_ADMIN_TOKEN=(.*)$/m) ??
  envValue('.env', /^STRAPI_API_TOKEN=(.*)$/m) ??
  envValue('.env', /^#\s*STRAPI_ADMIN_TOKEN=(.*)$/m)

if (!token) {
  console.error(
    'No write token found — set CLOUD_API_TOKEN, ../frontend/.env STRAPI_ACCESS_TOKEN or strapi .env CLOUD_ADMIN_TOKEN.',
  )
  process.exit(1)
}

const request = async (method, suffix, body, token) => {
  const response = await fetch(`${CLOUD_URL}${suffix}`, {
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
    item && typeof item === 'object' ? { id: item.id } : item,
  )

/**
 * `sections` is a dynamic zone: every item needs `__component` as its FIRST
 * key, nested relations must be ids only (entries, media and `{ set: [...] }`
 * wrappers), and nested components must not carry the source's component ids.
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

const list = await request(
  'GET',
  '/api/services?pagination[pageSize]=200&fields[0]=slug&fields[1]=title',
  null,
  token,
)

if (list.status !== 200) {
  console.error(
    `Cannot list services (HTTP ${list.status}) — the token needs read access to api::service.service.`,
  )
  process.exit(1)
}

const entries = list.body?.data ?? []
if (!entries.length) {
  console.error('No service entries returned.')
  process.exit(1)
}

const source =
  entries.find((entry) => (SOURCE_ID ? entry.documentId === SOURCE_ID : entry.slug === SOURCE_SLUG)) ??
  null

if (!source) {
  console.error(
    `Source service not found (${SOURCE_ID ? `documentId ${SOURCE_ID}` : `slug ${SOURCE_SLUG}`}).`,
  )
  process.exit(1)
}

const readEntry = async (documentId) => {
  const response = await request(
    'GET',
    `/api/services/${documentId}?populate[sections][populate]=*`,
    null,
    token,
  )
  if (response.status !== 200) {
    throw new Error(`GET /api/services/${documentId} → HTTP ${response.status}`)
  }
  return response.body?.data ?? null
}

const sourceEntry = await readEntry(source.documentId)
const sourceSections = sourceEntry?.sections ?? []

if (!sourceSections.length) {
  console.error(`Source service "${source.slug}" has no sections — nothing to copy.`)
  process.exit(1)
}

const payload = sourceSections.map(writable)
log(
  `source "${source.slug}" (${source.documentId}): ${sourceSections.length} sections → ${JSON.stringify(payload).length
  } bytes of payload`,
)

const targets = entries.filter((entry) => {
  if (entry.documentId === source.documentId) return false
  if (!ONLY.length) return true
  return ONLY.includes(entry.slug)
})

if (!targets.length) {
  console.error('No target services selected.')
  process.exit(1)
}

for (const target of targets) {
  if (!APPLY) {
    log(`would copy ${sourceSections.length} sections → "${target.slug}"`)
    continue
  }

  const response = await request(
    'PUT',
    `/api/services/${target.documentId}`,
    { data: { sections: payload } },
    token,
  )

  const written = response.body?.data?.sections?.length ?? null
  log(
    `"${target.slug}" (${target.documentId}) → HTTP ${response.status}${written === null ? '' : `, sections: ${written}`
    }`,
  )

  if (response.status >= 400) {
    console.error(JSON.stringify(response.body).slice(0, 400))
  }
}

if (!APPLY) {
  log('dry run — re-run with --apply to write')
}
