'use client'

import { useState } from 'react'
import Link from 'next/link'
import { render } from 'storyblok-rich-text-react-renderer'
import Image from 'next/image'
import { GoPlus } from 'react-icons/go'
import { FiMinus } from 'react-icons/fi'

interface Props {
  props: {
    slug: any
    full_slug: string
    name: string
    published_at: string
    uuid: string

    content: {
      future_picture: any
      image: any
      kategori: string[]
    }
  }[]

  kategories: {
    name: string
    uuid: string
    translated_slugs?: {
      path: string
      name: string | null
      lang: string
      published: string | null
    }[]
  }[]

  locale: string
}

const NewsComponent = ({ props, kategories, locale }: Props) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [hoveredUuid, setHoveredUuid] = useState<string | null>(null)
  const [openFilter, isOpenFilter] = useState(false)

  const handleOpenFilter = () => {
    isOpenFilter(!openFilter)
  }

  const filteredPosts = selectedCategory
    ? props.filter((item) => item.content.kategori.includes(selectedCategory))
    : props

  const handleMouseEnter = (uuid: string) => {
    setHoveredUuid(uuid)
  }

  const handleMouseLeave = () => {
    setHoveredUuid(null)
  }

  // const getCategoryName = (uuid: string) => {
  //   const category = kategories.find((k) => k.uuid === uuid)
  //   if (!category) return ''
  //   if (locale === 'en' && category.translated_slugs) {
  //     const translatedSlug = category.translated_slugs.find(
  //       (slug) => slug.lang === 'en'
  //     )
  //     return translatedSlug && translatedSlug.name
  //       ? translatedSlug.name
  //       : category.name
  //   }
  //   return category.name
  // }

  const firstContent =
    'Bästa Kompisar · Best Friends · Bedste venner · Parhaat ystävät · Migliori amici · Meilleurs amis · Beste vrienden · Mejores amigos · Beste Freunde ·'
  const nextContent =
    'Лучшие друзья- 最好的朋友 - 親友 - أعز اصدقاء · Amici optimi Bästa Kompisar · Best Friends · Bestevenner  · Parhaat ystävät · Migliori amici · Meilleurs amis ·'

  return (
    <div className="m-auto">
      <div className="pt-24 pb-5 bg-[#F7F0EE] full-width-element">
        <div className="marquee-section m-auto">
          <div className="loop-div-right">
            <div className="marquee flex gap-2 text-[18px] reel-text-color">
              <span>{firstContent}</span>
              <span>{firstContent}</span>
              <span>{firstContent}</span>
            </div>
          </div>
        </div>
        <div className="marquee-section m-auto">
          <div className="loop-div-left">
            <div className="marquee flex gap-2 text-[18px] reel-text-color">
              <span>{nextContent}</span>
              <span>{nextContent}</span>
              <span>{nextContent}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="full-width-element bg-[#F7F0EE] mb-14 pb-10">
        <div className=" flex container m-auto">
          {props.slice(0, 1).map((item: any, index: number) => (
            <Link href={`nyheter/${item.slug}`} key={item.uuid}>
              <div
                className="grid grid-cols-2 gap-5 h-full items-center justify-center py-10 m-auto"
                key={index}
              >
                <div className="flex flex-col gap-10 px-6 h-full justify-center">
                  <h1 className="font-normal font-primary text-[20px]">
                    {locale === 'en' ? 'LATEST NEWS' : 'SENASTE NYHET'}
                  </h1>
                  <h2
                    className={`text-[70px] w-full font-normal leading-[85px] ${
                      hoveredUuid === item.uuid ? 'opacity-100' : 'opacity-80'
                    }`}
                  >
                    {item.name}
                  </h2>
                  <span className="font-primary font-normal text-xl">
                    23.12.18
                  </span>
                  <span className="max-w-[80%] text-[20px] leading-[32px] line-clamp-5 font-normal font-primary">
                    {render(item.content.content)}
                  </span>
                </div>
                <div className="relative h-full w-[500px]">
                  <Image
                    src={
                      item.content.future_picture.filename
                        ? item.content.image.filename
                        : item?.content?.image?.filename
                    }
                    fill
                    className="object-contain"
                    alt={item.name}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <button
        className="text-right flex gap-2 items-center justify-end w-full mb-10 font-bold text-[22px]"
        onClick={handleOpenFilter}
      >
        Filter
        <span className="mt-1">
          {!openFilter ? (
            <GoPlus fontSize={'1.5em'} color="#FF6062" />
          ) : (
            <FiMinus fontSize={'1.5em'} color="#FF6062" />
          )}
        </span>
      </button>
      {openFilter && (
        <div className="flex flex-wrap gap-5 mb-6 justify-start border-b-2 border-t-2 p-5">
          <button
            onClick={() => setSelectedCategory('')}
            className={`uppercase ${
              selectedCategory === '' ? 'text-[#FF6063]' : ''
            }`}
          >
            {locale === 'en' ? 'All news' : 'Alla nyheter'}
          </button>
          {kategories.map((item) => (
            <button
              key={item.uuid}
              onClick={() => setSelectedCategory(item.uuid)}
              className={`uppercase ${
                selectedCategory === item.uuid ? 'text-[#FF6063]' : ''
              }`}
            >
              {locale === 'en' && item.translated_slugs
                ? item.translated_slugs.find((slug) => slug.lang === 'en')
                    ?.name || item.name
                : item.name}
            </button>
          ))}
        </div>
      )}
      <div className="grid h-full gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 3xl:grid-cols-3">
        {filteredPosts.slice(1, 100).map((item) => (
          <Link
            href={`nyheter/${item.slug}`}
            key={item.uuid}
            className="flex flex-col gap-5 mb-10"
            onMouseEnter={() => handleMouseEnter(item.uuid)}
            onMouseLeave={handleMouseLeave}
          >
            <Image
              src={
                item.content.future_picture.filename
                  ? item.content.future_picture.filename
                  : item?.content?.image?.filename
              }
              height={390}
              width={500}
              className="object-cover"
              style={{ height: '521px', width: '100%' }}
              alt={item.name}
            />

            {/* <div
                className={`bg-[#121212] absolute h-full w-full ${
                  hoveredUuid == item.uuid ? 'opacity-80' : 'opacity-40'
                } transition-opacity duration-300`}
              /> */}
            <div className="flex flex-col gap-2">
              <h2
                className={`text-[30px] max-w-[80%] font-primary font-normal ${
                  hoveredUuid === item.uuid ? 'opacity-100' : 'opacity-100'
                }`}
              >
                {item.name}
              </h2>
              <span className="font-primary font-normal text-xl">23.12.18</span>
            </div>
            {/* <div className="flex w-full justify-between">
                  <span className="text-[16px]">
                    {item.content.kategori
                      .map((kat) => getCategoryName(kat))
                      .join(' / ')}
                  </span>
                </div> */}
          </Link>
        ))}
      </div>
    </div>
  )
}

export default NewsComponent
