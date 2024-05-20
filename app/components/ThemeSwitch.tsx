'use client'
import { useTheme } from 'next-themes'
import { GoMoon } from 'react-icons/go'
import { IoSunnyOutline } from 'react-icons/io5'

const ThemeSwitch = () => {
  const { setTheme, theme } = useTheme()

  return (
    <div className="pl-2  flex justify-center items-center">
      {theme === 'light' ? (
        <button onClick={() => setTheme('dark')}>
          <GoMoon fontSize={'1.5rem'} />
        </button>
      ) : (
        <button onClick={() => setTheme('light')}>
          <IoSunnyOutline fontSize={'1.5rem'} />
        </button>
      )}
    </div>
  )
}

export default ThemeSwitch
