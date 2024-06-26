import { storyblokEditable } from '@storyblok/react/rsc'
import Link from 'next/link'
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
        className={`${
          blok.two_columns ? 'text-left w-full' : 'justify-center flex'
        }`}
      >
        <div
          className={`${
            blok.two_columns
              ? 'text-left w-full'
              : 'text-left max-w-[75%] flex flex-col gap-5'
          } ${blok.smalltext ? 'text-[20px]' : 'text-[20px]'}  font-primary`}
        >
          {render(blok.content)}
        </div>
        {blok.two_columns && (
          <div className="flex mt-10">
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
        <div className="flex justify-center w-full">
          <div className="w-[75%]">
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
        </div>
      )}
    </div>
  )
}

export default CTA
