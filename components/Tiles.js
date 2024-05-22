import React from 'react'
import { storyblokEditable } from '@storyblok/react'
import CountUp from 'react-countup'
import { useInView } from 'react-intersection-observer'

const Tiles = ({ blok }) => {
  return (
    <div
      {...storyblokEditable(blok)}
      className="grid grid-cols-4 p-14 gap-20 my-10 text-[#25364F] dark:text-white"
    >
      {blok.tile.map((item, index) => {
        const { ref, inView } = useInView({
          triggerOnce: true,
          threshold: 0.1,
        })

        return (
          <div key={index} className="flex flex-col gap-5" ref={ref}>
            <span className="flex flex-col gap-2">
              <h2 className="uppercase font-bold">{item.title}</h2>
              <h3 className="text-6xl font-bold">
                {inView && <CountUp end={item.number} duration={2} />}
                {item.procent ? '%' : null}
              </h3>
            </span>
            <p>{item.content}</p>
          </div>
        )
      })}
    </div>
  )
}

export default Tiles
