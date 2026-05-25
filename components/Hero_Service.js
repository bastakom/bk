'use client'

import { storyblokEditable } from '@storyblok/react/rsc'

const HeroService = ({ blok }) => {


return (
  <>
    <div className="w-full h-[600px] lg:h-[92vh] flex items-center relative overflow-hidden">
      <div className="h-full absolute w-full bg-black z-10 opacity-40" />

      <video
        autoPlay
        playsInline
        loop
        muted
        className="absolute hidden lg:block w-full h-full top-0 left-0 object-cover hero-video"
      >
        <source src={blok.Video.filename} />
      </video>

      <video
        autoPlay
        playsInline
        loop
        muted
        className="absolute lg:hidden w-full h-full top-0 left-0 object-cover hero-video"
      >
        <source src={blok.mobile_video.filename} />
      </video>

      <div className="w-full max-w-[760px] px-8 lg:px-20 text-white flex flex-col gap-5 items-start z-20 relative">
        <h2 className="text-sm lg:text-base uppercase font-bold tracking-[0.2em] text-white drop-shadow-[0_0_12px_rgba(0,0,0,0.35)]" {...storyblokEditable(blok)}>
          {blok?.tagline}
        </h2>

        <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold leading-[1.05] text-white max-w-[620px] drop-shadow-[0_0_12px_rgba(0,0,0,0.35)]" {...storyblokEditable(blok)}>
          {blok?.headline}
        </h1>

        {blok?.body && (
          <p className="text-base lg:text-xl leading-relaxed text-white max-w-[650px]">
            {blok.body}
          </p>
        )}

        <div className="flex gap-4 mt-4">
          {blok?.primary_button_text && (
            <a
              href={blok?.primary_button_link?.cached_url}
              className="bg-[#ff6b5f] hover:bg-[#ff5a4d] transition-colors px-6 py-4 text-white font-bold uppercase text-sm"
            >
              {blok.primary_button_text}
            </a>
          )}

          {blok?.secondary_button_text && (
            <a
              href={blok?.secondary_button_link?.cached_url}
              className="border border-white px-6 py-4 text-white font-bold uppercase text-sm"
            >
              {blok.secondary_button_text}
            </a>
          )}
        </div>

      
      </div>
    </div>
  </>
)}

export default HeroService
