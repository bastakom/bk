import Image from 'next/image'

type StoryblokAsset = {
  filename?: string
  alt?: string
  name?: string
  title?: string
}

type StoryblokImageProps = {
  asset?: StoryblokAsset | string
  alt?: string
  decorative?: boolean
  fill?: boolean
  width?: number
  height?: number
  sizes?: string
  priority?: boolean
  quality?: number
  className?: string
}

function imageUrl(asset?: StoryblokAsset | string) {
  if (typeof asset === 'string') return asset
  return asset?.filename || ''
}

function imageAlt(asset: StoryblokAsset | string | undefined, alt?: string, decorative?: boolean) {
  if (decorative) return ''
  if (alt) return alt
  if (typeof asset === 'object') {
    return asset.alt || asset.name || asset.title || ''
  }
  return ''
}

export default function StoryblokImage({
  asset,
  alt,
  decorative,
  fill,
  width,
  height,
  sizes,
  priority,
  quality = 90,
  className,
}: StoryblokImageProps) {
  const src = imageUrl(asset)

  if (!src) return null

  const resolvedAlt = imageAlt(asset, alt, decorative)

  if (fill) {
    return (
      <Image
        src={src}
        alt={resolvedAlt}
        fill
        sizes={sizes || '100vw'}
        priority={priority}
        quality={quality}
        className={className}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={resolvedAlt}
      width={width || 1200}
      height={height || 800}
      sizes={sizes || '(max-width: 768px) 100vw, 50vw'}
      priority={priority}
      quality={quality}
      className={className}
    />
  )
}
