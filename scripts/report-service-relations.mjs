#!/usr/bin/env node

import fs from 'node:fs'

const CLOUD_URL =
  process.env.CLOUD_CMS_URL ?? 'https://original-desk-e673ad0b47.strapiapp.com'

const arg = (name) => {
  const found = process.argv.find((value) => value.startsWith(`--${name}=`))
  return found ? found.slice(name.length + 3) : null
}

const ONLY = (arg('only') ?? '')
  .split(',')
  .map((slug) => slug.trim())
  .filter(Boolean)

const JSON_OUT = process.argv.includes('--json')

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(
    [
      'Usage: node scripts/report-service-relations.mjs [options]',
      '',
      'Read-only audit of the Service <-> Case Study <-> Tech Stack relations.',
      'Prints, per service: the sections it has, the case studies and technologies',
      'linked on the entry, and the case studies / technologies picked inside its',
      'sections — plus the drift between those two sources.',
      '',
      'Options:',
      '  --only=a,b,c   report just these service slugs',
      '  --json         print the raw report as JSON',
      '',
      'Nothing is written to the CMS.',
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
    'No read token found — set CLOUD_API_TOKEN, ../frontend/.env STRAPI_ACCESS_TOKEN or strapi .env CLOUD_ADMIN_TOKEN.',
  )
  process.exit(1)
}

const request = async (suffix) => {
  const response = await fetch(`${CLOUD_URL}${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const text = await response.text()
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }
  return { status: response.status, body: parsed }
}

const slugOf = (entry) => entry?.slug ?? entry?.documentId ?? '?'

const componentName = (section) =>
  (section?.__component ?? '').replace(/^sections\./, '')

const list = await request(
  '/api/services?pagination[pageSize]=200&fields[0]=slug&fields[1]=title&sort[0]=title:ASC',
)

if (list.status !== 200) {
  console.error(
    `Cannot list services (HTTP ${list.status}) — the token needs read access to api::service.service.`,
  )
  process.exit(1)
}

const services = (list.body?.data ?? []).filter(
  (entry) => !ONLY.length || ONLY.includes(entry.slug),
)

if (!services.length) {
  console.error('No service entries returned.')
  process.exit(1)
}

const POPULATE = [
  'populate[sections][populate]=*',
  'populate[caseStudies][fields][0]=slug',
  'populate[caseStudies][fields][1]=title',
  'populate[techStack][fields][0]=slug',
  'populate[techStack][fields][1]=title',
].join('&')

const report = []

for (const service of services) {
  const response = await request(`/api/services/${service.documentId}?${POPULATE}`)
  if (response.status !== 200) {
    console.error(`  ! ${service.slug}: HTTP ${response.status}`)
    continue
  }

  const entry = response.body?.data ?? {}
  const sections = entry.sections ?? []
  const caseLinks = entry.caseStudies ?? []
  const techLinks = entry.techStack ?? []

  const pickedCases = sections
    .filter((section) => section.__component === 'sections.case-studies')
    .flatMap((section) => section.caseStudies ?? [])
  const pickedTech = sections
    .filter((section) => section.__component === 'sections.tech-stack')
    .flatMap((section) => section.blocks ?? [])

  const caseIds = new Set(caseLinks.map((item) => item.documentId ?? item.id))
  const techIds = new Set(techLinks.map((item) => item.documentId ?? item.id))

  const casePickIds = new Set(
    pickedCases.map((item) => item.documentId ?? item.id),
  )
  const techPickIds = new Set(pickedTech.map((item) => item.documentId ?? item.id))

  report.push({
    slug: service.slug,
    sections: sections.length,
    sectionTypes: [...new Set(sections.map(componentName))],
    caseLinks: caseLinks.length,
    techLinks: techLinks.length,
    manualCaseSections: sections.filter(
      (section) => section.__component === 'sections.case-studies',
    ).length,
    casePicks: pickedCases.length,
    techSections: sections.filter(
      (section) => section.__component === 'sections.tech-stack',
    ).length,
    techPicks: pickedTech.length,
    casesMissingFromEntry: [...casePickIds].filter((id) => !caseIds.has(id)).length,
    techMissingFromEntry: [...techPickIds].filter((id) => !techIds.has(id)).length,
    caseSlugs: caseLinks.map(slugOf),
    techSlugs: techLinks.map(slugOf),
  })
}

const totals = report.reduce(
  (acc, row) => ({
    sections: acc.sections + row.sections,
    caseLinks: acc.caseLinks + row.caseLinks,
    techLinks: acc.techLinks + row.techLinks,
    casePicks: acc.casePicks + row.casePicks,
    techPicks: acc.techPicks + row.techPicks,
  }),
  { sections: 0, caseLinks: 0, techLinks: 0, casePicks: 0, techPicks: 0 },
)

const summary = {
  services: report.length,
  servicesWithNoCases: report.filter((row) => row.caseLinks === 0).length,
  servicesWithNoTech: report.filter((row) => row.techLinks === 0).length,
  servicesWithNoTechSection: report.filter((row) => row.techSections === 0).length,
  servicesWithDrift: report.filter(
    (row) => row.casesMissingFromEntry > 0 || row.techMissingFromEntry > 0,
  ).length,
  ...totals,
}

if (JSON_OUT) {
  console.log(JSON.stringify({ summary, report }, null, 2))
} else {
  console.log(
    `\n${summary.services} services · ${summary.sections} sections · ` +
    `${summary.caseLinks} case links · ${summary.techLinks} tech links\n`,
  )

  console.table(
    report.map((row) => ({
      service: row.slug,
      sections: row.sections,
      'case links': row.caseLinks,
      'tech links': row.techLinks,
      'case picks': row.casePicks,
      'tech picks': row.techPicks,
      drift: row.casesMissingFromEntry + row.techMissingFromEntry,
    })),
  )

  console.log(
    [
      '',
      `Case studies linked on the entry      : ${summary.caseLinks}`,
      `Case studies picked inside sections   : ${summary.casePicks}`,
      `Technologies linked on the entry      : ${summary.techLinks}`,
      `Technologies picked inside sections   : ${summary.techPicks}`,
      '',
      `Services with no case studies at all  : ${summary.servicesWithNoCases}`,
      `Services with no tech stack at all    : ${summary.servicesWithNoTech}`,
      `Services with no Tech Stack section   : ${summary.servicesWithNoTechSection}`,
      `Services whose section picks are not on the entry relation: ${summary.servicesWithDrift}`,
      '',
      'Section picks that are missing from the entry relation mean the page',
      'renders case studies / technologies that the service itself does not',
      'claim — the two sources of truth have drifted.',
      '',
    ].join('\n'),
  )
}
