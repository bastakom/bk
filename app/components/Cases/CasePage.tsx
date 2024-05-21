'use client'

import { useState } from 'react'
import Link from 'next/link'
import placeholder from '@/public/placeholder.png'
import Image from 'next/image'
import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

interface Props {
  props: any
  config: any
}

const CasePage = ({ props, config }: Props) => {
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

  console.log(config.config.data.story)

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
    if (Array.isArray(item.content.Kategori)) {
      item.content.Kategori.forEach((category: string) => {
        uniqueCategories.add(category)
      })
    } else {
      uniqueCategories.add(item.content.Kategori)
    }
  })

  return (
    <div className="w-full m-auto">
      <div className="mt-20 p-5 text-left flex gap-5 text-sm justify-center items-center">
        <Link
          key={100}
          href="#"
          onClick={() => handleCategoryClick('')}
          className={`font-primary ${
            selectedCategory === '' ? 'text-[#FF6063]' : ''
          }`}
        >
          Alla cases
        </Link>
        {Array.from(uniqueCategories).map((category: string, index: number) =>
          category ? (
            <Link
              className={`font-primary ${
                selectedCategory === category ? 'text-[#FF6063]' : ''
              }`}
              href="#"
              key={index}
              onClick={() => handleCategoryClick(category)}
            >
              {category}
            </Link>
          ) : null
        )}
      </div>
      <div className="flex m-auto">
        <div
          className="flex flex-wrap gap-5 justify-start pb-10 w-full"
          ref={container}
        >
          {props
            .filter(
              (item: any) =>
                !selectedCategory ||
                (Array.isArray(item.content.Kategori) &&
                  item.content.Kategori.includes(selectedCategory)) ||
                item.content.Kategori === selectedCategory
            )
            .map((item: any, index: number) => {
              return (
                <Link
                  key={index}
                  href={item.full_slug}
                  className="w-[32.4%] h-[400px] relative"
                  onMouseEnter={() => handleMouseEnter(item.content.uuid)}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="filtered-item h-full">
                    {item.content?.videoimage?.is_external_url ? (
                      <video
                        autoPlay
                        loop
                        muted
                        className="object-cover absolute h-full w-full transition-opacity duration-300"
                      >
                        <source src={`${item.content.videoimage.filename}`} />
                      </video>
                    ) : (
                      <Image
                        src={item.content.videoimage?.filename || placeholder}
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
                        hoveredItem === item.content.uuid
                          ? 'text-white opacity-100'
                          : 'text-white opacity-50'
                      } text-[25px] leading-10 font-bold font-primary`}
                    >
                      {item.name}
                    </span>
                    {item.content?.Kategori && (
                      <span className="text-[16px] font-bold font-primary text-white">
                        {Array.isArray(item.content.Kategori)
                          ? item.content.Kategori.join(', ')
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
  )
}

export default CasePage
