import { getStoryblokApi } from '@storyblok/react'
import NewsComponent from '../components/NewsComponent/NewsComponent'

const Page = async ({ params }: { params: { lang: string } }) => {
  const res = await getNews(params.lang)
  const settings = await fetchConfig(params.lang)
  const {
    data: { stories },
  } = res

  return (
    <NewsComponent
      title={params.lang === 'en' ? 'Market Breaks' : 'MARKNADSFIKA'}
      props={stories}
      locale={params.lang}
      hero_title={settings.content.marknadsfika_title}
      subtitle={settings.content.marknadsfika_subtitle}
      content={settings.content.marknadsfika_content}
      filename={settings.content.marknadsfika_image.filename}
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

const fetchConfig = async (locale: string) => {
  let sbParams = { version: 'draft' as const, language: locale }

  const storyblokApi = getStoryblokApi()
  const config = await storyblokApi.get(`cdn/stories/config`, sbParams, {
    cache: 'no-store',
  })
  return config.data.story
}

export default Page
