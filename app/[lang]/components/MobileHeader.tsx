import MobileNavigation from './MobileNavigation'
import Navigation from './Navigation'
import { getStoryblokApi } from '@storyblok/react'

export const fetchConfig = async (locale: string) => {
  let sbParams = { version: 'draft' as const, language: locale }

  const storyblokApi = getStoryblokApi()
  const config = await storyblokApi.get(`cdn/stories/config`, sbParams, {
    cache: 'no-store',
  })
  return { config }
}

const MobileHeader = async (locale: any) => {
  const { config } = await fetchConfig(locale.locale)
  return (
    <div className="block lg:hidden">
      <MobileNavigation props={config.data} locale={locale} />
    </div>
  )
}

export default MobileHeader
