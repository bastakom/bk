import { storyblokEditable } from '@storyblok/react'
import { render } from 'storyblok-rich-text-react-renderer'

const TitleText = ({ blok }) => {
  return (
    <div className="bg-[#F4E9E6] full-width-element flex justify-center no-padding-bottom">
      <div
        className={`pt-16 lg:pt-20 pb-20 flex px-2 flex-col gap-5 lg:gap-10 items-${
          blok.position
        } ${blok.smallsize ? 'w-full lg:w-[60%]' : 'w-full'}`}
        {...storyblokEditable(blok)}
      >
        <h2
          className={`text-${blok.position} text-[30px] lg:text-[50px] font-bold`}
        >
          {render(blok.title)}
        </h2>
        {blok.content && (
          <span
            className={`flex flex-col gap-5 text-[16px] lg:text-[20px] font-light service text-${blok.position}`}
          >
            {render(blok.content)}
          </span>
        )}
      </div>
    </div>
  )
}

export default TitleText
