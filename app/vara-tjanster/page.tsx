import { getStoryblokApi } from '@storyblok/react'
import Staplar from '../components/Tjanster/Staplar'
import Small from '../components/SmallHero/Small'
import TitleText from '../components/TitleText/TitleText'

const page = async () => {
  const res = await getTjanster()
  const config = await fetchConfig()

  return (
    <>
      <TitleText
        title={config.hero_tjanster_title}
        content={config.hero_tjanster_sub}
      />
      <Staplar props={res} config={config} />
      <Small
        image={config.image_tjanster}
        title={config.tjanster_title}
        content={config.tjanster_content}
      />
    </>
  )
}

export default page

const getTjanster = async () => {
  let sbParams = { version: 'draft' as const, starts_with: 'vara-tjanster/' }

  const storyblokApi = getStoryblokApi()

  const res = await storyblokApi.get(`cdn/stories/`, sbParams, {
    cache: 'no-store',
  })
  return res.data.stories
}

export const fetchConfig = async () => {
  let sbParams = { version: 'draft' as const }

  const storyblokApi = getStoryblokApi()
  const config = await storyblokApi.get(`cdn/stories/config`, sbParams, {
    cache: 'no-store',
  })
  return config.data.story.content
}
