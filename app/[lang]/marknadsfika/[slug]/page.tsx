import type { Metadata } from 'next'
import { getStoryblokApi } from '@storyblok/react'
import { notFound } from 'next/navigation'
import MarknadsSlug from '../../components/NewsComponent/marknadsfikaslug'
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
  const story = await getNewsSlug(params.slug, params.lang)
  const title = story?.name
    ? `${story.name} - Marknadsfika`
    : 'Marknadsfika - Bästa Kompisar'
  const description =
    story?.content?.intro ||
    story?.content?.excerpt ||
    story?.content?.description ||
    'Marknadsfika från Bästa Kompisar med samtal och perspektiv på marknadsföring.'

  return buildPageMetadata({
    lang: params.lang,
    path: `/${params.lang}/marknadsfika/${params.slug}`,
    title,
    description,
  })
}

const page = async ({ params }: { params: { slug: string; lang: string } }) => {
  const data = await getNewsSlug(params.slug, params.lang)
  const slugsNews = await getAllNewsSlug(params.lang)

  if (!data) {
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
      <MarknadsSlug item={data} locale={params.lang} nextCaseSlug={nextCaseSlug} />
    </div>
  )
}

async function getNewsSlug(slug: string, locale: string) {
  const sbParams = {
    version: storyblokVersion,
    language: locale,
  }

  const storyblokApi = getStoryblokApi()

  try {
    const res = await storyblokApi.get(
      `cdn/stories/marknadsfika/${slug}`,
      sbParams,
      {
        cache: 'no-store',
      }
    )

    if (!res?.data?.story) {
      notFound()
    }

    return res.data.story
  } catch {
    notFound()
  }
}

async function getAllNewsSlug(locale: string) {
  const sbParams = {
    version: storyblokVersion,
    starts_with: `marknadsfika/`,
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

