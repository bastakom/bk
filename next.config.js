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
        source: '/sv/vara-tjanster/cases',
        destination: '/sv/cases',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig

