import Image from 'next/image'
import { render } from 'storyblok-rich-text-react-renderer'

interface Props {
  image: {
    filename: string
  }
  title: string
  content: string
}

const Small = ({ title, content, image }: Props) => {
  return (
    <div className="h-[50vh] flex w-full my-10">
      <div className="w-1/2 h-full flex flex-col justify-center">
        <h1 className="text-5xl font-bold p-10">{title}</h1>
        <span className="flex flex-col gap-5 px-10 max-w-[90%]">
          {render(content)}
        </span>
      </div>
      {image.filename && (
        <div className="w-1/2 h-full relative h-[50vh]">
          <Image src={image.filename} className="object-cover" fill alt="" />
        </div>
      )}
    </div>
  )
}

export default Small
