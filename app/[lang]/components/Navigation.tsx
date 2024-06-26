'use client'

import Link from 'next/link'
import logoblack from '@/public/bk-black.png'
import logowhite from '@/public/bk-white.png'
import Image from 'next/image'
import ThemeSwitch from './ThemeSwitch'
import { useTheme } from 'next-themes'
import TextAnimation from './TextAnimation/TextAnimation'
import { usePathname, useRouter } from 'next/navigation'

interface Props {
  props?: any
  locale: any
}

const Navigation = ({ props, locale }: Props) => {
  const { theme } = useTheme()
  const usePath = usePathname()
  const router = useRouter()

  const changeLanguage = (newLang: string) => {
    const currentPath = usePath
    const newPath = currentPath.replace(/^(\/[^/]+)(.*)$/, `/${newLang}$2`)
    router.push(newPath, { scroll: false })
  }
  return (
    <div className="flex py-2 items-center justify-between fixed z-50 w-full px-10 top-0 left-0 bg-[#fff] dark:bg-[#121212]">
      <Link href={`/${locale.locale}`} className="flex gap-5 w-1/3 items-center">
        <Image
          src={theme === 'dark' ? logowhite : logoblack}
          width={50}
          height={50}
          alt="Bästa kompisar Reklambyrå"
          className="my-2"
        />
        {/* <TextAnimation /> */}
      </Link>
      <nav className="flex gap-5 w-1/3 justify-center">
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
      <div className="w-1/3 flex justify-end gap-5">
        <div className="flex gap-2 items-center">
          <button
            onClick={() => changeLanguage('sv')}
            className="font-secondary text-[16px]"
          >
            SV
          </button>

          <span>/</span>
          <button
            onClick={() => changeLanguage('en')}
            className="font-secondary text-[16px]"
          >
            EN
          </button>
        </div>
        <ThemeSwitch />
      </div>
    </div>
  )
}

export default Navigation
