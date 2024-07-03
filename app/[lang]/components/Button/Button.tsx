'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { IoMdArrowForward } from 'react-icons/io'

interface Props {
  TextEN?: string
  TextSV?: string
  href?: any
  margin?: string
  size?: string
  text?: string
  align?: string
}

const Button = ({ TextEN, TextSV, href, margin, size, text, align }: Props) => {
  const params = useParams()
  return (
    <Link
      href={`${href}`}
      className={`text-${
        align ? align : 'center'
      } text-[#FF6062] text-xl font-noraml flex gap-2 ${
        align === 'center' && 'justify-center'
      } items-center ${margin}`}
      style={{ fontSize: `${size}px` }}
    >
      {params.lang === 'en' ? TextEN : TextSV}
      {text ? text : null}
      <span className="mt-1">
        <IoMdArrowForward fontSize={'1.3em'} color="#FF6062" />
      </span>
    </Link>
  )
}

export default Button
