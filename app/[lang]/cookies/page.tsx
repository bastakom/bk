import type { Metadata } from 'next'
import CookieConsent from '../components/CookieConsent/CookieConsent'
import { buildPageMetadata } from '../../lib/seo'

export async function generateMetadata({
  params,
}: {
  params: { lang: string }
}): Promise<Metadata> {
  return buildPageMetadata({
    lang: params.lang,
    path: `/${params.lang}/cookies`,
    title: 'Cookies - Bästa Kompisar',
    description:
      'Cookiepolicy för Bästa Kompisar med information om vilka cookies som används på webbplatsen.',
  })
}

const page = () => {
  return (
    <>
      <CookieConsent />
    </>
  )
}

export default page
