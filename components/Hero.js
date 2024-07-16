import { storyblokEditable } from '@storyblok/react/rsc'

const Hero = ({ blok }) => {
  return (
    <>
      <div
        className={`w-full flex justify-${blok.position} h-[80vh] lg:h-[92vh] items-center relative`}
      >
        <div className="h-full absolute w-full bg-black z-10 opacity-30" />
        <video
          muted
          autoPlay
          playsInline
          loop
          className="absolute w-full h-full top-0 object-cover"
        >
          <source src={blok.Video.filename} />
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
        </div>
      </div>
    </>
  )
}

export default Hero
