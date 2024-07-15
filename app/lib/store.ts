import { create } from 'zustand'

interface IsOpenMenu {
  open: boolean
  setIsOpenMenu: (value: boolean) => void
}

const useStore = create<IsOpenMenu>((set) => ({
  open: false,
  setIsOpenMenu: (value) => set({ open: value }),
}))

export default useStore
