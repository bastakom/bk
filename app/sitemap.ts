import type { MetadataRoute } from 'next'

const SITE_URL = 'https://bastakompisar.se'
const STORYBLOK_TOKEN = 'faVE0ToH7Y41wHZy0uSt3Qtt'
const STORYBLOK_API_BASE = 'https://api.storyblok.com/v2/cdn/stories'

export const revalidate = 3600

const staticRoutes = [
  '/sv',
  '/sv/vara-tjanster',
  '/sv/cases',
  '/sv/omoss',
  '/sv/nyheter',
  '/sv/marknadsfika',
  '/sv/filmproduktion',
]

const pageSlugMap: Record<string, string> = {
  faq: 'sv/faq',
  filmproduktion: 'sv/filmproduktion',
  kontakt: 'sv/kontakt',
  omoss: 'sv/omoss',
  'vara-tjanster': 'sv/vara-tjanster',
}

const serviceSlugMap: Record<string, string> = {
  film: 'sv/vara-tjanster/film',
  ljud: 'sv/vara-tjanster/ljud',
  'sociala-medier': 'sv/vara-tjanster/sociala-medier',
  varumarke: 'sv/vara-tjanster/varumarke',
  webb: 'sv/vara-tjanster/webb',
}

const excludedStorySlugs = new Set([
  'allmaena-vilkor',
  'config',
  'privacy-policy',
  'service-avtal-webbtjaenster',
  'nyheter/kategori/baestakompisar',
  'nyheter/kategori/branding',
  'nyheter/kategori/design',
  'nyheter/kategori/digital',
  'nyheter/kategori/film',
  'nyheter/kategori/grafisk-identitet',
  'nyheter/kategori/kampanjer',
  'nyheter/kategori/kommunikation',
  'nyheter/kategori/some',
  'nyheter/kategori/sound',
  'nyheter/kategori/strategi',
  'nyheter/kategori/tryck',
  'nyheter/kategori/webb',
  'marknadsfika/christina-elwing-skanetrafiken',
  'marknadsfika/henrik-jarl-smeg',
  'marknadsfika/jenny-holmstedt-homemaid',
  'marknadsfika/jenny-maltesson-granngarden',
  'marknadsfika/lars-aberg-tidigare-cmo-axis',
  'marknadsfika/mariette-lindsjoe-kjell-och-company',
  'marknadsfika/nilla-hedlund-eldan-recycling',
  'marknadsfika/patrik-rudenschoeld-assa-abloy',
  'marknadsfika/peter-fuele-axis',
  'marknadsfika/robin-jacobsson-bygghemma',
  'marknadsfika/rutger-hagstad-mff',
  'nyheter/frontpac-i-ny-foerpackning',
])

function normalizeFullSlug(fullSlug: string) {
  return fullSlug.replace(/^\/+/, '').replace(/\/+$/, '')
}

function storyPath(story: any) {
  const fullSlug = normalizeFullSlug(story.full_slug || '')

  if (!fullSlug || excludedStorySlugs.has(fullSlug)) return ''
  if (fullSlug === 'home') return 'sv'
  if (fullSlug.startsWith('home/')) return `sv/${fullSlug.replace(/^home\/?/, '')}`
  if (fullSlug.startsWith('sv/') || fullSlug === 'sv') return fullSlug
  if (fullSlug.startsWith('en/') || fullSlug === 'en') return fullSlug
  if (fullSlug.startsWith('cases/')) return `sv/${fullSlug}`
  if (fullSlug.startsWith('nyheter/')) return `sv/${fullSlug}`
  if (fullSlug.startsWith('marknadsfika/')) return `sv/${fullSlug}`
  if (fullSlug.startsWith('filmproduction/')) {
    return `sv/filmproduction/${fullSlug.replace(/^filmproduction\//, '')}`
  }
  if (pageSlugMap[fullSlug]) return pageSlugMap[fullSlug]
  if (serviceSlugMap[fullSlug]) return serviceSlugMap[fullSlug]

  return ''
}

function getLastModified(story: any) {
  const date =
    story.published_at ||
    story.first_published_at ||
    story.created_at

  return date ? new Date(date) : undefined
}

async function fetchStories(page: number) {
  const url = new URL(STORYBLOK_API_BASE)
  url.searchParams.set('token', STORYBLOK_TOKEN)
  url.searchParams.set('version', 'published')
  url.searchParams.set('per_page', '100')
  url.searchParams.set('page', String(page))

  const response = await fetch(url.toString(), {
    next: { revalidate },
  })

  if (!response.ok) {
    return {
      stories: [],
      total: 0,
    }
  }

  const total = Number(response.headers.get('total') || '0')
  const data = await response.json()

  return {
    stories: data.stories || [],
    total,
  }
}

async function fetchAllStories() {
  const firstPage = await fetchStories(1)
  const stories = firstPage.stories.slice()
  const totalPages = Math.max(1, Math.ceil(firstPage.total / 100))

  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await fetchStories(page)
    stories.push(...nextPage.stories)
  }

  return stories
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  const entries = new Map<string, MetadataRoute.Sitemap[number]>()

  for (const route of staticRoutes) {
    entries.set(`${SITE_URL}${route}`, {
      url: `${SITE_URL}${route}`,
      lastModified: now,
    })
  }

  const stories = await fetchAllStories()

  for (const story of stories) {
    const path = storyPath(story)

    if (!path) continue

    entries.set(`${SITE_URL}/${path}`, {
      url: `${SITE_URL}/${path}`,
      lastModified: getLastModified(story) || now,
    })
  }

  return Array.from(entries.values()).sort((a, b) => a.url.localeCompare(b.url))
}

