import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { StoryblokStory, getStoryblokApi } from '@storyblok/react/rsc'
import { buildStoryblokSeoMetadata, siteName, siteUrl } from '../../lib/seo'
import JsonLd from '../components/JsonLd'

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
  if (Array.isArray(value)) {
    return value.map((item: any) => plainText(item)).filter(Boolean).join(' ')
  }
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

function storyDescription(content: any) {
  return (
    content.description ||
    content.intro ||
    content.sub_title ||
    truncate(
      plainText(content.content) ||
        plainText(content.single_content) ||
        plainText(content.text_block_content)
    ) ||
    'Bästa Kompisar är en kreativ reklambyrå och filmproduktionsbyrå i Malmö.'
  )
}

function storyImage(content: any) {
  return (
    content.image?.filename ||
    content.hero_image?.filename ||
    content.preview_image?.filename ||
    undefined
  )
}

function pageSchemaType(slugName: string) {
  if (slugName === 'kontakt') return 'ContactPage'

  return 'WebPage'
}

function contactPageFields(slugName: string) {
  if (slugName !== 'kontakt') return {}

  return {
    mainEntity: {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: siteName,
      url: siteUrl,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        areaServed: 'SE',
        availableLanguage: ['sv', 'en'],
      },
    },
  }
}

function collectFaqItems(value: any, items: Array<{ question: string; answer: string }> = []) {
  if (!value || typeof value !== 'object') return items

  if (Array.isArray(value)) {
    value.forEach((item) => collectFaqItems(item, items))
    return items
  }

  const question =
    plainText(value.question) ||
    plainText(value.fraga) ||
    plainText(value.fråga) ||
    plainText(value.title)
  const answer =
    plainText(value.answer) ||
    plainText(value.svar) ||
    plainText(value.content) ||
    plainText(value.text)

  if (question && answer && question !== answer) {
    items.push({
      question: truncate(question, 180),
      answer: truncate(answer, 500),
    })
  }

  Object.values(value).forEach((childValue) => {
    if (childValue && typeof childValue === 'object') {
      collectFaqItems(childValue, items)
    }
  })

  return items
}

function faqPageJsonLd(slugName: string, content: any, pageUrl: string) {
  if (slugName !== 'faq') return null

  const faqItems = collectFaqItems(content).slice(0, 20)
  if (faqItems.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${pageUrl}#faq`,
    url: pageUrl,
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

function filmproduktionServiceJsonLd(slugName: string, content: any, pageUrl: string) {
  if (slugName !== 'filmproduktion') return null

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${pageUrl}#filmproduktion-service`,
    url: pageUrl,
    name: 'Filmproduktion',
    description: storyDescription(content),
    image: storyImage(content),
    provider: {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: siteName,
      url: siteUrl,
    },
    areaServed: {
      '@type': 'Country',
      name: 'Sverige',
    },
    serviceType: 'Filmproduktion',
  }
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

    return buildStoryblokSeoMetadata({
      content,
      fallbackTitle: title,
      fallbackDescription: storyDescription(content),
      fallbackImage: storyImage(content),
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

    const story = data.data.story
    const content = story.content || {}
    const path = pathForParams(params)
    const pageUrl = `${siteUrl}${path}`
    const webPageJsonLd = {
      '@context': 'https://schema.org',
      '@type': pageSchemaType(slugName),
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: story.name ? `${story.name} - Bästa Kompisar` : siteName,
      description: storyDescription(content),
      image: storyImage(content),
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
      ...contactPageFields(slugName),
    }
    const extraJsonLd = [
      faqPageJsonLd(slugName, content, pageUrl),
      filmproduktionServiceJsonLd(slugName, content, pageUrl),
    ].filter((item): item is Record<string, unknown> => item !== null)
    const jsonLdData =
      extraJsonLd.length > 0 ? [webPageJsonLd, ...extraJsonLd] : webPageJsonLd

    return (
      <div className="mt-10">
        <JsonLd data={jsonLdData} />
        {hiddenH1 && (
          <h1 className="sr-only">
            {hiddenH1}
          </h1>
        )}
        <StoryblokStory story={story} settings={settings} />
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
