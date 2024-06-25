import { getStoryblokApi } from '@storyblok/react'
import Small from '../components/SmallHero/Small'
import Staplar from '../components/Tjanster/Staplar'

const page = async ({ params }: { params: { lang: string } }) => {
  const res = await getTjanster(params.lang)
  const config = await fetchConfig(params.lang)

  const firstContent =
    'Bästa Kompisar · Best Friends · Bedste venner · Parhaat ystävät · Migliori amici · Meilleurs amis · Beste vrienden · Mejores amigos · Beste Freunde ·'
  const nextContent =
    'Лучшие друзья- 最好的朋友 - 親友 - أعز اصدقاء · Amici optimi Bästa Kompisar · Best Friends · Bestevenner  · Parhaat ystävät · Migliori amici · Meilleurs amis ·'

  return (
    <div className="mb-12">
      <div className="mt-24 mb-14">
        <div className="marquee-section m-auto">
          <div className="loop-div-right">
            <div className="marquee flex gap-2 text-[18px]">
              <span>{firstContent}</span>
              <span>{firstContent}</span>
              <span>{firstContent}</span>
            </div>
          </div>
        </div>
        <div className="marquee-section m-auto">
          <div className="loop-div-left">
            <div className="marquee flex gap-2 text-[18px]">
              <span>{nextContent}</span>
              <span>{nextContent}</span>
              <span>{nextContent}</span>
            </div>
          </div>
        </div>
      </div>
      <Small
        image={config.image_tjanster}
        title={config.tjanster_title}
        content={config.tjanster_content}
      />
      <Staplar props={res} config={config} />
    </div>
  )
}

export default page

const getTjanster = async (locale: string) => {
  let sbParams = {
    version: 'draft' as const,
    starts_with: 'vara-tjanster/',
    language: locale,
  }

  const storyblokApi = getStoryblokApi()

  const res = await storyblokApi.get(`cdn/stories/`, sbParams, {
    cache: 'no-store',
  })
  return res.data.stories
}

const fetchConfig = async (locale: string) => {
  let sbParams = { version: 'draft' as const, language: locale }

  const storyblokApi = getStoryblokApi()
  const config = await storyblokApi.get(`cdn/stories/config`, sbParams, {
    cache: 'no-store',
  })
  return config.data.story.content
}
