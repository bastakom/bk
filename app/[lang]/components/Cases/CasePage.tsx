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

const CasePage = ({ props, config, locale }: Props) => {
  const [selectedCategory, setSelectedCategory] = useState('')
  const [data, setData] = useState<{ data: { stories: any[] } } | null>(null)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const container = useRef<HTMLInputElement>(null)

  const enCat = props.flatMap((item: any) => item.content.categoriesen)

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

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category)
  }

  if (!data) return <div>Loading...</div>
  const uniqueCategories = new Set<string>()

  props.forEach((item: any) => {
    if (locale === 'en') {
      if (Array.isArray(item.content.categoriesen)) {
        item.content.categoriesen.forEach((category: string) => {
          uniqueCategories.add(category)
        })
      }
    } else {
      if (Array.isArray(item.content.Kategori)) {
        item.content.Kategori.forEach((category: string) => {
          uniqueCategories.add(category)
        })
      } else {
        uniqueCategories.add(item.content.Kategori)
      }
    }
  })

  return (
    <div className="w-full m-auto bg-[#F7F0EE] full-width-element pb-14 no-padding-bottom px-4 lg:px-0">
      <div className="container m-auto">
        <div className="min-h-[55vh] flex flex-col justify-center mt-14  lg:mt-0 lg:ml-10 gap-5">
          <h1 className="text-[20px]">{config.content.case_title}</h1>
          <span className="lg:max-w-[50%] text-[20px] lg:text-[25px]">
            {render(config.content.case_content)}
          </span>
        </div>
        <div className="z-10 relative">
          <div className="py-5 text-left flex gap-5 lg:gap-10 mb-5 text-sm lg:ml-10 items-center left-0 z-50 flex-wrap">
            <button
              key={100}
              onClick={() => handleCategoryClick('')}
              className={`font-primary uppercase text-[14px] ${
                selectedCategory === '' ? 'text-[#FF6063]' : ''
              }`}
            >
              {locale === 'en' ? 'All Case' : 'Alla Case'}
            </button>
            {Array.from(uniqueCategories).map(
              (category: string, index: number) =>
                category ? (
                  <button
                    className={`font-primary uppercase text-[14px] ${
                      selectedCategory === category ? 'text-[#FF6063]' : ''
                    }`}
                    key={index}
                    onClick={() => handleCategoryClick(category)}
                  >
                    {category}
                  </button>
                ) : null
            )}
          </div>
          <div className="flex m-auto">
            <div
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 justify-start pb-10 w-full m-auto"
              ref={container}
            >
              {props
                .filter((item: any) => {
                  const categories =
                    locale === 'en'
                      ? Array.isArray(item.content.categoriesen)
                        ? item.content.categoriesen
                        : []
                      : Array.isArray(item.content.Kategori)
                      ? item.content.Kategori
                      : [item.content.Kategori]
                  return (
                    !selectedCategory || categories.includes(selectedCategory)
                  )
                })
                .map((item: any, index: number) => {
                  return (
                    <Link
                      key={item.uuid}
                      href={`/${item.full_slug}`}
                      className="w-full h-[300px] lg:h-[400px] relative"
                      onMouseEnter={() => handleMouseEnter(item.uuid)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <div className="filtered-item h-full">
                        <div
                          className={`transition-opacity duration-300 ${
                            hoveredItem === item.uuid
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
                          className={`transition-opacity duration-300 ${
                            hoveredItem === item.uuid
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

export default CasePage
