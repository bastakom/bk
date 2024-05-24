import Team from '@/app/components/Team/Team'
import { storyblokEditable } from '@storyblok/react'

const VartTeam = ({ blok }) => {
  return <Team {...storyblokEditable(blok)} />
}

export default VartTeam
