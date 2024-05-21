import { storyblokEditable } from '@storyblok/react'

const TitleText = ({ blok }) => {
  return (
    <div
      className={`mt-24 mb-10 flex flex-col gap-2 items-${blok.position}`}
      {...storyblokEditable(blok)}
    >
      <h2 className={`text-${blok.position} max-w-[30%] text-4xl font-bold`}>
        {blok.title}
      </h2>
      {blok.content && (
        <span className={`leading-[22px] text-${blok.position}`}>
          {blok.content}
        </span>
      )}
    </div>
  )
}

export default TitleText
