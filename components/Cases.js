import CasesReel from '@/app/[lang]/components/Cases/CasesReel'
import { storyblokEditable } from '@storyblok/react'

const Cases = ({ blok }) => {
  return <CasesReel className="container" {...storyblokEditable(blok)} props={blok.referens} />
}

export default Cases
