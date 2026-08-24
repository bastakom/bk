'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { IoMdArrowForward } from 'react-icons/io'
import { motion } from 'framer-motion'

interface Props {
  TextEN?: string
  TextSV?: string
  href?: any
  margin?: string
  size?: string
  text?: string
  align?: string
  onClick?: any
  arrowDown?: boolean
}

function localizedHref(href: any, lang: string) {
  if (!href || typeof href !== 'string') return href || `/${lang}`
  if (
    href.startsWith('#') ||
    href.startsWith('http') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  ) {
    return href
  }

  const normalized = href.startsWith('/') ? href : `/${href}`

  if (normalized === `/${lang}` || normalized.startsWith(`/${lang}/`)) {
    return normalized
  }

  return `/${lang}${normalized}`.replace(/\/$/, '')
}

const Button = ({ arrowDown, TextEN, TextSV, href, margin, size, text, align }: Props) => {
  const params = useParams()
  const lang = typeof params.lang === 'string' ? params.lang : 'sv'

  return (
    <motion.div
      whileHover="hover"
      className={`text-${align ? align : 'center'
        } text-[#FF6062] text-xl font-normal flex gap-2 ${align === 'center' && 'justify-center'
        } items-center ${margin}`}
    >
      <Link
        href={localizedHref(href, lang)}
        className="flex items-center gap-2"
        style={{ fontSize: `${size}px` }}
      >
        {params.lang === 'en' ? TextEN : TextSV}
        {text ? text : null}
        <motion.span
          variants={{
            hover: { x: 5 },
          }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <IoMdArrowForward className={`${arrowDown && "rotate-90"}`} fontSize={'1.3em'} color="#FF6062" />
        </motion.span>
      </Link>
    </motion.div>
  )
}

export default Button
