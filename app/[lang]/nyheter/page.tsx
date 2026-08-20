import type { Metadata } from 'next'
import { getStoryblokApi } from '@storyblok/react'
import NewsComponent from '../components/NewsComponent/NewsComponent'
import { buildPageMetadata } from '../../lib/seo'

export async function generateMetadata({
  params,
}: {
  params: { lang: string }
}): Promise<Metadata> {
  return buildPageMetadata({
    lang: params.lang,
    path: `/${params.lang}/nyheter`,
    title: 'Nyheter - Bästa Kompisar',
    description:
      'Nyheter, kunduppdrag och insikter från Bästa Kompisar i Malmö.',
  })
}

const Page = async ({ params }: { params: { lang: string } }) => {
  const resCat = await getCategories(params.lang)
  const res = await getNews(params.lang)
  const settings = await fetchConfig(params.lang)
  const {
    data: { stories },
  } = res

  return (
    <NewsComponent
      props={stories}
      kategories={resCat.data.stories}
      locale={params.lang}
      hero_title={settings.content.nyheter_title}
      subtitle={settings.content.nyheter_subtitle}
      content={settings.content.nyheter_content}
      filename={settings.content.nyheter_image.filename}
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

const fetchConfig = async (locale: string) => {
  let sbParams = { version: 'draft' as const, language: locale }

  const storyblokApi = getStoryblokApi()
  const config = await storyblokApi.get(`cdn/stories/config`, sbParams, {
    cache: 'no-store',
  })
  return config.data.story
}


export default Page

