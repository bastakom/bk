import { getStoryblokApi } from '@storyblok/react'
import CasePage from '../components/Cases/CasePage'

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
    version: 'draft' as const,
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
  let sbParams = { version: 'draft' as const, language: locale }

  const storyblokApi = getStoryblokApi()
  try {
    const response = await storyblokApi.get(`cdn/stories/config`, sbParams, {
      cache: 'no-store',
    })
    return response
  } catch (error) {
    console.error('Error fetching config:')
    return { data: { story: {} } } // Return an empty object as a fallback
  }
}
