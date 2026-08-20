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

const excludedFullSlugs = new Set([
  'config',
  'sv/marknadsfika/christina-elwing-skanetrafiken',
  'sv/marknadsfika/henrik-jarl-smeg',
  'sv/marknadsfika/jenny-holmstedt-homemaid',
  'sv/marknadsfika/jenny-maltesson-granngarden',
  'sv/marknadsfika/lars-aberg-tidigare-cmo-axis',
  'sv/marknadsfika/mariette-lindsjoe-kjell-och-company',
  'sv/marknadsfika/nilla-hedlund-eldan-recycling',
  'sv/marknadsfika/patrik-rudenschoeld-assa-abloy',
  'sv/marknadsfika/peter-fuele-axis',
  'sv/marknadsfika/robin-jacobsson-bygghemma',
  'sv/marknadsfika/rutger-hagstad-mff',
  'sv/nyheter/frontpac-i-ny-foerpackning',
  'sv/vara-tjanster/cases',
])

function normalizeFullSlug(fullSlug: string) {
  return fullSlug.replace(/^\/+/, '').replace(/\/+$/, '')
}

function storyPath(story: any) {
  const fullSlug = normalizeFullSlug(story.full_slug || '')

  if (fullSlug === 'home') return 'sv'
  if (fullSlug.startsWith('home/')) return `sv/${fullSlug.replace(/^home\/?/, '')}`
  if (fullSlug.startsWith('sv/') || fullSlug === 'sv') return fullSlug
  if (fullSlug.startsWith('en/') || fullSlug === 'en') return fullSlug

  return ''
}

function isIndexablePath(path: string) {
  if (!path) return false
  if (excludedFullSlugs.has(path)) return false
  if (path.includes('/kategori/')) return false
  if (path.startsWith('nyheter/kategori')) return false
  if (!path.startsWith('sv') && !path.startsWith('en')) return false

  return true
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
  const stories = [...firstPage.stories]
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

    if (!isIndexablePath(path)) continue

    entries.set(`${SITE_URL}/${path}`, {
      url: `${SITE_URL}/${path}`,
      lastModified: getLastModified(story) || now,
    })
  }

  return [...entries.values()].sort((a, b) => a.url.localeCompare(b.url))
}

