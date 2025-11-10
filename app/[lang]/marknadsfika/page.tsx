import { getStoryblokApi } from '@storyblok/react'
import NewsComponent from '../components/NewsComponent/NewsComponent'

const Page = async ({ params }: { params: { lang: string } }) => {
  const res = await getNews(params.lang)
  const {
    data: { stories },
  } = res

  return (
    <NewsComponent
      title={params.lang === 'en' ? 'Market Breaks' : 'MARKNADSFIKA'}
      props={stories}
      locale={params.lang}
    />
  )
}

async function getNews(locale: string) {
  let sbParams = {
    version: 'draft' as const,
    starts_with: 'marknadsfika',
    language: locale,
  }

  const storyblokApi = getStoryblokApi()
  return await storyblokApi.get(`cdn/stories/`, sbParams, {
    cache: 'no-store',
  })
}

export default Page
