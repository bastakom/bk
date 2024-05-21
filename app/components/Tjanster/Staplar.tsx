'use client'

import { useState } from 'react'

interface Props {
  props: any[]
}

const Staplar = ({ props }: Props) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [open, setIsOpen] = useState(false)

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
      {props.map((item, index) => (
        <div
          onClick={() => handleView(index)}
          className={`h-[600px] ${
            openIndex === index ? 'w-full' : 'w-1/5'
          } bg-gray-200 flex flex-col justify-center transition-all duration-300 hover:cursor-pointer`}
          key={index}
        >
          <div>
            {open && <h2 className="p-2 font-bold text-lg">{item.name}</h2>}
            {openIndex === index && (
              <h2 className="p-2 font-bold text-lg">{item.name}</h2>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default Staplar
