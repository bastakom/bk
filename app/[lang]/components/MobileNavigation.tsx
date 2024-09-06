import useStore from '@/app/lib/store'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { IoMdArrowForward } from 'react-icons/io'

const MobileNavigation = ({ props }: any) => {
  const open = useStore((state) => state.open)
  const setIsOpen = useStore((state) => state.setIsOpenMenu)
  const usePath = usePathname()
  const router = useRouter()

  const changeLanguage = (newLang: string) => {
    const currentPath = usePath
    const newPath = currentPath.replace(/^(\/[^/]+)(.*)$/, `/${newLang}$2`)
    router.push(newPath, { scroll: false })
    setIsOpen(false)
  }

  if (open === true) {
    document.body.classList.add('no-scroll')
  } else {
    document.body.classList.remove('no-scroll')
  }

  return (
    <>
      <nav
        className={`flex flex-col h-[100vh] top-0 z-10 bg-[#F7DAD2] gap-5 w-[100%] pt-24 absolute transition-all duration-500 right-0 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col mt-5 px-5">
          {props.story.content.header_menu.map((item: any) => {
            const link = item.link.cached_url.startsWith('/')
              ? item.link.cached_url
              : `/${item.link.cached_url}`
            return (
              <Link
                href={link}
                onClick={() => setIsOpen(false)}
                key={item._uid}
                className="font-secondary text-[28px]"
              >
                {item.name}
              </Link>
            )
          })}
        </div>
        <div className="justify-center flex w-full">
          <div className="w-[95%] mt-2 border-[0.5px] border-black" />
        </div>

        <div className="flex flex-col gap-2 mb-4 mt-5 px-5">
          {props.story.content.socials.map((item: any, index: number) => {
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
                className="font-light flex text-[18px]"
                key={index}
              >
                {handleIcon}
                <span className="-rotate-45 font-light">
                  <IoMdArrowForward fontSize={'1.5em'} />
                </span>
              </Link>
            )
          })}
          <div className=" bottom-24 right-4 flex flex-col text-left mt-10">
            <Link className="text-[18px]" href={`tel:${props.story.content.tel}`}>
              {props.story.content.tel}
            </Link>
            <Link className="text-[14px]" href={`mailto:${props.story.content.mail}`}>
              {props.story.content.mail}
            </Link>
          </div>
        </div>

        {/* <div className="flex gap-2 items-center text-[25px] w-full flex justify-center left-0 absolute py-4 top-0 z-40 bg-white">
          <button
            onClick={() => changeLanguage('sv')}
            className="font-secondary"
          >
            SV
          </button>

          <span>|</span>
          <button
            onClick={() => changeLanguage('en')}
            className="font-secondary"
          >
            EN
          </button>
        </div> */}
      </nav>
    </>
  )
}

export default MobileNavigation
