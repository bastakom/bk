'use client'

import { render } from 'storyblok-rich-text-react-renderer'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { IoMdArrowForward } from 'react-icons/io'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import 'react-loading-skeleton/dist/skeleton.css'
import { useState } from 'react'

interface Props {
  story: any
  nextCaseSlug: string
}

const CaseSlugPage = ({ story, nextCaseSlug }: Props) => {
  const [loading, isLoaded] = useState(false)
  const router = useRouter()
  const locale = useParams()

  const handleNextClick = () => {
    router.push(`${nextCaseSlug}`)
  }

  setTimeout(() => {
    isLoaded(true)
  }, 1000)

  return (
    <>
      <div className="relative dark:bg-[#121212] pb-20 container m-auto">
        <div className="flex gap-5 mb-5 lg:mb-20 mt-16 flex-col items-center">
          {!loading ? (
            <div className="w-full h-[350px] lg:h-[600px]">
              <Skeleton className="h-full" />
            </div>
          ) : (
            <div className="w-full relative h-[300px] lg:h-[602px]">
              {story?.content?.image?.filename.endsWith('.mp4') ? (
                <video
                  autoPlay
                  muted
                  playsInline
                  loop
                  className="object-cover h-full w-full"
                >
                  <source src={story.content.image?.filename || ''} />
                </video>
              ) : (
                <Image
                  src={story?.content?.image?.filename || ''}
                  fill
                  alt="placeholder"
                  quality={100}
                  className="object-cover bg-[-200px]"
                />
              )}
            </div>
          )}
          <div className="flex justify-start w-full gap-2 my-5 ml-0 lg:ml-[3.75rem]">
            <span className="font-light">
              {locale.lang === 'en' ? 'Client: ' : 'Kund: '}
            </span>
            <h1 className="font-bold">{story.name}</h1>
          </div>
          <div className="flex container flex-col lg:flex-row mb-10 ml-0 lg:ml-[60px]">
            <div className="w-full lg:w-1/2 flex-col flex gap-5 container">
              <div className="flex gap-2 flex-col">
                <h2 className="text-[65px] lg:max-w-[80%] break-normal lg:text-[100px] leading-[70px] lg:leading-[100px]">
                  {story.content.title}
                </h2>
              </div>
              <span>{story?.content?.ingress}</span>
            </div>
            <div className="w-full lg:w-[47.6%] mt-5 lg:mt-0 flex flex-col gap-10 font-light-sofia text-[18px] lg:text-[25px] in_link">
              {render(story.content.content)}
            </div>
          </div>
        </div>
        <div className="w-full gap-5 container m-auto">
          {story.content &&
            Array.isArray(story.content.videos) &&
            story.content.videos.length > 0 &&
            story.content.videos.slice(0, 1).map((item: any) => (
              <div
                className={`object-cover relative ${
                  story.content.sound ? 'w-full lg:w-2/3 m-auto' : 'w-full'
                } `}
                key={item.filename}
              >
                <video controls playsInline className="w-full">
                  <source src={item.filename} />
                </video>
              </div>
            ))}
        </div>
        {story.content && Array.isArray(story.content.gallery) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 my-5 container m-auto">
            {story.content &&
              Array.isArray(story.content.gallery) &&
              story.content.gallery.length > 0 &&
              story.content.gallery.slice(0, 4).map((item: any) => (
                <div className="h-[377px] relative w-full" key={item.filename}>
                  {item.filename.endsWith('.mp4') ||
                  item.filename.endsWith('.mov') ? (
                    <video
                      autoPlay
                      muted
                      playsInline
                      loop
                      className="object-cover h-full w-full"
                    >
                      <source src={item?.filename || ''} />
                    </video>
                  ) : (
                    <Image
                      src={item?.filename || ''}
                      fill
                      alt=""
                      className="object-cover"
                    />
                  )}
                </div>
              ))}
          </div>
        )}
        {!story.content.hide_content_under_gallery && (
          <div className="flex flex-col gap-5 text-[20px] container m-auto my-10 font-light-sofia">
            {story.content.title_columns && (
              <span className="text-[22px] font-normal">
                {story.content.title_columns}
              </span>
            )}
            {story.content.hide_content_under_gallery && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 font-light text-[18px] lg:text-[20px]">
                <span>{render(story.content.text_under_gallery)}</span>
                <span>
                  {story.content?.two_column_text_2 &&
                    render(story.content.two_column_text_2)}
                </span>
              </div>
            )}
            {story.content.extrattitlecontent && (
              <div
                className="max-w-full lg:max-w-[40%] mt-20 flex flex-col gap-14 pb-10 mb-14"
                style={{ borderBottom: '1px solid #25364F' }}
              >
                <h3 className="text-[32px] lg:text-[50px] font-primary">
                  {story.content.extrattitlecontent}
                </h3>
                <span className="text-[14px] font-normal font-primary">
                  {story.content.extratitlecontentingress}
                </span>
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 my-5 container m-auto">
          {story.content &&
            Array.isArray(story.content.gallery) &&
            story.content.gallery.length > 4 &&
            story.content.gallery.slice(4, 8).map((item: any) => (
              <div className="h-[377px] relative w-full" key={item.filename}>
                {item.filename.endsWith('.mp4') ||
                item.filename.endsWith('.mov') ? (
                  <video
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="object-cover h-full w-full"
                  >
                    <source src={item?.filename || ''} />
                  </video>
                ) : (
                  <Image
                    src={item?.filename || ''}
                    fill
                    alt=""
                    className="object-cover"
                  />
                )}
              </div>
            ))}
        </div>

        <div className="flex flex-col gap-2 text-[18px] lg:text-[20px] max-w-full lg:max-w-[40%] container font-light-sofia">
          {render(story.content.text_under_video)}
        </div>
        <div className="w-ful gap-5 container m-auto">
          {Array.isArray(story.content.gallery) &&
            story.content.videos.length === 2 &&
            story.content.videos.slice(1, 2).map((item: any, index: number) => (
              <div className="object-cover relative w-full" key={index}>
                <video controls playsInline className="w-full">
                  <source src={item.filename} />
                </video>
              </div>
            ))}
        </div>
      </div>
      {story?.content?.footer_image?.filename && (
        <div className="w-full relative h-[602px] mb-5 container m-auto">
          <Image
            src={story?.content?.footer_image?.filename || ''}
            fill
            alt="placeholder"
            quality={100}
            className="object-cover bg-[-200px]"
          />
        </div>
      )}
      <motion.div whileHover="hover">
        <button
          className="m-auto flex justify-end items-center gap-2 container text-[#FF6062] mb-20 mt-20"
          onClick={handleNextClick}
        >
          {locale.lang === 'en' ? 'Next' : 'Nästa'}
          <motion.span
            variants={{
              hover: { x: 5 },
            }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <IoMdArrowForward fontSize={'1.3em'} color="#FF6062" />
          </motion.span>
        </button>
      </motion.div>
    </>
  )
}

export default CaseSlugPage
