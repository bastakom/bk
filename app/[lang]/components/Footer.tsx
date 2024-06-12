import { getStoryblokApi } from '@storyblok/react'
import FooterComponent from './FooterComponent'

export const fetchConfig = async (locale: any) => {
  let sbParams = { version: 'draft' as const, language: locale }

  const storyblokApi = getStoryblokApi()
  const config = await storyblokApi.get(`cdn/stories/config`, sbParams, {
    cache: 'no-store',
  })
  return { config }
}

const Footer = async (locale: any) => {
  const { config } = await fetchConfig(locale.locale)
  return <FooterComponent props={config.data} />
}

export default Footer
