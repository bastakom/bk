import { getStoryblokApi, renderRichText } from '@storyblok/react'
import { Metadata } from 'next'
import FilmSlugPage from '../../components/Cases/filmslugpage'
import BreadcrumbJsonLd from '../../components/BreadcrumbJsonLd'
import JsonLd from '../../components/JsonLd'
import { buildStoryblokSeoMetadata, siteName, siteUrl } from '../../../lib/seo'

const getSlugData = async (slug: string, locale: string) => {
  let sbParams = { version: 'published' as const, language: locale }

  const storyblokApi = getStoryblokApi()
  return await storyblokApi.get(`cdn/stories/filmproduction/${slug}`, sbParams)
}

const getAllSlugs = async (locale: string) => {
  let sbParams = {
    version: 'published' as const,
    starts_with: 'filmproduction/',
    language: locale,
  }

  const storyblokApi = getStoryblokApi()
  return await storyblokApi.get(`cdn/stories`, sbParams)
}

function stripHtml(value: string) {
  return value.replace(/<\/?[^>]+(>|$)/g, '').replace(/\s+/g, ' ').trim()
}

function truncate(value: string, maxLength = 150) {
  const cleanValue = value.replace(/\s+/g, ' ').trim()
  return cleanValue.length > maxLength
    ? `${cleanValue.substring(0, maxLength).replace(/\s+\S*$/, '')}...`
    : cleanValue
}

function richTextToPlainText(value: any) {
  return stripHtml(renderRichText(value) || '')
}

function storyDescription(story: any, maxLength = 150) {
  const titleText =
    typeof story?.content?.title === 'string'
      ? story.content.title
      : richTextToPlainText(story?.content?.title)
  const contentText = richTextToPlainText(story?.content?.content)

  return (
    story?.content?.ingress ||
    story?.content?.meta_description ||
    truncate(`${titleText} ${contentText}`, maxLength) ||
    `${story?.name || 'Filmcase'} från Bästa Kompisar.`
  )
}

function storyImage(story: any) {
  return (
    story?.content?.image?.filename ||
    story?.content?.videoimage?.filename ||
    story?.content?.preview_image?.filename ||
    `${siteUrl}/bk-black.png`
  )
}

function storyCategories(story: any, lang: string) {
  if (lang === 'en') {
    return Array.isArray(story?.content?.categoriesen)
      ? story.content.categoriesen.filter(Boolean)
      : []
  }

  if (Array.isArray(story?.content?.Kategori)) {
    return story.content.Kategori.filter(Boolean)
  }

  return story?.content?.Kategori ? [story.content.Kategori] : []
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

  return buildStoryblokSeoMetadata({
    content: story?.content,
    fallbackTitle: `${story.name} - Bästa Kompisar filmcase`,
    fallbackDescription: storyDescription(story),
    fallbackImage: storyImage(story),
    lang: params.lang,
    path: `/${params.lang}/filmproduction/${params.slug}`,
  })
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
  const pageUrl = `${siteUrl}/${params.lang}/filmproduction/${params.slug}`
  const categories = storyCategories(story, params.lang)
  const description = storyDescription(story, 220)
  const image = storyImage(story)
  const breadcrumbItems = [
    { label: 'Start', href: `/${params.lang}` },
    { label: 'Filmproduktion', href: `/${params.lang}/filmproduction` },
    { label: story.name },
  ]

  const filmCaseJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    '@id': `${pageUrl}#filmcase`,
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    name: story.name,
    headline: story.name,
    description,
    image,
    datePublished: story.first_published_at || story.published_at,
    dateModified: story.published_at || story.first_published_at,
    inLanguage: params.lang === 'en' ? 'en-US' : 'sv-SE',
    genre: categories,
    keywords: categories.join(', '),
    creator: {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: siteName,
      url: siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: siteName,
      url: siteUrl,
    },
    about: categories.map((category: string) => ({
      '@type': 'Thing',
      name: category,
    })),
    abstract: description,
  }

  return (
    <>
      <JsonLd data={filmCaseJsonLd} />
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <FilmSlugPage story={story} nextCaseSlug={nextCaseSlug} />
    </>
  )
}

export default page
