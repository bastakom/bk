import type { Metadata } from 'next'
import { storyblokInit, apiPlugin } from '@storyblok/react/rsc'
import './globals.css'
import './font.css'
import StoryblokProvider from '@/components/StoryblokProvider'
import { ThemeProvider } from './[lang]/components/ThemeProvid/theme-provider'
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
  title: 'Bästa kompisar malmö',
  description: 'En fullservice reklam byrå',
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

        {/* <Script
          src="https://consent.cookiebot.com/6261c3fa-3f04-4b5b-967e-dc48fd9022a4/cd.js"
          id="CookieDeclaration"
          type="text/javascript"
          strategy="afterInteractive"
          async
        /> */}
        <body>
          <ThemeProvider defaultTheme="light" attribute="class">
            {children}
          </ThemeProvider>
        </body>
      </html>
    </StoryblokProvider>
  )
}
