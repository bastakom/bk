import NewsSlug from '@/app/[lang]/components/NewsComponent/NewsSlug'
import { getStoryblokApi } from '@storyblok/react'
import { useRouter } from 'next/navigation'

const page = async ({ params }: { params: { slug: string; lang: string } }) => {
  const data = await getNewsSlug(params.slug, params.lang)
  const slugsNews = await getAllNewsSlug(params.lang)

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
    version: 'draft' as const,
    starts_with: `nyheter/${slug}`,
    excluding_slugs: 'nyheter/kategori*',
    language: locale,
  }

  const storyblokApi = getStoryblokApi()
  const res = await storyblokApi.get(`cdn/stories/`, sbParams, {
    cache: 'no-store',
  })
  return res.data.stories
}

async function getAllNewsSlug(locale: string) {
  let sbParams = {
    version: 'draft' as const,
    starts_with: `nyheter/`,
    excluding_slugs: 'nyheter/kategori*',
    language: locale,
  }

  const storyblokApi = getStoryblokApi()
  const res = await storyblokApi.get(`cdn/stories/`, sbParams, {
    cache: 'no-store',
  })
  return res.data.stories
}

export default page
