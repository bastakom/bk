import { getStoryblokApi } from '@storyblok/react'
import CaseSlugPage from '../../components/Cases/CaseSlugPage'

const getSlugData = async (slug: string) => {
  let sbParams = { version: 'draft' as const }

  const storyblokApi = getStoryblokApi()
  return await storyblokApi.get(`cdn/stories/cases/${slug}`, sbParams)
}

const page = async ({ params }: { params: { slug: string; lang: string } }) => {
  const pathname = params.slug

  const {
    data: { story },
  } = await getSlugData(pathname)

  return (
    <>
      <CaseSlugPage story={story} />
    </>
  )
}

export default page
