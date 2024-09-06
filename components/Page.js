import { storyblokEditable, StoryblokComponent } from '@storyblok/react/rsc'

const Page = ({ blok }) => (
  <div {...storyblokEditable(blok)}>
    {blok &&
      Array.isArray(blok.body) &&
      blok.body.map((nestedBlok, index) => (
        <StoryblokComponent blok={nestedBlok} key={nestedBlok._uid} />
      ))}
  </div>
)

export default Page
