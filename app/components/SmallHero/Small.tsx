import Image from 'next/image'

interface Props {
  props: any
}

const Small = ({ props }: Props) => {
  return (
    <div className="h-[50vh] flex w-full mb-10 mt-20">
      <div className="w-1/2 h-full flex flex-col justify-center">
        <h1 className="text-6xl font-bold p-10">{props.title}</h1>
      </div>
      {props.image && (
        <div className="w-1/2 h-full relative h-[50vh]">
          <Image
            src={props.image.filename}
            className="object-cover"
            fill
            alt=""
          />
        </div>
      )}
    </div>
  )
}

export default Small
