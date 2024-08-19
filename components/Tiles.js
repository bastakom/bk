import React from 'react'
import { storyblokEditable } from '@storyblok/react'
import CountUp from 'react-countup'
import { useInView } from 'react-intersection-observer'

const Tiles = ({ blok }) => {
  return (
    <div
      {...storyblokEditable(blok)}
      className="grid grid-cols-1 full-width-element no-padding-bottom lg:grid-cols-4 p-5 lg:p-14 gap-20 mt-10 py-28 bg-[#F7DAD2] dark:bg-[#121212] text-[#25364F] dark:text-white"
    >
      {blok.tile.map((item, index) => {
        const { ref, inView } = useInView({
          triggerOnce: true,
          threshold: 0.1,
        })
        return (
          <React.Fragment key={index}>
            <div className={`flex flex-col gap-5 lg:pb-20 lg:pt-20`} ref={ref}>
              <span className="flex flex-col gap-2">
                <h2 className="uppercase font-normal text-black">
                  {item.title}
                </h2>
                <h3 className="text-6xl text-[#25364f] font-bold">
                  {inView && <CountUp end={item.number} duration={2} />}
                  {item.procent ? '%' : null}
                </h3>
              </span>
              <p className="font-light text-black">{item.content}</p>
            </div>

            {index === 3 && (
              <div className="col-span-full flex flex-col gap-5">
                <h2 className="font-normal text-6xl text-[#25364F]">
                  {blok.tiles_title}
                </h2>
                <p className="text-black">{blok.tiles_text}</p>
              </div>
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

export default Tiles
