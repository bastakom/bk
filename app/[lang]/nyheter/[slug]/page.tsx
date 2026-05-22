import NewsSlug from '@/app/[lang]/components/NewsComponent/NewsSlug'
import { getStoryblokApi } from '@storyblok/react'
import { notFound } from 'next/navigation'

const storyblokVersion: 'published' | 'draft' =
  process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW === 'true'
    ? 'draft'
    : 'published'

const page = async ({ params }: { params: { slug: string; lang: string } }) => {
  const data = await getNewsSlug(params.slug, params.lang)
  const slugsNews = await getAllNewsSlug(params.lang)

  if (!data || data.length === 0) {
    notFound()
  }

  const slugs = slugsNews.map((item: any) => item.slug)

  const currentIndex = slugs.indexOf(params.slug)
  const nextCaseSlug = slugs[(currentIndex + 1) % slugs.length]

  return (
    <div className="mt-20">
      <NewsSlug props={data} locale={params.lang} nextCaseSlug={nextCaseSlug} />
    </div>
  )
}

async function getNewsSlug(slug: string, locale: string) {
  let sbParams = {
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

    return res.data.stories
  } catch {
    notFound()
  }
}

async function getAllNewsSlug(locale: string) {
  let sbParams = {
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

    return res.data.stories
  } catch {
    return []
  }
}

export default page
