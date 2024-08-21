import type { Metadata } from 'next'
import { storyblokInit, apiPlugin } from '@storyblok/react/rsc'
import StoryblokProvider from '../../components/StoryblokProvider'
import { ThemeProvider } from './components/ThemeProvid/theme-provider'
import dynamic from 'next/dynamic'

const Footer = dynamic(() => import('./components/Footer'), { ssr: false })
const Header = dynamic(() => import('./components/Header'), { ssr: false })

import '../globals.css'
import '../font.css'
import LoadingLogo from './components/Loading/LoadingLogo'
import Head from 'next/head'
import Script from 'next/script'

storyblokInit({
  accessToken: 'faVE0ToH7Y41wHZy0uSt3Qtt',
  use: [apiPlugin],
  apiOptions: {
    region: 'eu',
  },
})

export const metadata: Metadata = {
  title: 'Bästa Kompisar',
  description: 'En fullservicebyrå',
}

export default function RootLayout({
  children,
  params: { lang },
}: Readonly<{
  children: React.ReactNode
  params: { lang: string }
}>) {
  return (
    <StoryblokProvider>
      <html lang={lang}>
        {/* <Script
          src="https://consent.cookiebot.com/uc.js"
          id="Cookiebot"
          data-cbid="6261c3fa-3f04-4b5b-967e-dc48fd9022a4"
          data-blockingmode="auto"
          type="text/javascript"
          strategy="beforeInteractive"
        /> */}
        <Script
          id="CookieDeclaration"
          src="https://consent.cookiebot.com/6261c3fa-3f04-4b5b-967e-dc48fd9022a4/cd.js"
          type="text/javascript"
          async
        />

        {/* <Script
          src="https://consent.cookiebot.com/6261c3fa-3f04-4b5b-967e-dc48fd9022a4/cd.js"
          id="CookieDeclaration"
          type="text/javascript"
          strategy="afterInteractive"
          async
        /> */}
        <body>
          <ThemeProvider defaultTheme="light" attribute="class">
            <Header locale={lang} />
            <LoadingLogo />

            <main className={`pb-10 px-3 md:px-10 relative`}>{children}</main>
            <Footer locale={lang} />
          </ThemeProvider>
        </body>
      </html>
    </StoryblokProvider>
  )
}
