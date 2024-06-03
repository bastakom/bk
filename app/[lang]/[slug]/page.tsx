import { StoryblokStory, getStoryblokApi } from '@storyblok/react/rsc'

async function fetchData(slug: string, LANGCODE: string) {
  let sbParams = {
    version: 'draft' as const,
    language: LANGCODE,
    resolve_relations: 'varacases.referens',
  }

  const storyblokApi = getStoryblokApi()
  const data = await storyblokApi.get(`cdn/stories/hem`, sbParams, {
    cache: 'no-store',
  })

  return { data }
}

const getLanguage = async (slug: string, locale: string) => {
  const res = await fetch(
    `https://api.storyblok.com/v2/cdn/stories/${slug}?version=draft&token=faVE0ToH7Y41wHZy0uSt3Qtt&cv=1717160101&resolve_relations=varacases.referens&language=${locale}}`
  )
  return res.json()
}

export default async function page({
  params,
}: {
  params: { slug: string; lang: string }
}) {
  const pathname = params.slug
  const slugName = pathname === undefined ? `hem` : pathname
  // const res = await getLanguage(slugName, params.lang)
  const { data } = await fetchData(slugName, params.lang)
  // console.log(res)
  console.log(data.data.story)

  // const { data } = await fetchData(slugName)

  return (
    <div className="mt-10">
      <StoryblokStory story={data.data?.story} />
    </div>
  )
}
