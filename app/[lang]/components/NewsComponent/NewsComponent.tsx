'use client'

import { useState } from 'react'
import Link from 'next/link'
import { render } from 'storyblok-rich-text-react-renderer'
import Image from 'next/image'

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

  const filteredPosts = selectedCategory
    ? props.filter((item) => item.content.kategori.includes(selectedCategory))
    : props

  const handleMouseEnter = (uuid: string) => {
    setHoveredUuid(uuid)
  }

  const handleMouseLeave = () => {
    setHoveredUuid(null)
  }

  const getCategoryName = (uuid: string) => {
    const category = kategories.find((k) => k.uuid === uuid)
    if (!category) return ''
    if (locale === 'en' && category.translated_slugs) {
      const translatedSlug = category.translated_slugs.find(
        (slug) => slug.lang === 'en'
      )
      return translatedSlug && translatedSlug.name
        ? translatedSlug.name
        : category.name
    }
    return category.name
  }

  return (
    <div className="mt-24">
      <div className="h-[70vh] my-5 ">
        {props.slice(0, 1).map((item: any, index: number) => (
          <div
            className="grid grid-cols-2 h-full items-center justify-center py-10 m-auto"
            key={index}
          >
            <div className="flex flex-col gap-5 px-6 bg-[#EFE9E2] h-full justify-center">
              <h1 className="font-bold-sofia">
                {locale === 'en' ? 'LATEST NEWS' : 'SENASTE NYHET'}
              </h1>
              {item.content.kategori
                .map((kat: any) => getCategoryName(kat))
                .join(' / ')}
              <h2
                className={`text-[45px] max-w-[80%] font-bold leading-[40px] ${
                  hoveredUuid === item.uuid ? 'opacity-100' : 'opacity-80'
                }`}
              >
                {item.name}
              </h2>
              <span className="max-w-[80%] line-clamp-3 font-primary">
                {render(item.content.content)}
              </span>
              <Link
                href={`nyheter/${item.slug}`}
                key={item.uuid}
                className="text-[16px]"
              >
                Läs mer
              </Link>
            </div>
            <div className="relative h-full w-full">
              <Image
                src={
                  item.content.future_picture.filename
                    ? item.content.image.filename
                    : item?.content?.image?.filename
                }
                fill
                className="object-fit"
                alt={item.name}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-5 mb-6 justify-center">
        <button
          onClick={() => setSelectedCategory('')}
          className={`${selectedCategory === '' ? 'text-[#FF6063]' : ''}`}
        >
          Alla nyheter
        </button>
        {kategories.map((item) => (
          <button
            key={item.uuid}
            onClick={() => setSelectedCategory(item.uuid)}
            className={`${
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-3 3xl:grid-cols-3">
        {filteredPosts.slice(1, 100).map((item) => (
          <Link
            href={`nyheter/${item.slug}`}
            key={item.uuid}
            className="relative min-h-[400px]"
            onMouseEnter={() => handleMouseEnter(item.uuid)}
            onMouseLeave={handleMouseLeave}
          >
            <div className="h-full w-full relative">
              <Image
                src={
                  item.content.future_picture.filename
                    ? item.content.future_picture.filename
                    : item?.content?.image?.filename
                }
                fill
                className="object-cover"
                alt={item.name}
              />

              <div
                className={`bg-[#121212] absolute h-full w-full ${
                  hoveredUuid == item.uuid ? 'opacity-80' : 'opacity-40'
                } transition-opacity duration-300`}
              />
            </div>
            <div className="flex w-full p-5 text-white justify-between items-end absolute bottom-0">
              <div className="flex flex-col w-full">
                <h2
                  className={`text-[24px] max-w-[80%] font-bold ${
                    hoveredUuid === item.uuid ? 'opacity-100' : 'opacity-100'
                  }`}
                >
                  {item.name}
                </h2>
                <div className="flex w-full justify-between">
                  <span className="text-[16px]">
                    {item.content.kategori
                      .map((kat) => getCategoryName(kat))
                      .join(' / ')}
                  </span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default NewsComponent
