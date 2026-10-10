#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const CLOUD_URL =
  process.env.CLOUD_CMS_URL ?? 'https://original-desk-e673ad0b47.strapiapp.com'
const SCHEMA = 'src/api/service/content-types/service/schema.json'
const COMPONENTS = 'src/components'

const arg = (name) => {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : null
}

const APPLY = process.argv.includes('--apply')
const VERIFY_ONLY = process.argv.includes('--verify-only')
const ALL = process.argv.includes('--all')
const FROM_ID = arg('from-id') ?? 'yf5wf9v2xnqy2lxrhkuy61ar'
const FIELD = arg('field') ?? 'sections'
let TYPES = (arg('types') ?? 'content-numerated,content-color-boxes')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const ONLY = (arg('to') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const EXCEPT = (arg('except') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(
    [
      'Usage: node scripts/copy-service-blocks.mjs [options]',
      '',
      'Copies Numbered Content and Color Boxes from one service into every other',
      'service. A target keeps its section order and its other sections; its own',
      'section of a copied type is replaced in place (extra duplicates are dropped,',
      "a missing one is inserted where the source has it). Nested repeatables — a",
      "color box's Items (`boxes[].blocks`) — are copied and verified by reading",
      'every target back after the write. Dry run unless --apply.',
      '',
      'Options:',
      `  --from-id=<id>     source documentId (default ${FROM_ID})`,
      '  --types=a,b        section types to copy (default content-numerated,',
      '                     content-color-boxes)',
      '  --all              copy the whole sections zone in the source order',
      '                     (every type, nested items, headings, pickers)',
      '  --to=slug,slug     only these target slugs (default: every other service)',
      '  --except=id,slug   never touch these targets (documentId or slug)',
      '  --field=sections   zone field (default sections)',
      '  --apply            write the changes',
      '  --verify-only      read-only: report the nested counts of every service',
    ].join('\n'),
  )
  process.exit(0)
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

const request = async (method, suffix, data, token) => {
  const response = await fetch(`${CLOUD_URL}${suffix}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  })
  const text = await response.text()
  let body = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { status: response.status, ok: response.ok, body }
}

const canRead = async (value) => {
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
for (const [label, value] of candidates) {
  if (await canRead(value)) {
    token = value
    console.log(`token: ${label}`)
    break
  }
}

if (!token) {
  console.error('No candidate token can read the cloud CMS.')
  process.exit(1)
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))

const componentSchema = (uid) =>
  readJson(path.join(COMPONENTS, `${uid.replace('.', '/')}.json`))

const leafPopulate = (uid, prefix, output, trail) => {
  for (const [name, attribute] of Object.entries(
    componentSchema(uid).attributes ?? {},
  )) {
    if (attribute.type === 'component') {
      if (trail.includes(attribute.component)) continue
      leafPopulate(
        attribute.component,
        `${prefix}[${name}][populate]`,
        output,
        [...trail, attribute.component],
      )
      continue
    }
    if (attribute.type === 'media' || attribute.type === 'relation') {
      output.push(`${prefix}[${name}]=true`)
    }
  }
}

const populate = []
for (const uid of readJson(SCHEMA).attributes[FIELD].components) {
  leafPopulate(uid, `populate[${FIELD}][on][${uid}][populate]`, populate, [uid])
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

const isEntry = (value) =>
  value &&
  typeof value === 'object' &&
  typeof value.documentId === 'string' &&
  value.id !== undefined

const componentAttributes = (uid) => componentSchema(uid).attributes ?? {}

const relationRef = (row) => {
  const id = row?.documentId ?? row?.id
  return id === undefined ? null : { documentId: id }
}

const writable = (value, uid) => {
  if (Array.isArray(value)) return value.map((item) => writable(item, uid))

  if (value && typeof value === 'object') {
    const attributes = uid ? componentAttributes(uid) : {}
    const output = {}

    if (typeof value.__component === 'string') {
      output.__component = value.__component
    }

    for (const [key, item] of Object.entries(value)) {
      if (key === '__component' || DROP_KEYS.has(key)) continue

      if (item === null || item === undefined) {
        output[key] = item ?? null
        continue
      }

      const attribute = attributes[key]

      if (attribute?.type === 'component') {
        output[key] = Array.isArray(item)
          ? item.map((child) => writable(child, attribute.component))
          : writable(item, attribute.component)
        continue
      }

      if (attribute?.type === 'media') {
        output[key] = Array.isArray(item)
          ? item.map((row) => (row?.id === undefined ? row : { id: row.id }))
          : isMedia(item) || isEntry(item)
            ? { id: item.id }
            : item
        continue
      }

      if (attribute?.type === 'relation') {
        const rows = Array.isArray(item) ? item : [item]
        output[key] = { set: rows.map(relationRef).filter(Boolean) }
        continue
      }

      output[key] = item
    }

    return output
  }

  return value
}

const writableSection = (section) => {
  const encoded = writable(section, section?.__component)
  if (!encoded || typeof encoded !== 'object' || Array.isArray(encoded)) {
    return encoded
  }
  return { __component: section.__component, ...encoded }
}

const stable = (value) => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

const typeOf = (section) =>
  (section?.__component ?? '').replace(/^sections\./, '')

const fetchDeep = async (documentId, status) => {
  const suffix = `/api/services/${documentId}?status=${status}&${populate.join('&')}`
  const response = await request('GET', suffix, null, token)
  if (!response.ok) {
    console.error(`GET ${suffix} → HTTP ${response.status}`)
    console.error(JSON.stringify(response.body).slice(0, 300))
    return null
  }
  return response.body?.data ?? null
}

const readEntry = async (documentId) => {
  const draft = await fetchDeep(documentId, 'draft')
  if (draft?.[FIELD]?.length) return { entry: draft, status: 'draft' }
  const published = await fetchDeep(documentId, 'published')
  if (published) return { entry: published, status: 'published' }
  return { entry: draft, status: 'draft' }
}

const describeSection = (section) => {
  const type = typeOf(section)
  if (type === 'content-color-boxes') {
    const boxes = section.boxes ?? []
    return `content-color-boxes boxes=${boxes.length} items=[${boxes
      .map((box) => (box.blocks ?? []).length)
      .join(',')}]`
  }

  const parts = []
  for (const [key, value] of Object.entries(section ?? {})) {
    if (key === '__component' || value === null || value === undefined) continue
    if (typeof value !== 'object') continue
    if (Array.isArray(value)) {
      if (value.length) parts.push(`${key}=${value.length}`)
      continue
    }
    parts.push(isMedia(value) || isEntry(value) ? `${key}=1` : `${key}✓`)
  }

  return `${type}${parts.length ? ` (${parts.join(' ')})` : ''}`
}

const nestedGaps = (section) => {
  if (typeOf(section) !== 'content-color-boxes') return []
  const boxes = section.boxes ?? []
  if (!boxes.length) return []
  const missing = boxes.filter((box) => !Array.isArray(box.blocks))
  return missing.length === boxes.length
    ? ['every color box came back without its `blocks` — populate is incomplete']
    : []
}

const insertionIndex = (list, type, order) => {
  const at = order.indexOf(type)
  for (let index = 0; index < list.length; index += 1) {
    const other = order.indexOf(typeOf(list[index]))
    if (other !== -1 && other > at) return index
  }
  return list.length
}

const mergeSections = (targetSections, sourceByType, sourceOrder, wholeZone) => {
  if (wholeZone) {
    const kept = new Set(wholeZone.map(typeOf))
    const dropped = [...new Set(targetSections.map(typeOf))].filter(
      (type) => !kept.has(type),
    )
    const plan = [
      `replaced the whole zone with the source's ${wholeZone.length} sections`,
    ]
    if (dropped.length) plan.push(`drops: ${dropped.join(', ')}`)
    return { sections: wholeZone, plan }
  }

  const selected = new Set(TYPES)
  const used = new Set()
  const plan = []
  const output = []

  for (const section of targetSections) {
    const type = typeOf(section)
    if (!selected.has(type)) {
      output.push(section)
      continue
    }
    const replacement = sourceByType.get(type)
    if (!replacement) {
      output.push(section)
      continue
    }
    if (used.has(type)) {
      plan.push(`dropped extra ${type} at index ${output.length}`)
      continue
    }
    used.add(type)
    output.push(replacement)
    plan.push(`replaced ${type} at index ${output.length - 1}`)
  }

  for (const type of TYPES) {
    if (used.has(type)) continue
    const replacement = sourceByType.get(type)
    if (!replacement) {
      plan.push(`no source section of type ${type}`)
      continue
    }
    const at = insertionIndex(output, type, sourceOrder)
    output.splice(at, 0, replacement)
    plan.push(`inserted ${type} at index ${at}`)
  }

  return { sections: output, plan }
}

const byType = (sections) => {
  const map = new Map()
  for (const section of sections ?? []) {
    const type = typeOf(section)
    map.set(type, [...(map.get(type) ?? []), stable(writableSection(section))])
  }
  return map
}

const list = await request(
  'GET',
  '/api/services?pagination[pageSize]=200&fields[0]=slug&fields[1]=title',
  null,
  token,
)

if (!list.ok) {
  console.error(`Cannot list services (HTTP ${list.status}).`)
  process.exit(1)
}

const entries = list.body?.data ?? []
if (!entries.length) {
  console.error('No service entries returned.')
  process.exit(1)
}

const sourceRef = entries.find((entry) => entry.documentId === FROM_ID)

if (!sourceRef) {
  console.error(`Source service ${FROM_ID} not found.`)
  process.exit(1)
}

const { entry: sourceEntry, status: sourceStatus } = await readEntry(
  sourceRef.documentId,
)
const sourceSections = sourceEntry?.[FIELD] ?? []

if (!sourceSections.length) {
  console.error(`Source service "${sourceRef.slug}" has no ${FIELD}.`)
  process.exit(1)
}

if (ALL) {
  TYPES = [...new Set(sourceSections.map(typeOf))]
}

const sourceByType = new Map()
for (const type of TYPES) {
  const section = sourceSections.find((item) => typeOf(item) === type)
  if (section) sourceByType.set(type, section)
}

const sourceOrder = sourceSections.map(typeOf)

console.log(
  `\nsource: ${sourceRef.slug} (${sourceRef.documentId}, ${sourceStatus})`,
)
console.log(`${FIELD}: ${sourceSections.map(describeSection).join(' | ')}`)

const gaps = TYPES.flatMap((type) => {
  const section = sourceSections.find((item) => typeOf(item) === type)
  return section ? nestedGaps(section) : [`no source section of type ${type}`]
})

if (gaps.length) {
  console.error('\nNested content is missing from the source read:')
  for (const gap of gaps) console.error(`  - ${gap}`)
  console.error('Nothing written.')
  process.exit(1)
}

for (const type of TYPES) {
  console.log(`  copies ${describeSection(sourceByType.get(type))}`)
}

const targets = entries.filter((entry) => {
  if (entry.documentId === sourceRef.documentId) return false
  if (EXCEPT.includes(entry.documentId) || EXCEPT.includes(entry.slug)) {
    return false
  }
  if (!ONLY.length) return true
  return ONLY.includes(entry.slug)
})

if (!targets.length) {
  console.error('No target services selected.')
  process.exit(1)
}

if (VERIFY_ONLY) {
  let bad = 0
  for (const target of [sourceRef, ...targets]) {
    const { entry, status } = await readEntry(target.documentId)
    const sections = entry?.[FIELD] ?? []
    const problems = TYPES.flatMap((type) => {
      const section = sections.find((item) => typeOf(item) === type)
      if (!section) return [`${type} missing`]
      return nestedGaps(section)
    })
    if (ALL) {
      const expected = byType(sourceSections)
      const actual = byType(sections)
      const diff = [...expected.keys()].filter(
        (type) =>
          stable(expected.get(type) ?? []) !== stable(actual.get(type) ?? []),
      )
      if (diff.length) {
        problems.push(`differs from the source: ${diff.join(', ')}`)
      }
      if (stable(sections.map(typeOf)) !== stable(sourceSections.map(typeOf))) {
        problems.push('order differs from the source')
      }
    }
    const counts = TYPES.map((type) => {
      const section = sections.find((item) => typeOf(item) === type)
      return section ? describeSection(section) : `${type} missing`
    })
    if (problems.length) bad += 1
    console.log(
      `${problems.length ? '[warn]' : '[ok]  '} ${target.slug} (${status}) — ${counts.join(
        ' · ',
      )}${problems.length ? ` — ${problems.join('; ')}` : ''}`,
    )
  }
  process.exit(bad ? 1 : 0)
}

for (const target of targets) {
  const { entry, status } = await readEntry(target.documentId)
  const beforeSections = entry?.[FIELD] ?? []
  const { sections, plan } = mergeSections(
    beforeSections,
    sourceByType,
    sourceOrder,
    ALL ? sourceSections : null,
  )

  console.log(`\n${target.slug} (${target.documentId}, ${status})`)
  console.log(
    `  before: ${beforeSections.map(describeSection).join(' | ') || '—'}`,
  )
  for (const step of plan) console.log(`  ${step}`)
  console.log(`  after : ${sections.map(describeSection).join(' | ')}`)

  if (!APPLY) continue

  const payload = sections.map(writableSection)

  for (const version of ['draft', 'published']) {
    const suffix = version === 'published' ? '?status=published' : ''
    const response = await request(
      'PUT',
      `/api/services/${target.documentId}${suffix}`,
      { data: { [FIELD]: payload } },
      token,
    )

    if (!response.ok) {
      console.error(
        `  [fail] ${version} PUT → HTTP ${response.status}: ${JSON.stringify(
          response.body,
        ).slice(0, 300)}`,
      )
      continue
    }

    const verify = await fetchDeep(target.documentId, version)
    const after = verify?.[FIELD] ?? []
    const afterTypes = byType(after)
    const payloadTypes = byType(sections)
    const beforeTypes = byType(beforeSections)
    const selected = new Set(TYPES)

    const lost = []
    if (!ALL) {
      for (const [type, fingerprints] of beforeTypes) {
        if (selected.has(type)) continue
        if (stable(fingerprints) !== stable(afterTypes.get(type) ?? [])) {
          lost.push(type)
        }
      }
    }

    const mismatched = TYPES.filter(
      (type) =>
        stable(payloadTypes.get(type) ?? []) !==
        stable(afterTypes.get(type) ?? []),
    )

    const nested = TYPES.flatMap((type) => {
      const section = after.find((item) => typeOf(item) === type)
      return section ? nestedGaps(section) : []
    })

    const problems = [
      ...lost.map((type) => `untouched ${type} changed on write`),
      ...mismatched.map((type) => `${type} differs from the payload after write`),
      ...(ALL && stable(after.map(typeOf)) !== stable(sections.map(typeOf))
        ? ['section order after write differs from the payload']
        : []),
      ...nested,
    ]

    console.log(
      `  ${problems.length ? '[warn]' : '[ok]  '} ${version}: ${after
        .map(describeSection)
        .join(' | ')}${problems.length ? ` — ${problems.join('; ')}` : ''}`,
    )
  }
}

if (!APPLY) {
  console.log('\nDry run — nothing written. Re-run with --apply to copy.')
}
