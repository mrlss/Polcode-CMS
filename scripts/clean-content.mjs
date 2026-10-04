import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import qs from 'qs'

const here = path.dirname(fileURLToPath(import.meta.url))
const STRAPI = path.resolve(here, '..')
const FRONTEND = path.resolve(STRAPI, '..', 'frontend')

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const opt = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : null
}

const APPLY = flag('apply')
const VERIFY = flag('verify')
const PROBE = args.some((a) => a === '--probe' || a.startsWith('--probe='))
const PROBE_MODE = opt('probe')
const KEEP_IDS = flag('keep-ids')
const FRESH_NESTED = flag('fresh-nested')
const RESTORE = opt('restore')
const ROUNDTRIP = flag('roundtrip')
const FRESH = flag('fresh')
const FORM_ID = opt('form-id')
const ONLY = (opt('only') ?? '').split(',').filter(Boolean)
const LIMIT = opt('limit') ? Number(opt('limit')) : 0
const SAMPLES = opt('samples') ? Number(opt('samples')) : 6
const STAMP = new Date().toISOString().replace(/[:.]/g, '-')
const BACKUP = path.join(STRAPI, '.tmp', `content-backup-${STAMP}.json`)

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

function loadSchemas() {
  const schemas = {}
  const apiDir = path.join(STRAPI, 'src', 'api')
  for (const name of fs.readdirSync(apiDir)) {
    const file = path.join(apiDir, name, 'content-types', name, 'schema.json')
    if (fs.existsSync(file)) {
      schemas[`api::${name}.${name}`] = JSON.parse(fs.readFileSync(file, 'utf8'))
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

async function request(method, pathname, { query, body } = {}) {
  const url = `${API}/api/${pathname}${query ? `?${qs.stringify(query, { encodeValuesOnly: true })}` : ''}`
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 400) }
  }
  if (!res.ok) {
    throw new Error(
      `${method} ${res.status} ${pathname} :: ${JSON.stringify(json).slice(0, 500)}`
    )
  }
  return json
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'source', 'col'])
const DROP_TAGS = new Set(['span', 'font'])
const ALLOWED_ATTRS = {
  a: new Set(['href', 'target', 'rel', 'title']),
  img: new Set(['src', 'alt', 'width', 'height']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan']),
  ol: new Set(['start']),
  li: new Set(['value']),
  pre: new Set(['class']),
  code: new Set(['class']),
}
const ALLOWED_CLASSES = new Set([
  'wysiwyg-columns',
  'language-js',
  'language-jsx',
  'language-ts',
  'language-tsx',
  'language-html',
  'language-css',
  'language-scss',
  'language-json',
  'language-bash',
  'language-sh',
  'language-php',
  'language-python',
  'language-sql',
  'language-yml',
  'language-yaml',
])

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g

function cleanTag(raw, name) {
  const allowed = ALLOWED_ATTRS[name]
  const attrs = raw.matchAll(
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g
  )
  const keep = []
  for (const m of attrs) {
    const attr = m[1].toLowerCase()
    const value = m[3] ?? m[4] ?? m[5] ?? ''
    if (attr === 'class') {
      const classes = value
        .split(/\s+/)
        .filter((c) => ALLOWED_CLASSES.has(c))
      if (classes.length) keep.push(`class="${classes.join(' ')}"`)
      continue
    }
    if (!allowed || !allowed.has(attr)) continue
    if (!value) continue
    keep.push(`${attr}="${value.replace(/"/g, '&quot;')}"`)
  }
  return keep.length ? `<${name} ${keep.join(' ')}>` : `<${name}>`
}

function cleanHtml(html) {
  if (typeof html !== 'string' || !html.includes('<')) return html
  let out = html.replace(/<!--[\s\S]*?-->/g, '')
  out = out.replace(TAG_RE, (match, slash, rawName) => {
    const name = rawName.toLowerCase()
    if (DROP_TAGS.has(name)) return ''
    if (slash) return VOID_TAGS.has(name) ? '' : `</${name}>`
    return cleanTag(match, name)
  })
  out = out.replace(/&nbsp;/g, ' ')
  out = out.replace(/<br\s*\/?>/gi, '<br>')
  for (let i = 0; i < 3; i += 1) {
    out = out.replace(
      /<(strong|em|u|a)((?:"[^"]*"|'[^']*'|[^>"'])*)>\s*<\/\1>/gi,
      ''
    )
  }
  out = out.replace(/<p>(\s)*<\/p>/gi, '')
  out = out.replace(/<div>(\s)*<\/div>/gi, '')
  out = out.replace(/<p>(PROBE|NESTEDPROBE)<\/p>/g, '')
  out = out.replace(/[ \t]{2,}/g, ' ')
  out = out.replace(/\n{3,}/g, '\n\n')
  return out.trim()
}

function isRichtext(attr) {
  return attr?.customField === 'plugin::ckeditor5.CKEditor'
}

const schemaAttributes = (uid) => SCHEMAS[uid]?.attributes ?? {}

function walk(uid, data, visit) {
  const schema = SCHEMAS[uid]
  if (!schema || !data) return data
  for (const [name, attr] of Object.entries(schema.attributes ?? {})) {
    const value = data[name]
    if (value === undefined || value === null) continue
    if (isRichtext(attr)) {
      visit(data, name, value)
    } else if (attr.type === 'component') {
      if (attr.repeatable) value.forEach((v) => walk(attr.component, v, visit))
      else walk(attr.component, value, visit)
    } else if (attr.type === 'dynamiczone') {
      value.forEach((v) => walk(v.__component, v, visit))
    }
  }
  return data
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
        ...toPayload(v.__component, v, {
          dropId: !KEEP_IDS,
          dropAllIds: FRESH_NESTED,
        }),
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
          ? value.map((m) => m?.originalFilename ?? m?.name ?? null)
          : (value.originalFilename ?? value.name ?? null)
        : null
    } else if (attr.type === 'relation') {
      const ids = Array.isArray(value) ? value.map((r) => r?.id) : value?.id
      out[name] = ids ?? null
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
  const bothObjects =
    a && b && typeof a === 'object' && typeof b === 'object'
  if (!bothObjects) {
    acc.push(`${trail}: ${JSON.stringify(a)?.slice(0, 80)} -> ${JSON.stringify(b)?.slice(0, 80)}`)
    return acc
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if (key === 'id' || key === '__component') continue
    deepDiff(a[key], b[key], trail ? `${trail}.${key}` : key, acc)
  }
  return acc
}

const stats = { entries: 0, versions: 0, fields: 0, changedFields: 0, charsBefore: 0, charsAfter: 0, formIds: 0 }
const samples = []
const planned = []

function summarize(value, max = 90) {
  const s = String(value).replace(/\s+/g, ' ')
  return s.length > max ? `${s.slice(0, max)}…` : s
}

async function prepare(uid, name, documentId, status) {
  const query = { status, populate: populateNode(uid) }
  const res = await request('GET', `${name}/${documentId}`, { query })
  const raw = res.data
  const copy = JSON.parse(JSON.stringify(raw))
  let touched = 0
  walk(uid, copy, (parent, field, value) => {
    const cleaned = cleanHtml(value)
    if (cleaned !== value) {
      touched += 1
      parent[field] = cleaned
    }
  })
  if (FORM_ID) {
    const applyFormId = (node) => {
      if (!node || typeof node !== 'object') return
      if (node.__component === 'sections.form' && node.hubspotFormID !== FORM_ID) {
        node.hubspotFormID = FORM_ID
        touched += 1
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(applyFormId)
        else if (value && typeof value === 'object') applyFormId(value)
      }
    }
    applyFormId(copy)
  }
  return {
    raw,
    payload: toPayload(uid, copy, { dropId: true, dropAllIds: FRESH }),
    touched,
  }
}

async function restore() {
  const file = RESTORE
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'))
  let done = 0
  let failed = 0
  for (const [label, raw] of Object.entries(backup)) {
    const parsed = /^(\S+) (\S+) \[(\w+)\]$/.exec(label)
    if (!parsed) continue
    const [, uid, documentId, status] = parsed
    const name = schemaPlural(uid)
    const payload = toPayload(uid, raw, { dropId: true, dropAllIds: true })
    try {
      await request('PUT', `${name}/${documentId}`, {
        query: { status },
        body: { data: payload },
      })
      done += 1
      console.log(`  restored ${label}`)
    } catch (error) {
      failed += 1
      console.log(`  ! ${label}: ${error.message.slice(0, 200)}`)
    }
  }
  console.log(`restored ${done}, failed ${failed}`)
}

async function run() {
  if (RESTORE) return restore()
  console.log(`api      : ${API}`)
  console.log(`mode     : ${APPLY ? 'APPLY' : PROBE ? 'PROBE' : VERIFY ? 'VERIFY' : 'DRY RUN'}`)
  if (FORM_ID) console.log(`form id  : ${FORM_ID}`)

  const collectionUids = Object.keys(SCHEMAS).filter((uid) =>
    uid.startsWith('api::')
  )
  const targets = collectionUids.filter((uid) => {
    if (ONLY.length && !ONLY.includes(uid.split('.')[0].replace('api::', '')))
      return false
    const schema = SCHEMAS[uid]
    return Object.values(schema.attributes ?? {}).some(
      (a) =>
        a.type === 'component' ||
        a.type === 'dynamiczone' ||
        isRichtext(a)
    )
  })

  const backup = {}

  for (const uid of targets) {
    const name = schemaPlural(uid)
    let listRes
    try {
      listRes = await request('GET', name, {
        query: { status: 'draft', pagination: { pageSize: 200 } },
      })
    } catch (error) {
      console.log(`skip ${uid}: ${error.message.slice(0, 140)}`)
      continue
    }
    const entries = listRes.data ?? []
    console.log(`\n== ${uid} (${entries.length} entries)`)

    for (const entry of entries.slice(0, LIMIT || undefined)) {
      stats.entries += 1
      for (const status of ['draft', 'published']) {
        const query = { status, populate: populateNode(uid) }
        let res
        try {
          res = await request('GET', `${name}/${entry.documentId}`, { query })
        } catch (error) {
          console.log(`  ! read ${status} failed: ${error.message.slice(0, 140)}`)
          continue
        }
        const raw = res.data
        if (!raw) continue
        stats.versions += 1
        const copy = JSON.parse(JSON.stringify(raw))
        const label = `${uid} ${entry.documentId} [${status}]`
        backup[label] = raw

        let touched = 0
        if (ROUNDTRIP) {
          const payload = toPayload(uid, copy, {
            dropId: true,
            dropAllIds: FRESH,
          })
          await request('PUT', `${name}/${entry.documentId}`, {
            query: { status },
            body: { data: payload },
          })
          const after = await request('GET', `${name}/${entry.documentId}`, { query })
          const diff = deepDiff(
            fingerprint(uid, raw),
            fingerprint(uid, after.data),
            '',
            []
          )
          console.log(`  roundtrip ${label}: diffs=${diff.length}`)
          diff.slice(0, 15).forEach((d) => console.log(`    ${d}`))
          continue
        }
        walk(uid, copy, (parent, field, value) => {
          stats.fields += 1
          stats.charsBefore += value.length
          const cleaned = cleanHtml(value)
          stats.charsAfter += cleaned.length
          if (cleaned !== value) {
            touched += 1
            stats.changedFields += 1
            parent[field] = cleaned
            if (samples.length < SAMPLES) {
              samples.push({
                where: `${label}.${field}`,
                before: summarize(value),
                after: summarize(cleaned),
              })
            }
          }
        })

        if (FORM_ID) {
          const applyFormId = (node) => {
            if (!node || typeof node !== 'object') return
            if (node.__component === 'sections.form' && node.hubspotFormID !== FORM_ID) {
              node.hubspotFormID = FORM_ID
              stats.formIds += 1
              touched += 1
            }
            for (const value of Object.values(node)) {
              if (Array.isArray(value)) value.forEach(applyFormId)
              else if (value && typeof value === 'object') applyFormId(value)
            }
          }
          applyFormId(copy)
        }

        let payload = toPayload(uid, copy, { dropId: true, dropAllIds: FRESH })

        if (PROBE && entry.documentId === entries[0].documentId) {
          const attrs = schemaAttributes(uid)
          const probeField =
            Object.keys(attrs).find((attr) => isRichtext(attrs[attr])) ?? 'title'
          copy[probeField] = `<p>PROBE</p>${raw[probeField] ?? ''}`
          const nested = []
          walk(uid, copy, (parent, field) => nested.push([parent, field]))
          const nestedHit = nested.find(([, field]) => field !== probeField)
          if (nestedHit)
            nestedHit[0][nestedHit[1]] = `<p>NESTEDPROBE</p>${nestedHit[0][nestedHit[1]] ?? ''}`
          if (PROBE_MODE === 'empty') {
            for (const section of copy.sections ?? []) {
              if (Array.isArray(section.blocks)) section.blocks = []
            }
          }
          const before = (raw.sections ?? []).map((s) =>
            Array.isArray(s.blocks) ? s.blocks.length : null
          )
          console.log(
            `  probe ${entry.documentId} [${status}] top=${probeField} nested=${nestedHit ? nestedHit[1] : 'none'} blocksBefore=${JSON.stringify(before)}`
          )
          payload = toPayload(uid, copy, { dropId: true, dropAllIds: FRESH })
          await request('PUT', `${name}/${entry.documentId}`, {
            query: { status },
            body: { data: payload },
          })
          const after = await request('GET', `${name}/${entry.documentId}`, { query })
          const afterBlocks = (after.data.sections ?? []).map((s) =>
            Array.isArray(s.blocks) ? s.blocks.length : null
          )
          const diff = deepDiff(
            fingerprint(uid, raw),
            fingerprint(uid, after.data),
            '',
            []
          )
          console.log(
            `  after: blocks=${JSON.stringify(afterBlocks)} diffs=${diff.length}`
          )
          diff.slice(0, 25).forEach((d) => console.log(`    ${d}`))
          continue
        }

        if (VERIFY) {
          if (entry.documentId !== entries[0].documentId) continue
          const res2 = await request('PUT', `${name}/${entry.documentId}`, {
            query: { status },
            body: { data: payload },
          })
          const after = await request('GET', `${name}/${entry.documentId}`, {
            query,
          })
          const diff = deepDiff(
            fingerprint(uid, res2.data ?? after.data),
            fingerprint(uid, after.data)
          )
          const losses = deepDiff(fingerprint(uid, raw), fingerprint(uid, after.data))
          console.log(`  verify ${status}: roundtrip diffs=${diff.length} original-vs-after=${losses.length}`)
          losses.slice(0, 12).forEach((d) => console.log(`    ${d}`))
          continue
        }

        if (touched) planned.push({ uid, name, documentId: entry.documentId, status, payload, touched })
      }
    }
  }

  fs.mkdirSync(path.dirname(BACKUP), { recursive: true })
  fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 1))
  console.log(`\nbackup   : ${path.relative(process.cwd(), BACKUP)}`)

  console.log(
    `\nentries=${stats.entries} versions=${stats.versions} richtextFields=${stats.fields} changed=${stats.changedFields} chars ${stats.charsBefore} -> ${stats.charsAfter} formIds=${stats.formIds}`
  )
  samples.forEach((s) =>
    console.log(`\n  ${s.where}\n    before: ${s.before}\n    after : ${s.after}`)
  )

  if (VERIFY || !APPLY) {
    console.log(`\nplanned writes: ${planned.length} (dry run — pass --apply to execute)`)
    for (const item of planned.slice(0, 20))
      console.log(`  ${item.uid} ${item.documentId} [${item.status}] fields=${item.touched}`)
    if (planned.length > 20) console.log(`  … ${planned.length - 20} more`)
    return
  }

  let done = 0
  for (const item of planned) {
    let written = false
    for (let attempt = 0; attempt < 2 && !written; attempt += 1) {
      try {
        const fresh = await prepare(item.uid, item.name, item.documentId, item.status)
        await request('PUT', `${item.name}/${item.documentId}`, {
          query: { status: item.status },
          body: { data: fresh.payload },
        })
        written = true
        done += 1
      } catch (error) {
        if (attempt === 1)
          console.log(
            `  ! write ${item.uid}/${item.documentId} [${item.status}]: ${error.message.slice(0, 220)}`
          )
      }
    }
  }
  console.log(`\nwrote ${done}/${planned.length} versions`)
}

function schemaPlural(uid) {
  return SCHEMAS[uid]?.info?.pluralName ?? `${uid.split('.')[1]}s`
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
