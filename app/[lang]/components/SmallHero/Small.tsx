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
    <div className=" flex w-full gap-14 py-10">
      <div className="w-1/2 h-full flex flex-col justify-center">
        <h2 className="px-10 text-[20px] uppercase font-normal">
          {params.lang === 'en' ? 'Our services' : 'Våra tjänster'}
        </h2>
        <h1 className="text-[28px] xl:text-[100px] font-normal p-10 leading-[100px]">
          {render(title)}
        </h1>
        <span className="flex flex-col font-light-sofia text-[20px] gap-5 px-10 max-w-[90%]">
          {render(content)}
        </span>
      </div>
      {image.filename && (
        <div className="w-1/2 relative flex flex-col gap-5">
          <Image
            src={image.filename}
            className="object-cover w-full"
            style={{ maxHeight: '600px' }}
            width={500}
            height={400}
            alt=""
          />
          <Link
            href={`#tjanster`}
            className="link-color flex gap-2 items-center"
          >
            {params.lang === 'en' ? 'Our services' : 'Våra tjänster'}
            <span>
              <IoMdArrowDown fontSize={'1.2em'} className="mt-2" />
            </span>
          </Link>
        </div>
      )}
    </div>
  )
}

export default Small
