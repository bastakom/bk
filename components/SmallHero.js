import Small from '@/app/components/SmallHero/Small'
import { storyblokEditable } from '@storyblok/react'

const Smallhero = ({ blok }) => {
  return (
    <div {...storyblokEditable(blok)}>
      <Small props={blok} />
    </div>
  )
}

export default Smallhero
