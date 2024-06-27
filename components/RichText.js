import { storyblokEditable } from '@storyblok/react/rsc'

const RichText = ({ blok }) => {
  return (
    <div
      {...storyblokEditable(blok)}
      className={`${
        blok.full_width ? 'full-width-element my-0 pt-14 bg-[#F7F0EE]' : 'my-20'
      }`}
    >
      <div className="marquee-section m-auto">
        <div className="loop-div-right">
          <div
            className={`marquee flex gap-2 ${
              blok.full_width ? 'text-[18px]' : 'text-[24px]'
            }`}
          >
            <span>{blok.content}</span>
            <span>{blok.content}</span>
            <span>{blok.content}</span>
          </div>
        </div>
      </div>
      <div className="marquee-section m-auto">
        <div className="loop-div-left">
          <div
            className={`marquee flex gap-2 ${
              blok.full_width ? 'text-[18px]' : 'text-[24px]'
            }`}
          >
            <span>{blok.content_2}</span>
            <span>{blok.content_2}</span>
            <span>{blok.content_2}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RichText
