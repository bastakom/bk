import { storyblokEditable } from '@storyblok/react'

const Smallhero = ({ blok }) => {
  return (
    <div className="h-[50vh] flex w-full my-10" {...storyblokEditable(blok)}>
      <div className="w-1/2 h-full flex flex-col justify-center">
        <h1 className="text-5xl font-bold p-10">{blok.title}</h1>
        <span className="flex flex-col gap-5 px-10 max-w-[90%]">
          {render(blok.sub_text)}
        </span>
      </div>
      {props.image && (
        <div className="w-1/2 h-full relative h-[50vh]">
          <Image
            src={props.image.filename}
            className="object-cover"
            fill
            alt=""
          />
        </div>
      )}
    </div>
  )
}

export default Smallhero
