import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { storyblokInit, apiPlugin } from '@storyblok/react/rsc'
import StoryblokProvider from '../components/StoryblokProvider'
import dynamic from 'next/dynamic'

const Footer = dynamic(() => import('./components/Footer'), { ssr: false })
const Header = dynamic(() => import('./components/Header'), { ssr: false })

import { ThemeProvider } from './components/ThemeProvid/theme-provider'
import './globals.css'
import './font.css'
import Loading from './components/Loading/Loading'

storyblokInit({
  accessToken: 'faVE0ToH7Y41wHZy0uSt3Qtt',
  use: [apiPlugin],
  apiOptions: {
    region: 'eu',
  },
})

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Bästa kompisar malmö',
  description: 'En fullservice reklam byrå',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <StoryblokProvider>
      <html lang="en">
        <body className={`${inter.className} pb-10 px-10 relative`}>
          {/* <Loading /> */}
          <ThemeProvider defaultTheme="light" attribute="class">
            <Header />
            {children}
            <Footer />
          </ThemeProvider>
        </body>
      </html>
    </StoryblokProvider>
  )
}
