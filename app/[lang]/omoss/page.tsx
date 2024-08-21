import { getStoryblokApi } from '@storyblok/react'
import Image from 'next/image'
import { render } from 'storyblok-rich-text-react-renderer'
import Button from '../components/Button/Button'
import Link from 'next/link'
import { IoMdArrowDown } from 'react-icons/io'

const getTeam = async () => {
  let sbParams = {
    version: 'published' as const,
    starts_with: 'team',
  }

  const storyblokApi = getStoryblokApi()
  const data = await storyblokApi.get(`cdn/stories/`, sbParams)

  return data.data.stories
}

const fetchConfig = async (locale: string) => {
  let sbParams = { version: 'draft' as const, language: locale }

  const storyblokApi = getStoryblokApi()
  const config = await storyblokApi.get(`cdn/stories/config`, sbParams, {
    cache: 'no-store',
  })
  return { config }
}

const Page = async () => {
  const res = await getTeam()
  const blok = await fetchConfig('sv')
  const configData = blok.config.data.story.content
  return (
    <div className="">
      <div
        className={`min-h-[100%] lg:min-h-[80vh] flex flex-col lg:flex-row ${
          configData.about_marginleft
            ? 'w-full lg:w-[80%] m-auto my-10 lg:my-24 gap-10 lg:gap-20'
            : 'w-full items-start bg-[#F7F0EE] full-width-element px-4 lg:px-32 gap-10'
        } pt-24 lg:pt-40 pb-5 lg:pb-24 mb-0 lg:mb-14 font-primary`}
      >
        <div
          className={`w-full lg:w-1/2 h-full flex flex-col ${
            configData.about_marginleft ? 'justify-start' : 'justify-center'
          }`}
        >
          <div
            className={`flex flex-col w-full ${
              configData.about_marginleft ? 'gap-5' : 'gap-5 lg:gap-14'
            }`}
          >
            {configData.about_subtitle && (
              <span className="text-lg font-normal">
                {configData.about_subtitle}
              </span>
            )}
            <div
              className={`w-full max-w-full lg:max-w-[100%] ${
                configData.about_marginleft
                  ? 'text-[50px] lg:text-[70px] font-normal leading-[50px] lg:leading-[85px]'
                  : 'text-[65px] lg:text-[100px] w-[55%] font-normal leading-[70px] lg:leading-[100px] text-[#25364F]'
              }`}
            >
              {render(configData.about_title)}
            </div>
            <span className="flex flex-col gap-5 max-w-[100%] lg:max-w-[90%] font-light-sofia text-[20px]">
              {render(configData.about_subtext)}
            </span>
            {configData.link_name && configData.about_marginleft && (
              <Button
                href={`${configData.about_link.cached_url}`}
                text={configData.about_linkname}
              />
            )}
          </div>
        </div>
        {configData.image && (
          <div
            className={`w-full mt-0 lg:mt-10 lg:mt-0 lg:w-1/2 h-full relative ${
              configData.marginleft ? '' : 'flex-col flex gap-10'
            }`}
          >
            <Image
              src={configData.about_image.filename}
              className={`object-cover ${
                !configData.marginleft
                  ? 'min-h-full max-h-[600px] w-full'
                  : 'min-h-[100%] lg:min-h-[50vh] '
              }`}
              width={600}
              height={600}
              alt=""
            />
            {configData.about_link && !configData.about_marginleft && (
              <Link
                href={`${configData.about_link.cached_url}`}
                className="link-color flex gap-2 items-center"
              >
                {configData.about_linkname}
                <span>
                  <IoMdArrowDown fontSize={'1.2em'} />
                </span>
              </Link>
            )}
          </div>
        )}
      </div>
      {/* SPLIT */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        id="dinakompisar"
      >
        {res.map((member: any) => (
          <div key={member.id} className="relative group">
            <div className="relative max-h-[520px] xl:max-h-[800px]">
              {member?.content?.content === '' ? null : (
                <div
                  className="absolute top-0 h-full text-white w-full p-5 flex items-center bg-[#25364F] opacity-0 group-hover:opacity-90
            transition-all duration-300 ease-in-out text-[16px]"
                >
                  {render(member?.content?.content)}
                </div>
              )}
              <Image
                className="object-cover max-h-[520px] xl:max-h-[800px]"
                style={{ objectPosition: '50% 50%' }}
                src={member.content.image.filename}
                width={800}
                height={480}
                alt={member.name}
              />
            </div>
            <h2 className="text-[24px] font-bold-sofia mt-2 text-black">
              {member.name}
            </h2>
            <span className="font-light-sofia text-[14px]">
              <span className="uppercase"> {member.content.yrkesroll}</span>{' '}
              <br />
              {member.content.email}
              {member.content.telefon && (
                <span>
                  <br />
                  {member.content.telefon}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Page
