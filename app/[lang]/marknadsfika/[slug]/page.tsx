import type { Metadata } from 'next'
import { getStoryblokApi } from '@storyblok/react'
import { notFound } from 'next/navigation'
import MarknadsSlug from '../../components/NewsComponent/marknadsfikaslug'
import Breadcrumbs from '../../components/Breadcrumbs'
import BreadcrumbJsonLd from '../../components/BreadcrumbJsonLd'
import JsonLd from '../../components/JsonLd'
import { buildStoryblokSeoMetadata, siteName, siteUrl } from '../../../lib/seo'

const storyblokVersion: 'published' | 'draft' =
  process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW === 'true'
    ? 'draft'
    : 'published'

export async function generateMetadata({
  params,
}: {
  params: { slug: string; lang: string }
}): Promise<Metadata> {
  const story = await getNewsSlug(params.slug, params.lang)
  const title = story?.name
    ? `${story.name} - Marknadsfika`
    : 'Marknadsfika - Bästa Kompisar'
  const description =
    story?.content?.intro ||
    story?.content?.excerpt ||
    story?.content?.description ||
    'Marknadsfika från Bästa Kompisar med samtal och perspektiv på marknadsföring.'
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
    path: `/${params.lang}/marknadsfika/${params.slug}`,
  })
}

const page = async ({ params }: { params: { slug: string; lang: string } }) => {
  const data = await getNewsSlug(params.slug, params.lang)
  const slugsNews = await getAllNewsSlug(params.lang)

  if (!data) {
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

  const breadcrumbItems = [
    { label: 'Start', href: `/${params.lang}` },
    { label: 'Marknadsfika', href: `/${params.lang}/marknadsfika` },
    { label: data.name },
  ]
  const description =
    data.content?.intro ||
    data.content?.excerpt ||
    data.content?.description ||
    'Marknadsfika från Bästa Kompisar med samtal och perspektiv på marknadsföring.'
  const image =
    data.content?.image?.filename ||
    data.content?.future_picture?.filename ||
    `${siteUrl}/bk-black.png`

  const podcastEpisodeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    '@id': `${siteUrl}/${params.lang}/marknadsfika/${params.slug}#podcast-episode`,
    url: `${siteUrl}/${params.lang}/marknadsfika/${params.slug}`,
    name: data.name,
    description,
    image,
    datePublished: data.first_published_at || data.published_at,
    dateModified: data.published_at || data.first_published_at,
    inLanguage: params.lang === 'en' ? 'en-US' : 'sv-SE',
    partOfSeries: {
      '@type': 'PodcastSeries',
      name: 'Marknadsfika',
      url: `${siteUrl}/${params.lang}/marknadsfika`,
      publisher: {
        '@id': `${siteUrl}/#organization`,
      },
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: siteName,
      url: siteUrl,
    },
  }

  return (
    <>
      <JsonLd data={podcastEpisodeJsonLd} />
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <Breadcrumbs items={breadcrumbItems} />
      <div className="mt-6">
        <MarknadsSlug item={data} locale={params.lang} nextCaseSlug={nextCaseSlug} />
      </div>
    </>
  )
}

async function getNewsSlug(slug: string, locale: string) {
  const sbParams = {
    version: storyblokVersion,
    language: locale,
  }

  const storyblokApi = getStoryblokApi()

  try {
    const res = await storyblokApi.get(
      `cdn/stories/marknadsfika/${slug}`,
      sbParams,
      {
        cache: 'no-store',
      }
    )

    if (!res?.data?.story) {
      notFound()
    }

    return res.data.story
  } catch {
    notFound()
  }
}

async function getAllNewsSlug(locale: string) {
  const sbParams = {
    version: storyblokVersion,
    starts_with: `marknadsfika/`,
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
