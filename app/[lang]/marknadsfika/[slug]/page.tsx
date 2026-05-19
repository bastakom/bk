import { getStoryblokApi } from '@storyblok/react'
import MarknadsSlug from '../../components/NewsComponent/marknadsfikaslug';

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
    version: 
      process.env.VERCEL_ENV === 'production'
    ? 'published' 
    : 'draft',
    language: locale,
  }

  const storyblokApi = getStoryblokApi()
  const res = await storyblokApi.get(`cdn/stories/marknadsfika/${slug}`, sbParams, {
    cache: 'no-store',
  })
  return res.data.story
}

async function getAllNewsSlug(locale: string) {
  let sbParams = {
    version: 
      process.env.VERCEL_ENV === 'production'
    ? 'published' 
    : 'draft',
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
