import { storyblokEditable } from '@storyblok/react/rsc'
import { useState } from 'react'
import { GoMute, GoUnmute } from 'react-icons/go'

const Hero = ({ blok }) => {
  const [isMuted, isSetMuted] = useState(true)
  const handleMuted = () => {
    isSetMuted(!isMuted)
  }

  return (
    <>
      <div
        className={`w-full flex justify-${blok.position} h-[378px] lg:h-[92vh] items-center relative`}
      >
        <div className="h-full absolute w-full bg-black z-10 opacity-30" />
        <video
          autoPlay
          playsInline
          loop
          muted={isMuted}
          className="absolute hidden lg:block w-full h-full top-0 object-cover hero-video"
        >
          <source src={blok.Video.filename} />
        </video>
        <video
          autoPlay
          playsInline
          loop
          muted={isMuted}
          className="absolute lg:hidden w-full h-[378px] top-0 object-cover hero-video"
        >
          <source src={blok.mobile_video.filename} />
        </video>
        <div
          className={`w-full text-white flex flex-col gap-5 items-${blok.position} z-10`}
        >
          <h2
            className="text-xl uppercase font-light"
            {...storyblokEditable(blok)}
          >
            {blok?.tagline}
          </h2>
          <h1 className="text-6xl font-bold" {...storyblokEditable(blok)}>
            {blok?.headline}
          </h1>
          <div className="aboslute bottom-0 right-0 w-full z-50 flex justify-end items-end h-[85vh] py-2 px-5">
            <button onClick={handleMuted} className="z-10">
              {isMuted ? (
                <GoMute fontSize={'2.5rem'} color="#fff" />
              ) : (
                <GoUnmute fontSize={'2.5rem'} color="#fff" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default Hero
