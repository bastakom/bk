import { getStoryblokApi } from '@storyblok/react'
import CasePage from '../components/Cases/CasePage'

const storyblokVersion: 'published' | 'draft' =
  process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW === 'true'
    ? 'draft'
    : 'published'

const Page = async ({ params }: { params: { lang: string } }) => {
  const props = await fetchCases(params.lang)
  const config = await fetchConfig(params.lang)

  return (
    <CasePage
      props={props.data.stories}
      config={config.data.story}
      locale={params.lang}
    />
  )
}

export default Page

async function fetchCases(locale: string) {
  let sbParams = {
    version: storyblokVersion,
    starts_with: 'cases/',
    language: locale,
  }

  const storyblokApi = getStoryblokApi()

  try {
    const response = await storyblokApi.get(`cdn/stories/`, sbParams, {
      cache: 'no-store',
    })

    return response
  } catch (error) {
    console.error('Error fetching cases:')
    return { data: { stories: [] } }
  }
}

const fetchConfig = async (locale: string) => {
  let sbParams = {
    version: storyblokVersion,
    language: locale,
  }

  const storyblokApi = getStoryblokApi()

  try {
    const response = await storyblokApi.get(`cdn/stories/config`, sbParams, {
      cache: 'no-store',
    })

    return response
  } catch (error) {
    console.error('Error fetching config:')
    return { data: { story: {} } }
  }
}
