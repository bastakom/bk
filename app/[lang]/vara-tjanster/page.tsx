import { getStoryblokApi } from '@storyblok/react'
import Small from '../components/SmallHero/Small'
import Staplar from '../components/Tjanster/Staplar'
import Link from 'next/link'
import { IoMdArrowForward } from 'react-icons/io'
import NameLoop from '../components/NameLoop/NameLoop'

const page = async ({ params }: { params: { lang: string } }) => {
  const res = await getTjanster(params.lang)
  const config = await fetchConfig(params.lang)

  const firstContent =
    'Bästa Kompisar · Best Friends · Bedste venner · Parhaat ystävät · Migliori amici · Meilleurs amis · Beste vrienden · Mejores amigos · Beste Freunde ·'
  const nextContent =
    'Лучшие друзья- 最好的朋友 - 親友 - أعز اصدقاء · Amici optimi Bästa Kompisar · Best Friends · Bestevenner  · Parhaat ystävät · Migliori amici · Meilleurs amis ·'

  return (
    <div className="no-padding-bottom">
      <NameLoop />
      <div className="full-width-element bg-[#F7F0EE] pb-20 px-2">
        <div className="px-2 lg:px-10">
          <Small
            image={config.image_tjanster}
            title={config.tjanster_title}
            content={config.tjanster_content}
          />

          <Staplar props={res} config={config} />
          <Link
            href={'/cases'}
            className="text-center text-[#FF6062] text-xl font-normal lg:mx-0 flex gap-2 justify-center items-center mt-14"
            style={{ fontSize: '16px' }}
          >
            {params.lang === 'en' ? 'See all case' : 'Se alla case'}
            <span className="">
              <IoMdArrowForward fontSize={'1.5em'} />
            </span>
          </Link>
        </div>
      </div>
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
