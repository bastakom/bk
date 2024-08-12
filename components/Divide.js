import { storyblokEditable } from '@storyblok/react'

const Divide = ({ blok }) => {
  return (
    <div
      {...storyblokEditable(blok)}
      className="full-width-element"
      style={{
        paddingTop: `${blok.margin_top}px`,
        background: `${blok.bg_color ? blok.bg_color : '#f7f0ee'}`,
      }}
    />
  )
}

export default Divide
