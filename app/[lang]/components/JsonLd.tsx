type JsonLdData = Record<string, unknown> | Record<string, unknown>[]

type JsonLdProps = {
  data: JsonLdData
}

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  )
}
