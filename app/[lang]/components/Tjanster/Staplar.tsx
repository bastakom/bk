'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { GoPlus } from 'react-icons/go'
import { IoMdArrowForward } from 'react-icons/io'
import './loading.css'
import { render } from 'storyblok-rich-text-react-renderer'

interface Props {
  props: any[]
  config: any
}

const Staplar = ({ props }: Props) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [open, setIsOpen] = useState(true)
  const [click, isSetClicked] = useState(false)

  const params = useParams()

  const handleView = (index: number) => {
    if (isAnimating) return

    if (openIndex === index) {
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }

    if (openIndex === index) {
      setOpenIndex(null)
    } else {
      setIsAnimating(true)
      setOpenIndex(null)

      setTimeout(() => {
        setOpenIndex(index)
        setIsAnimating(false)
      }, 100)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row">
      {props.map((item, index) => {
        const translatedName = item.translated_slugs.flatMap(
          (translatedSlug: any) => translatedSlug.name
        )

        const itemHref =
          params.lang === 'sv' && item.slug === 'film'
            ? '/sv/filmproduktion'
            : `/${params.lang}/vara-tjanster/${item.slug}`

        const displayName =
          params.lang === 'sv' && item.slug === 'film'
            ? 'Filmproduktion'
            : translatedName && params.lang === 'en'
              ? translatedName
              : item.name

        return (
          <Link
            href={itemHref}
            id="tjanster"
            className={`h-[600px] ${
              openIndex === index ? 'w-full' : 'w-full lg:w-1/5'
            } bg-gray-200 flex flex-col justify-center transition-all duration-300 hover:cursor-pointer relative`}
            key={index}
          >
            {item.content.image && (
              <Image
                src={item.content.image.filename}
                fill
                alt={item.name}
                className="object-cover"
              />
            )}
            <div className="bg-black opacity-40 absolute top-0 h-full w-full" />
            <div className="z-10 h-full items-center flex flex-col lg:flex-row justify-center">
              {open && (
                <h2 className="p-2 font-bold text-[22px] text-white transition-opacity text-center flex gap-2 items-center">
                  {click && <div className="spinner top-2" />}
                  <span>{displayName}</span>
                  <span>
                    <IoMdArrowForward fontSize="1.5em" color="#FF6062" />
                  </span>
                </h2>
              )}

              {openIndex === index && (
                <div className="flex flex-col justify-center gap-2 items-center w-full p-2">
                  <div className="p-0 flex justify-center gap-14 w-full h-full flex-col lg:flex-row items-center">
                    <h2 className="font-bold text-xl text-white">
                      <span>{displayName}</span>
                    </h2>

                    <div className="font-primary max-w-[100%] lg:max-w-[60%] text-white reveal">
                      <span className="leading-[22px] text-left mb-5 lg:text-left">
                        {render(item.content.content)}
                      </span>
                      <span>
                        <Link
                          href={itemHref}
                          onClick={() => isSetClicked(true)}
                          className="text-left text-[#FF6062] text-[19px] lg:text-[16px] font-bold flex gap-2 justify-center lg:justify-start items-center z-20"
                        >
                          {params.lang === 'en' ? 'Read more' : 'Läs mer'}
                          <span>
                            <IoMdArrowForward fontSize="1.5em" />
                          </span>
                        </Link>
                      </span>
                    </div>

                    <GoPlus
                      className="rotate-45"
                      fontSize="2.4em"
                      color="#FF6062"
                    />
                  </div>
                </div>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}

export default Staplar
