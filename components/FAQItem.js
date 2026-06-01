'use client'

import { useState } from 'react'
import { storyblokEditable } from '@storyblok/react/rsc'

const FAQItem = ({ blok }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div
      className="border-b border-black"
      {...storyblokEditable(blok)}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left py-8 gap-8"
      >
        <h3 className="text-xl lg:text-2xl font-bold">
          {blok.question}
        </h3>

        <span
          className={`text-3xl leading-none transition-transform duration-300 flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          ↓
        </span>
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-[500px] pb-8' : 'max-h-0'
        }`}
      >
        <p className="text-base lg:text-lg leading-relaxed max-w-[900px]">
          {blok.answer}
        </p>
      </div>
    </div>
  )
}

export default FAQItem
