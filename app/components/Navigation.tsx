'use client'

import Link from 'next/link'
import logoblack from '@/public/bk-black.png'
import logowhite from '@/public/bk-white.png'
import Image from 'next/image'
import ThemeSwitch from './ThemeSwitch'
import { useTheme } from 'next-themes'
import TextAnimation from './TextAnimation/TextAnimation'

interface Props {
  props?: any
}

const Navigation = ({ props }: Props) => {
  const { theme } = useTheme()
  return (
    <div className="flex py-2 items-center justify-between fixed z-50 w-full px-10 top-0 left-0 bg-[#FFFBF6] dark:bg-[#121212]">
      <Link href="/" className="flex gap-5 w-1/3 items-center">
        <Image
          src={theme === 'dark' ? logowhite : logoblack}
          width={50}
          height={50}
          alt="Bästa kompisar Reklambyrå"
          className="my-2"
        />
        <TextAnimation />
      </Link>
      <nav className="flex gap-5 w-1/3 justify-center">
        {props.story.content.header_menu.map((item: any) => {
          return (
            <Link
              href={`/${item.link.cached_url}`}
              key={item._uid}
              className="font-secondary text-[16px]"
            >
              {item.name}
            </Link>
          )
        })}
      </nav>
      <div className="w-1/3 flex justify-end mr-2">
        <ThemeSwitch />
      </div>
    </div>
  )
}

export default Navigation
