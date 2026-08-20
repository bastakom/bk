import type { Metadata } from 'next'
import { getStoryblokApi } from '@storyblok/react'
import { buildPageMetadata } from '../../../lib/seo'

const storyblokVersion: 'published' | 'draft' =
  process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW === 'true'
    ? 'draft'
    : 'published'

async function getService(slug: string, locale: string) {
  const storyblokApi = getStoryblokApi()

  try {
    const res = await storyblokApi.get(
      `cdn/stories/vara-tjanster/${slug}`,
      {
        version: storyblokVersion,
        language: locale,
      },
      {
        cache: 'no-store',
      }
    )

    return res?.data?.story
  } catch {
    return undefined
  }
}

function plainText(value: any) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value.content)) {
    return value.content
      .map((item: any) => plainText(item))
      .filter(Boolean)
      .join(' ')
  }
  if (value.text) return value.text
  return ''
}

function truncate(value: string, maxLength = 155) {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length > maxLength ? `${clean.substring(0, maxLength)}...` : clean
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string; lang: string }
}): Promise<Metadata> {
  const story = await getService(params.slug, params.lang)
  const title = story?.name
    ? `${story.name} - Bästa Kompisar`
    : 'Tjänst - Bästa Kompisar'
  const description =
    story?.content?.sub_title ||
    truncate(plainText(story?.content?.single_content)) ||
    'Tjänst från Bästa Kompisar inom varumärke, filmproduktion, ljud, sociala medier och webb.'
  const image =
    story?.content?.image?.filename ||
    story?.content?.film_case_image?.filename ||
    undefined

  return buildPageMetadata({
    lang: params.lang,
    path: `/${params.lang}/vara-tjanster/${params.slug}`,
    title,
    description: truncate(description),
    image,
  })
}

export default function ServiceSlugLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

