import TjansterComponent from '@/app/components/Tjanster/TjansterComponent'
import { storyblokEditable } from '@storyblok/react'

const Tjanster = ({ blok }) => {
  return (
    <div className="flex" {...storyblokEditable(blok)}>
      <TjansterComponent />
    </div>
  )
}

export default Tjanster
