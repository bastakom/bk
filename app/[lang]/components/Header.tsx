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

const Header = async (lang: any) => {
  const { config } = await fetchConfig()
  console.log(lang.lang)
  return <Navigation props={config.data} lang={lang.lang} />
}

export default Header
