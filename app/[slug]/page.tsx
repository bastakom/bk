'use client'

import { StoryblokStory, getStoryblokApi } from '@storyblok/react/rsc'
import { Suspense } from 'react'

async function fetchData(slug: string) {
  let sbParams = {
    version: 'draft' as const,
    resolve_relations: 'varacases.referens',
  }

  const storyblokApi = getStoryblokApi()
  const data = await storyblokApi.get(`cdn/stories/${slug}`, sbParams, {
    cache: 'no-store',
  })

  return { data }
}

export default async function page({ params }: { params: { slug: string } }) {
  const pathname = params.slug
  const slugName = pathname === undefined ? `home` : pathname
  const { data } = await fetchData(slugName)

  return (
    <Suspense fallback={<>Loading...</>}>
      <div className="mt-10">
        <StoryblokStory story={data?.data.story} />
      </div>
    </Suspense>
  )
}
