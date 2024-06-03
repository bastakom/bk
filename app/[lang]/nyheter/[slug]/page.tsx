import NewsSlug from '@/app/[lang]/components/NewsComponent/NewsSlug'
import { getStoryblokApi } from '@storyblok/react'

const page = async ({ params }: { params: { slug: string; lang: string } }) => {
  const data = await getNewsSlug(params.slug, params.lang)
  const pathname = params.slug
  return (
    <div className="mt-20">
      <NewsSlug props={data} />
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

export default page
