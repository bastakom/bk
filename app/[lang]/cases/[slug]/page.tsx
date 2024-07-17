import { getStoryblokApi } from '@storyblok/react'
import CaseSlugPage from '../../components/Cases/CaseSlugPage'

const getSlugData = async (slug: string, locale: string) => {
  let sbParams = { version: 'published' as const, language: locale }

  const storyblokApi = getStoryblokApi()
  return await storyblokApi.get(`cdn/stories/cases/${slug}`, sbParams)
}

const getAllSlugs = async (locale: string) => {
  let sbParams = {
    version: 'published' as const,
    starts_with: 'cases/',
    language: locale,
  }

  const storyblokApi = getStoryblokApi()
  return await storyblokApi.get(`cdn/stories`, sbParams)
}

const page = async ({ params }: { params: { slug: string; lang: string } }) => {
  const pathname = params.slug

  const {
    data: { story },
  } = await getSlugData(pathname, params.lang)

  const {
    data: { stories: stores },
  } = await getAllSlugs(params.lang)

  const slugs = stores.map((item: any) => item.slug)
  const currentIndex = slugs.indexOf(pathname)
  const nextCaseSlug = slugs[(currentIndex + 1) % slugs.length]

  return (
    <>
      <CaseSlugPage story={story} nextCaseSlug={nextCaseSlug} />
    </>
  )
}

export default page
