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

function caseCategories(item: any, locale: string) {
  if (locale === 'en') {
    return Array.isArray(item?.content?.categoriesen)
      ? item.content.categoriesen.filter(Boolean)
      : []
  }

  if (Array.isArray(item?.content?.Kategori)) {
    return item.content.Kategori.filter(Boolean)
  }

  return item?.content?.Kategori ? [item.content.Kategori] : []
}

function localizedCaseHref(fullSlug: string | undefined, locale: string) {
  const normalized = fullSlug?.replace(/^\/+|\/+$/g, '') || ''

  if (!normalized) return `/${locale}/cases`
  if (normalized === locale || normalized.startsWith(`${locale}/`)) {
    return `/${normalized}`
  }

  return `/${locale}/${normalized}`
}

function richTextToPlainText(value: any): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(richTextToPlainText).join(' ')
  if (typeof value !== 'object') return ''

  const ownText = typeof value.text === 'string' ? value.text : ''
  const childText = Array.isArray(value.content)
    ? value.content.map(richTextToPlainText).join(' ')
    : ''

  return `${ownText} ${childText}`.trim()
}

function truncateText(value: string, maxLength = 155) {
  const cleanValue = value.replace(/\s+/g, ' ').trim()
  if (cleanValue.length <= maxLength) return cleanValue

  return `${cleanValue.slice(0, maxLength).replace(/\s+\S*$/, '')}...`
}

function caseDescription(item: any, locale: string) {
  const content = item?.content || {}
  const categories = caseCategories(item, locale).join(' / ')

  return truncateText(
    content.ingress ||
      content.description ||
      content.meta_description ||
      richTextToPlainText(content.content) ||
      categories
  )
}

function caseImageAlt(item: any) {
  const image = item?.content?.videoimage

  return (
    image?.alt ||
    image?.name ||
    `${item?.name || 'Case'} - kundcase fran Basta Kompisar`
  )
}

const CasePage = ({ props, config, locale }: Props) => {
  const [selectedCategory, setSelectedCategory] = useState('')
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const container = useRef<HTMLInputElement>(null)

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

  const uniqueCategories = new Set<string>()

  props.forEach((item: any) => {
    caseCategories(item, locale).forEach((category: string) => {
      uniqueCategories.add(category)
    })
  })

  return (
    <div className="w-full m-auto bg-[#F7F0EE] full-width-element pb-14 no-padding-bottom px-4 lg:px-0">
      <div className="container m-auto">
        <div className="h-full pt-16 lg:pt-44 pb-20 flex flex-col justify-center mt-14  lg:mt-0 lg:ml-10 gap-5">
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
            {Array.from(uniqueCategories).map((category: string) =>
              category ? (
                <button
                  className={`font-primary uppercase text-[14px] ${
                    selectedCategory === category ? 'text-[#FF6063]' : ''
                  }`}
                  key={category}
                  onClick={() => handleCategoryClick(category)}
                >
                  {category}
                </button>
              ) : null
            )}
          </div>
          <div className="flex m-auto">
            <div
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-4 justify-start pb-10 gap-5 lg:gap-0 w-full m-auto"
              ref={container}
            >
              {props
                .filter((item: any) => {
                  const categories = caseCategories(item, locale)
                  return !selectedCategory || categories.includes(selectedCategory)
                })
                .map((item: any) => {
                  const categories = caseCategories(item, locale)
                  const description = caseDescription(item, locale)

                  return (
                    <Link
                      key={item.uuid}
                      href={localizedCaseHref(item.full_slug, locale)}
                      className="w-full h-[400px] lg:h-[400px] relative"
                      onMouseEnter={() => handleMouseEnter(item.uuid)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <div className="filtered-item h-full">
                        <div
                          className={`transition-opacity duration-300 ${
                            hoveredItem === item.uuid ? 'opacity-80' : 'opacity-0'
                          } absolute inset-0 bg-[#25364f] z-10`}
                        />

                        {item?.content?.videoimage?.filename?.endsWith('.mp4') ||
                        item?.content?.videoimage?.filename?.endsWith('.mov') ? (
                          <video
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="object-cover absolute h-full w-full transition-opacity duration-300"
                            aria-label={caseImageAlt(item)}
                          >
                            <source src={`${item.content.videoimage.filename}`} />
                          </video>
                        ) : (
                          <Image
                            src={item.content.videoimage?.filename || placeholder}
                            height={500}
                            width={500}
                            style={{ width: '100%', height: '400px' }}
                            alt={caseImageAlt(item)}
                            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw"
                            className="object-cover absolute h-full w-full"
                          />
                        )}
                      </div>

                      <div className="flex p-5 h-full w-full items-start justify-end z-20 absolute flex-col bottom-0">
                        <span
                          className={`transition-opacity duration-300 ${
                            hoveredItem === item.uuid
                              ? 'text-white opacity-100'
                              : 'text-white opacity-100'
                          } text-[28px] leading-10 font-bold font-primary`}
                        >
                          {item.name}
                        </span>
                        {categories.length > 0 && (
                          <span className="text-[16px] font-light italic font-primary text-white">
                            {categories.join(' / ')}
                          </span>
                        )}
                        {description && (
                          <p className="mt-2 max-h-[64px] max-w-[90%] overflow-hidden text-[14px] leading-[21px] font-light font-primary text-white">
                            {description}
                          </p>
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
