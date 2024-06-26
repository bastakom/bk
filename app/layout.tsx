import type { Metadata } from 'next'
import { storyblokInit, apiPlugin } from '@storyblok/react/rsc'

import './globals.css'
import './font.css'
import StoryblokProvider from '@/components/StoryblokProvider'
import { ThemeProvider } from './[lang]/components/ThemeProvid/theme-provider'

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
        <body>
          <ThemeProvider defaultTheme="light" attribute="class">
            <main className={`pb-10 px-10 relative`}>{children}</main>
          </ThemeProvider>
        </body>
      </html>
    </StoryblokProvider>
  )
}
