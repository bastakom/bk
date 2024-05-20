'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'

interface Props {
  props: {
    name: string
    published_at: string
    uuid: string
    content: {
      kategori: string[] // Assuming kategori is now an array of strings representing UUIDs
    }
  }[]

  kategories: {
    name: string
    uuid: string
  }[]
}

const NewsComponent = ({ props, kategories }: Props) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const filteredPosts = selectedCategory
    ? props.filter((item) => item.content.kategori.includes(selectedCategory))
    : props

  return (
    <div className="mt-14">
      <div className="flex gap-5">
        {kategories.map((item) => (
          <button
            key={item.uuid}
            onClick={() => setSelectedCategory(item.uuid)}
            className={`${
              selectedCategory === item.uuid ? 'bg-blue-500 text-white' : ''
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>
      {filteredPosts.map((item) => {
        const formattedDate = format(
          new Date(`${item.published_at}`),
          'yyyy-MM-dd'
        )
        return (
          <Link href="" key={item.uuid}>
            <div>
              <div>
                {item.content.kategori
                  .map((kat) => kategories.find((k) => k.uuid === kat)?.name)
                  .join(', ')}
              </div>
              <div>{item.name}</div>
              <div>{formattedDate}</div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

export default NewsComponent
