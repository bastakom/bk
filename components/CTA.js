import { storyblokEditable } from '@storyblok/react/rsc'
import Link from 'next/link'
import { IoMdArrowForward } from 'react-icons/io'
import { render } from 'storyblok-rich-text-react-renderer'

const CTA = ({ blok }) => {
  return (
    <div
      className={`${
        blok.two_columns
          ? 'grid grid-cols-2 my-32 mx-auto max-w-[80%]'
          : 'flex flex-col justify-center items-start  md:h-[500px]'
      }  gap-10 `}
      {...storyblokEditable(blok)}
    >
      {blok.title && (
        <h2 className={`text-[45px] font-primary`}>{blok.title}</h2>
      )}

      <div
        className={`pt-10 lg:pt-0 ${
          blok.two_columns ? 'text-left w-full' : 'justify-center flex'
        }`}
      >
        <div
          className={`${
            blok.two_columns
              ? 'text-left w-full'
              : 'text-left w-full flex flex-col gap-5'
          } ${blok.smalltext ? 'text-[20px]' : 'text-[25px]'}  font-primary`}
        >
          <span className="max-w-[100%] lg:max-w-[50%] ml-0 px-2 lg:ml-14">
            {render(blok.content)}
          </span>
        </div>
        {blok.two_columns && (
          <div className="flex mt-0 lg:mt-10">
            {blok.buttons.map((item, index) => (
              <Link
                href={item.link.cached_url}
                key={item._uid}
                className="link-color font-normal"
              >
                <span> {item.title}</span>
                <span className="mx-2">
                  {index !== blok.buttons.length - 1 && ' / '}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
      {!blok.two_columns && (
        <div className="flex justify-start w-full ml-2 mb-5 lg:mb-0 lg:ml-14">
          <div className="flex">
            {blok.buttons.map((item, index) => (
              <Link
                href={item.link.cached_url}
                key={item._uid}
                className="link-color font-normal"
              >
                <span> {item.title}</span>
                <span className="mx-2">
                  {index !== blok.buttons.length - 1 && ' / '}
                </span>
              </Link>
            ))}
            <span>
              <IoMdArrowForward fontSize={'1.4em'} color="#FF6062" />
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default CTA
