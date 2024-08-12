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
}

const Button = ({ TextEN, TextSV, href, margin, size, text, align }: Props) => {
  const params = useParams()
  return (
    <motion.div
      whileHover="hover"
      className={`text-${
        align ? align : 'center'
      } text-[#FF6062] text-xl font-normal flex gap-2 ${
        align === 'center' && 'justify-center'
      } items-center ${margin}`}
      style={{ fontSize: `${size}px` }}
    >
      <Link href={`/${href}`} className="flex items-center gap-2">
        {params.lang === 'en' ? TextEN : TextSV}
        {text ? text : null}
        <motion.span
          variants={{
            hover: { x: 5 },
          }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <IoMdArrowForward fontSize={'1.3em'} color="#FF6062" />
        </motion.span>
      </Link>
    </motion.div>
  )
}

export default Button
