import type { Metadata } from 'next'
import { getStoryblokApi } from '@storyblok/react'
import CasePage from '../components/Cases/CasePage'
import JsonLd from '../components/JsonLd'
import { buildPageMetadata, siteName, siteUrl } from '../../lib/seo'

const storyblokVersion: 'published' | 'draft' =
  process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW === 'true'
    ? 'draft'
    : 'published'

export async function generateMetadata({
  params,
}: {
  params: { lang: string }
}): Promise<Metadata> {
  return buildPageMetadata({
    lang: params.lang,
    path: `/${params.lang}/cases`,
    title: 'Case - Bästa Kompisar',
    description:
      'Se utvalda case från Bästa Kompisar inom varumärke, filmproduktion, content och digital kommunikation.',
  })
}

const Page = async ({ params }: { params: { lang: string } }) => {
  const props = await fetchCases(params.lang)
  const config = await fetchConfig(params.lang)
  const stories = props.data.stories
  const pageUrl = `${siteUrl}/${params.lang}/cases`

  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#cases`,
    url: pageUrl,
    name: 'Case - Bästa Kompisar',
    description:
      'Utvalda kundcase från Bästa Kompisar inom varumärke, filmproduktion, content och digital kommunikation.',
    inLanguage: params.lang === 'en' ? 'en-US' : 'sv-SE',
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      name: siteName,
      url: siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: siteName,
      url: siteUrl,
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: stories.map((story: any, index: number) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${siteUrl}/${params.lang}/${story.full_slug}`,
        name: story.name,
      })),
    },
  }

  return (
    <>
      <JsonLd data={collectionJsonLd} />
      <CasePage
        props={stories}
        config={config.data.story}
        locale={params.lang}
      />
    </>
  )
}

export default Page

async function fetchCases(locale: string) {
  let sbParams = {
    version: storyblokVersion,
    starts_with: 'cases/',
    language: locale,
  }

  const storyblokApi = getStoryblokApi()

  try {
    const response = await storyblokApi.get(`cdn/stories/`, sbParams, {
      cache: 'no-store',
    })

    return response
  } catch (error) {
    console.error('Error fetching cases:')
    return { data: { stories: [] } }
  }
}

const fetchConfig = async (locale: string) => {
  let sbParams = {
    version: storyblokVersion,
    language: locale,
  }

  const storyblokApi = getStoryblokApi()

  try {
    const response = await storyblokApi.get(`cdn/stories/config`, sbParams, {
      cache: 'no-store',
    })

    return response
  } catch (error) {
    console.error('Error fetching config:')
    return { data: { story: {} } }
  }
}
