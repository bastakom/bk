'use client'

import Link from 'next/link'
import logoblack from '@/public/bk-black.png'
import logowhite from '@/public/bk-white.png'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { usePathname, useRouter } from 'next/navigation'
import MobileNavigation from './MobileNavigation'
import useStore from '@/app/lib/store'

interface Props {
  props?: any
  locale: any
}

const Navigation = ({ props, locale }: Props) => {
  const open = useStore((state) => state.open)
  const setIsOpen = useStore((state) => state.setIsOpenMenu)

  const { theme } = useTheme()
  const usePath = usePathname()
  const router = useRouter()

  const changeLanguage = (newLang: string) => {
    const currentPath = usePath
    const newPath = currentPath.replace(/^(\/[^/]+)(.*)$/, `/${newLang}$2`)
    router.push(newPath, { scroll: false })
  }

  const handleMenuOpen = () => {
    setIsOpen(!open)
  }

  return (
    <div className="flex py-2 items-center justify-between fixed z-30 w-full px-5 lg:px-10 top-0 left-0 bg-[#fff] dark:bg-[#121212]">
      <Link
        href={`/${locale.locale}`}
        className="flex gap-5 w-full lg:w-1/3 items-center"
        onClick={() => setIsOpen(false)}
      >
        <Image
          src={theme === 'dark' ? logowhite : logoblack}
          width={50}
          height={50}
          alt="Bästa kompisar Reklambyrå"
          className="my-2 z-20"
        />
      </Link>

      <div
        className={`menu-btn-6 mt-4 z-20 xl:hidden ${open ? 'active' : ''}`}
        onClick={handleMenuOpen}
      >
        <span />
      </div>
      <nav className="hidden xl:flex gap-5 w-1/3 justify-center">
        {props.story.content.header_menu.map((item: any) => {
          const link = item.link.cached_url.startsWith('/')
            ? item.link.cached_url
            : `/${item.link.cached_url}`
          return (
            <Link
              href={link}
              key={item._uid}
              className="font-secondary text-[14px] uppercase"
            >
              {item.name}
            </Link>
          )
        })}
      </nav>
      <MobileNavigation props={props} />
      <div className="w-1/3 hidden xl:flex justify-end gap-5">
        <div className="flex gap-2 items-center">
          <button
            onClick={() => changeLanguage('sv')}
            className="font-secondary text-[16px]"
          >
            SV
          </button>

          <span>|</span>
          <button
            onClick={() => changeLanguage('en')}
            className="font-secondary text-[16px]"
          >
            EN
          </button>
        </div>
        {/* <ThemeSwitch /> */}
      </div>
    </div>
  )
}

export default Navigation
