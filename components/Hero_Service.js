'use client'

import { storyblokEditable } from '@storyblok/react/rsc'
import { useState } from 'react'
import { GoMute, GoUnmute } from 'react-icons/go'

const HeroService = ({ blok }) => {
const [isMuted, isSetMuted] = useState(true)

const handleMuted = () => {
  isSetMuted(!isMuted)
}

return (
  <>
    <div className="w-full h-[600px] lg:h-[92vh] flex items-center relative overflow-hidden border border-white/50">
      <div className="h-full absolute w-full bg-black z-10 opacity-40" />

     <video
      autoPlay
      muted={isMuted}
      playsInline
      loop
      preload="auto"
      className="absolute hidden lg:block w-full h-full top-0 left-0 object-cover hero-video">
        <source src={blok.Video.filename} type="video/mp4" /> 
    </video>

      <video
        autoPlay
        muted={isMuted}
        playsInline
        loop
        preload="auto"
        className="absolute lg:hidden w-full h-full top-0 left-0 object-cover hero-video">
           <source src={blok.mobile_video.filename} type="video/mp4" />
      </video>

      <div className="w-full max-w-[910px] px-8 lg:px-20 text-white flex flex-col gap-5 items-start z-20 relative">
        <h2 className="text-sm lg:text-base uppercase font-bold tracking-[0.2em] text-white drop-shadow-[0_0_12px_rgba(0,0,0,0.35)]" {...storyblokEditable(blok)}>
          {blok?.tagline}
        </h2>

        <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold leading-[1.05] text-white max-w-[900px] drop-shadow-[0_0_12px_rgba(0,0,0,0.35)]" {...storyblokEditable(blok)}>
          {blok?.headline}
        </h1>

        {blok?.body && (
      <p className="text-[18px] lg:text-[24px] leading-[1.5] text-white max-w-[620px] drop-shadow-[0_0_10px_rgba(0,0,0,0.3)]">
        {blok.body}
      </p>
    )}

  <div className="flex flex-col sm:flex-row gap-4 mt-6">
      {blok?.primary_button_text && (
    <a
      href={blok?.primary_button_link?.cached_url}
      className="bg-[#ff6b5f] hover:bg-[#ff5a4d] transition-all duration-300 px-8 py-4 text-white font-bold uppercase text-sm tracking-wide">
      {blok.primary_button_text}
    </a>
  )}

  {blok?.secondary_button_text && (
    <a
      href={blok?.secondary_button_link?.cached_url}
      className="border border-white hover:bg-white hover:text-black transition-all duration-300 px-8 py-4 text-white font-bold uppercase text-sm tracking-wide"
    >
      {blok.secondary_button_text}
    </a>
  )}
</div>

      
      </div>
    <button

  onClick={handleMuted}

  className="absolute bottom-6 right-6 z-30"

>

  {isMuted ? (

    <GoMute fontSize={'2rem'} color="#fff" />

  ) : (

    <GoUnmute fontSize={'2rem'} color="#fff" />

  )}

</button>
    </div>
  </>
)}

export default HeroService
