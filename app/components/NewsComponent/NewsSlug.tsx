import { format } from 'date-fns'
import Image from 'next/image'
import { render } from 'storyblok-rich-text-react-renderer'

interface Props {
  props: any
}

const NewsSlug = ({ props }: Props) => {
  return props.map((item: any) => {
    // const formattedDate = item.published_at
    //   ? format(new Date(`${item?.published_at}`), 'yyyy-MM-dd')
    //   : null

    return (
      <div
        className={`${
          item.content.full_width
            ? 'flex flex-col'
            : 'items-star py-10 grid grid-cols-2'
        } gap-10 max-w-[85rem] m-auto`}
      >
        <div className="m-auto w-full h-[700px] flex justify-center relative">
          <Image
            src={item.content?.image?.filename || ''}
            fill
            quality={100}
            className={`${
              item.content.full_width ? 'object-cover' : 'object-contain'
            }`}
            alt={item.name}
          />
        </div>
        <div>
          <div className="w-full m-auto flex flex-col gap-5 pt-5">
            {/* <span>{formattedDate}</span> */}
            <h1
              className={`text-[58px] ${
                item.content.full_width ? 'w-[70%]' : 'w-[90%]'
              }  leading-[64px] mb-5 font-bold`}
            >
              {item.name}.
            </h1>
          </div>
          <span className="flex flex-col gap-2 max-w-[90%] font-primary text-[16px] mb-5 mt-2">
            {render(item.content.content)}
          </span>
        </div>
      </div>
    )
  })
}

export default NewsSlug
