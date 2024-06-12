import type { Metadata } from 'next'
import { storyblokInit, apiPlugin } from '@storyblok/react/rsc'
import StoryblokProvider from '../../components/StoryblokProvider'
import { ThemeProvider } from './components/ThemeProvid/theme-provider'
import Loading from './components/Loading/Loading'
import dynamic from 'next/dynamic'

const Footer = dynamic(() => import('./components/Footer'), { ssr: false })
const Header = dynamic(() => import('./components/Header'), { ssr: false })

import '../globals.css'
import '../font.css'

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
        <body className={`pb-10 px-10 relative`}>
          {/* <Loading /> */}
          <ThemeProvider defaultTheme="light" attribute="class">
            <Header locale={lang} />
            {children}
            <Footer locale={lang} />
          </ThemeProvider>
        </body>
      </html>
    </StoryblokProvider>
  )
}
