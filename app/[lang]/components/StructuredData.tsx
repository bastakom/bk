import { siteName, siteUrl } from "../../lib/seo";

const organizationId = `${siteUrl}/#organization`;
const websiteId = `${siteUrl}/#website`;

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["Organization", "LocalBusiness", "ProfessionalService"],
      "@id": organizationId,
      name: siteName,
      url: siteUrl,
      logo: `${siteUrl}/bk-black.png`,
      image: `${siteUrl}/bk-black.png`,
      telephone: "+46 40 127 327",
      email: "info@bastakompisar.se",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Södra Tullgatan 3",
        postalCode: "211 40",
        addressLocality: "Malmö",
        addressCountry: "SE",
      },
      areaServed: [
        {
          "@type": "City",
          name: "Malmö",
        },
        {
          "@type": "Country",
          name: "Sverige",
        },
      ],
      knowsAbout: [
        "Reklambyrå",
        "Filmproduktion",
        "Varumärkesstrategi",
        "Webbdesign",
        "Webbutveckling",
        "Content production",
        "Sociala medier",
        "Digital kommunikation",
      ],
      sameAs: [
        "https://www.instagram.com/bastakompisar",
        "https://www.linkedin.com/company/bastakompisar",
        "https://vimeo.com/user4762673",
        "https://www.facebook.com/bastakompisarreklambyra",
        "https://www.youtube.com/@bastakompisar",
      ],
    },
    {
      "@type": "WebSite",
      "@id": websiteId,
      url: siteUrl,
      name: siteName,
      inLanguage: "sv-SE",
      publisher: {
        "@id": organizationId,
      },
    },
  ],
};

export default function StructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
      }}
    />
  );
}
