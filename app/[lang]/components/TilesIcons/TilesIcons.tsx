import Image from 'next/image'
import { IoMdArrowForward } from 'react-icons/io'
import { render } from 'storyblok-rich-text-react-renderer'

interface Props {
  tiles: any
  header: string
  content: string
}

const TilesIcons = ({ tiles, header, content }: Props) => {
  return (
    <div className="px-5 lg:px-10 pb-14 pt-14">
      <div className="flex flex-col lg:w-1/2 w-full">
        <h2 className="text-[70px] font-normal text-[#ef6966]">{header}</h2>
        <span className="text-[20px]">{content}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 justify-center pt-32 gap-14">
        {tiles.map((item: any, index: number) => (
          <div key={item._uid} className="flex flex-col gap-10 justify">
            <Image
              src={item.icon.filename}
              width={120}
              height={90}
              alt={item.icon.filename}
              className="mix-blend-darken h-[120px]"
            />
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[20px] text-[#ef6966]">
                {item.title}
              </h3>
            </div>
            <div className="bullets flex flex-col gap-10 text-[18px] font-light">
              {render(item.text)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TilesIcons
