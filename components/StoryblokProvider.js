'use client'
/** 1. Tag it as a client component */
import { storyblokInit, apiPlugin } from '@storyblok/react/rsc'

/** Import your components */
import Page from './Page'
import Hero from './Hero'
import Feature from './Feature'
import Grid from './Grid'
import CTA from './CTA'
import Config from './Config'
import HeaderMenu from './HeaderMenu'
import MenuLink from './MenuLink'
import Cases from './Cases'
import SmallHero from './SmallHero'
import TitleText from './TitleText'

const components = {
  feature: Feature,
  grid: Grid,
  Hero: Hero,
  page: Page,
  varacases: Cases,
  ctablock: CTA,
  config: Config,
  header_menu: HeaderMenu,
  menu_link: MenuLink,
  smallhero: SmallHero,
  title_text: TitleText,
}
/** 2. Initialize it as usual */
storyblokInit({
  accessToken: 'faVE0ToH7Y41wHZy0uSt3Qtt',
  components,
  use: [apiPlugin],
  apiOptions: {
    region: 'eu',
  },
})

export default function StoryblokProvider({ children }) {
  return children
}
