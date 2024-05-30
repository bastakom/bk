'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import Image from 'next/image'
import { render } from 'storyblok-rich-text-react-renderer'

interface Props {
  props: {
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
  }[]
}

const NewsComponent = ({ props, kategories }: Props) => {
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

  return (
    <div className="mt-24">
      <h1 className="font-bold-sofia">SENASTE NYHET</h1>
      <div className="h-[50vh] my-5 ">
        {props.slice(0, 1).map((item: any) => (
          <div className="grid grid-cols-2 h-full items-center justify-center p-10 m-auto">
            <div className="flex flex-col gap-5">
              {item.content.kategori
                .map((kat: any) => kategories.find((k) => k.uuid === kat)?.name)
                .join(' / ')}
              <h2
                className={`text-[28px] max-w-[80%] font-bold leading-[26px] ${
                  hoveredUuid === item.uuid ? 'opacity-100' : 'opacity-80'
                }`}
              >
                {item.name}
              </h2>
              <span className="max-w-[80%] line-clamp-3 font-primary">
                {render(item.content.content)}
              </span>
              <Link
                href={item.full_slug}
                key={item.uuid}
                className="text-[16px]"
              >
                Läs mer
              </Link>
            </div>
            <div className="relative h-full">
              <Image
                src={
                  item.content.future_picture.filename
                    ? item.content.image.filename
                    : item?.content?.image?.filename
                }
                fill
                className="object-cover"
                alt={item.name}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-5 mb-6">
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
            {item.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
        {filteredPosts.slice(1, 100).map((item) => {
          // const formattedDate = item.published_at
          //   ? format(new Date(`${item?.published_at}`), 'yyyy-MM-dd')
          //   : null
          return (
            <Link
              href={item.full_slug}
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
                  className="object-fit"
                  alt={item.name}
                />

                <div
                  className={`bg-[#25364f] absolute h-full w-full ${
                    hoveredUuid == item.uuid ? 'opacity-80' : 'opacity-40'
                  } transition-opacity duration-300`}
                />
              </div>
              <div className="flex w-full p-5 text-white justify-between items-end absolute bottom-0">
                <div className="flex flex-col gap-2 w-full">
                  <h2
                    className={`text-[24px] max-w-[80%] font-bold leading-[26px] ${
                      hoveredUuid === item.uuid ? 'opacity-100' : 'opacity-80'
                    }`}
                  >
                    {item.name}
                  </h2>
                  <div className="flex w-full justify-between">
                    <span className="text-[16px]">
                      {item.content.kategori
                        .map(
                          (kat) => kategories.find((k) => k.uuid === kat)?.name
                        )
                        .join(' / ')}
                    </span>

                    {/* <span
                      className={`opacity-0  -translate-x-5 transition-opacity transition-transform ease-in-out duration-500 ${
                        hoveredUuid === item.uuid &&
                        ' opacity-100 translate-x-0'
                      }`}
                    >
                      <FaArrowRightLong color="white" fontSize={'1.5rem'} />
                    </span> */}
                  </div>
                </div>
                {/* <span className="w-1/2 flex justify-end">{formattedDate}</span> */}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default NewsComponent
