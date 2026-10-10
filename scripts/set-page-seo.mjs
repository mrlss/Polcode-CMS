#!/usr/bin/env node

import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import qs from 'qs'

const here = path.dirname(fileURLToPath(import.meta.url))
const STRAPI = path.resolve(here, '..')
const FRONTEND = path.resolve(STRAPI, '..', 'frontend')

const APPLY = process.argv.includes('--apply')
const FORCE_IMAGE = process.argv.includes('--force-image')
const SOCIAL_IMAGE_FILE = path.join(FRONTEND, 'public', 'social.jpg')

function readEnv(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const env = {
  ...readEnv(path.join(STRAPI, '.env')),
  ...readEnv(path.join(FRONTEND, '.env')),
  ...readEnv(path.join(FRONTEND, '.env.local')),
}
const API = (env.NEXT_PUBLIC_CMS_URL || 'http://localhost:1337').replace(
  /\/$/,
  ''
)
const TOKEN = env.STRAPI_ACCESS_TOKEN || env.STRAPI_API_TOKEN
if (!TOKEN) {
  console.error('no STRAPI token found in strapi/.env or frontend/.env')
  process.exit(1)
}

const PAGES = [
  {
    slug: 'index',
    label: '/',
    metaTitle: 'Polcode — Software Development Partner for Product Teams',
    metaDescription:
      'Polcode builds and modernizes web, mobile and data platforms for product teams — 18 years in business, 750+ delivered projects, senior-only engineers.',
  },
  {
    slug: 'services',
    label: '/services',
    metaTitle: 'Software Development Services | Polcode',
    metaDescription:
      'Web, mobile, cloud and data engineering services: product design, frontend and backend development, legacy modernization, QA automation and dedicated teams.',
  },
  {
    slug: 'case-studies',
    label: '/case-studies',
    metaTitle: 'Software Development Case Studies | Polcode',
    metaDescription:
      'Real projects we delivered: e-commerce platforms, fintech systems, healthtech portals and legacy modernizations — the challenge, our approach and the results.',
  },
  {
    slug: 'resources',
    label: '/resources',
    metaTitle: 'Resources — Articles, Podcasts & eBooks | Polcode',
    metaDescription:
      'Practical guides from our engineers: modernizing legacy systems, scaling product teams, QA automation, data platforms and everything in between.',
  },
  {
    slug: 'contact-us',
    label: '/contact-us',
    metaTitle: 'Contact Polcode — Start Your Software Project',
    metaDescription:
      'Tell us about your project and book a free consultation with our engineering team. We reply within one business day, no obligation attached.',
  },
].map((page) => ({
  ...page,
  metaDescription: page.metaDescription.endsWith('.')
    ? page.metaDescription
    : `${page.metaDescription}.`,
}))

function loadSchemas() {
  const schemas = {}
  const apiDir = path.join(STRAPI, 'src', 'api')
  for (const name of fs.readdirSync(apiDir)) {
    const file = path.join(apiDir, name, 'content-types', name, 'schema.json')
    if (fs.existsSync(file)) {
      schemas[`api::${name}.${name}`] = JSON.parse(
        fs.readFileSync(file, 'utf8')
      )
    }
  }
  const compRoot = path.join(STRAPI, 'src', 'components')
  for (const cat of fs.readdirSync(compRoot)) {
    const dir = path.join(compRoot, cat)
    if (!fs.statSync(dir).isDirectory()) continue
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue
      schemas[`${cat}.${file.replace(/\.json$/, '')}`] = JSON.parse(
        fs.readFileSync(path.join(dir, file), 'utf8')
      )
    }
  }
  return schemas
}

const SCHEMAS = loadSchemas()
const PAGE_UID = 'api::page.page'
const MAX_DEPTH = 7

function populateNode(uid, depth = 0) {
  const schema = SCHEMAS[uid]
  if (!schema || depth > MAX_DEPTH) return {}
  const populate = {}
  for (const [name, attr] of Object.entries(schema.attributes ?? {})) {
    if (attr.type === 'component') {
      populate[name] = { populate: populateNode(attr.component, depth + 1) }
    } else if (attr.type === 'dynamiczone') {
      const on = {}
      for (const comp of attr.components ?? []) {
        const spec = populateNode(comp, depth + 1)
        on[comp] = Object.keys(spec).length ? { populate: spec } : {}
      }
      populate[name] = { on }
    } else if (attr.type === 'media' || attr.type === 'relation') {
      populate[name] = true
    }
  }
  return populate
}

const BASE_FIELDS = [
  'id',
  'documentId',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'locale',
]

async function request(method, pathname, { query, body, form } = {}) {
  const url = `${API}/api/${pathname}${query ? `?${qs.stringify(query, { encodeValuesOnly: true })}` : ''
    }`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(form ? {} : { 'Content-Type': 'application/json' }),
    },
    body: form ?? (body ? JSON.stringify(body) : undefined),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text.slice(0, 400) }
  }
  if (!res.ok) {
    throw new Error(
      `${method} ${res.status} ${pathname} :: ${JSON.stringify(json).slice(
        0,
        500
      )}`
    )
  }
  return json
}

function toPayload(uid, data, { dropId = false, dropAllIds = false } = {}) {
  const schema = SCHEMAS[uid]
  const out = {}
  if (!dropId && data.id !== undefined) out.id = data.id
  for (const [name, attr] of Object.entries(schema?.attributes ?? {})) {
    const value = data[name]
    if (value === undefined) continue
    if (attr.type === 'media') {
      if (value === null) out[name] = null
      else if (Array.isArray(value)) out[name] = value.map((m) => ({ id: m.id }))
      else out[name] = { id: value.id }
    } else if (attr.type === 'relation') {
      if (value === null) out[name] = null
      else if (Array.isArray(value)) out[name] = value.map((r) => ({ id: r.id }))
      else out[name] = { id: value.id }
    } else if (attr.type === 'component') {
      const child = { dropId: dropAllIds, dropAllIds }
      if (attr.repeatable)
        out[name] = (value ?? []).map((v) => toPayload(attr.component, v, child))
      else
        out[name] =
          value === null ? null : toPayload(attr.component, value, child)
    } else if (attr.type === 'dynamiczone') {
      out[name] = (value ?? []).map((v) => ({
        __component: v.__component,
        ...toPayload(v.__component, v, { dropId: true, dropAllIds: true }),
      }))
    } else {
      out[name] = value
    }
  }
  return out
}

function fingerprint(uid, data) {
  const out = {}
  const schema = SCHEMAS[uid]
  for (const [name, attr] of Object.entries(schema?.attributes ?? {})) {
    const value = data[name]
    if (value === undefined) continue
    if (BASE_FIELDS.includes(name)) continue
    if (attr.type === 'media') {
      out[name] = value
        ? Array.isArray(value)
          ? value.map((m) => m?.name ?? m?.originalFilename ?? null)
          : (value.name ?? value.originalFilename ?? null)
        : null
    } else if (attr.type === 'relation') {
      out[name] = Array.isArray(value)
        ? value.map((r) => r?.id)
        : (value?.id ?? null)
    } else if (attr.type === 'component') {
      const items = attr.repeatable ? (value ?? []) : value ? [value] : []
      out[name] = items.map((v) => fingerprint(attr.component, v))
    } else if (attr.type === 'dynamiczone') {
      out[name] = (value ?? []).map((v) => ({
        __component: v.__component,
        ...fingerprint(v.__component, v),
      }))
    } else {
      out[name] = value
    }
  }
  return out
}

function deepDiff(a, b, trail = '', acc = []) {
  if (a === b) return acc
  const bothObjects = a && b && typeof a === 'object' && typeof b === 'object'
  if (!bothObjects) {
    acc.push(
      `${trail}: ${JSON.stringify(a)?.slice(0, 70)} -> ${JSON.stringify(
        b
      )?.slice(0, 70)}`
    )
    return acc
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if (key === 'id' || key === '__component') continue
    deepDiff(a[key], b[key], trail ? `${trail}.${key}` : key, acc)
  }
  return acc
}

async function ensureSocialImage() {
  const found = await request('GET', 'upload/files', {
    query: {
      filters: { name: { $eq: 'social.jpg' } },
      sort: ['id:desc'],
    },
  })
  const hit = Array.isArray(found) ? found[0] : null
  if (hit && !FORCE_IMAGE) return { id: hit.id, created: false }

  if (!fs.existsSync(SOCIAL_IMAGE_FILE)) {
    throw new Error(`missing ${SOCIAL_IMAGE_FILE}`)
  }
  const buffer = fs.readFileSync(SOCIAL_IMAGE_FILE)
  if (!APPLY) return { id: hit?.id ?? null, created: true, dry: true }

  const form = new FormData()
  form.append('files', new Blob([buffer], { type: 'image/jpeg' }), 'social.jpg')
  form.append(
    'fileInfo',
    JSON.stringify({
      name: 'social.jpg',
      alternativeText: 'Polcode — software development partner',
    })
  )
  const uploaded = await request('POST', 'upload', { form })
  const media = Array.isArray(uploaded) ? uploaded[0] : uploaded
  return { id: media.id, created: true }
}

async function readVersion(documentId, status) {
  const res = await request('GET', `pages/${documentId}`, {
    query: { status, populate: populateNode(PAGE_UID) },
  })
  return res.data
}

async function writeVersion(documentId, status, mutate) {
  let lastError = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await readVersion(documentId, status)
      const copy = JSON.parse(JSON.stringify(raw))
      mutate(copy)
      const payload = toPayload(PAGE_UID, copy, {
        dropId: true,
        dropAllIds: true,
      })
      await request('PUT', `pages/${documentId}`, {
        query: { status },
        body: { data: payload },
      })
      const after = await readVersion(documentId, status)
      return {
        before: fingerprint(PAGE_UID, raw),
        seo: after.seo,
        diffs: deepDiff(
          fingerprint(PAGE_UID, raw),
          fingerprint(PAGE_UID, after)
        ),
      }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

async function findPage(slug) {
  for (const status of ['published', 'draft']) {
    const res = await request('GET', 'pages', {
      query: {
        status,
        filters: { slug: { $eq: slug } },
        fields: ['slug', 'title'],
        pagination: { limit: 5 },
      },
    })
    const hit = res.data?.[0]
    if (hit) return { documentId: hit.documentId, foundIn: status }
  }
  return null
}

async function run() {
  console.log(`api   : ${API}`)
  console.log(`mode  : ${APPLY ? 'APPLY' : 'dry run'}`)
  console.log(`image : ${SOCIAL_IMAGE_FILE}`)

  const image = await ensureSocialImage()
  console.log(
    `social: ${image.id
      ? image.created
        ? `upload (id ${image.id}${image.dry ? ', pending --apply' : ''})`
        : `existing media id ${image.id}`
      : 'not found — pass --apply to upload'
    }`
  )

  const seo = (page) => ({
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    socialImage: image.id ? { id: image.id } : undefined,
  })

  for (const page of PAGES) {
    const found = await findPage(page.slug)
    if (!found) {
      console.log(`\n${page.label} (slug ${page.slug}) — NOT FOUND`)
      continue
    }
    console.log(`\n${page.label} (slug ${page.slug}, ${found.documentId})`)
    console.log(`  title: ${page.metaTitle}`)
    console.log(`  desc : ${page.metaDescription} (${page.metaDescription.length})`)
    if (!APPLY) continue

    for (const status of ['draft', 'published']) {
      try {
        const result = await writeVersion(found.documentId, status, (copy) => {
          copy.seo = { ...(copy.seo ?? {}), ...seo(page) }
        })
        const unexpected = result.diffs.filter((d) => !d.startsWith('seo'))
        console.log(
          `  ${status.padEnd(9)} ok — title="${result.seo?.metaTitle}" image=${result.seo?.socialImage?.name ?? 'none'
          } otherDiffs=${unexpected.length}`
        )
        unexpected.slice(0, 6).forEach((d) => console.log(`    ! ${d}`))
      } catch (error) {
        console.log(`  ${status.padEnd(9)} FAILED — ${error.message.slice(0, 220)}`)
      }
    }
  }

  if (!APPLY) console.log('\ndry run — pass --apply to write')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
