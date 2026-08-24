import type { Metadata } from 'next'
import { getStoryblokApi } from '@storyblok/react'
import BreadcrumbJsonLd from '../../components/BreadcrumbJsonLd'
import { buildStoryblokSeoMetadata, siteName, siteUrl } from '../../../lib/seo'

const storyblokVersion: 'published' | 'draft' =
  process.env.NEXT_PUBLIC_STORYBLOK_PREVIEW === 'true'
    ? 'draft'
    : 'published'

async function getServiceStory(slug: string, locale: string) {
  const storyblokApi = getStoryblokApi()

  try {
    const response = await storyblokApi.get(
      `cdn/stories/vara-tjanster/${slug}`,
      {
        version: storyblokVersion,
        language: locale,
      },
      {
        cache: 'no-store',
      }
    )

    return response?.data?.story
  } catch {
    return undefined
  }
}

function textFromRichText(value: any): string {
  if (!value?.content || !Array.isArray(value.content)) return ''

  return value.content
    .flatMap((node: any) => node.content || [])
    .map((node: any) => node.text || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function truncate(value: string, maxLength = 155) {
  const cleanValue = value.replace(/\s+/g, ' ').trim()
  return cleanValue.length > maxLength
    ? `${cleanValue.substring(0, maxLength).replace(/\s+\S*$/, '')}...`
    : cleanValue
}

function serviceDescription(story: any) {
  return (
    textFromRichText(story?.content?.single_content) ||
    textFromRichText(story?.content?.text_block_content) ||
    `${story?.name || 'Tjänst'} från ${siteName}.`
  )
}

function serviceImage(story: any) {
  return (
    story?.content?.image?.filename ||
    story?.content?.film_case_image?.filename ||
    `${siteUrl}/bk-black.png`
  )
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string; lang: string }
}): Promise<Metadata> {
  const story = await getServiceStory(params.slug, params.lang)

  return buildStoryblokSeoMetadata({
    content: story?.content,
    fallbackTitle: `${story?.name || 'Tjänst'} - Bästa Kompisar`,
    fallbackDescription: truncate(serviceDescription(story)),
    fallbackImage: serviceImage(story),
    lang: params.lang,
    path: `/${params.lang}/vara-tjanster/${params.slug}`,
  })
}

export default async function ServiceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { slug: string; lang: string }
}) {
  const story = await getServiceStory(params.slug, params.lang)
  const breadcrumbItems = [
    { label: 'Start', href: `/${params.lang}` },
    { label: 'Tjänster', href: `/${params.lang}/vara-tjanster` },
    { label: story?.name || params.slug },
  ]

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbItems} />
      {children}
    </>
  )
}
