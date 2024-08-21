"use client"

import { useEffect } from 'react'

const CookieConsent = () => {
  useEffect(() => {
    const cookieBotWrapper = document.getElementById('CookiebotDeclaration')
    if (cookieBotWrapper) {
      const script = document.createElement('script')
      script.id = 'CookieDeclaration'
      script.type = 'text/javascript'
      script.async = true
      script.src = `https://consent.cookiebot.com/6261c3fa-3f04-4b5b-967e-dc48fd9022a4/cd.js`

      cookieBotWrapper.appendChild(script)
    }
  }, [])
  return <div id="CookiebotDeclaration" className="container m-auto mt-28" />
}

export default CookieConsent
