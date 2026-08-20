import { NextResponse } from 'next/server'

const STORYBLOK_TOKEN = 'faVE0ToH7Y41wHZy0uSt3Qtt'
const STORYBLOK_API_BASE = 'https://api.storyblok.com/v2/cdn/stories'

export const dynamic = 'force-dynamic'

async function fetchStories(page: number) {
  const url = new URL(STORYBLOK_API_BASE)
  url.searchParams.set('token', STORYBLOK_TOKEN)
  url.searchParams.set('version', 'published')
  url.searchParams.set('per_page', '100')
  url.searchParams.set('page', String(page))

  const response = await fetch(url.toString(), {
    cache: 'no-store',
  })

  const text = await response.text()

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      total: 0,
      stories: [],
      bodyPreview: text.slice(0, 500),
    }
  }

  const data = JSON.parse(text)

  return {
    ok: true,
    status: response.status,
    total: Number(response.headers.get('total') || '0'),
    stories: data.stories || [],
    bodyPreview: '',
  }
}

export async function GET() {
  const firstPage = await fetchStories(1)

  if (!firstPage.ok) {
    return NextResponse.json(firstPage, { status: 502 })
  }

  const totalPages = Math.max(1, Math.ceil(firstPage.total / 100))
  const stories = firstPage.stories.slice()

  for (let page = 2; page <= totalPages; page += 1) {
    const nextPage = await fetchStories(page)
    stories.push(...nextPage.stories)
  }

  return NextResponse.json({
    totalHeader: firstPage.total,
    totalPages,
    returned: stories.length,
    sample: stories.slice(0, 50).map((story: any) => ({
      id: story.id,
      name: story.name,
      slug: story.slug,
      full_slug: story.full_slug,
      published_at: story.published_at,
      first_published_at: story.first_published_at,
      created_at: story.created_at,
      content_component: story.content?.component,
    })),
  })
}

