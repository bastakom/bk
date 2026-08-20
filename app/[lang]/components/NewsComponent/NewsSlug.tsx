'use client'

import { format } from 'date-fns'
import Image from 'next/image'
import { render } from 'storyblok-rich-text-react-renderer'
import { useRouter } from 'next/navigation'
import { IoMdArrowForward } from 'react-icons/io'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { FacebookShareButton, LinkedinShareButton } from 'react-share'

interface Props {
  props: any[]
  locale: any
  nextCaseSlug: string
}

function formatStoryDate(item: any) {
  const rawDate = item?.sort_by_date || item?.published_at || item?.first_published_at

  if (!rawDate) return ''

  const date = new Date(rawDate)

  if (Number.isNaN(date.getTime())) return ''

  return format(date, 'yyyy.MM.dd')
}

function renderRichText(value: any) {
  if (!value || typeof value !== 'object') return null

  try {
    return render(value)
  } catch {
    return null
  }
}

const NewsSlug = ({ props, nextCaseSlug }: Props) => {
  const params = useParams()
  const router = useRouter()

  if (!Array.isArray(props) || props.length === 0) {
    return null
  }

  return props.map((item: any, index: number) => {
    const content = item?.content || {}
    const imageFilename = content?.image?.filename || content?.future_picture?.filename
    const formattedDate = formatStoryDate(item)

    const handleNextClick = () => {
      if (nextCaseSlug) {
        router.push(`/${params.lang}/nyheter/${nextCaseSlug}`)
      }
    }

    return (
      <div className="py-10" key={item.uuid || item.id || item.slug || index}>
        <h1
          className={`text-[40px] lg:text-[70px] w-full lg:max-w-[70%] m-auto text-center justify-center pb-2 lg:pb-0 flex leading-[60px] lg:leading-[85px] lg:mb-10 font-normal`}
        >
          {item.name}.
        </h1>
        {formattedDate && (
          <span className="justify-center mb-1 lg:mb-10 w-full flex text-[20px]">
            {formattedDate}
          </span>
        )}
        {nextCaseSlug && (
          <div className="m-auto container">
            <motion.div whileHover="hover">
              <button
                className="m-auto flex justify-end items-center gap-2 container text-[#FF6062] mb-10 mt-10"
                onClick={handleNextClick}
              >
                {params.lang === 'en' ? 'Next' : 'Nästa'}
                <motion.span
                  variants={{
                    hover: { x: 5 },
                  }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <IoMdArrowForward fontSize={'1.3em'} color="#FF6062" />
                </motion.span>
              </button>
            </motion.div>
          </div>
        )}
        <div
          className={`${!content.full_width && 'lg:grid'} flex flex-col-reverse grid-cols-2 gap-10 m-auto container`}
        >
          <div>
            <span className="flex flex-col gap-2 w-full lg:max-w-[80%] font-primary text-[20px] font-light mb-5">
              {renderRichText(content.content)}
            </span>
            <div className="flex justify-start flex-col text-left text-[20px]">
              <span className="font-bold">
                {params.lang === 'en' ? 'Share' : 'Dela'}
              </span>

              <FacebookShareButton
                url={typeof window !== 'undefined' ? window.location.toString() : ''}
                className="text-left flex gap-2 font-light"
              >
                Facebook
                <span className="-rotate-45 font-light">
                  <IoMdArrowForward fontSize={'1.5em'} />
                </span>
              </FacebookShareButton>
              <LinkedinShareButton
                url={typeof window !== 'undefined' ? window.location.toString() : ''}
                className="text-left flex gap-2 font-light"
              >
                LinkedIn
                <span className="-rotate-45 font-light">
                  <IoMdArrowForward fontSize={'1.5em'} />
                </span>
              </LinkedinShareButton>
            </div>
          </div>
          {imageFilename && (
            <div className="w-full h-[500px] lg:h-[500px] relative">
              <Image
                src={imageFilename}
                fill
                quality={100}
                className={`object-contain`}
                alt={item.name || ''}
              />
            </div>
          )}
        </div>
      </div>
    )
  })
}

export default NewsSlug
