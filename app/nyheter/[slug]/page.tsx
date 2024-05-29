import NewsSlug from '@/app/components/NewsComponent/NewsSlug'
import { getStoryblokApi } from '@storyblok/react'
import Image from 'next/image'

const page = async ({ params }: { params: { slug: string } }) => {
  const data = await getNewsSlug(params.slug)
  const pathname = params.slug
  console.log(data)
  return (
    <div className="mt-20">
      <NewsSlug props={data} />
    </div>
  )
}

async function getNewsSlug(slug: string) {
  let sbParams = {
    version: 'draft' as const,
    starts_with: `nyheter/${slug}`,
    excluding_slugs: 'nyheter/kategori*',
  }

  const storyblokApi = getStoryblokApi()
  const res = await storyblokApi.get(`cdn/stories/`, sbParams, {
    cache: 'no-store',
  })
  return res.data.stories
}

export default page
