'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { GoPlus } from 'react-icons/go'
import { IoMdArrowForward } from 'react-icons/io'

interface Props {
  props: any[]
  config: any
}

const Staplar = ({ props }: Props) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [open, setIsOpen] = useState(true)

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
    <div className="flex w-full relative gap-2 mt-10" id="tjanster">
      {props.map((item, index) => {
        const translatedName = item.translated_slugs.flatMap(
          (item: any) => item.name
        )

        return (
          <div
            onClick={() => handleView(index)}
            id="tjanster"
            className={`h-[600px] ${
              openIndex === index ? 'w-full' : 'w-1/5'
            } bg-gray-200 flex flex-col justify-center transition-all duration-300 hover:cursor-pointer relative`}
            key={index}
          >
            {item.content.image && (
              <Image
                src={`${
                  item.content.image ? item?.content?.image.filename : null
                }`}
                fill
                alt={item.name}
                className="object-cover"
              />
            )}
            <div className="bg-black opacity-40 absolute top-0 h-full w-full" />
            <div className="z-10 h-full items-center flex justify-center">
              {open && (
                <h2
                  className={`p-2 font-bold text-[22px] text-white transition-opacity text-center flex gap-2 items-center`}
                >
                  <span>
                    {translatedName && params.lang === 'en'
                      ? translatedName
                      : item.name}
                  </span>
                  <span>
                    <GoPlus
                      fontSize={'1.4em'}
                      className="mt-1"
                      color="#FF6062"
                    />
                  </span>
                </h2>
              )}

              {openIndex === index && (
                <div className="flex flex-col justify-center gap-2">
                  <div className="p-5 flex justify-center gap-10 w-full h-full  justify-center items-center">
                    <h2 className={`font-bold text-xl text-white`}>
                      <span>
                        {translatedName && params.lang === 'en'
                          ? translatedName
                          : item.name}
                      </span>
                    </h2>
                    {typeof item?.content?.content === 'string' ? (
                      <div className="line-clamp-3 font-primary max-w-[60%] text-white reveal">
                        <span className="leading-[22px]">
                          {item.content.content}
                        </span>
                      </div>
                    ) : null}
                    <GoPlus
                      className="rotate-45"
                      fontSize={'2.4em'}
                      color="#FF6062"
                    />
                  </div>
                  <Link
                    href={`${item.full_slug}`}
                    className="text-center text-[#FF6062] text-xl font-bold flex gap-2 justify-center items-center"
                    style={{ fontSize: '16px' }}
                  >
                    {params.lang === 'en' ? 'Read more' : 'Läs mer'}
                    <span className="">
                      <IoMdArrowForward fontSize={'1.5em'} />
                    </span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default Staplar
