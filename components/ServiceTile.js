import { storyblokEditable } from '@storyblok/react/rsc'

function internalHref(cachedUrl) {
  if (!cachedUrl) return '#'
  if (
    cachedUrl.startsWith('#') ||
    cachedUrl.startsWith('http') ||
    cachedUrl.startsWith('mailto:') ||
    cachedUrl.startsWith('tel:')
  ) {
    return cachedUrl
  }

  const normalized = cachedUrl.startsWith('/') ? cachedUrl : `/${cachedUrl}`

  if (normalized === '/sv' || normalized.startsWith('/sv/')) {
    return normalized
  }

  return `/sv${normalized}`.replace(/\/$/, '')
}

const ServiceTile = ({ blok }) => {
  const backgroundStyle = blok?.background_image?.filename
    ? {
        backgroundImage: `url(${blok.background_image.filename})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {
        backgroundColor: blok?.background_color || '#000',
      }

  return (
    <a
      href={internalHref(blok?.link?.cached_url)}
      className="relative min-h-[420px] p-10 flex flex-col justify-between overflow-hidden group border border-white/50"
      style={backgroundStyle}
      {...storyblokEditable(blok)}
    >
      {blok?.background_image?.filename && (
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-all duration-300" />
      )}

      <div className="relative z-10">
        <div className="h-16 mb-3 flex items-center">
          {blok?.icon?.filename ? (
            <img
              src={blok.icon.filename}
              alt={blok.icon.alt || blok.icon.name || ''}
              className="w-16 h-16 object-contain"
            />
          ) : (
            blok?.tagline && (
              <p
                className={`uppercase text-base tracking-[0.2em] font-medium ${
                  blok?.text_color === 'black'
                    ? 'text-black'
                    : 'text-white'
                }`}
              >
                {blok.tagline}
              </p>
            )
          )}
        </div>

        <h3
          className={`text-4xl font-bold leading-tight mb-6 ${
            blok?.text_color === 'black'
              ? 'text-black'
              : 'text-white'
          }`}
        >
          {blok.title}
        </h3>

        <p
          className={`text-lg leading-relaxed max-w-[90%] ${
            blok?.text_color === 'black'
              ? 'text-black'
              : 'text-white'
          }`}
        >
          {blok.ingress}
        </p>
      </div>

      {blok?.link?.cached_url && (
        <div className="relative z-10 mt-10">
          <span
            className={`uppercase font-bold text-sm tracking-wide ${
              blok?.text_color === 'black'
                ? 'text-black'
                : 'text-white'
            }`}
          >
            Läs mer →
          </span>
        </div>
      )}
    </a>
  )
}

export default ServiceTile
