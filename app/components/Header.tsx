import Navigation from './Navigation'
import { getStoryblokApi } from '@storyblok/react'

export const fetchConfig = async () => {
  let sbParams = { version: 'draft' as const }

  const storyblokApi = getStoryblokApi()
  const config = await storyblokApi.get(`cdn/stories/config`, sbParams, {
    cache: 'no-store',
  })
  return { config }
}

const Header = async () => {
  const { config } = await fetchConfig()
  return <Navigation props={config.data} />
}

export default Header
