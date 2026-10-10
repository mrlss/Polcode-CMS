#!/usr/bin/env node

import fs from 'node:fs'

const CLOUD_URL =
  process.env.CLOUD_CMS_URL ?? 'https://original-desk-e673ad0b47.strapiapp.com'

const arg = (name) => {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : null
}

const APPLY = process.argv.includes('--apply')
const FOLDER = arg('folder') ?? '7'
const TYPE = (arg('type') ?? 'article').toLowerCase()
const EXCLUDE = (arg('exclude') ?? 'img016.jpg')
  .split(',')
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean)
const NAMES = (arg('names') ?? '')
  .split(',')
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean)
const MATCH = new RegExp(arg('match') ?? '^img0\\d{2}\\.jpg$', 'i')

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

const listFolder = async () => {
  const filtered = await request(
    `/api/upload/files?filters[folder][id][$eq]=${FOLDER}&pagination[pageSize]=500`,
  ).catch(() => null)
  const direct = Array.isArray(filtered) ? filtered : filtered?.results ?? []
  if (direct.length) return { files: direct, via: `folder=${FOLDER} filter` }

  const all = await request('/api/upload/files?pagination[pageSize]=500').catch(
    () => [],
  )
  const rows = Array.isArray(all) ? all : all?.results ?? []
  return {
    files: rows.filter(
      (file) =>
        String(file.folder?.id ?? file.folder) === String(FOLDER),
    ),
    via: 'folder.id match',
    all: rows,
  }
}

const { files, via, all = [] } = await listFolder()

const byName = new Map()
for (const file of all.length ? all : files) {
  if (file.mime !== 'image/jpeg') continue
  const name = (file.name ?? '').toLowerCase()
  if (EXCLUDE.includes(name)) continue
  if (NAMES.length ? !NAMES.includes(name) : !MATCH.test(name)) continue
  if (!byName.has(name)) byName.set(name, file)
}

const images = [...byName.values()].sort((a, b) =>
  a.name.localeCompare(b.name),
)

console.log(
  `folder ${FOLDER} via API: ${files.length} files (${via}) — the token cannot read upload folders, selecting by name instead`,
)
console.log(
  `usable (${images.length}): ${images.map((f) => f.name).join(', ') || '— none —'}`,
)

if (!images.length) {
  console.error('\nNo usable images.')
  process.exit(1)
}

const POPULATE = 'populate[featuredMedia]=true&populate[resourceType]=true'

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

const skipped = []
let index = 0
const changes = []

for (const entry of draft) {
  const type = one(entry.resourceType)?.slug ?? '—'

  if (type.toLowerCase() !== TYPE) {
    skipped.push({ insight: entry.title?.slice(0, 46), type })
    continue
  }

  const file = images[index % images.length]
  index += 1
  changes.push({ entry, file })
}

if (skipped.length) console.table(skipped)

console.table(
  changes.map(({ entry, file }) => ({
    insight: entry.title?.slice(0, 46),
    current: (one(entry.featuredMedia)?.name ?? 'none').slice(0, 26),
    next: file.name,
  })),
)

if (!APPLY) {
  console.log(`\nDry run — ${changes.length} articles. Re-run with --apply.`)
  process.exit(0)
}

for (const { entry, file } of changes) {
  const row = publishedById.get(entry.documentId)
  const body = (source) =>
    JSON.stringify({
      data: {
        title: source?.title ?? entry.title,
        slug: source?.slug ?? entry.slug,
        featuredMedia: { id: file.id },
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
  console.log(`[apply] ${entry.title} → ${file.name}`)
}

console.log(`\nDone — ${changes.length} article insights updated.`)
