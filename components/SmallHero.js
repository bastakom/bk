import Button from '@/app/[lang]/components/Button/Button'
import { storyblokEditable } from '@storyblok/react'
import Image from 'next/image'
import Link from 'next/link'
import { IoMdArrowDown } from 'react-icons/io'
import { render } from 'storyblok-rich-text-react-renderer'

const Smallhero = ({ blok }) => {
  return (
    <div
      className={`min-h-[80vh] flex flex-col lg:flex-row ${
        blok.marginleft
          ? 'w-full lg:w-[80%] m-auto my-24 gap-20'
          : 'w-full items-center bg-[#F7F0EE] full-width-element px-32 gap-10'
      } pt-10 pb-14 mb-14 font-primary`}
      {...storyblokEditable(blok)}
    >
      <div
        className={`w-full lg:w-1/2 h-full flex flex-col ${
          blok.marginleft ? 'justify-start' : 'justify-center'
        }`}
      >
        <div
          className={`flex flex-col w-full ${
            blok.marginleft ? 'gap-5' : 'gap-14'
          }`}
        >
          {blok.subtitle && (
            <span className="text-lg font-light-sofia">{blok.subtitle}</span>
          )}
          <div
            className={`md:text-[50px] w-full max-w-full lg:max-w-[100%] ${
              blok.marginleft
                ? 'text-[28px] xl:text-[70px] font-normal leading-[85px]'
                : 'text-[28px] xl:text-[100px] w-[55%] font-normal leading-[100px]'
            }`}
          >
            {render(blok.title)}
          </div>
          <span className="flex flex-col gap-5 max-w-[90%] font-light-sofia text-[20px]">
            {render(blok.sub_text)}
          </span>
          {blok.link_name && blok.marginleft && (
            <Button href={''} text={blok.link_name} align="left" />
          )}
        </div>
      </div>
      {blok.image && (
        <div
          className={`w-full mt-10 lg:mt-0 lg:w-1/2 h-full relative ${
            blok.marginleft ? '' : 'flex-col flex gap-10'
          }`}
        >
          <Image
            src={blok.image.filename}
            className={`object-cover ${
              !blok.marginleft
                ? 'min-h-full max-h-[600px] w-full'
                : 'min-h-[100%] lg:min-h-[50vh] '
            }`}
            width={600}
            height={600}
            alt=""
          />
          {blok.link_name && !blok.marginleft && (
            <Link
              href={`${blok.link.url}`}
              className="link-color flex gap-2 items-center"
            >
              {blok.link_name}
              <span>
                <IoMdArrowDown fontSize={'1.2em'} className="mt-2" />
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

export default Smallhero
