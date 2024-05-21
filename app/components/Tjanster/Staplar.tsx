'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'

interface Props {
  props: any[]
}

const Staplar = ({ props }: Props) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [open, setIsOpen] = useState(true)

  const handleView = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
    if (openIndex === index) {
      setIsOpen(true)
    } else {
      setIsOpen(false)
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
            <div className="bg-black opacity-30 absolute top-0 h-full w-full" />
            <div className="z-10">
              {open && <h2 className="p-2 font-bold text-lg text-white">{item.name}</h2>}
              {openIndex === index && (
                <div className="p-2">
                  <h2 className="font-bold text-lg text-white">{item.name}</h2>
                  <Link href={`${item.full_slug}`} className="z-50">
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
