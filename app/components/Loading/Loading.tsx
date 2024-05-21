'use client'
import React, { useState, useEffect } from 'react'

const Loading = () => {
  const arr = [
    'Bästa Kompisar',
    'Best Friends',
    'Bestevenner',
    'Bedste venner',
    'Parhaat ystävät',
    'Migliori amici',
    'Meilleurs amis',
    'Beste vrienden',
    'Mejores amigos',
    'Beste Freunde',
    'Лучшие друзья',
    '最好的朋友',
    '親友',
    'أعز اصدقاء',
    'Amici optimi',
  ]
  const [index, setIndex] = useState(0)
  const [loading, isLoaded] = useState(false)

  setTimeout(() => {
    isLoaded(true)
  }, 3000)

  useEffect(() => {
    const intervalId = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % arr.length)
    }, 100)

    return () => clearInterval(intervalId)
  }, [arr.length])

  return !loading ? (
    <div className="h-[90vh] absolute top-0 bg-black z-50 text-white flex justify-center items-center">
      <span className="text-2xl">{arr[index]}</span>
    </div>
  ) : null
}

export default Loading
