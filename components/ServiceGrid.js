import { storyblokEditable, StoryblokComponent } from '@storyblok/react/rsc'

const ServiceGrid = ({ blok }) => {
  return (
    <section
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      {...storyblokEditable(blok)}
    >
      {blok.tiles?.map((nestedBlok) => (
        <StoryblokComponent blok={nestedBlok} key={nestedBlok._uid} />
      ))}
    </section>
  )
}

export default ServiceGrid
