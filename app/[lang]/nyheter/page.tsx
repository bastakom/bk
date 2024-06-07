import { getStoryblokApi } from '@storyblok/react'
import NewsComponent from '../components/NewsComponent/NewsComponent'

const Page = async ({ params }: { params: { lang: string } }) => {
  const resCat = await getCategories(params.lang)
  const res = await getNews(params.lang)
  const {
    data: { stories },
  } = res

  return (
    <NewsComponent
      props={stories}
      kategories={resCat.data.stories}
      locale={params.lang}
    />
  )
}

async function getNews(locale: string) {
  let sbParams = {
    version: 'draft' as const,
    starts_with: 'nyheter',
    excluding_slugs: 'nyheter/kategori*',
    language: locale,
  }

  const storyblokApi = getStoryblokApi()
  return await storyblokApi.get(`cdn/stories/`, sbParams, {
    cache: 'no-store',
  })
}
async function getCategories(locale: string) {
  let sbParams = {
    version: 'draft' as const,
    starts_with: 'nyheter/kategori/',
    sort_by: 'name:asc',
    language: locale,
  }

  const storyblokApi = getStoryblokApi()
  return await storyblokApi.get(`cdn/stories/`, sbParams, {
    cache: 'no-store',
  })
}

export default Page
