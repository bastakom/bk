import { getStoryblokApi } from '@storyblok/react'

const getSlugData = async (slug: string) => {
  let sbParams = { version: 'draft' as const }

  const storyblokApi = getStoryblokApi()
  return await storyblokApi.get(`cdn/stories/tjanster/${slug}`, sbParams)
}

const page = async ({ params }: { params: { slug: string } }) => {
  const pathname = params.slug

  const res = await getSlugData(pathname)

  const {
    data: { story },
  } = res

  return <div className="h-screen flex items-center">{story.name}</div>
}

export default page
