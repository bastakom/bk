import { NextResponse } from 'next/server'

let locales = ['sv', 'en']

// Get the preferred locale, similar to the above or using a library
function getLocale(request: any) {
  return 'sv'
}

export function middleware(request: any) {
  // Check if there is any supported locale in the pathname
  const { pathname } = request.nextUrl

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) return

  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.includes('/api/')
  )
    return

  // Redirect if there is no locale
  const locale = getLocale(request)
  request.nextUrl.pathname = `/${locale}${pathname}`
  // e.g. incoming request is /products
  // The new URL is now /en-US/products
  return NextResponse.redirect(request.nextUrl)
}

export const config = {
  matcher: [
    // Skip all internal paths (_next)
    '/((?!api|_next/static|_next/image|img/|favicon.ico).*)',
    // Optional: only run on root (/) URLmatcher: [

    // '/'
  ],
}
