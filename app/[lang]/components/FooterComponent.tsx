'use client'

import Link from 'next/link'
import { render } from 'storyblok-rich-text-react-renderer'
import { useParams } from 'next/navigation'
import { IoMdArrowForward } from 'react-icons/io'
import Image from 'next/image'

interface Props {
  props: any
}

const FooterComponent = ({ props }: Props) => {
  const {
    story: { content },
  } = props

  const params = useParams()

  return (
    <div className="w-full min-h-[80vh] justify-between flex flex-col bg-[#25364F] p-4 lg:p-14 pb-5 text-white relative">
      <div className="w-full grid mx-auto grid-cols-1 lg:grid-cols-[40%_30%_30%] gap-10 pt-10">
        <div className="flex flex-col gap-10 mt-5 lg:mt-0">
          <h2 className="font-primary text-[20px] font-light text-white">
            {render(content.descriptionText)}
          </h2>

          <div className="flex flex-col gap-1 z-20">
            {content.footer_menu.map((item: any, index: string) => (
              <Link
                key={index}
                href={`${item.link.cached_url}`}
                className="font-normal"
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex flex-col lg:mx-auto gap-14">
          <div>
            <h3 className="font-normal mb-2 text-xl">
              {params.lang === 'en' ? 'Visit us' : 'Besök oss'}
            </h3>
            <div
              className="font-light"
              dangerouslySetInnerHTML={{ __html: content.adress }}
            />
          </div>
          <div className="flex flex-col">
            <h3 className="font-normal text-xl">
              {params.lang === 'en' ? 'Contact' : 'Kontakt'}
            </h3>
            <Link href={`tel:${content.tel}`} className="font-light">
              {content.tel}
            </Link>
            <Link href={`mailto:${content.mail}`} className="font-light">
              {content.mail}
            </Link>
          </div>
        </div>

        <div className="flex flex-col lg:mx-auto">
          <h3 className="font-normal mb-2 text-xl">
            {params.lang === 'en' ? 'Socials' : 'Sociala kanaler'}
          </h3>
          <div className="flex flex-col gap-2 mb-4 mt-2">
            {content.socials.map((item: any, index: number) => {
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
                  href={`${item.link.url}`}
                  passHref={true}
                  target="_blank"
                  className="font-light flex"
                  key={index}
                >
                  {handleIcon}
                  <span className="-rotate-45 font-light">
                    <IoMdArrowForward fontSize={'1.5em'} />
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex w-full items-center">
        <div className="flex flex-col lg:flex-row gap-5 lg:gap-2 w-full justify-between text-[16px]">
          <span className="font-light-sofia uppercase lg:mt-0 mt-10 flex flex-col gap-10">
            <div className="flex gap-5">
              {content.Logos.map((el: any) => {
                return (
                  <Image
                    src={el.filename}
                    alt={el.filename}
                    width={80}
                    className="object-contain"
                    height={50}
                    key={el.id}
                  />
                )
              })}
            </div>
            <span>© Reklambyrån Bästa Kompisar 2024</span>
          </span>
          <div className="flex flex-col lg:flex-row gap-2 lg:gap-10 items-end">
            <Link className="text-[16px] font-light" href="/cookies">
              Cookies
            </Link>
            <Link className="text-[16px] font-light" href="privacy-policy">
              {params.lang === 'en' ? 'Privacy Policy' : 'Integritetspolicy'}
            </Link>
         {/*    <Link
              className="text-[16px] font-light-sofia"
              href="service-avtal-webbtjaenster"
            >
              {params.lang === 'en'
                ? 'Service agreement web services'
                : 'Serviceavtal webbtjänster'}
            </Link> */}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FooterComponent
