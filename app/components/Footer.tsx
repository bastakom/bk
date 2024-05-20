import { getStoryblokApi } from '@storyblok/react'
import FooterComponent from './FooterComponent'

export const fetchConfig = async () => {
  let sbParams = { version: 'draft' as const }

  const storyblokApi = getStoryblokApi()
  const config = await storyblokApi.get(`cdn/stories/config`, sbParams, {
    cache: 'no-store',
  })
  return { config }
}

const Footer = async () => {
  const { config } = await fetchConfig()
  return <FooterComponent props={config.data} />
}

export default Footer
