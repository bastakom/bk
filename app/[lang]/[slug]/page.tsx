import { notFound, redirect } from 'next/navigation'
import { StoryblokStory, getStoryblokApi } from '@storyblok/react/rsc'

const storyblokVersion: 'published' | 'draft' =
  process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW === 'true'
    ? 'draft'
    : 'published'

async function fetchData(slug: string, locale: string) {
  let sbParams = {
    version: storyblokVersion,
    resolve_relations: ['varacases.referens', 'varacases.categories'],
    language: locale,
  }

  const storyblokApi = getStoryblokApi()

  try {
    const data = await storyblokApi.get(`cdn/stories/${slug}`, sbParams, {
      cache: 'no-store',
    })

    if (!data) {
      throw new Error('Not Found')
    }

    return { data }
  } catch (error: any) {
    if (error.response && error.response.status === 500) {
      redirect('/500')
    } else {
      throw error
    }
  }
}

const fetchConfig = async (locale: string) => {
  let sbParams = {
    version: storyblokVersion,
    language: locale,
  }

  const storyblokApi = getStoryblokApi()

  const config = await storyblokApi.get(`cdn/stories/config`, sbParams, {
    cache: 'no-store',
  })

  return { config }
}

function fallbackH1(slug: string, locale: string) {
  if (slug === 'omoss') {
    return locale === 'en' ? 'About Bästa Kompisar' : 'Om Bästa Kompisar'
  }

  return ''
}

export default async function page({
  params,
}: {
  params: { slug: string; lang: string }
}) {
  const pathname = params.slug
  const slugName = pathname === undefined ? `hem` : pathname
  const settings = await fetchConfig(params.lang)
  const hiddenH1 = fallbackH1(slugName, params.lang)

  try {
    const { data } = await fetchData(slugName, params.lang)

    if (!data || !data.data || !data.data.story) {
      notFound()
    }

    return (
      <div className="mt-10">
        {hiddenH1 && (
          <h1 className="sr-only">
            {hiddenH1}
          </h1>
        )}
        <StoryblokStory story={data.data.story} settings={settings} />
      </div>
    )
  } catch (error: any) {
    if (error.message === 'Not Found') {
      notFound()
    } else {
      throw error
    }
  }
}
