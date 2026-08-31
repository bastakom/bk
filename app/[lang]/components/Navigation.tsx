'use client'

import Link from 'next/link'
import logoblack from '@/public/bk-black.png'
import logowhite from '@/public/bk-white.png'
import Image from 'next/image'
import { useTheme } from 'next-themes'
// import { usePathname, useRouter } from 'next/navigation'
import useStore from '@/app/lib/store'
import ThemeSwitch from './ThemeSwitch'

interface Props {
  props?: any
  locale: any
}

function localizedHref(cachedUrl: string | undefined, locale: string) {
  if (!cachedUrl) return `/${locale}`
  if (cachedUrl.startsWith('http') || cachedUrl.startsWith('mailto:') || cachedUrl.startsWith('tel:')) {
    return cachedUrl
  }

  const normalized = cachedUrl.startsWith('/') ? cachedUrl : `/${cachedUrl}`

  if (normalized === `/${locale}` || normalized.startsWith(`/${locale}/`)) {
    return normalized
  }

  return `/${locale}${normalized}`.replace(/\/$/, '')
}

const Navigation = ({ props, locale }: Props) => {
  const open = useStore((state) => state.open)
  const setIsOpen = useStore((state) => state.setIsOpenMenu)

  const { theme } = useTheme()
  const currentLocale = locale.locale || 'sv'
  // const usePath = usePathname()
  // const router = useRouter()

  // const changeLanguage = (newLang: string) => {
  //   const currentPath = usePath
  //   const newPath = currentPath.replace(/^(\/[^/]+)(.*)$/, `/${newLang}$2`)
  //   router.push(newPath, { scroll: false })
  // }

  const handleMenuOpen = () => {
    setIsOpen(!open)
  }

  return (
    <div className="flex py-2 items-center justify-center fixed z-30 w-full px-5 lg:px-10 top-0 left-0 bg-[#fff] dark:bg-[#121212]">
      <Link
        href={`/${currentLocale}`}
        className="absolute left-5 lg:left-10 flex gap-5 items-center"
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
      <nav className="hidden xl:flex gap-5 justify-center">
        {props.story.content.header_menu.map((item: any) => {
          const link = localizedHref(item.link.cached_url, currentLocale)
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
    </div>
  )
}

export default Navigation
