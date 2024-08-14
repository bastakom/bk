import Image from 'next/image'
import Button from '../Button/Button'
import { render } from 'storyblok-rich-text-react-renderer'

interface Props {
  title: string
  content: string
  image: any
  tiles: any
}

const Kompetens = ({ title, content, image, tiles }: Props) => {
  return (
    <div className="px-10 bg-white pt-14 pb-20 my-20">
      <div className="flex m-auto">
        <div className="flex gap-5">
          <div className="w-1/2 mt-14 flex flex-col gap-10">
            <h2 className="text-[70px] max-w-[50%] leading-[85px] text-[#ef6966]">
              {title}
            </h2>
            <span className="font-light max-w-[90%] text-[20px]">
              {content}
            </span>
          </div>
          <Image
            src={image.filename}
            width={497}
            height={400}
            className="mix-blend-multiply m-auto"
            alt={image.filename}
          />
        </div>
      </div>
      <div className="w-[80%]">
        <div className="grid grid-cols-3">
          {tiles.map((item: any) =>
            item.title ? (
              <div>
                <Button text={item.title} size={'20'} />
                <span className="text-[20px] font-light">
                  {render(item.content)}
                </span>
              </div>
            ) : (
              <div />
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default Kompetens
