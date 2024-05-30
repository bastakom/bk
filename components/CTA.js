import { storyblokEditable } from '@storyblok/react/rsc'
import Link from 'next/link'

const CTA = ({ blok }) => {
  return (
    <div
      className={`${
        blok.two_columns
          ? 'grid grid-cols-2 my-32 mx-auto max-w-[80%]'
          : 'flex flex-col justify-center items-center  md:h-[500px]'
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
        <p
          className={`${
            blok.two_columns ? 'text-left w-full' : 'text-center max-w-[40%]'
          } ${
            blok.smalltext ? 'text-[20px]' : 'text-[25px] leading-10'
          }  font-primary`}
        >
          {blok.content}
        </p>
        {blok.two_columns && (
          <div className="flex mt-10">
            {blok.buttons.map((item, index) => (
              <Link
                href={item.link.cached_url}
                key={item._uid}
                className="link-color font-bold"
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
        <div className="flex">
          {blok.buttons.map((item, index) => (
            <Link
              href={item.link.cached_url}
              key={item._uid}
              className="link-color font-bold"
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
  )
}

export default CTA
