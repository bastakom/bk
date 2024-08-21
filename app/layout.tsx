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
        <Script
          src={`https://cdn-cookieyes.com/client_data/6261c3fa-3f04-4b5b-967e-dc48fd9022a4/script.js`}
        />
        <body>
          <ThemeProvider defaultTheme="light" attribute="class">
            {children}
          </ThemeProvider>
        </body>
      </html>
    </StoryblokProvider>
  )
}
