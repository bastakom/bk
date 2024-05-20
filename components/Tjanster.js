import TjansterComponent from '@/app/components/Tjanster/TjansterComponent'
import { storyblokEditable } from '@storyblok/react'

const Tjanster = ({ blok }) => {
  return (
    <div className="h-screen flex items-center" {...storyblokEditable(blok)}>
      <TjansterComponent />
    </div>
  )
}

export default Tjanster
