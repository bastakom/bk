import { getStoryblokApi } from '@storyblok/react'
import Image from 'next/image'
import Link from 'next/link'
import { render } from 'storyblok-rich-text-react-renderer'
import Button from '../../components/Button/Button'

const getSlugData = async (slug: string) => {
  let sbParams = { version: 'draft' as const }

  const storyblokApi = getStoryblokApi()
  return await storyblokApi.get(`cdn/stories/vara-tjanster/${slug}`, sbParams)
}

const page = async ({ params }: { params: { slug: string } }) => {
  const pathname = params.slug

  const res = await getSlugData(pathname)

  const {
    data: { story },
  } = res

  const firstContent =
    'Bästa Kompisar · Best Friends · Bedste venner · Parhaat ystävät · Migliori amici · Meilleurs amis · Beste vrienden · Mejores amigos · Beste Freunde ·'
  const nextContent =
    'Лучшие друзья- 最好的朋友 - 親友 - أعز اصدقاء · Amici optimi Bästa Kompisar · Best Friends · Bestevenner  · Parhaat ystävät · Migliori amici · Meilleurs amis ·'

  console.log(story.content.background)
  return (
    <div
      className={`full-width-element pt-24 no-padding-bottom pb-20`}
      style={{
        background: `${
          story.content.background ? story.content.background : 'none'
        }`,
      }}
    >
      <div className="pb-5 mb-14">
        <div className="marquee-section m-auto">
          <div className="loop-div-right">
            <div className="marquee flex gap-2 text-[18px] reel-text-color">
              <span>{firstContent}</span>
              <span>{firstContent}</span>
              <span>{firstContent}</span>
            </div>
          </div>
        </div>
        <div className="marquee-section m-auto">
          <div className="loop-div-left">
            <div className="marquee flex gap-2 text-[18px] reel-text-color">
              <span>{nextContent}</span>
              <span>{nextContent}</span>
              <span>{nextContent}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="container m-auto">
        <div className="text-center flex flex-col gap-10 justify-center">
          <h1 className="text-[20px]">{story.name}</h1>
          {story.content.title && (
            <div className="text-[100px] leading-[120px]">
              {render(story.content.title)}
            </div>
          )}
          {story.content.sub_title && (
            <h2 className="text-[30px]">{story.content.sub_title}</h2>
          )}
        </div>
        <div className="grid grid-cols-2 mt-24">
          <div className="max-w-[80%] flex flex-col gap-14">
            {story.content.single_content && (
              <span className="text-[20px] font-normal leading-[32px]">
                {render(story.content.single_content)}
              </span>
            )}
            {story.content.link_text && (
              <Button
                text={story.content.link_text}
                href={story?.content.link?.cached_url}
              />
            )}
          </div>
          <div className="w-full relative h-[600px]">
            <Image
              src={story.content.image.filename}
              fill
              alt=""
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default page
