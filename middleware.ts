import { NextResponse } from 'next/server'

const locales = ['sv', 'en']
const primaryHost = 'bastakompisar.se'
const orderHost = 'order.bastakompisar.se'
const signatureHost = 'signatur.bastakompisar.se'

function getLocale() {
  return 'sv'
}

function shouldSkipPath(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.startsWith('/img/')
  )
}

function hasLocale(pathname: string) {
  return locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )
}

export function middleware(request: any) {
  const url = request.nextUrl.clone()
  const { pathname } = url
  const hostname = request.headers.get('host')?.split(':')[0]

  if (shouldSkipPath(pathname)) {
    return
  }

  if (hostname === orderHost) {
    if (pathname === '/') {
      url.pathname = '/order'
      return NextResponse.rewrite(url)
    }

    if (pathname === '/dashboard') {
      url.pathname = '/order/dashboard'
      return NextResponse.rewrite(url)
    }

    if (pathname.startsWith('/order')) {
      return
    }
  }

  if (hostname === signatureHost) {
    if (pathname === '/') {
      url.pathname = '/signatur'
      return NextResponse.rewrite(url)
    }

    if (pathname.startsWith('/signatur')) {
      return
    }
  }

  if (hostname === `www.${primaryHost}`) {
    url.hostname = primaryHost
    url.protocol = 'https'
    return NextResponse.redirect(url, 308)
  }

  if (!hasLocale(pathname)) {
    const locale = getLocale()
    url.pathname = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`
    return NextResponse.redirect(url, 308)
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|img/|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
