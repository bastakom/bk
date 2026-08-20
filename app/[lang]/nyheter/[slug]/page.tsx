import type { Metadata } from 'next'
import NewsSlug from '@/app/[lang]/components/NewsComponent/NewsSlug'
import Breadcrumbs from '../../components/Breadcrumbs'
import { getStoryblokApi } from '@storyblok/react'
import { notFound } from 'next/navigation'
import { buildStoryblokSeoMetadata } from '../../../lib/seo'

const storyblokVersion: 'published' | 'draft' =
  process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW === 'true'
    ? 'draft'
    : 'published'

export async function generateMetadata({
  params,
}: {
  params: { slug: string; lang: string }
}): Promise<Metadata> {
  const story = await getNewsStory(params.slug, params.lang, false)
  const title = story?.name
    ? `${story.name} - Bästa Kompisar`
    : 'Nyhet - Bästa Kompisar'
  const description =
    story?.content?.intro ||
    story?.content?.excerpt ||
    story?.content?.description ||
    'Nyhet från Bästa Kompisar i Malmö.'
  const image =
    story?.content?.image?.filename ||
    story?.content?.future_picture?.filename ||
    undefined

  return buildStoryblokSeoMetadata({
    content: story?.content,
    fallbackTitle: title,
    fallbackDescription: description,
    fallbackImage: image,
    lang: params.lang,
    path: `/${params.lang}/nyheter/${params.slug}`,
  })
}

const page = async ({ params }: { params: { slug: string; lang: string } }) => {
  const story = await getNewsStory(params.slug, params.lang, true)
  const slugsNews = await getAllNewsSlug(params.lang)

  if (!story) {
    notFound()
  }

  const slugs = slugsNews
    .map((item: any) => item.slug)
    .filter((slug: string | undefined) => Boolean(slug))

  const currentIndex = slugs.indexOf(params.slug)
  const nextCaseSlug =
    slugs.length > 1 && currentIndex >= 0
      ? slugs[(currentIndex + 1) % slugs.length]
      : ''

  return (
    <>
      <Breadcrumbs
        items={[
          { label: 'Start', href: `/${params.lang}` },
          { label: 'Nyheter', href: `/${params.lang}/nyheter` },
          { label: story.name },
        ]}
      />
      <div className="mt-6">
        <NewsSlug props={[story]} locale={params.lang} nextCaseSlug={nextCaseSlug} />
      </div>
    </>
  )
}

async function getNewsStory(
  slug: string,
  locale: string,
  throwNotFound: boolean,
) {
  const sbParams = {
    version: storyblokVersion,
    language: locale,
  }

  const storyblokApi = getStoryblokApi()

  try {
    const res = await storyblokApi.get(`cdn/stories/nyheter/${slug}`, sbParams, {
      cache: 'no-store',
    })

    return res?.data?.story
  } catch {
    if (throwNotFound) {
      notFound()
    }

    return null
  }
}

async function getAllNewsSlug(locale: string) {
  const sbParams = {
    version: storyblokVersion,
    starts_with: `nyheter/`,
    excluding_slugs: 'nyheter/kategori*',
    language: locale,
  }

  const storyblokApi = getStoryblokApi()

  try {
    const res = await storyblokApi.get(`cdn/stories/`, sbParams, {
      cache: 'no-store',
    })

    return res?.data?.stories || []
  } catch {
    return []
  }
}

export default page
