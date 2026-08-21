import { siteUrl } from "../../lib/seo";
import JsonLd from "./JsonLd";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbJsonLdProps = {
  items: BreadcrumbItem[];
};

export default function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const itemListElement = items.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.label,
    ...(item.href
      ? {
          item: `${siteUrl}${item.href}`.replace(/\/$/, ""),
        }
      : {}),
  }));

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement,
      }}
    />
  );
}
