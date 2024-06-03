import { getStoryblokApi } from '@storyblok/react'
import CasePage from '../components/Cases/CasePage'

const Page = async ({ params }: { params: { lang: string } }) => {
  const props = await fetchCases(params.lang)
  const config = await fetchConfig()
  return (
    <CasePage props={props.data.stories} config={config.config.data.story} />
  )
}

export default Page

async function fetchCases(locale: string) {
  let sbParams = {
    version: 'draft' as const,
    language: locale,
    starts_with: 'cases/',
  }

  const storyblokApi = getStoryblokApi()
  return await storyblokApi.get(`cdn/stories/`, sbParams, {
    cache: 'no-store',
  })
}

const fetchConfig = async () => {
  let sbParams = { version: 'draft' as const }

  const storyblokApi = getStoryblokApi()
  const config = await storyblokApi.get(`cdn/stories/config`, sbParams, {
    cache: 'no-store',
  })
  return { config }
}
