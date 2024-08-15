import React from 'react'
import { storyblokEditable } from '@storyblok/react'
import CountUp from 'react-countup'
import { useInView } from 'react-intersection-observer'

const Tiles = ({ blok }) => {
  return (
    <div
      {...storyblokEditable(blok)}
      className="grid grid-cols-1 full-width-element no-padding-bottom lg:grid-cols-4 p-5 lg:p-14 gap-20 mt-10 py-28 bg-[#F4E9E6] dark:bg-[#121212] text-[#25364F] dark:text-white"
    >
      {blok.tile.map((item, index) => {
        const { ref, inView } = useInView({
          triggerOnce: true,
          threshold: 0.1,
        })
        console.log(blok)
        return (
          <React.Fragment key={index}>
            <div className="flex flex-col gap-5" ref={ref}>
              <span className="flex flex-col gap-2">
                <h2 className="uppercase font-bold">{item.title}</h2>
                <h3 className="text-6xl font-bold">
                  {inView && <CountUp end={item.number} duration={2} />}
                  {item.procent ? '%' : null}
                </h3>
              </span>
              <p>{item.content}</p>
            </div>

            {/* Add a text and title after the first 4 tiles */}
            {index === 3 && (
              <div className="col-span-full flex flex-col gap-5">
                <h2 className="uppercase font-bold text-6xl">
                  {blok.tiles_title}
                </h2>
                <p>{blok.tiles_text}</p>
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export default Tiles
