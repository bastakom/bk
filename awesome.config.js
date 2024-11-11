module.exports = {
    siteUrl: 'https://bastakompisar.se', // Replace with your site URL
    generateRobotsTxt: true, // (optional)
    sitemapSize: 7000, // (optional) Limit the number of URLs per sitemap file
    changefreq: 'daily', // (optional) Default change frequency for all URLs
    priority: 0.7, // (optional) Default priority for all URLs
    exclude: ['/admin/*'], // (optional) Exclude specific paths
    robotsTxtOptions: {
      additionalSitemaps: [
        'https://bastakompisar.se/sitemap-0.xml', // (optional) Additional sitemaps
      ],
    },
  };