'use client'
import { useTheme } from 'next-themes'
import { GoMoon } from 'react-icons/go'
import { IoSunnyOutline } from 'react-icons/io5'
import { useEffect, useState } from 'react'

const ThemeSwitch = () => {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [isDark, setIsDark] = useState(theme === 'dark')

  useEffect(() => {
    setMounted(true)
    setIsDark(theme === 'dark')
  }, [theme])

  if (!mounted) return null

  return (
    <div className="px-2 flex w-[50px] justify-center items-center bg-gray-200 dark:bg-slate-500 rounded-3xl ml-8">
      <button
        onClick={() => {
          setTheme(theme === 'light' ? 'dark' : 'light')
          setIsDark(!isDark)
        }}
        className={`transition-transform duration-300 transform ${
          !isDark ? 'translate-x-5' : '-translate-x-5'
        } bg-black dark:bg-white p-2 rounded-full shadow-md`}
      >
        {!isDark ? (
          <IoSunnyOutline fontSize={'1.5rem'} color='white'/>
        ) : (
          <GoMoon fontSize={'1.5rem'} color='black' />
        )}
      </button>
    </div>
  )
}

export default ThemeSwitch
