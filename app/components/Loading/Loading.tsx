'use client'

import React, { useState, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

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
  const [loading, setLoading] = useState(false)
  const [loadingText, setTextLoading] = useState(false)
  const loadingRef = useRef(null)
  const textRef = useRef(null)

  useGSAP(() => {
    const timeoutId = setTimeout(() => {
      if (textRef.current) {
        gsap.to(textRef.current, {
          opacity: 0,
          duration: 0.5,
          onComplete: () => {
            if (loadingRef.current) {
              gsap.to(loadingRef.current, {
                opacity: 0,
                duration: 1,
                onComplete: () => setLoading(true),
              })
            } else {
              setLoading(true)
            }
          },
        })
      } else {
        if (loadingRef.current) {
          gsap.to(loadingRef.current, {
            opacity: 0,
            duration: 1,
            onComplete: () => setLoading(true),
          })
        } else {
          setLoading(true)
        }
      }
    }, 3000)

    setTimeout(() => {
      setTextLoading(true)
    }, 3000)

    return () => clearTimeout(timeoutId)
  }, [])

  useGSAP(() => {
    const intervalId = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % arr.length)
    }, 200)

    return () => clearInterval(intervalId)
  }, [arr.length])

  useGSAP(() => {
    if (textRef.current) {
      gsap.fromTo(
        textRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: 'power2.out' }
      )
    }
  }, [index])

  return !loading ? (
    <div
      ref={loadingRef}
      className="w-full pb-8 px-10 pt-16 bg-white h-screen left-0 top-0 flex items-center justify-center  fixed"
      style={{ zIndex: 49 }}
    >
      <div
        className="h-full w-full left-0 bg-black top-0 z-50 text-white flex justify-center items-center"
        style={{ zIndex: 99 }}
      >
        {!loadingText && (
          <span ref={textRef} className="text-6xl font-bold">
            {arr[index]}
          </span>
        )}
      </div>
    </div>
  ) : null
}

export default Loading
