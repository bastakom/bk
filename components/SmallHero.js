import Small from '@/app/components/SmallHero/Small'
import { storyblokEditable } from '@storyblok/react'

const Cases = ({ blok }) => {
  return (
    <div {...storyblokEditable(blok)}>
      <Small props={blok} />
    </div>
  )
}

export default Cases
