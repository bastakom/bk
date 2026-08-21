import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { StoryblokStory, getStoryblokApi } from '@storyblok/react/rsc'
import { buildStoryblokSeoMetadata } from '../../lib/seo'

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

function plainText(value: any): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (Array.isArray(value.content)) {
    return value.content
      .map((item: any) => plainText(item))
      .filter(Boolean)
      .join(' ')
  }
  if (value.text) return value.text
  return ''
}

function truncate(value: string, maxLength = 155) {
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length > maxLength ? `${clean.substring(0, maxLength)}...` : clean
}

function slugForParams(params: { slug?: string }) {
  return params.slug === undefined ? 'hem' : params.slug
}

function pathForParams(params: { slug?: string; lang: string }) {
  const slugName = slugForParams(params)
  return slugName === 'hem' ? `/${params.lang}` : `/${params.lang}/${slugName}`
}

function fallbackH1(slug: string, locale: string) {
  if (slug === 'omoss') {
    return locale === 'en' ? 'About Bästa Kompisar' : 'Om Bästa Kompisar'
  }

  return ''
}

export async function generateMetadata({
  params,
}: {
  params: { slug?: string; lang: string }
}): Promise<Metadata> {
  const slugName = slugForParams(params)

  try {
    const { data } = await fetchData(slugName, params.lang)
    const story = data?.data?.story
    const content = story?.content || {}
    const title = story?.name
      ? `${story.name} - Bästa Kompisar`
      : 'Bästa Kompisar'
    const description =
      content.description ||
      content.intro ||
      content.sub_title ||
      truncate(
        plainText(content.content) ||
          plainText(content.single_content) ||
          plainText(content.text_block_content)
      ) ||
      'Bästa Kompisar är en kreativ reklambyrå och filmproduktionsbyrå i Malmö.'
    const image =
      content.image?.filename ||
      content.hero_image?.filename ||
      content.preview_image?.filename ||
      undefined

    return buildStoryblokSeoMetadata({
      content,
      fallbackTitle: title,
      fallbackDescription: description,
      fallbackImage: image,
      lang: params.lang,
      path: pathForParams(params),
    })
  } catch {
    return buildStoryblokSeoMetadata({
      fallbackTitle: 'Bästa Kompisar',
      fallbackDescription:
        'Kreativ reklambyrå och filmproduktionsbyrå i Malmö.',
      lang: params.lang,
      path: pathForParams(params),
    })
  }
}

export default async function page({
  params,
}: {
  params: { slug?: string; lang: string }
}) {
  const slugName = slugForParams(params)
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
