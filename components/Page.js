import { storyblokEditable, StoryblokComponent } from '@storyblok/react/rsc'

const Page = ({ blok, settings }) => (
  <div {...storyblokEditable(blok)}>
    {blok &&
      Array.isArray(blok.body) &&
      blok.body.map((nestedBlok, index) => (
        <StoryblokComponent
          blok={nestedBlok}
          key={nestedBlok._uid}
          settings={settings}
        />
      ))}
  </div>
)

export default Page
