import { getStoryblokApi } from '@storyblok/react'
import { notFound } from 'next/navigation'
import MarknadsSlug from '../../components/NewsComponent/marknadsfikaslug'

const storyblokVersion: 'published' | 'draft' =
  process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW === 'true'
    ? 'draft'
    : 'published'

 const page = async ({ params }: { params: { slug: string; lang: string } }) => {
  const data = await getNewsSlug(params.slug, params.lang)
  const slugsNews = await getAllNewsSlug(params.lang)

  const slugs = slugsNews.map((item: any) => item.slug)

  const currentIndex = slugs.indexOf(params.slug)
  const nextCaseSlug = slugs[(currentIndex + 1) % slugs.length]

  return (
    <div className="mt-20">
      <MarknadsSlug item={data} locale={params.lang} nextCaseSlug={nextCaseSlug} />
    </div>
  )
}

async function getNewsSlug(slug: string, locale: string) {
  let sbParams = {
   version: "draft" as const,
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
  let sbParams = {
    version: "draft" as const,
    starts_with: `marknadsfika/`,
    language: locale,
  }

  const storyblokApi = getStoryblokApi()
  const res = await storyblokApi.get(`cdn/stories/`, sbParams, {
    cache: 'no-store',
  })

  return res.data.stories
}

export default page
