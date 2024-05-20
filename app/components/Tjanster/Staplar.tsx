'use client'

import Link from 'next/link'
import { useState } from 'react'

interface Props {
  props: any[]
}

const Staplar = ({ props }: Props) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const handleView = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <div className="flex w-full h-full relative gap-2">
      {props.map((item, index) => {
        if (openIndex === index) {
          return (
            <div
              onClick={() => handleView(index)}
              className=" w-full h-[600px] absolute bg-gray-200 flex flex-col justify-center transition-all duration-300"
              key={index}
            >
              <h2 className="p-2 font-bold text-2xl">{item.name}</h2>
              <Link href="#" className="p-2">
                LÄS MER FÖRFAN!
              </Link>
            </div>
          )
        } else if (openIndex === null) {
          return (
            <div
              onClick={() => handleView(index)}
              className="h-[600px] w-1/5 bg-gray-200 flex flex-col justify-center transition-all duration-300"
              key={index}
            >
              <div>
                <h2 className="p-2 font-bold text-2xl">{item.name}</h2>
              </div>
            </div>
          )
        } else {
          return null
        }
      })}
    </div>
  )
}

export default Staplar
