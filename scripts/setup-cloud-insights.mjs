#!/usr/bin/env node

import fs from 'node:fs'

const CLOUD_URL =
  process.env.CLOUD_CMS_URL ?? 'https://original-desk-e673ad0b47.strapiapp.com'

const arg = (name) => {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : null
}

const APPLY = process.argv.includes('--apply')
const SOURCE_ID = arg('source') ?? 'dpwl87zr8788z31p53qgkw7a'
const OVERWRITE_SECTIONS = process.argv.includes('--overwrite-sections')
const OVERWRITE_RELATIONS = process.argv.includes('--overwrite-relations')
const SEED = Number(arg('seed') ?? 20261005)

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

const authorizes = async (value) => {
  try {
    const response = await fetch(
      `${CLOUD_URL}/api/insights?pagination[pageSize]=1`,
      { headers: { Authorization: `Bearer ${value}` } },
    )
    return response.ok
  } catch {
    return false
  }
}

let token = null
for (const [label, value] of candidates) {
  if (await authorizes(value)) {
    token = value
    console.log(`token: ${label}`)
    break
  }
}

if (!token) {
  console.error('No candidate token can read the cloud CMS.')
  process.exit(1)
}

const api = async (suffix, init = {}) => {
  const response = await fetch(`${CLOUD_URL}${suffix}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
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

const between = (min, max) => min + Math.floor(random() * (max - min + 1))

const one = (value) => (Array.isArray(value) ? value[0] : value)

const ids = (value) => {
  const rows = Array.isArray(value) ? value : value ? [value] : []
  return rows.map((row) => row?.documentId ?? row?.id).filter(Boolean)
}

const DROP_KEYS = new Set([
  'id',
  'documentId',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'locale',
])

const isMedia = (value) =>
  value &&
  typeof value === 'object' &&
  typeof value.url === 'string' &&
  value.id !== undefined

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

const INSIGHT_POPULATE = [
  'populate[featuredMedia]=true',
  'populate[tags]=true',
  'populate[author]=true',
  'populate[resourceType]=true',
  'populate[audience]=true',
  'populate[parent]=true',
  'populate[sections][populate]=*',
].join('&')

const readInsights = async (status) =>
  api(
    `/api/insights?status=${status}&pagination[pageSize]=200&${INSIGHT_POPULATE}`,
  ).then((body) => body.data ?? [])

const readPool = async (resource) => {
  const suffix = (status) =>
    `/api/${resource}?status=${status}&pagination[pageSize]=200`
  const [drafts, published] = await Promise.all([
    api(suffix('draft')).then((body) => body.data ?? []),
    api(suffix('published')).then((body) => body.data ?? []),
  ])
  const pool = new Map()
  for (const [entry, status] of [
    ...drafts.map((e) => [e, 'draft']),
    ...published.map((e) => [e, 'published']),
  ]) {
    const current = pool.get(entry.documentId) ?? { entries: {} }
    current.entries[status] = entry
    current.title = entry.title ?? entry.fullName ?? entry.slug
    current.slug = entry.slug
    pool.set(entry.documentId, current)
  }
  return pool
}

const [
  insightsDraft,
  insightsPublished,
  tags,
  authors,
  resourceTypes,
  audiences,
  pages,
] = await Promise.all([
  readInsights('draft'),
  readInsights('published'),
  readPool('tags'),
  readPool('authors'),
  readPool('resource-types'),
  readPool('primary-audiences'),
  readPool('pages'),
])

const byId = new Map()
for (const [entry, status] of [
  ...insightsDraft.map((e) => [e, 'draft']),
  ...insightsPublished.map((e) => [e, 'published']),
]) {
  const current = byId.get(entry.documentId) ?? { entries: {} }
  current.entries[status] = entry
  byId.set(entry.documentId, current)
}

const source = byId.get(SOURCE_ID)
if (!source) throw new Error(`Source insight ${SOURCE_ID} not found`)

const sourceEntry = source.entries.draft ?? source.entries.published
const sourceSections = (sourceEntry.sections ?? []).map(writable)
const sourceTags = ids(sourceEntry.tags)
const sourceAuthor = ids(sourceEntry.author)[0]
const sourceType = ids(sourceEntry.resourceType)[0]
const sourceAudience = ids(sourceEntry.audience)[0]
const sourceParent = ids(sourceEntry.parent)[0]
const sourceMedia = one(sourceEntry.featuredMedia) ?? null

const files = await api('/api/upload/files?pagination[pageSize]=500').catch(
  () => [],
)
const library = Array.isArray(files) ? files : files?.results ?? []
const jpegs = library.filter((file) => file.mime === 'image/jpeg')

const stem = (name) => (name ?? '').replace(/\.[^.]+$/, '').toLowerCase()

const jpegQueue = shuffle(jpegs)
let jpegIndex = 0

const jpegFor = (media) => {
  const match = jpegs.find((file) => stem(file.name) === stem(media?.name))
  if (match) return match
  if (!jpegQueue.length) return sourceMedia
  const file = jpegQueue[jpegIndex % jpegQueue.length]
  jpegIndex += 1
  return file
}

const hasVersion = (pool, documentId, status) =>
  Boolean(pool.get(documentId)?.entries[status])

const keep = (pool, list, status) =>
  list.filter((id) => hasVersion(pool, id, status))

const applyRelation = (current, sourceValue) =>
  OVERWRITE_RELATIONS ? sourceValue : current ?? sourceValue

const plan = []

for (const [documentId, entry] of byId) {
  const draft = entry.entries.draft ?? entry.entries.published
  const published = entry.entries.published ?? entry.entries.draft
  const isSource = documentId === SOURCE_ID

  const currentTags = [...new Set([...ids(draft.tags), ...ids(published.tags)])]
  let nextTags = currentTags
  if (!isSource) {
    const wanted = Math.max(2, currentTags.length)
    const base = currentTags.length ? currentTags : sourceTags
    const extra = shuffle(
      [...tags.keys()].filter((id) => !base.includes(id)),
    ).slice(0, wanted - base.length)
    nextTags = [...new Set([...base, ...extra])]
  }

  const currentMedia = one(draft.featuredMedia) ?? one(published.featuredMedia)
  const needsJpeg = currentMedia?.mime !== 'image/jpeg'
  const media = needsJpeg ? jpegFor(currentMedia) : null

  const sections =
    isSource ||
      ((draft.sections ?? []).length > 0 && !OVERWRITE_SECTIONS)
      ? null
      : sourceSections

  plan.push({
    documentId,
    title: draft.title ?? published.title,
    slug: draft.slug ?? published.slug,
    isSource,
    sections,
    keptSections: (draft.sections ?? []).length,
    media,
    currentMedia,
    tags: nextTags,
    tagsBefore: currentTags.length,
    author: applyRelation(ids(draft.author)[0], sourceAuthor),
    resourceType: applyRelation(ids(draft.resourceType)[0], sourceType),
    audience: applyRelation(ids(draft.audience)[0], sourceAudience),
    parent: ids(draft.parent)[0] ?? sourceParent,
  })
}

const nameOf = (pool, documentId) =>
  documentId ? pool.get(documentId)?.title ?? documentId : '—'

console.log(
  `\n${CLOUD_URL}\nsource: ${sourceEntry.title} (${SOURCE_ID})\n` +
  `library: ${library.length} files, ${jpegs.length} jpeg\n`,
)

console.table(
  plan.map((item) => ({
    insight: item.title?.slice(0, 40),
    src: item.isSource ? 'SOURCE' : '',
    sections: item.sections
      ? `copy ${item.sections.length}`
      : `${item.keptSections} kept`,
    media: item.media
      ? `${item.currentMedia?.mime} → jpeg ${item.media.name}`
      : item.currentMedia
        ? `${item.currentMedia.mime} ok`
        : 'none',
    tags: `${item.tagsBefore} → ${item.tags.length}`,
    author: nameOf(authors, item.author),
    type: nameOf(resourceTypes, item.resourceType),
    audience: nameOf(audiences, item.audience),
    parent: nameOf(pages, item.parent),
  })),
)

if (!APPLY) {
  console.log('\nDry run — nothing written. Re-run with --apply.')
  process.exit(0)
}

for (const item of plan) {
  const entry = byId.get(item.documentId)

  const payload = (status) => {
    const row = entry.entries[status] ?? entry.entries[status === 'draft' ? 'published' : 'draft']
    return {
      title: row?.title ?? item.title,
      slug: item.slug,
      featuredMedia: item.media ? { id: item.media.id } : undefined,
      tags: keep(tags, item.tags, status),
      author: hasVersion(authors, item.author, status) ? item.author : undefined,
      resourceType: hasVersion(resourceTypes, item.resourceType, status)
        ? item.resourceType
        : undefined,
      audience: hasVersion(audiences, item.audience, status)
        ? item.audience
        : undefined,
      parent: hasVersion(pages, item.parent, status) ? item.parent : undefined,
      ...(item.sections ? { sections: item.sections } : {}),
    }
  }

  await api(`/api/insights/${item.documentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: payload('draft') }),
  })
  await api(`/api/insights/${item.documentId}?status=published`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: payload('published') }),
  })
  console.log(`[apply] ${item.title}`)
}

console.log(`\nDone — ${plan.length} insights processed.`)
