'use client'

import Link from 'next/link'
import logoblack from '@/public/bk-black.png'
import logowhite from '@/public/bk-white.png'
import Image from 'next/image'
import ThemeSwitch from './ThemeSwitch'
import { useTheme } from 'next-themes'

interface Props {
  props?: any
}

const Navigation = ({ props }: Props) => {
  const { theme } = useTheme()
  return (
    <div className="flex py-2 items-center justify-between fixed z-50 w-full p-10 top-0 left-0 bg-white dark:bg-[#121212]">
      <Link href="/">
        <Image
          src={theme === 'dark' ? logowhite : logoblack}
          width={50}
          height={50}
          alt="Bästa kompisar Reklambyrå"
          className="my-2"
        />
      </Link>
      <nav className="flex gap-5 w-full justify-end">
        {props.story.content.header_menu.map((item: any) => {
          return (
            <Link
              href={item.link.cached_url}
              key={item._uid}
              className="font-secondary text-md"
            >
              {item.name}
            </Link>
          )
        })}
      </nav>
      <ThemeSwitch />
    </div>
  )
}

export default Navigation
