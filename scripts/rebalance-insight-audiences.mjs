#!/usr/bin/env node

import fs from 'node:fs'

const CLOUD_URL =
  process.env.CLOUD_CMS_URL ?? 'https://original-desk-e673ad0b47.strapiapp.com'

const arg = (name) => {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : null
}

const APPLY = process.argv.includes('--apply')
const SEED = Number(arg('seed') ?? 20261005)
const PREFER_TYPE = (arg('prefer-type') ?? 'article').toLowerCase()

const TARGETS = new Map(
  (arg('targets') ?? 'for-developers:4,customer-stories:4')
    .split(',')
    .map((pair) => pair.split(':'))
    .filter((pair) => pair.length === 2 && pair[0].trim())
    .map(([slug, count]) => [slug.trim().toLowerCase(), Number(count)]),
)

const PINNED = new Map()
for (const value of process.argv) {
  const match = value.match(/^--set-([a-z0-9-]+)=(.*)$/i)
  if (!match) continue
  PINNED.set(
    match[1].toLowerCase(),
    match[2]
      .split('|')
      .map((title) => title.trim().toLowerCase())
      .filter(Boolean),
  )
}

const readEnv = (file) => {
  if (!fs.existsSync(file)) return {}
  const output = {}
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) output[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
  }
  return output
}

const strapiEnv = readEnv('.env')
const frontendEnv = readEnv('../frontend/.env')

const candidates = [
  [
    'CLOUD_ADMIN_TOKEN',
    process.env.CLOUD_ADMIN_TOKEN ?? strapiEnv.CLOUD_ADMIN_TOKEN,
  ],
  ['STRAPI_ADMIN_TOKEN', strapiEnv.STRAPI_ADMIN_TOKEN],
  ['STRAPI_API_TOKEN', strapiEnv.STRAPI_API_TOKEN],
  ['frontend STRAPI_ACCESS_TOKEN', frontendEnv.STRAPI_ACCESS_TOKEN],
].filter(([, value]) => Boolean(value))

const api = async (suffix, init = {}, bearer = null) => {
  const response = await fetch(`${CLOUD_URL}${suffix}`, {
    ...init,
    headers: { Authorization: `Bearer ${bearer}`, ...(init.headers ?? {}) },
  })
  const text = await response.text()
  let body = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!response.ok) {
    throw new Error(
      `${init.method ?? 'GET'} ${suffix} → ${response.status}: ${typeof body === 'string' ? body : JSON.stringify(body)
      }`,
    )
  }
  return body
}

let token = null
for (const [label, value] of candidates) {
  const ok = await api('/api/insights?pagination[pageSize]=1', {}, value)
    .then(() => true)
    .catch(() => false)
  if (ok) {
    token = value
    console.log(`token: ${label}`)
    break
  }
}

if (!token) {
  console.error('No candidate token can read the cloud CMS.')
  process.exit(1)
}

const request = (suffix, init) => api(suffix, init, token)
const one = (value) => (Array.isArray(value) ? value[0] : value)

const mulberry32 = (seed) => {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = mulberry32(SEED)

const shuffle = (items) => {
  const pool = [...items]
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool
}

const POPULATE = 'populate[audience]=true&populate[resourceType]=true'

const [draft, published] = await Promise.all([
  request(
    `/api/insights?status=draft&pagination[pageSize]=200&${POPULATE}`,
  ).then((body) => body.data ?? []),
  request(
    `/api/insights?status=published&pagination[pageSize]=200&${POPULATE}`,
  ).then((body) => body.data ?? []),
])

const publishedById = new Map(
  published.map((entry) => [entry.documentId, entry]),
)

const audiences = await request(
  '/api/primary-audiences?pagination[pageSize]=200',
).then((body) => body.data ?? [])

const audienceBySlug = new Map(
  audiences.map((entry) => [entry.slug.toLowerCase(), entry]),
)

for (const slug of TARGETS.keys()) {
  if (!audienceBySlug.has(slug)) {
    console.error(`Unknown audience slug: ${slug}`)
    process.exit(1)
  }
}

const groups = new Map()
for (const entry of draft) {
  const slug = one(entry.audience)?.slug?.toLowerCase() ?? '(none)'
  if (!groups.has(slug)) groups.set(slug, [])
  groups.get(slug).push(entry)
}

const audienceOf = (entry) =>
  one(entry.audience)?.slug?.toLowerCase() ?? '(none)'

const moves = []
const assignment = new Map(
  draft.map((entry) => [entry.documentId, audienceOf(entry)]),
)

const sizeOf = (slug) => groups.get(slug)?.length ?? 0

const movableFrom = (slug) =>
  (groups.get(slug) ?? []).filter(
    (entry) =>
      assignment.get(entry.documentId) === slug &&
      MOVED.has(entry.documentId) === false,
  )

const typeOf = (entry) =>
  one(entry.resourceType)?.slug?.toLowerCase() ?? ''

const MOVED = new Set()

const sortedGroupSlugs = () =>
  [...groups.keys()]
    .filter((slug) => slug !== '(none)')
    .sort((a, b) => sizeOf(b) - sizeOf(a))

const take = (list, entry) => {
  const from = assignment.get(entry.documentId)
  assignment.set(entry.documentId, list)
  MOVED.add(entry.documentId)
  if (from && groups.has(from)) {
    const at = groups.get(from).indexOf(entry)
    if (at !== -1) groups.get(from).splice(at, 1)
  }
  if (!groups.has(list)) groups.set(list, [])
  groups.get(list).push(entry)
}

const PINNED_MEMBERS = new Set()

for (const [slug, titles] of PINNED) {
  if (!TARGETS.has(slug)) TARGETS.set(slug, titles.length)
  for (const wanted of titles) {
    const entry = draft.find((row) =>
      row.title.toLowerCase().includes(wanted),
    )
    if (!entry) {
      console.warn(`! no insight matches "${wanted}"`)
      continue
    }
    PINNED_MEMBERS.add(entry.documentId)
    take(slug, entry)
  }
}

for (const [slug, target] of TARGETS) {
  if (PINNED.has(slug)) continue
  let current = sizeOf(slug)
  if (current >= target) continue

  const donorSlugs = sortedGroupSlugs().filter(
    (other) => other !== slug && !TARGETS.has(other) && sizeOf(other) > 4,
  )
  const pool = shuffle(donorSlugs.flatMap((other) => movableFrom(other)))
  const donors = [
    ...pool.filter((entry) => typeOf(entry) === PREFER_TYPE),
    ...pool.filter((entry) => typeOf(entry) !== PREFER_TYPE),
  ]

  for (const entry of donors) {
    if (current >= target) break
    const from = assignment.get(entry.documentId)
    assignment.set(entry.documentId, slug)
    MOVED.add(entry.documentId)
    groups.get(from).splice(groups.get(from).indexOf(entry), 1)
    groups.get(slug).push(entry)
    current += 1
  }
}

for (const [slug, target] of TARGETS) {
  let current = sizeOf(slug)
  if (current <= target) continue

  const pool = shuffle(
    (groups.get(slug) ?? []).filter(
      (entry) => assignment.get(entry.documentId) === slug,
    ),
  )
  const surplus = [
    ...pool.filter(
      (entry) =>
        !PINNED_MEMBERS.has(entry.documentId) &&
        typeOf(entry) !== PREFER_TYPE,
    ),
    ...pool.filter(
      (entry) =>
        !PINNED_MEMBERS.has(entry.documentId) &&
        typeOf(entry) === PREFER_TYPE,
    ),
    ...pool.filter((entry) => PINNED_MEMBERS.has(entry.documentId)),
  ].slice(0, current - target)

  for (const entry of surplus) {
    const to = sortedGroupSlugs().find(
      (other) =>
        other !== slug &&
        !TARGETS.has(other) &&
        (groups.get(other)?.length ?? 0) > 1,
    )
    if (!to) break
    assignment.set(entry.documentId, to)
    MOVED.add(entry.documentId)
    groups.get(slug).splice(groups.get(slug).indexOf(entry), 1)
    groups.get(to).push(entry)
    current -= 1
  }
}

console.table(
  Object.fromEntries(
    [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([slug, list]) => [
        slug,
        {
          count: list.length,
          target: TARGETS.get(slug) ?? '—',
          insights: list
            .map((entry) => entry.title)
            .join(' · ')
            .slice(0, 200),
        },
      ]),
  ),
)

const changed = draft.filter(
  (entry) => assignment.get(entry.documentId) !== audienceOf(entry),
)

console.table(
  changed.map((entry) => ({
    insight: entry.title?.slice(0, 52),
    from: audienceOf(entry),
    to: assignment.get(entry.documentId),
  })),
)

if (!APPLY) {
  console.log(`\nDry run — ${changed.length} insights would move.`)
  process.exit(0)
}

for (const entry of changed) {
  const slug = assignment.get(entry.documentId)
  const audienceId = audienceBySlug.get(slug)?.documentId
  if (!audienceId) continue

  const row = publishedById.get(entry.documentId)
  const body = (source) =>
    JSON.stringify({
      data: {
        title: source?.title ?? entry.title,
        slug: source?.slug ?? entry.slug,
        audience: audienceId,
      },
    })

  await request(`/api/insights/${entry.documentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body(entry),
  })
  await request(`/api/insights/${entry.documentId}?status=published`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body(row),
  })
  console.log(`[apply] ${entry.title} → ${slug}`)
}

console.log(`\nDone — ${changed.length} insights re-assigned.`)
