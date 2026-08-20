/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'a.storyblok.com',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'bastakompisar.se',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'www.youtube.com',
        port: '',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/en/home',
        destination: '/en',
        permanent: true,
      },
      {
        source: '/home',
        destination: '/sv',
        permanent: true,
      },
      {
        source: '/cases',
        destination: '/sv/cases',
        permanent: true,
      },
      {
        source: '/nyheter',
        destination: '/sv/nyheter',
        permanent: true,
      },
      {
        source: '/marknadsfika',
        destination: '/sv/marknadsfika',
        permanent: true,
      },
      {
        source: '/vara-tjanster',
        destination: '/sv/vara-tjanster',
        permanent: true,
      },
      {
        source: '/omoss',
        destination: '/sv/omoss',
        permanent: true,
      },
      {
        source: '/kontakt',
        destination: '/sv/kontakt',
        permanent: true,
      },
      {
        source: '/faq',
        destination: '/sv/faq',
        permanent: true,
      },
      {
        source: '/filmproduktion',
        destination: '/sv/filmproduktion',
        permanent: true,
      },
      {
        source: '/filmproduction',
        destination: '/sv/filmproduktion',
        permanent: true,
      },
      {
        source: '/sv/filmproduction',
        destination: '/sv/filmproduktion',
        permanent: true,
      },
      {
        source: '/sv/vara-tjanster/film',
        destination: '/sv/filmproduktion',
        permanent: true,
      },
      {
        source: '/sv/vara-tjanster/cases',
        destination: '/sv/cases',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig

