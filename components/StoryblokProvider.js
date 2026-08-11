'use client'

import { storyblokInit, apiPlugin } from '@storyblok/react/rsc'

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
import Tiles from './Tiles'
import Team from './Team'
import RichText from './RichText'
import Form from './Form'
import KarriarForm from './Karriar'
import Divide from './Divide'
import Tilesicon from './Tilesicon'
import OrgForm from './OrgForm'
import HeroService from './Hero_Service'
import ServiceGrid from './ServiceGrid'
import ServiceTile from './ServiceTile'
import FAQBlock from './FAQBlock'
import FAQItem from './FAQItem'

const TitleText = dynamic(() => import('./TitleText'), {
  ssr: false,
})

const components = {
  feature: Feature,
  grid: Grid,
  Hero: Hero,

  page: Page,

  // Nya modulära case-sidor använder samma body-rendering som Page.
  case: Page,

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
  HeroService: HeroService,
  service_grid: ServiceGrid,
  service_tile: ServiceTile,
  faq_block: FAQBlock,
  faq_item: FAQItem,
}

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
