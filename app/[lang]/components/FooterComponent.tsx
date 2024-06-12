'use client'

import Link from 'next/link'
import { render } from 'storyblok-rich-text-react-renderer'
import { useParams } from 'next/navigation'

interface Props {
  props: any
}

const FooterComponent = ({ props }: Props) => {
  const {
    story: { content },
  } = props

  const params = useParams()

  return (
    <div className="w-full min-h-[60vh] justify-between flex flex-col bg-[#25364F] p-14 text-white relative">
      <div className="w-full grid mx-auto grid-cols-[40%_30%_30%] gap-10">
        <div className="flex flex-col gap-10">
          <h2 className="font-primary text-xl">
            {render(content.descriptionText)}
          </h2>
          <div className="flex flex-col gap-1 z-20">
            {content.footer_menu.map((item: any) => (
              <Link href={`${item.link.url}`}>{item.name}</Link>
            ))}
          </div>
        </div>
        <div className="flex flex-col mx-auto gap-14">
          <div>
            <h3 className="font-bold mb-2 text-xl">
              {params.lang === 'en' ? 'Visit us' : 'Besök oss'}
            </h3>
            <div dangerouslySetInnerHTML={{ __html: content.adress }} />
          </div>
          <div className="flex flex-col">
            <h3 className="font-bold text-xl">
              {params.lang === 'en' ? 'Contact' : 'Kontakt'}
            </h3>
            <Link href={`tel:${content.tel}`}>{content.tel}</Link>
            <Link href={`mailto:${content.mail}`}>{content.mail}</Link>
          </div>
        </div>

        <div className="flex flex-col mx-auto">
          <h3 className="font-bold mb-2 text-xl">
            {params.lang === 'en' ? 'Socials' : 'Sociala kanaler'}
          </h3>
          <div className="flex flex-col gap-2 mb-4 mt-2">
            {content.socials.map((item: any) => {
              const handleIcon =
                item.icon === 'ig'
                  ? 'Instagram'
                  : item.icon === 'li'
                  ? 'Linkedin'
                  : item.icon === 'vi'
                  ? 'Vimeo'
                  : item.icon === 'fb'
                  ? 'Facebook'
                  : item.icon === 'yt'
                  ? 'Youtube'
                  : null
              return (
                <Link
                  href={`https://${item.link.url}`}
                  passHref={true}
                  target="_blank"
                >
                  {handleIcon}
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex w-full items-center">
        <div className="flex gap-2 w-full justify-between text-[16px]">
          <span>© Reklambyrån Bästa Kompisar</span>
          <div className="flex gap-10">
            <Link className="text-[16px]" href="/">
              Cookies
            </Link>
            <Link className="text-[16px]" href="/">
              {params.lang === 'en' ? 'Privacy Policy' : 'Integritetspolicy'}
            </Link>
            <Link className="text-[16px]" href="/">
              {params.lang === 'en'
                ? 'Service agreement web services'
                : 'Serviceavtal webbtjänster'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FooterComponent
