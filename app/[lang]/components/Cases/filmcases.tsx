
'use client'

import { useState } from 'react'
import Link from 'next/link'
import placeholder from '@/public/placeholder.png'
import Image from 'next/image'
import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { render } from 'storyblok-rich-text-react-renderer'

interface Props {
  props: any
  config: any
  locale: string
}

const FilmCases = ({ props, config, locale }: Props) => {
  const [selectedCategory, setSelectedCategory] = useState('')
  const [data, setData] = useState<{ data: { stories: any[] } } | null>(null)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const container = useRef<HTMLInputElement>(null)


  useGSAP(() => {
    async function fetchData() {
      const casesData = props
      setData(casesData)
    }
    fetchData()
  }, [])

  useGSAP(() => {
    gsap.fromTo(
      '.filtered-item',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.1 }
    )
  }, [selectedCategory])

  const handleMouseEnter = (uuid: string) => {
    setHoveredItem(uuid)
  }

  const handleMouseLeave = () => {
    setHoveredItem(null)
  }


  if (!data) return <div>Loading...</div>


  return (
    <div className="w-full pt-14 m-auto full-width-element pb-14 no-padding-bottom px-4 lg:px-0">
      <div className=" m-auto px-8">
        <div className="z-10 relative">
          <div className="flex m-auto">
            <div
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 justify-start pb-10 gap-5 lg:gap-0 w-full m-auto"
              ref={container}
            >
              {props.map((item: any) => {
                return (
                  <Link
                    key={item.uuid}
                    href={`/${item.full_slug}`}
                    className="w-full h-[400px] lg:h-[400px] relative"
                    onMouseEnter={() => handleMouseEnter(item.uuid)}
                    onMouseLeave={handleMouseLeave}
                  >
                    <div className="filtered-item h-full">
                      <div
                        className={`transition-opacity duration-300 ${hoveredItem === item.uuid
                          ? 'opacity-80'
                          : 'opacity-0'
                          } absolute inset-0 bg-[#25364f] z-10`}
                      />

                      {item?.content?.videoimage?.filename?.endsWith(
                        '.mp4'
                      ) ||
                        item?.content?.videoimage?.filename?.endsWith(
                          '.mov'
                        ) ? (
                        <video
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="object-cover absolute h-full w-full transition-opacity duration-300"
                        >
                          <source
                            src={`${item.content.videoimage.filename}`}
                          />
                        </video>
                      ) : (
                        <Image
                          src={
                            item.content.videoimage?.filename || placeholder
                          }
                          height={500}
                          width={500}
                          style={{ width: '100%', height: '400px' }}
                          alt="placeholder"
                          className="object-cover absolute h-full w-full"
                        />
                      )}
                    </div>

                    <div
                      className={`flex p-5 h-full w-full items-start justify-end z-20 absolute flex-col bottom-0`}
                    >
                      <span
                        className={`transition-opacity duration-300 ${hoveredItem === item.uuid
                          ? 'text-white opacity-100'
                          : 'text-white opacity-100'
                          } text-[28px] leading-10 font-bold font-primary`}
                      >
                        {item.name}
                      </span>
                      {locale === 'en'
                        ? item.content.categoriesen && (
                          <span className="text-[16px] font-light italic font-primary text-white">
                            {item.content.categoriesen.join(', ')}
                          </span>
                        )
                        : item.content.Kategori && (
                          <span className="text-[16px] font-light italic font-primary text-white">
                            {Array.isArray(item.content.Kategori)
                              ? item.content.Kategori.join(' / ')
                              : item.content.Kategori}
                          </span>
                        )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FilmCases
