'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

interface Props {
  props: any[]
  config: any
}

const Staplar = ({ props }: Props) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [open, setIsOpen] = useState(true)

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
    <div className="flex w-full relative gap-2">
      {props.map((item, index) => {
        return (
          <div
            onClick={() => handleView(index)}
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
                  className={`p-2 font-bold text-[28px] text-white transition-opacity text-center`}
                >
                  <span>{item.name}</span>
                </h2>
              )}

              {openIndex === index && (
                <div className="p-5 flex flex-col gap-2 w-full h-full  justify-end">
                  <h2 className={`font-bold text-4xl text-white`}>
                    <span>{item.name}</span>
                  </h2>
                  {typeof item?.content?.content === 'string' ? (
                    <div className="line-clamp-3 font-primary max-w-[60%] text-white reveal">
                      <span className="leading-[22px]">
                        {item.content.content}
                      </span>
                    </div>
                  ) : null}
                  <Link
                    href={`${item.full_slug}`}
                    className="z-10 button absolute right-5 bottom-5"
                  >
                    Läs mer
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
