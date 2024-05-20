import { storyblokEditable } from '@storyblok/react/rsc'
import Link from 'next/link'

const CTA = ({ blok }) => {
  return (
    <div
      className={`md:h-[500px] flex justify-center items-center flex-col mt-10 gap-10`}
      style={{ background: `${blok.background}` }}
      {...storyblokEditable(blok)}
    >
      {blok.title && (
        <h2 className="text-[32px] font-bold text-white font-primary">
          {blok.title}
        </h2>
      )}

      <p
        className={`max-w-[60%] text-center ${
          blok.smalltext ? 'text-[20px]' : 'text-[32px] font-bold leading-10'
        }  text-white font-primary`}
      >
        {blok.content}
      </p>
      <div className="flex text-white font-bold">
        {blok.buttons.map((item, index) => (
          <Link href={item.link.cached_url} key={item._uid}>
            <span> {item.title}</span>
            <span className="mx-2">
              {index !== blok.buttons.length - 1 && ' / '}{' '}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default CTA
