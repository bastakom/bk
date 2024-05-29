import { storyblokEditable } from '@storyblok/react/rsc'
import { render } from 'storyblok-rich-text-react-renderer'

const RichText = ({ blok }) => {
  console.log(blok)
  return (
    <div className="absolute left-0 pt-20 pb-14" {...storyblokEditable(blok)}>
      <div className="looping-text-container">
        <div className="looping-text">{render(blok.content)}</div>
      </div>
    </div>
  )
}

export default RichText
