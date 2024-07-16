'use client'

import placeholder from '@/public/placeholder.png'
import Image from 'next/image'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { MdKeyboardArrowLeft, MdKeyboardArrowRight } from 'react-icons/md'
import Slider from 'react-slick'
import { useParams } from 'next/navigation'
import Button from '../Button/Button'

interface Props {
  props: any
}

function CasesReelComponent({ props }: Props) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [showPrevArrow, setShowPrevArrow] = useState<boolean>(false)
  const [showNextArrow, setShowNextArrow] = useState<boolean>(true)

  const router = useParams()

  const handleMouseEnter = (uuid: string) => {
    setHoveredItem(uuid)
  }

  const handleMouseLeave = () => {
    setHoveredItem(null)
  }

  const NextArrow = ({ onClick }: any) => (
    <button
      className="custom-next-arrow"
      onClick={onClick}
      style={{ display: showNextArrow ? 'block' : 'none' }}
    >
      <MdKeyboardArrowRight fontSize={'3.5rem'} />
    </button>
  )

  const PrevArrow = ({ onClick }: any) => (
    <button
      className="custom-prev-arrow"
      onClick={onClick}
      style={{ display: showPrevArrow ? 'block' : 'none' }}
    >
      <MdKeyboardArrowLeft fontSize={'3.5rem'} />
    </button>
  )

  const sliderRef = useRef<Slider>(null)

  const nextSlide = () => {
    if (sliderRef.current) {
      sliderRef.current.slickNext()
    }
  }

  const prevSlide = () => {
    if (sliderRef.current) {
      sliderRef.current.slickPrev()
    }
  }

  const handleSliderChange = (currentSlide: number, slideCount: number) => {
    setShowPrevArrow(currentSlide > 0)

    if (currentSlide + settings.slidesToShow >= slideCount) {
      setShowNextArrow(false)
    } else {
      setShowNextArrow(true)
    }
  }
  const settings = {
    dots: false,
    infinite: false,
    arrows: false,
    autoplay: false,
    speed: 500,
    slidesToShow: 2.5,
    slidesToScroll: 2,
    responsive: [
      {
        breakpoint: 600,
        settings: {
          slidesToShow: 2,
          slidesToScroll: 2,
          initialSlide: 2,
        },
      },
      {
        breakpoint: 480,
        settings: {
          slidesToShow: 1,
          slidesToScroll: 1,
        },
      },
    ],
  }

  return (
    <div className="flex flex-col gap-5 relative">
      <Slider
        key="1"
        {...settings}
        ref={sliderRef}
        afterChange={(currentSlide: number) =>
          handleSliderChange(currentSlide, props.length)
        }
      >
        {props.map((item: any) => {
          return (
            <Link
              key={item.uuid}
              href={`/${item.full_slug ? item.full_slug : ''} `}
              className="relative h-[500px] overflow-hidden"
              onMouseEnter={() => handleMouseEnter(item.uuid)}
              onMouseLeave={handleMouseLeave}
            >
              {item?.content?.videoimage?.filename.endsWith('.mp4') ? (
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="object-cover absolute h-full w-full transition-opacity duration-300"
                >
                  <source src={`${item?.content?.videoimage?.filename}`} />
                </video>
              ) : (
                <Image
                  src={item.content?.videoimage?.filename || placeholder}
                  fill
                  alt={item.title}
                  className="object-cover absolute h-full transition-opacity duration-300"
                />
              )}
              <div
                className={`transition-opacity duration-300 ${
                  hoveredItem === item.uuid ? 'opacity-80' : 'opacity-40'
                } absolute inset-0 bg-[#25364f]`}
              />
              <div
                className={`flex p-5 h-full w-full items-start justify-end z-20 absolute flex-col`}
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
                {item.content?.Kategori && (
                  <span className="text-[18px] font-light italic font-primary text-white">
                    {router.lang === 'en'
                      ? (() => {
                          const categories =
                            item.content.categoriesen || item.content.Kategori
                          return Array.isArray(categories)
                            ? categories.join(' / ')
                            : categories
                        })()
                      : Array.isArray(item.content.Kategori)
                      ? item.content.Kategori.join(' / ')
                      : item.content.Kategori}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </Slider>
      {props.length > 3 && (
        <div className="flex justify-end z-20">
          <PrevArrow
            onClick={prevSlide}
            style={{ display: showPrevArrow ? 'block' : 'none' }}
          />
          <NextArrow
            onClick={nextSlide}
            style={{ display: showNextArrow ? 'block' : 'none' }}
          />
        </div>
      )}
      <Button
        TextEN="See all cases"
        TextSV="Se alla cases"
        align="center"
        size="20"
        href={`cases`}
      />
    </div>
  )
}

export default CasesReelComponent
