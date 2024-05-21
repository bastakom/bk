import { getStoryblokApi } from '@storyblok/react'
import CasePage from '../components/Cases/CasePage'

const Page = async () => {
  const props = await fetchCases()
  const config = await fetchConfig()
  return <CasePage props={props.data.stories} config={config} />
}

export default Page

async function fetchCases() {
  let sbParams = { version: 'draft' as const, starts_with: 'cases/' }

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
