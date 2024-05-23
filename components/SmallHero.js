import { storyblokEditable } from '@storyblok/react'
import Image from 'next/image'
import { render } from 'storyblok-rich-text-react-renderer'

const Smallhero = ({ blok }) => {
  return (
    <div
      className="h-[80vh] flex w-full my-10 font-primary"
      {...storyblokEditable(blok)}
    >
      <div className="w-1/2 h-full flex flex-col justify-center">
        <div className="flex flex-col gap-5 w-full">
          {blok.subtitle && (
            <span className="text-lg font-light-sofia">{blok.subtitle}</span>
          )}
          <h1 className="text-5xl max-w-[60%] font-bold leading-[3.5rem]">
            {blok.title}
          </h1>
          <span className="flex flex-col gap-5 max-w-[90%] font-light-sofia text-[28px]">
            {render(blok.sub_text)}
          </span>
        </div>
      </div>
      {blok.image && (
        <div className="w-1/2 h-full relative h-[50vh]">
          <Image
            src={blok.image.filename}
            className="object-cover"
            fill
            alt=""
          />
        </div>
      )}
    </div>
  )
}

export default Smallhero
