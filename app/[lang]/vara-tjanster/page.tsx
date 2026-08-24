import type { Metadata } from 'next'
import { getStoryblokApi } from '@storyblok/react'
import Small from '../components/SmallHero/Small'
import Staplar from '../components/Tjanster/Staplar'
import Link from 'next/link'
import { IoMdArrowForward } from 'react-icons/io'
import TilesIcons from '../components/TilesIcons/TilesIcons'
import Button from '../components/Button/Button'
import { buildPageMetadata } from '../../lib/seo'

export async function generateMetadata({
  params,
}: {
  params: { lang: string }
}): Promise<Metadata> {
  return buildPageMetadata({
    lang: params.lang,
    path: `/${params.lang}/vara-tjanster`,
    title: 'Tjänster - Bästa Kompisar',
    description:
      'Bästa Kompisar hjälper företag med varumärke, filmproduktion, ljud, sociala medier och webb.',
  })
}

const page = async ({ params }: { params: { lang: string } }) => {
  const res = await getTjanster(params.lang)
  const config = await fetchConfig(params.lang)

  return (
    <div className="no-padding-bottom">
      <div className="full-width-element bg-[#F7F0EE] pt-20 lg:pt-32 px-2">
        <div className="px-2 lg:px-10">
          <Small
            image={config.image_tjanster}
            title={config.tjanster_title}
            content={config.tjanster_content}
          />

          <Staplar props={res} config={config} />
          <Link
            href={`/${params.lang}/cases`}
            className="text-center text-[#FF6062] text-xl font-normal lg:mx-0 flex gap-2 justify-center items-center mt-14"
            style={{ fontSize: '18px' }}
          >
            {params.lang === 'en' ? 'See all case' : 'Se alla case'}
            <span className="">
              <IoMdArrowForward fontSize={'1.5em'} />
            </span>
          </Link>
        </div>
        <div className="bg-[#F7DAD2] mt-10 lg:px-20 full-width-element no-padding-bottom">
          <TilesIcons
            tiles={config.tile}
            header={config.tile_header}
            content={config.tile_content}
          />
          <div className="w-full justify-center flex -mt-5 pb-16">
            <Button
              text="Nyfiken? Boka ett möte med oss!"
              href={`/${params.lang}/kontakt`}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default page

const getTjanster = async (locale: string) => {
  let sbParams = {
    version: 'published' as const,
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
