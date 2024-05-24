import { getStoryblokApi } from '@storyblok/react'
import { render } from 'storyblok-rich-text-react-renderer'
import Image from 'next/image'

const getSlugData = async (slug: string) => {
  let sbParams = { version: 'draft' as const }

  const storyblokApi = getStoryblokApi()
  return await storyblokApi.get(`cdn/stories/cases/${slug}`, sbParams)
}

const page = async ({ params }: { params: { slug: string } }) => {
  const pathname = params.slug

  const {
    data: { story },
  } = await getSlugData(pathname)

  return (
    <>
      <div className="relative bg-slate-50 dark:bg-[#121212] pb-20 ">
        <div className="flex gap-14 mb-20 mt-20 flex-col items-center">
          <div className="w-full relative h-[800px]">
            <Image
              src={story?.content?.image?.filename || ''}
              fill
              alt="placeholder"
              className="object-cover"
            />
          </div>

          <div className="w-full justify-between flex-col flex gap-5 container m-auto ">
            <div className="flex items-center gap-2">
              <span className="font-light">Kund: </span>
              <h2 className="font-bold">{story.content.title}</h2>
            </div>
            <div className="w-2/3 flex flex-col gap-5 font-light-sofia text-[28px]">
              {render(story.content.content)}
            </div>
            <span>{story?.content?.ingress}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-5 my-5 container m-auto">
          {story.content &&
            Array.isArray(story.content.gallery) &&
            story.content.gallery.length > 0 &&
            story.content.gallery.slice(0, 4).map((item: any) => (
              <div className="h-[400px] relative w-full" key={item.filename}>
                <Image
                  src={item.filename}
                  fill
                  alt=""
                  className="object-cover"
                />
              </div>
            ))}
        </div>

        <div className="flex flex-col gap-5 text-[28px] container m-auto my-10 font-light-sofia">
          {story.content?.text_under_gallery &&
            render(story.content.text_under_gallery)}
        </div>

        <div className="w-full gap-5 container m-auto">
          {story.content &&
            Array.isArray(story.content.videos) &&
            story.content.videos.length > 0 &&
            story.content.videos.slice(0, 1).map((item: any) => (
              <div className="object-cover relative w-full" key={item.filename}>
                <video muted loop controls autoPlay className="w-full">
                  <source src={item.filename} />
                </video>
              </div>
            ))}
        </div>

        <div className="grid grid-cols-2 gap-5 my-5 container m-auto">
          {story.content &&
            Array.isArray(story.content.gallery) &&
            story.content.gallery.length > 4 &&
            story.content.gallery.slice(4, 8).map((item: any) => (
              <div className="h-[400px] relative w-full" key={item.filename}>
                <Image
                  src={item.filename}
                  fill
                  alt=""
                  className="object-cover"
                />
              </div>
            ))}
        </div>

        <div className="flex flex-col gap-5 text-[28px] container m-auto my-10 font-light-sofia">
          {render(story.content.text_under_video)}
        </div>
        <div className="w-ful gap-5 container m-auto">
          {Array.isArray(story.content.gallery) &&
            story.content.videos.length === 2 &&
            story.content.videos.slice(1, 2).map((item: any) => (
              <div className="object-cover relative w-full">
                <video muted loop controls autoPlay className="w-full">
                  <source src={item.filename} />
                </video>
              </div>
            ))}
        </div>
      </div>
    </>
  )
}

export default page
