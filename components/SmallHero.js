import { storyblokEditable } from '@storyblok/react'
import Image from 'next/image'
import Link from 'next/link'
import { render } from 'storyblok-rich-text-react-renderer'

const Smallhero = ({ blok }) => {
  return (
    <div
      className={`min-h-[80vh] flex flex-col lg:flex-row ${
        blok.marginleft ? 'w-full lg:w-[80%] m-auto my-24' : 'w-full '
      } my-10 font-primary`}
      {...storyblokEditable(blok)}
    >
      <div
        className={`w-full lg:w-1/2 h-full flex flex-col  ${
          blok.marginleft ? 'justify-start' : 'justify-center'
        }`}
      >
        <div className={`flex flex-col gap-5 w-full`}>
          {blok.subtitle && (
            <span className="text-lg font-light-sofia">{blok.subtitle}</span>
          )}
          <h2
            className={`text-[28px] md:text-[50px] xl:text-[70px] max-w-full lg:max-w-[80%] ${
              blok.marginleft ? 'font-light' : 'font-bold'
            } leading-[1.5em]`}
          >
            {blok.title}
          </h2>
          <span className="flex flex-col gap-5 max-w-[90%] font-light-sofia text-[20px]">
            {render(blok.sub_text)}
          </span>
          {blok.link_name && (
            <Link href="" className="link-color">
              {blok.link_name}
            </Link>
          )}
        </div>
      </div>
      {blok.image && (
        <div className="w-full mt-10 lg:mt-0 lg:w-1/2 h-full relative">
          <Image
            src={blok.image.filename}
            className="object-cover min-h-[100%] lg:min-h-[80vh]"
            width={600}
            height={600}
            alt=""
          />
        </div>
      )}
    </div>
  )
}

export default Smallhero
