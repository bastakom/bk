import { storyblokEditable, StoryblokComponent } from '@storyblok/react/rsc'

const Page = ({ blok }) => (
  <main {...storyblokEditable(blok)}>
    {blok &&
      Array.isArray(blok.body) &&
      blok.body.map((nestedBlok, index) => (
        <StoryblokComponent blok={nestedBlok} key={nestedBlok._uid} />
      ))}
  </main>
)

export default Page
