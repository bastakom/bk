'use client'

import Image from 'next/image'
import Link from 'next/link'
import { IoMdArrowDown } from 'react-icons/io'
import { render } from 'storyblok-rich-text-react-renderer'
import { useParams } from 'next/navigation'

interface Props {
  image: {
    filename: string
  }
  title: string
  content: string
}

const Small = ({ title, content, image }: Props) => {
  const params = useParams()
  return (
    <div className="flex flex-col lg:flex-row w-full gap-14 pt-10 pb-10">
      <div className="w-full gap-10 lg:gap-0 lg:w-1/2 h-full flex flex-col justify-center">
        <h2 className="px-0 lg:px-10 text-[20px] uppercase font-normal text-black">
          {params.lang === 'en' ? 'Our services' : 'Våra tjänster'}
        </h2>
        <h1 className="text-[65px] xl:text-[100px] font-normal p-0 lg:p-10 leading-[70px] lg:leading-[100px] text-[#25364F]">
          {render(title)}
        </h1>
        <span className="flex flex-col font-light-sofia text-[20px] gap-5 px-0 lg:px-10 max-w-[100%] lg:max-w-[90%] text-render">
          {render(content)}
        </span>
      </div>
      {image.filename && (
        <div className="w-full lg:w-1/2 relative flex flex-col gap-5">
          <Image
            src={image.filename}
            className="object-cover w-full"
            style={{ maxHeight: '600px' }}
            width={500}
            height={400}
            alt=""
          />
          <div className="flex gap-10">
            <Link
              href={`#tjanster`}
              className="link-color hidden lg:flex gap-2 items-center"
            >
              {params.lang === 'en' ? 'Our services' : 'Våra tjänster'}
              <span>
                <IoMdArrowDown fontSize={'1.2em'} />
              </span>
            </Link>
            <Link
              href={`#process`}
              className="link-color flex gap-2 items-center"
            >
              {params.lang === 'en' ? 'Our process' : 'Vår process'}
              <span>
                <IoMdArrowDown fontSize={'1.2em'} />
              </span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export default Small
