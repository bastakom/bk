'use client'

import { format } from 'date-fns'
import Image from 'next/image'
import { render } from 'storyblok-rich-text-react-renderer'
import { usePathname } from 'next/navigation'
import Button from '../Button/Button'
import { FacebookShareButton, LinkedinShareButton } from 'react-share'

interface Props {
  props: any
  locale: any
}

const NewsSlug = ({ props, locale }: Props) => {
  return props.map((item: any, index: number) => {
    const formattedDate = item.sort_by_date
      ? format(new Date(`${item.sort_by_date}`), 'yyyy.MM.dd')
      : format(new Date(`${item.published_at}`), 'yyyy.MM.dd')

    const router = usePathname()

    console.log(router)

    return (
      <div className="py-10">
        <h1
          className={`text-[70px] max-w-[80%] m-auto text-center justify-center pb-10 w-full flex leading-[85px] mb-10 font-normal`}
        >
          {item.name}.
        </h1>
        <span className="justify-center mb-10 w-full flex text-[20px]">
          {formattedDate}
        </span>
        <div className="m-auto container">
          <span className="flex justify-end">
            <Button
              href={''}
              TextEN="Next"
              TextSV="Nästa"
              margin="mb-10"
              size="20"
            />
          </span>
        </div>
        <div key={index} className={`grid grid-cols-2 gap-10 m-auto container`}>
          <div>
            <span className="flex flex-col gap-2 max-w-[80%] font-primary text-[20px] font-light mb-5">
              {render(item.content.content)}
            </span>
            <div className="flex justify-start flex-col text-left">
              <span className="font-bold">Dela</span>
              <FacebookShareButton
                url={`${window.location.toString()}`}
                className="text-left"
              >
                Facebook
              </FacebookShareButton>
              <LinkedinShareButton
                url={`${window.location.toString()}`}
                className="text-left"
              >
                LinkedIn
              </LinkedinShareButton>
            </div>
          </div>
          <div className="w-full h-[700px] relative">
            <Image
              src={item.content?.image?.filename || ''}
              fill
              quality={100}
              className={`object-cover`}
              alt={item.name}
            />
          </div>
        </div>
      </div>
    )
  })
}

export default NewsSlug
