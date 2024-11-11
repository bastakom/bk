import type { Metadata } from 'next'
import { storyblokInit, apiPlugin } from '@storyblok/react/rsc'
import StoryblokProvider from '../../components/StoryblokProvider'
import { ThemeProvider } from './components/ThemeProvid/theme-provider'
import dynamic from 'next/dynamic'
// import Header from './components/Header'

const Footer = dynamic(() => import('./components/Footer'), { ssr: false })
const Header = dynamic(() => import('./components/Header'), { ssr: false })

import '../globals.css'
import '../font.css'
import LoadingLogo from './components/Loading/LoadingLogo'
import { GoogleAnalytics, GoogleTagManager } from '@next/third-parties/google'
import MobileHeader from './components/MobileHeader'

storyblokInit({
  accessToken: 'faVE0ToH7Y41wHZy0uSt3Qtt',
  use: [apiPlugin],
  apiOptions: {
    region: 'eu',
  },
})

export const metadata: Metadata = {
  title: 'Reklambyrån Bästa Kompisar – En fullservicebyrå',
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
        <GoogleTagManager gtmId="GTM-N5M8HVH" />
  {/*       <head>
          <script
            id="Cookiebot"
            src="https://consent.cookiebot.com/uc.js"
            data-cbid="6261c3fa-3f04-4b5b-967e-dc48fd9022a4"
            data-blockingmode="manual"
            type="text/javascript"
            async
          ></script>
        </head> */}

        <body>
          <noscript
            dangerouslySetInnerHTML={{
              __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-N5M8HVH"
              height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
            }}
          />

          <ThemeProvider defaultTheme="light" attribute="class">
            <Header locale={lang} />
            <MobileHeader locale={lang} />
            <LoadingLogo />
            <main className={`pb-10 px-3 md:px-10 relative`}>{children}</main>
            <Footer locale={lang} />
          </ThemeProvider>
        </body>
        <GoogleAnalytics gaId="GTM-N5M8HVH" />
      </html>
    </StoryblokProvider>
  )
}
