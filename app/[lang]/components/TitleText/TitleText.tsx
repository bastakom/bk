import { render } from 'storyblok-rich-text-react-renderer'

interface Props {
  title: string
  content: any
}

const TitleText = ({ title, content }: Props) => {
  return (
    <div className={`mt-24 mb-10 flex flex-col gap-2 items-center`}>
      <h2 className={`text-center max-w-[30%] text-4xl font-bold`}>
        {render(title)}
      </h2>
      {content && (
        <span className={`leading-[22px] text-center`}>{content}</span>
      )}
    </div>
  )
}

export default TitleText
