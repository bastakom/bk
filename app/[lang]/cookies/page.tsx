import Script from 'next/script'

const page = () => {
  return (
    <div>
      <Script
        id="CookieDeclaration"
        src="https://consent.cookiebot.com/6261c3fa-3f04-4b5b-967e-dc48fd9022a4/cd.js"
        type="text/javascript"
        async
        strategy="beforeInteractive"
      />
    </div>
  )
}

export default page
