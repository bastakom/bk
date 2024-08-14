import { getStoryblokApi } from '@storyblok/react'
import Small from '../components/SmallHero/Small'
import Staplar from '../components/Tjanster/Staplar'
import Link from 'next/link'
import { IoMdArrowForward } from 'react-icons/io'
import TilesIcons from '../components/TilesIcons/TilesIcons'
import Kompetens from '../components/Kompetens/Kompetens'

const page = async ({ params }: { params: { lang: string } }) => {
  const res = await getTjanster(params.lang)
  const config = await fetchConfig(params.lang)
  console.log(config.kompetens_tiles)

  return (
    <div className="no-padding-bottom">
      <div className="full-width-element bg-[#F7F0EE] pb-20 pt-32 px-2">
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
            style={{ fontSize: '18px' }}
          >
            {params.lang === 'en' ? 'See all case' : 'Se alla case'}
            <span className="">
              <IoMdArrowForward fontSize={'1.5em'} />
            </span>
          </Link>
        </div>
        <Kompetens
          title={config.kompetens_title}
          content={config.kompetens_content}
          image={config.kompetens_image}
          tiles={config.kompetens_tiles}
        />
        <TilesIcons
          tiles={config.tile}
          header={config.tile_header}
          content={config.tile_content}
        />
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
