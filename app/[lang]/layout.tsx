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

storyblokInit({
  accessToken: 'faVE0ToH7Y41wHZy0uSt3Qtt',
  use: [apiPlugin],
  apiOptions: {
    region: 'eu',
  },
})

export const metadata: Metadata = {
  title: 'Bästa Kompisar',
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
