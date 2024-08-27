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
        <head>
          <script
            id="Cookiebot"
            src="https://consent.cookiebot.com/uc.js"
            data-cbid="6261c3fa-3f04-4b5b-967e-dc48fd9022a4"
            data-blockingmode="manual"
            type="text/javascript"
            async
          ></script>
          {/* <script
            dangerouslySetInnerHTML={{
              __html: `
              <script></script>
            `,
            }}
          /> */}
        </head>
        <Script id="gtm" strategy="afterInteractive">
          {`
        (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','GTM-N5M8HVH')');
        `}
        </Script>

        <body>
          <noscript
            dangerouslySetInnerHTML={{
              __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-N5M8HVH"
              height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
            }}
          />

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
