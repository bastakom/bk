'use client'

import React, { useEffect, useRef } from 'react'
import Image from 'next/image'
import { IoMdArrowForward } from 'react-icons/io'
import { render } from 'storyblok-rich-text-react-renderer'

interface Props {
  tiles: any
  header: string
  content: string
}

const TilesIcons = ({ tiles, header, content }: Props) => {
  const tileRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('fade-in')
          }
        })
      },
      { threshold: 0.1 }
    )

    tileRefs.current.forEach((tile) => {
      if (tile) observer.observe(tile)
    })

    return () => {
      if (tileRefs.current) {
        tileRefs.current.forEach((tile) => {
          if (tile) observer.unobserve(tile)
        })
      }
    }
  }, [])

  return (
    <div
      className="px-5 lg:px-20 pb-36 pt-14 w-full lg:w-[100%] m-auto"
      id="process"
    >
      <div className="flex flex-col lg:w-2/3 w-full gap-10 mt-14">
        <h2 className="text-[40px] lg:text-[70px] font-normal text-[#25364F]">
          {header}
        </h2>
        <span className="text-[20px] w-[100%] lg:w-[80%]">{content}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-1 justify-center pt-32 gap-24">
        {tiles.map((item: any, index: number) => (
          <div
            key={item._uid}
            ref={(el: any) => (tileRefs.current[index] = el)}
            className={`flex gap-10 ${
              index % 2 !== 0
                ? 'flex-col lg:flex-row'
                : 'flex-col lg:flex-row-reverse'
            } justify opacity-0`}
          >
            <div className="w-full lg:w-1/2 flex h-full items-center justify-center">
              <Image
                src={item.icon.filename}
                width={488}
                height={365}
                alt={item.icon.filename}
                className="mix-blend-darken"
              />
            </div>
            <div className="flex items-center justify-between"></div>
            <div className="bullets flex flex-col gap-10 text-[18px] font-light w-full lg:w-1/2">
              <h3 className="font-normal text-[30px] text-[#ef6966]">
                {item.title}
              </h3>
              <div className="max-w-[100%] flex flex-col gap-10">
                {render(item.text)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TilesIcons
