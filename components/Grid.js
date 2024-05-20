import { storyblokEditable, StoryblokComponent } from '@storyblok/react/rsc'

const Grid = ({ blok }) => {
  return (
    <div
      className="grid grid-cols-3 text-center my-20"
      {...storyblokEditable(blok)}
    >
      {blok.columns.map((nestedBlok, index) => (
        <h2 key={index}>
          <StoryblokComponent blok={nestedBlok} key={nestedBlok._uid} />
        </h2>
      ))}
    </div>
  )
}

export default Grid
