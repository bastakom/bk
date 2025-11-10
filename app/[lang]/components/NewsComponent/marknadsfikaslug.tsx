'use client'
import Image from 'next/image'
import { render } from 'storyblok-rich-text-react-renderer'
import { useRouter } from 'next/navigation'
import { IoMdArrowForward } from 'react-icons/io'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { FacebookShareButton, LinkedinShareButton } from 'react-share'

interface Props {
  item: any
  locale: any
  nextCaseSlug: string
}

const MarknadsSlug = ({ item, nextCaseSlug }: Props) => {
  const params = useParams()
  const router = useRouter()

  const handleNextClick = () => {
    router.push(`${nextCaseSlug}`)
  }

  const getSpotifyEmbedUrl = (url: string) => {
    if (!url) return null

    const match = url.match(/spotify\.com\/(track|playlist|album|episode|show)\/([a-zA-Z0-9]+)/)

    if (match) {
      const [, type, id] = match
      return `https://open.spotify.com/embed/${type}/${id}`
    }

    return null
  }

  const spotifyEmbedUrl = item.content?.spotify_url ? getSpotifyEmbedUrl(item.content.spotify_url) : null

  return (
    <div className="py-10">
      <h1
        className={`text-[40px] lg:text-[70px] w-full lg:max-w-[70%] m-auto text-center justify-center pb-2 lg:pb-0 flex leading-[60px] lg:leading-[85px] lg:mb-10 font-normal`}
      >
        {item.name}.
      </h1>
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
      <div
        className={`${!item.content.full_width && "lg:grid"} flex flex-col-reverse grid-cols-2 gap-10 m-auto container`}
      >
        <div>
          <span className="flex flex-col gap-2 w-full lg:max-w-[80%] font-primary text-[20px] font-light mb-5">
            {render(item.content.content)}
          </span>

          {/* Spotify Embed */}
          {item.content.embeded_spotify &&
            <div className="mb-5 w-full lg:max-w-[80%]">
              <div dangerouslySetInnerHTML={{ __html: `${item.content.embeded_spotify}` }} />
            </div>
          }

          <div className="flex justify-start flex-col text-left text-[20px]">
            <span className="font-bold">
              {params.lang === 'en' ? 'Share' : 'Dela'}
            </span>
            <FacebookShareButton
              url={`${window.location.toString()}`}
              className="text-left flex gap-2 font-light"
            >
              Facebook
              <span className="-rotate-45 font-light">
                <IoMdArrowForward fontSize={'1.5em'} />
              </span>
            </FacebookShareButton>
            <LinkedinShareButton
              url={`${window.location.toString()}`}
              className="text-left flex gap-2 font-light"
            >
              LinkedIn
              <span className="-rotate-45 font-light">
                <IoMdArrowForward fontSize={'1.5em'} />
              </span>
            </LinkedinShareButton>
          </div>
        </div>
        <div className="w-full h-[500px] lg:h-[500px] relative">
          <Image
            src={item.content?.image?.filename || ''}
            fill
            quality={100}
            className={`object-contain`}
            alt={item.name}
          />
        </div>
      </div>
    </div>
  )
}

export default MarknadsSlug
