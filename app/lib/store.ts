import { create } from 'zustand'

// const [selectedCategory, setSelectedCategory] = useState('')

interface IsOpenMenu {
  // selectedCategory: string
  open: boolean
  setIsOpenMenu: (value: boolean) => void
  // setSelectedCategory: (value: string) => void
}

const useStore = create<IsOpenMenu>((set) => ({
  open: false,
  setIsOpenMenu: (value) => set({ open: value }),
}))

export default useStore
