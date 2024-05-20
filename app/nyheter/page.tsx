import { getStoryblokApi } from '@storyblok/react'
import NewsComponent from '../components/NewsComponent/NewsComponent'

const Page = async () => {
  const resCat = await getCategories()
  const res = await getNews()
  const {
    data: { stories },
  } = res

  return <NewsComponent props={stories} kategories={resCat.data.stories} />
}

async function getNews() {
  let sbParams = {
    version: 'draft' as const,
    starts_with: 'nyheter',

    excluding_slugs: 'nyheter/kategori*',
  }

  const storyblokApi = getStoryblokApi()
  return await storyblokApi.get(`cdn/stories/`, sbParams, {
    cache: 'no-store',
  })
}
async function getCategories() {
  let sbParams = {
    version: 'draft' as const,
    starts_with: 'nyheter/kategori/',
  }

  const storyblokApi = getStoryblokApi()
  return await storyblokApi.get(`cdn/stories/`, sbParams, {
    cache: 'no-store',
  })
}

export default Page
