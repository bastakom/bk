import Link from 'next/link'

import { FaInstagram, FaFacebook, FaLinkedin, FaVimeo } from 'react-icons/fa6'
import { FaYoutube } from 'react-icons/fa'

interface Props {
  props: any
}

const FooterComponent = ({ props }: Props) => {
  const {
    story: { content },
  } = props

  return (
    <div className="w-full h-[50vh] flex flex-col bg-[#3d3d3d] p-10 mt-10 text-white relative">
      <h2 className="font-bold font-primary uppercase text-xl">
        © Reklambyrån Bästa Kompisar
      </h2>
      <div className="w-full flex m-auto">
        <div className="w-1/4 flex flex-col">
          <h3 className="font-bold mb-2 text-2xl">
            Följ våra <br />
            sociala kanaler
          </h3>
          <div className="flex gap-2 mb-4 mt-2">
            {content.socials.map((item: any) => {
              const handleIcon =
                item.icon === 'ig' ? (
                  <FaInstagram fontSize={'1.5em'} />
                ) : item.icon === 'li' ? (
                  <FaLinkedin fontSize={'1.5rem'} />
                ) : item.icon === 'vi' ? (
                  <FaVimeo fontSize={'1.5rem'} />
                ) : item.icon === 'fb' ? (
                  <FaFacebook fontSize={'1.5rem'} />
                ) : item.icon === 'yt' ? (
                  <FaYoutube fontSize={'1.5rem'} />
                ) : null
              return <Link href={item.link.url}>{handleIcon}</Link>
            })}
          </div>
        </div>

        <div className="w-1/4 flex flex-col gap-1">
          <h3 className="font-bold mb-2 text-2xl">Meny</h3>
          {content.footer_menu.map((item: any) => (
            <Link href={`${item.link.url}`}>{item.name}</Link>
          ))}
        </div>

        <div className="w-1/4 flex flex-col">
          <h3 className="font-bold mb-2 text-2xl">Kontakt</h3>
          <Link href={`tel:${content.tel}`}>{content.tel}</Link>
          <span>{content.adress}</span>
          <Link href={`mailto:${content.mail}`}>{content.mail}</Link>
        </div>
      </div>

      <div className="flex w-full items-center">
        <div className="flex gap-2 w-full justify-between text-sm">
          <div>
            <Link href="/">Cookies</Link> & <Link href="/">Policys</Link>
          </div>
          <span>© Reklambyrån Bästa Kompisar</span>
        </div>
      </div>
    </div>
  )
}

export default FooterComponent
