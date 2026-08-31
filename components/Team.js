import Team from '@/app/[lang]/components/Team/Team'
import { storyblokEditable } from '@storyblok/react'

const VartTeam = ({ blok }) => {
  return (
    <section
      {...storyblokEditable(blok)}
      style={{
        paddingLeft: '40px',
        paddingRight: '40px',
      }}
    >
      <Team />
    </section>
  )
}

export default VartTeam
