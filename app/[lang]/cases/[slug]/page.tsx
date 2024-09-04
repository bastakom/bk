import { getStoryblokApi, renderRichText } from '@storyblok/react'
import CaseSlugPage from '../../components/Cases/CaseSlugPage'
import { Metadata } from 'next'
import { render } from 'storyblok-rich-text-react-renderer'

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
export async function generateMetadata({
  params,
}: {
  params: { slug: string; lang: string }
}): Promise<Metadata> {
  const pathname = params.slug

  const {
    data: { story },
  } = await getSlugData(pathname, params.lang)

  const maxLength = 150
  let description = `${story.content.title} - ${renderRichText(
    story.content.content
  )}`

  description = description.replace(/<\/?[^>]+(>|$)/g, '')

  if (description.length > maxLength) {
    description = description.substring(0, maxLength) + '...'
  }

  return {
    title: `${story.name} – Bästa Kompisar kundcase`,
    description,
  }
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
