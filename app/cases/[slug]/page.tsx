import { getStoryblokApi } from '@storyblok/react'
import { render } from 'storyblok-rich-text-react-renderer'
import placeholder from '@/public/placeholder.png'
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
      <div className="relative bg-slate-50 dark:bg-slate-950">
        <div className="mt-20 flex h-[50vh] gap-5 items-center">
          <div className="w-1/2 flex flex-col gap-5 px-10">
            <h2 className="text-5xl font-bold">{story.content.title}</h2>
            <div className="flex flex-col gap-5">
              {render(story.content.content)}
            </div>
          </div>
          <div className="w-1/2 relative h-full">
            <Image
              src={story.content.image.filename}
              fill
              alt="placeholder"
              className="object-cover"
            />
          </div>
        </div>
        <div className="flex gap-5 my-5">
          {story.content.gallery.slice(0, 2).map((item: any) => (
            <div className="h-[500px] relative w-1/2">
              <Image src={item.filename} fill alt="" />
            </div>
          ))}
        </div>
        <div className="flex gap-5">
          {story.content.videos.map((item: any) => (
            <div className="h-[500px] relative w-1/2">
              <video muted loop controls autoPlay>
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
