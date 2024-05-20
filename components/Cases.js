import CasesReel from '@/app/components/Cases/CasesReel'
import { storyblokEditable } from '@storyblok/react'

const Cases = ({ blok }) => {
  return <CasesReel {...storyblokEditable(blok)} props={blok.referens} />
}

export default Cases
