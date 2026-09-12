#!/usr/bin/env node

import { dirname, resolve } from 'node:path'

import { fileURLToPath } from 'node:url'
/**
 * Fills the demo data every industry needs: a description, a media file and a
 * handful (1–5, capped by what exists) of related case studies.
 *
 * The case-study ↔ industry relation is manyToOne on the case-study side, so a
 * case study belongs to exactly ONE industry: "related cases" are therefore
 * distributed across the industries, never shared. Each case goes to the
 * industry its title fits (`BEST_FIT`), links that already exist are kept, and
 * any leftovers land on an industry that still has room — so every industry
 * ends up with at least one case as long as one is available.
 *
 * Writes BOTH rows of each document (draft + `?status=published`), because the
 * published row is what the frontend reads and PUT never touches both at once.
 *
 * Usage:
 *   node scripts/set-industries-data.mjs [--dry-run]
 */
import { readFileSync } from 'node:fs'

const HERE = dirname(fileURLToPath(import.meta.url))
const API = process.env.STRAPI_URL ?? 'http://localhost:1337'
const DRY_RUN = process.argv.includes('--dry-run')
const MAX_CASES_PER_INDUSTRY = 5
const SEED = 20260912

const TOKEN =
  process.env.STRAPI_ACCESS_TOKEN ??
  readFileSync(resolve(HERE, '../../frontend/.env'), 'utf8')
    .match(/^STRAPI_ACCESS_TOKEN=(.*)$/m)?.[1]
    ?.trim()

if (!TOKEN) throw new Error('STRAPI_ACCESS_TOKEN not found')

/** Copy for each industry, styled after the ones already in the CMS. */
const DESCRIPTION = {
  fintech: '<p>Payments, banking and investment products.</p>',
  healthcare: '<p>Patient portals, clinical data and telehealth.</p>',
  retail: '<p>E-commerce, marketplace and omnichannel retail.</p>',
  'travel-mobility': '<p>Booking, logistics and fleet software.</p>',
  manufacturing: '<p>IoT, production analytics and ERP.</p>',
  edtech: '<p>Learning platforms and assessment tools.</p>',
  'human-capital-wellbeing': '<p>HR tech, eLearning and wellbeing platforms.</p>',
  'marketing-digital-media': '<p>Adtech, content platforms and campaign tooling.</p>',
  'professional-services-business':
    '<p>Legal, consulting and back-office automation.</p>',
  'mobility-infrastructure':
    '<p>Automotive, transportation and energy systems.</p>',
  'commerce-consumer-experience':
    '<p>Retail, marketplace and subscription products.</p>',
}

/** One distinct image per industry (name as stored in the media library). */
const MEDIA = {
  fintech: 'case001.png',
  healthcare: 'case002.png',
  retail: 'case003.png',
  'travel-mobility': 'case004.png',
  manufacturing: 'case005.png',
  edtech: 'img001.jpg',
  'human-capital-wellbeing': 'img002.jpg',
  'marketing-digital-media': 'img003.jpg',
  'professional-services-business': 'img004.jpg',
  'mobility-infrastructure': 'thumb01.jpg',
  // picked in the admin, kept as-is
  'commerce-consumer-experience': 'img005.png',
}

/** Which industry each case study belongs to (missing slug → random). */
const BEST_FIT = {
  'strategic-platform-development-for-impak-finance': 'fintech',
  'childrens-hospitals-in-poland-an-information-platform': 'healthcare',
  'building-its-first-e-commerce-platform': 'retail',
  'digital-sales-channel-launch-for-benx': 'retail',
  'modernizing-a-heritage-e-commerce-platform-for-craftsmanship-enthusiasts':
    'retail',
  'crafting-a-cinematic-travel-platform': 'travel-mobility',
  'how-a-b2b-client-simplified-complex-data-processing': 'manufacturing',
  'phase-1-of-long-term-modernization': 'edtech',
  'rebuilding-a-powerful-online-fitness-appointment-booking-platform':
    'human-capital-wellbeing',
  'elevating-the-user-experience-of-sitevibes-an-ai-powered-chatbot-tool':
    'marketing-digital-media',
  'how-polcode-cut-content-creation-time': 'marketing-digital-media',
  'firm-prospects-out-of-legacy-debt': 'professional-services-business',
  'legacy-platform-modernization': 'professional-services-business',
  'how-were-centralizing-and-automating-management-at-polcode':
    'mobility-infrastructure',
  'circular-e-commerce-in-practice': 'commerce-consumer-experience',
}

const auth = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }

async function api(path, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: auth })
  const text = await res.text()
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${text.slice(0, 400)}`)
  return text ? JSON.parse(text) : null
}

/** Deterministic PRNG so re-runs produce the same distribution. */
function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(list, random) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Buckets the case studies per industry: keep whatever is already linked, place
 * the rest by best fit (random when the title tells us nothing), then balance so
 * that no industry stays empty and none goes past MAX_CASES_PER_INDUSTRY.
 */
function assign(cases, industries, random) {
  const bySlug = new Map(industries.map((industry) => [industry.slug, industry]))
  const buckets = new Map(industries.map((industry) => [industry.documentId, []]))
  const orphans = []

  for (const item of cases) {
    if (item.industries?.documentId) {
      buckets.get(item.industries.documentId)?.push(item)
      continue
    }
    orphans.push(item)
  }

  const queue = []
  for (const item of shuffle(orphans, random)) {
    const industry = bySlug.get(BEST_FIT[item.slug])
    const bucket = industry && buckets.get(industry.documentId)
    if (bucket && bucket.length < MAX_CASES_PER_INDUSTRY) bucket.push(item)
    else queue.push(item)
  }

  // Anything the map left over (or squeezed out by the cap) fills the gaps.
  while (queue.length) {
    const empty = industries.filter((industry) => !buckets.get(industry.documentId).length)
    const room = empty.length
      ? empty
      : industries.filter(
        (industry) => buckets.get(industry.documentId).length < MAX_CASES_PER_INDUSTRY
      )
    if (!room.length) break
    const industry = room[Math.floor(random() * room.length)]
    buckets.get(industry.documentId).push(queue.shift())
  }

  return { buckets, queue }
}

async function main() {
  const [industriesRes, casesRes, mediaRes] = await Promise.all([
    api('/api/industries?populate=relatedCases&pagination[limit]=100'),
    api(
      '/api/case-studies?fields[0]=title&fields[1]=slug&populate[industries]=true&pagination[limit]=100'
    ),
    api('/api/upload/files?pagination[limit]=200'),
  ])

  const industries = industriesRes.data
  const cases = casesRes.data
  const mediaByName = new Map(mediaRes.map((file) => [file.name, file]))

  console.log(`${industries.length} industries · ${cases.length} case studies · ${mediaRes.length} media files`)
  if (DRY_RUN) console.log('dry run — nothing is written\n')

  const random = mulberry32(SEED)
  const { buckets, queue } = assign(cases, industries, random)
  if (queue.length)
    console.warn(`! ${queue.length} case studies could not be placed (every industry is full)`)

  let unassigned = 0
  for (const industry of industries) {
    const description = DESCRIPTION[industry.slug]
    const media = MEDIA[industry.slug] ? mediaByName.get(MEDIA[industry.slug]) : null
    const related = buckets.get(industry.documentId) ?? []
    if (!related.length) unassigned += 1

    if (!description) console.warn(`! ${industry.slug}: no description defined`)
    if (!media) console.warn(`! ${industry.slug}: media "${MEDIA[industry.slug]}" not in the library`)

    console.log(
      `${industry.title}\n  description: ${description ? 'yes' : 'NO'}` +
      `\n  media: ${media ? `${media.name} (${media.id})` : 'NONE'}` +
      `\n  related cases (${related.length}/${MAX_CASES_PER_INDUSTRY}): ${related.map((c) => c.title).join(' | ') || '—'}`
    )
    if (DRY_RUN) continue

    // The industry's own fields, on both rows.
    const industryData = {
      title: industry.title,
      slug: industry.slug,
      ...(description ? { description } : {}),
      ...(media ? { media: media.id } : {}),
    }
    await api(`/api/industries/${industry.documentId}`, {
      method: 'PUT',
      body: JSON.stringify({ data: industryData }),
    })
    await api(`/api/industries/${industry.documentId}?status=published`, {
      method: 'PUT',
      body: JSON.stringify({ data: industryData }),
    })

    // The other side of the relation: one industry per case study — but only
    // for the cases this run is responsible for.
    for (const item of related) {
      const current = item.industries?.documentId
      if (current === industry.documentId) continue
      for (const status of ['', '?status=published']) {
        await api(`/api/case-studies/${item.documentId}${status}`, {
          method: 'PUT',
          body: JSON.stringify({
            data: { title: item.title, slug: item.slug, industries: industry.documentId },
          }),
        })
      }
    }
  }

  if (unassigned) console.warn(`! ${unassigned} industries have no related case study (out of cases)`)
  console.log(DRY_RUN ? '\ndry run complete' : '\nindustries updated')
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
