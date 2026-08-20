import type { Metadata } from 'next'
import NewsSlug from '@/app/[lang]/components/NewsComponent/NewsSlug'
import { getStoryblokApi } from '@storyblok/react'
import { notFound } from 'next/navigation'
import { buildPageMetadata } from '../../../lib/seo'

const storyblokVersion: 'published' | 'draft' =
  process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW === 'true'
    ? 'draft'
    : 'published'

export async function generateMetadata({
  params,
}: {
  params: { slug: string; lang: string }
}): Promise<Metadata> {
  const data = await getNewsSlug(params.slug, params.lang)
  const story = data?.[0]
  const title = story?.name
    ? `${story.name} - Bästa Kompisar`
    : 'Nyhet - Bästa Kompisar'
  const description =
    story?.content?.intro ||
    story?.content?.excerpt ||
    story?.content?.description ||
    'Nyhet från Bästa Kompisar i Malmö.'
  const image = story?.content?.image?.filename || undefined

  return buildPageMetadata({
    lang: params.lang,
    path: `/${params.lang}/nyheter/${params.slug}`,
    title,
    description,
    image,
  })
}

const page = async ({ params }: { params: { slug: string; lang: string } }) => {
  const data = await getNewsSlug(params.slug, params.lang)
  const slugsNews = await getAllNewsSlug(params.lang)

  if (!data || data.length === 0) {
    notFound()
  }

  const slugs = slugsNews
    .map((item: any) => item.slug)
    .filter((slug: string | undefined) => Boolean(slug))

  const currentIndex = slugs.indexOf(params.slug)
  const nextCaseSlug =
    slugs.length > 1 && currentIndex >= 0
      ? slugs[(currentIndex + 1) % slugs.length]
      : ''

  return (
    <div className="mt-20">
      <NewsSlug props={data} locale={params.lang} nextCaseSlug={nextCaseSlug} />
    </div>
  )
}

async function getNewsSlug(slug: string, locale: string) {
  const sbParams = {
    version: storyblokVersion,
    starts_with: `nyheter/${slug}`,
    excluding_slugs: 'nyheter/kategori*',
    language: locale,
  }

  const storyblokApi = getStoryblokApi()

  try {
    const res = await storyblokApi.get(`cdn/stories/`, sbParams, {
      cache: 'no-store',
    })

    return res?.data?.stories || []
  } catch {
    notFound()
  }
}

async function getAllNewsSlug(locale: string) {
  const sbParams = {
    version: storyblokVersion,
    starts_with: `nyheter/`,
    excluding_slugs: 'nyheter/kategori*',
    language: locale,
  }

  const storyblokApi = getStoryblokApi()

  try {
    const res = await storyblokApi.get(`cdn/stories/`, sbParams, {
      cache: 'no-store',
    })

    return res?.data?.stories || []
  } catch {
    return []
  }
}

export default page

