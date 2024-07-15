interface Props {
  className?: string
  bg?: string
  pt?: string
}

const NameLoop = ({ className, bg, pt }: Props) => {
  const firstContent =
    'Bästa Kompisar · Best Friends · Bedste venner · Parhaat ystävät · Migliori amici · Meilleurs amis · Beste vrienden · Mejores amigos · Beste Freunde ·'
  const nextContent =
    'Лучшие друзья- 最好的朋友 - 親友 - أعز اصدقاء · Amici optimi Bästa Kompisar · Best Friends · Bestevenner  · Parhaat ystävät · Migliori amici · Meilleurs amis ·'
  return (
    <div
      className={`${className ? className : 'pt-24 pb-5'} ${
        bg ? bg : 'bg-[#F7F0EE]'
      } full-width-element`}
    >
      <div className="marquee-section m-auto">
        <div className="loop-div-right">
          <div className="marquee flex gap-2 text-[18px] reel-text-color">
            <span>{firstContent}</span>
            <span>{firstContent}</span>
            <span>{firstContent}</span>
          </div>
        </div>
      </div>
      <div className="marquee-section m-auto">
        <div className="loop-div-left">
          <div className="marquee flex gap-2 text-[18px] reel-text-color">
            <span>{nextContent}</span>
            <span>{nextContent}</span>
            <span>{nextContent}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NameLoop
