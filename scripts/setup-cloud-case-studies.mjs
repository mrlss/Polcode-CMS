#!/usr/bin/env node

import fs from 'node:fs'

const CLOUD_URL =
  process.env.CLOUD_CMS_URL ?? 'https://original-desk-e673ad0b47.strapiapp.com'

const arg = (name) => {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : null
}

const APPLY = process.argv.includes('--apply')
const OVERWRITE_SECTIONS = process.argv.includes('--overwrite-sections')
const SOURCE_ID = arg('source') ?? 'dsjepw80po1cukhpy9ufzcdb'
const PARENT_SLUG = arg('parent') ?? 'case-studies'
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

const candidateTokens = [
  ['CLOUD_ADMIN_TOKEN', process.env.CLOUD_ADMIN_TOKEN ?? strapiEnv.CLOUD_ADMIN_TOKEN],
  ['STRAPI_ADMIN_TOKEN', strapiEnv.STRAPI_ADMIN_TOKEN],
  ['STRAPI_API_TOKEN', strapiEnv.STRAPI_API_TOKEN],
  ['frontend STRAPI_ACCESS_TOKEN', frontendEnv.STRAPI_ACCESS_TOKEN],
].filter(([, value]) => Boolean(value))

const authorizes = async (value) => {
  try {
    const response = await fetch(
      `${CLOUD_URL}/api/services?pagination[pageSize]=1`,
      { headers: { Authorization: `Bearer ${value}` } },
    )
    return response.ok
  } catch {
    return false
  }
}

let token = null
let tokenSource = null
for (const [label, value] of candidateTokens) {
  if (await authorizes(value)) {
    token = value
    tokenSource = label
    break
  }
}

if (!token) {
  console.error(
    `No candidate token can read ${CLOUD_URL} — checked: ${candidateTokens
      .map(([label]) => label)
      .join(', ')}.`,
  )
  process.exit(1)
}

console.log(`token: ${tokenSource}`)

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

const readPools = async (resource, populate = '') => {
  const suffix = (status) =>
    `/api/${resource}?pagination[pageSize]=200&status=${status}${populate ? `&${populate}` : ''
    }`

  const [drafts, published] = await Promise.all([
    api(suffix('draft')).then((r) => r.data ?? []),
    api(suffix('published')).then((r) => r.data ?? []),
  ])

  const pool = new Map()
  for (const [entry, status] of [
    ...drafts.map((e) => [e, 'draft']),
    ...published.map((e) => [e, 'published']),
  ]) {
    const current = pool.get(entry.documentId) ?? { entries: {} }
    current.entries[status] = entry
    current.title = entry.title ?? entry.name
    current.slug = entry.slug
    pool.set(entry.documentId, current)
  }
  return pool
}

const casePopulate = [
  'populate[parent]=true',
  'populate[industries]=true',
  'populate[regions]=true',
  'populate[services]=true',
  'populate[techStack]=true',
  'populate[sections][populate]=*',
].join('&')

const log = (message) =>
  console.log(APPLY ? `[apply] ${message}` : `[dry]   ${message}`)

const [caseStudies, services, techStacks, industries, regions, pages] =
  await Promise.all([
    readPools('case-studies', casePopulate),
    readPools('services', 'populate[caseStudies]=true&populate[techStack]=true'),
    readPools('tech-stacks'),
    readPools('industries'),
    readPools('regions'),
    readPools('pages'),
  ])

const source = caseStudies.get(SOURCE_ID)
if (!source)
  throw new Error(`Source case study ${SOURCE_ID} not found on the cloud`)
if (!services.size) throw new Error('No services found')

const parent = [...pages.entries()].find(
  ([, entry]) => entry.slug === PARENT_SLUG,
)?.[0]

const sourceEntry = source.entries.draft ?? source.entries.published
const sourceSections = (sourceEntry.sections ?? []).map(writable)
const sourceIndustries = ids(sourceEntry.industries)[0]
const sourceRegions = ids(sourceEntry.regions)[0]

const hasVersion = (pool, documentId, wanted) =>
  Boolean(pool.get(documentId)?.entries[wanted])

const keep = (pool, list, wanted) =>
  list.filter((id) => hasVersion(pool, id, wanted))

const serviceIds = [...services.keys()]
const techIds = [...techStacks.keys()]
const industryIds = [...industries.keys()]
const regionIds = [...regions.keys()]

const pickOne = (pool, fallback) =>
  pool.length ? shuffle(pool)[0] : fallback ?? null

const caseStudyPlan = []
const serviceLinks = new Map(serviceIds.map((id) => [id, new Set()]))

for (const [documentId, entry] of caseStudies) {
  const draft = entry.entries.draft ?? entry.entries.published
  const published = entry.entries.published ?? entry.entries.draft

  const currentServices = [
    ...new Set([...ids(draft.services), ...ids(published.services)]),
  ]
  const nextServices = currentServices.length
    ? currentServices
    : shuffle(serviceIds).slice(0, between(1, 3))

  const currentTech = [
    ...new Set([...ids(draft.techStack), ...ids(published.techStack)]),
  ]
  const nextTech = currentTech.length
    ? currentTech
    : shuffle(techIds).slice(0, between(2, 4))

  const copySections =
    documentId !== SOURCE_ID &&
    ((draft.sections ?? []).length === 0 || OVERWRITE_SECTIONS)

  const currentIndustries = ids(draft.industries)[0]
  const currentRegions = ids(draft.regions)[0]

  caseStudyPlan.push({
    documentId,
    title: entry.title,
    slug: entry.slug,
    parent: ids(draft.parent)[0] ?? parent,
    industries: currentIndustries ?? pickOne(industryIds, sourceIndustries),
    regions: currentRegions ?? pickOne(regionIds, sourceRegions),
    industriesKept: Boolean(currentIndustries),
    regionsKept: Boolean(currentRegions),
    services: nextServices,
    techStack: nextTech,
    sections: copySections ? sourceSections : null,
    copySections,
    keptSections: (draft.sections ?? []).length,
  })

  for (const service of nextServices) serviceLinks.get(service)?.add(documentId)
}

const servicePlan = []

for (const [documentId, entry] of services) {
  const draft = entry.entries.draft ?? entry.entries.published
  const published = entry.entries.published ?? entry.entries.draft

  const currentCases = [
    ...new Set([...ids(draft.caseStudies), ...ids(published.caseStudies)]),
  ]
  let nextCases = currentCases.length
    ? [...new Set([...currentCases, ...(serviceLinks.get(documentId) ?? [])])]
    : shuffle([...caseStudies.keys()]).slice(0, between(1, 3))

  if (nextCases.length < 2) {
    const extra = shuffle(
      [...caseStudies.keys()].filter((id) => !nextCases.includes(id)),
    ).slice(0, 2 - nextCases.length)
    nextCases = [...nextCases, ...extra]
  }

  const currentTech = [
    ...new Set([...ids(draft.techStack), ...ids(published.techStack)]),
  ]
  const fromCases = [
    ...new Set(
      nextCases.flatMap((id) => {
        const planned = caseStudyPlan.find((item) => item.documentId === id)
        return (
          planned?.techStack ??
          ids(caseStudies.get(id)?.entries.draft?.techStack)
        )
      }),
    ),
  ]
  const nextTech = [
    ...new Set([...currentTech, ...fromCases]),
  ].slice(0, 6)

  servicePlan.push({
    documentId,
    title: entry.title,
    slug: entry.slug,
    caseStudies: nextCases,
    techStack: nextTech,
    changed:
      nextCases.length !== currentCases.length ||
      nextTech.length !== currentTech.length ||
      nextTech.some((id) => !currentTech.includes(id)),
  })
}

const titleOf = (pool, documentId) => pool.get(documentId)?.title ?? documentId

console.log(
  `\n${CLOUD_URL}\nsource: ${source.title} (${SOURCE_ID})\nparent: ${parent
    ? `${titleOf(pages, parent)} (${parent})`
    : 'NOT FOUND — pass --parent=<slug>'
  }\n`,
)

console.table(
  caseStudyPlan.map((item) => ({
    caseStudy: item.title,
    parent: item.parent ? titleOf(pages, item.parent) : '—',
    industries: item.industries
      ? `${titleOf(industries, item.industries)}${item.industriesKept ? '' : ' *'}`
      : '—',
    regions: item.regions
      ? `${titleOf(regions, item.regions)}${item.regionsKept ? '' : ' *'}`
      : '—',
    services: item.services.map((id) => titleOf(services, id)).join(', ') || '—',
    techStack:
      item.techStack.map((id) => titleOf(techStacks, id)).join(', ') || '—',
    sections: item.copySections ? `copy ${item.sections.length}` : `${item.keptSections} kept`,
  })),
)

console.table(
  servicePlan.map((item) => ({
    service: item.title,
    caseStudies:
      item.caseStudies.map((id) => titleOf(caseStudies, id)).join(', ') || '—',
    techStack:
      item.techStack.map((id) => titleOf(techStacks, id)).join(', ') || '—',
    write: item.changed ? 'yes' : 'no',
  })),
)

if (!APPLY) {
  console.log('\nDry run — nothing written. Re-run with --apply.')
  process.exit(0)
}

const put = async (resource, documentId, status, data) =>
  api(
    `/api/${resource}/${documentId}${status === 'published' ? '?status=published' : ''
    }`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    },
  )

for (const item of caseStudyPlan) {
  const payload = (wanted) => ({
    title: item.title,
    slug: item.slug,
    parent: hasVersion(pages, item.parent, wanted) ? item.parent : undefined,
    industries: hasVersion(industries, item.industries, wanted)
      ? item.industries
      : undefined,
    regions: hasVersion(regions, item.regions, wanted)
      ? item.regions
      : undefined,
    services: keep(services, item.services, wanted),
    techStack: keep(techStacks, item.techStack, wanted),
    ...(item.copySections ? { sections: item.sections } : {}),
  })

  await put('case-studies', item.documentId, 'draft', payload('draft'))
  await put('case-studies', item.documentId, 'published', payload('published'))
  log(`case study ${item.title}`)
}

for (const item of servicePlan) {
  if (!item.changed) {
    log(`service ${item.title} — already complete`)
    continue
  }

  const payload = (wanted) => ({
    title: item.title,
    slug: item.slug,
    caseStudies: keep(caseStudies, item.caseStudies, wanted),
    techStack: keep(techStacks, item.techStack, wanted),
  })

  await put('services', item.documentId, 'draft', payload('draft'))
  await put('services', item.documentId, 'published', payload('published'))
  log(`service ${item.title}`)
}

console.log(
  `\nDone — ${caseStudyPlan.length} case studies and ${servicePlan.length} services processed.`,
)
