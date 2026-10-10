#!/usr/bin/env node

import fs from 'node:fs'

const CLOUD_URL =
  process.env.CLOUD_CMS_URL ?? 'https://original-desk-e673ad0b47.strapiapp.com'

const RICH = 'sections.rich-content-body'

const arg = (name) => {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : null
}

const APPLY = process.argv.includes('--apply')
const SOURCE_ID = arg('source') ?? 'dsjepw80po1cukhpy9ufzcdb'
const TARGET_ID = arg('target') ?? 'dpwl87zr8788z31p53qgkw7a'
const EXAMPLES_ID = arg('examples') ?? 'nepn65qf5ggomt2xb6v4hgji'
const SKIP_EXAMPLES = process.argv.includes('--no-examples')
const PLACEMENT = arg('placement') ?? 'append'

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

const fetchEntry = async (resource, documentId, status) =>
  api(
    `/api/${resource}/${documentId}?status=${status}&populate[sections][populate]=*`,
  )
    .then((body) => body.data ?? null)
    .catch(() => null)

const richSection = (entry) =>
  (entry?.sections ?? []).find((section) => section.__component === RICH) ?? null

const isTable = (html) => /<table[\s>]/i.test(html ?? '')
const isCode = (html) => /<(pre|code)[\s>]/i.test(html ?? '')
const isTableOrCode = (html) => isTable(html) || isCode(html)

const isKept = (block) =>
  block.type === 'audio' ||
  (block.type === 'wysiwyg' && isTableOrCode(block.content))

const label = (block) => {
  if (block.type !== 'wysiwyg') return block.type
  if (isTable(block.content)) return 'wysiwyg(table)'
  if (isCode(block.content)) return 'wysiwyg(code)'
  return 'wysiwyg'
}

const describe = (blocks) => blocks.map(label).join(' | ') || '—'

const [sourceDraft, sourcePublished] = await Promise.all([
  fetchEntry('case-studies', SOURCE_ID, 'draft'),
  fetchEntry('case-studies', SOURCE_ID, 'published'),
])

const sourceSection = richSection(sourceDraft) ?? richSection(sourcePublished)
if (!sourceSection) {
  console.error(`Source ${SOURCE_ID} has no ${RICH} section.`)
  process.exit(1)
}

const copied = (sourceSection.blocks ?? []).map(writable)

const [targetDraft, targetPublished] = await Promise.all([
  fetchEntry('insights', TARGET_ID, 'draft'),
  fetchEntry('insights', TARGET_ID, 'published'),
])

const target = targetDraft ?? targetPublished
if (!target) {
  console.error(`Target insight ${TARGET_ID} not found.`)
  process.exit(1)
}

const targetSection = richSection(target)
const kept = (targetSection?.blocks ?? []).filter(isKept).map(writable)
const dropped = (targetSection?.blocks ?? []).filter((block) => !isKept(block))

const [examplesDraft, examplesPublished] = SKIP_EXAMPLES
  ? [null, null]
  : await Promise.all([
    fetchEntry('insights', EXAMPLES_ID, 'draft'),
    fetchEntry('insights', EXAMPLES_ID, 'published'),
  ])

const examplesSection = richSection(examplesDraft) ?? richSection(examplesPublished)
const keptContents = new Set(kept.map((block) => block.content ?? ''))

const examples = (examplesSection?.blocks ?? [])
  .filter((block) => isTableOrCode(block.content))
  .filter((block) => !keptContents.has(block.content ?? ''))
  .sort(
    (a, b) =>
      (isTable(a.content) ? 0 : 1) - (isTable(b.content) ? 0 : 1),
  )
  .map(writable)

const blocks =
  PLACEMENT === 'prepend'
    ? [...kept, ...examples, ...copied]
    : [...copied, ...kept, ...examples]

const ownSections = (target.sections ?? []).filter(
  (section) => section.__component !== RICH,
)
const richOut = {
  ...(targetSection ?? sourceSection),
  __component: RICH,
  blocks,
}
const sections = targetSection
  ? (target.sections ?? []).map((section) =>
    section.__component === RICH ? richOut : section,
  )
  : [...ownSections, richOut]

console.log(
  `\nsource case study : ${sourceDraft?.title ?? sourcePublished?.title}`,
)
console.log(`source blocks     : ${describe(copied)}`)
console.log(`\ntarget insight    : ${target.title}`)
console.log(`target blocks     : ${describe(targetSection?.blocks ?? [])}`)
console.log(`kept (audio/table/code): ${describe(kept)}`)
console.log(`dropped                : ${describe(dropped)}`)
console.log(
  `examples (${EXAMPLES_ID}): ${describe(examples)}${examplesSection ? '' : ' — none found'
  }`,
)
console.log(`\nresult (${PLACEMENT})  : ${describe(blocks)}`)
console.log(
  `other sections    : ${describe(
    ownSections.map((section) => ({ type: section.__component })),
  )}`,
)

if (!APPLY) {
  console.log('\nDry run — nothing written. Re-run with --apply.')
  process.exit(0)
}

const payload = (status) => {
  const entry = status === 'draft' ? targetDraft : targetPublished
  return {
    title: entry?.title ?? target.title,
    slug: target.slug,
    sections: sections.map(writable),
  }
}

for (const status of ['draft', 'published']) {
  const data = payload(status)
  const suffix = status === 'published' ? '?status=published' : ''
  await api(`/api/insights/${TARGET_ID}${suffix}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })
  console.log(`[apply] insight ${status} — ${data.sections.length} sections`)
}
