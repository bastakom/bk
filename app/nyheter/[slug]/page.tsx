import NewsSlug from '@/app/components/NewsComponent/NewsSlug'
import { getStoryblokApi } from '@storyblok/react'

const page = async ({ params }: { params: { slug: string } }) => {
  const data = await getNewsSlug(params.slug)
  const enData = await testLang()
  const pathname = params.slug
  return (
    <div className="mt-20">
      <NewsSlug props={data} enData={enData} />
    </div>
  )
}

async function getNewsSlug(slug: string) {
  let sbParams = {
    version: 'draft' as const,
    starts_with: `nyheter/${slug}`,
    excluding_slugs: 'nyheter/kategori*',
  }

  const storyblokApi = getStoryblokApi()
  const res = await storyblokApi.get(`cdn/stories/`, sbParams, {
    cache: 'no-store',
  })
  return res.data.stories
}

const testLang = async () => {
  let sbParams = {
    version: 'draft' as const,
    starts_with: `nyheter/basta-kompisar-utokar-agargruppen`,
    language: 'en',
  }
  const storyblokApi = getStoryblokApi()
  const res = await storyblokApi.get(`cdn/stories/`, sbParams, {
    cache: 'no-store',
  })
  return res.data.stories
}

export default page
