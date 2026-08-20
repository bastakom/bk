import type { Metadata } from 'next'

export const siteUrl = 'https://bastakompisar.se'
export const siteName = 'Bästa Kompisar'

const defaultTitle = 'Bästa Kompisar - Fullservice- och filmproduktionsbyrå i Malmö'
const defaultDescription =
  'Kreativ reklambyrå och produktionsbolag i Malmö. Filmproduktion, content och digital kommunikation med fokus på affärsnytta och effekt.'
const defaultImage = `${siteUrl}/bk-black.png`

export function canonicalUrl(path = '/') {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return new URL(cleanPath, siteUrl).toString()
}

export function localeForLang(lang: string) {
  return lang === 'en' ? 'en_US' : 'sv_SE'
}

export function buildPageMetadata({
  title = defaultTitle,
  description = defaultDescription,
  path = '/',
  lang = 'sv',
  image = defaultImage,
}: {
  title?: string
  description?: string
  path?: string
  lang?: string
  image?: string
} = {}): Metadata {
  const url = canonicalUrl(path)

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: `${siteName} logotype`,
        },
      ],
      locale: localeForLang(lang),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}

