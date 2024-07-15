import useStore from '@/app/lib/store'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { IoMdArrowForward } from 'react-icons/io'
import NameLoop from './NameLoop/NameLoop'

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

  return (
    <>
      <div
        className={`block hover:cursor-pointer lg:hidden full-width-element h-[100vh] left-0 top-0 w-full bg-black transition-opacity duration-500 ${
          open ? 'opacity-70 z-10' : 'opacity-0 hidden'
        } absolute `}
        onClick={() => setIsOpen(false)}
      />
      <nav
        className={`flex flex-col lg:hidden h-[100vh] top-0 z-10 bg-[#F7F0EE] gap-2 w-[100%] px-10  justify-center  absolute transition-all duration-500 right-0 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <NameLoop
          bg={'bg-transparent'}
          className="pt-0 pb-0 absolute top-0 right-0 z-40 left-[14px]"
          pt="pt-0"
        />
        <div className="flex flex-col mt-5">
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

        <div className="flex flex-col gap-2 mb-4 mt-5">
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
                href={`https://${item.link.url}`}
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

        <div className="flex gap-2 items-center  text-[25px] w-full flex justify-center left-0 absolute top-5 z-40">
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
        </div>
      </nav>
    </>
  )
}

export default MobileNavigation
