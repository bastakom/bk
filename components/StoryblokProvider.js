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
import dynamic from 'next/dynamic'
const TitleText = dynamic(() => import('./TitleText'), { ssr: false })
import Tiles from './Tiles'
import Team from './Team'
import RichText from './RichText'
import Form from './Form'
import KarriarForm from './Karriar'
import Divide from './Divide'
import Tilesicon from './Tilesicon'
import OrgForm from './OrgForm'

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
  tiles: Tiles,
  vart_team: Team,
  richtext_block: RichText,
  form: Form,
  karriar: KarriarForm,
  divide: Divide,
  tiles_icon: Tilesicon,
  organisation: OrgForm,
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
