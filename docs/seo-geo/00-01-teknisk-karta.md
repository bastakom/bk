# 00-01 Teknisk karta - bastakompisar.se

Status: underlag att kopiera till repo. Inga produktionsandringar ar gjorda.

## Syfte

Detta dokument hor till masterplanens paket `00-01 Koppla repo, miljoer och behorigheter`.
Målet ar att lasa versionsgate och skapa en trygg arbetsyta innan nagon kod for metadata, cache, redirects, route interception eller SEO-baslinje implementeras.

## Rekommenderad branch

```txt
seo-geo/00-01-teknisk-karta
```

## Filer att lagga till

Lagg denna fil i malrepot:

```txt
docs/seo-geo/00-01-teknisk-karta.md
```

## Filer att inspektera i malrepot

Fyll i nar repot ar oppnat:

```txt
package.json
next.config.js
next.config.mjs
next.config.ts
middleware.ts
src/middleware.ts
proxy.ts
src/proxy.ts
app/
src/app/
pages/
src/pages/
lib/
src/lib/
components/
src/components/
.env.example
vercel.json
.github/workflows/
```

## Versionsgate

Fyll i exakt fran `package.json` och lockfil:

| Omrade | Verifierat varde | Bevis |
| --- | --- | --- |
| Next.js majorversion | TBD | `package.json` |
| React-version | TBD | `package.json` |
| Router | TBD: App Router / Pages Router / hybrid | `app/`, `pages/` |
| Route interception-fil | TBD: `middleware.ts` / `proxy.ts` / saknas | filinspektion |
| Storyblok SDK/klient | TBD | `package.json`, `lib/`, `src/lib/` |
| Package manager | TBD | lockfil |
| Node-version | TBD | `.nvmrc`, `.node-version`, `package.json engines` |
| Vercel-konfig | TBD | `vercel.json`, dashboard |

Stopregel: skriv ingen versionsspecifik Next.js-losning innan denna tabell ar ifylld.

## Kommandon att verifiera

Kor lokalt eller i previewmiljo. Dokumentera exakt resultat, inte bara "funkar".

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

Om projektet anvander annan package manager, byt till motsvarande:

```bash
npm install
npm run lint
npm test
npm run build
```

eller

```bash
yarn install
yarn lint
yarn test
yarn build
```

## Miljovariabler

Lista namn, inte hemliga varden.

| Variabel | Behovs for | Finns lokalt | Finns preview | Finns produktion | Agare |
| --- | --- | --- | --- | --- | --- |
| NEXT_PUBLIC_STORYBLOK_TOKEN | Storyblok public/preview data | TBD | TBD | TBD | TBD |
| STORYBLOK_PREVIEW_TOKEN | Preview/draft data | TBD | TBD | TBD | TBD |
| STORYBLOK_SPACE_ID | Storyblok CLI/API | TBD | TBD | TBD | TBD |
| STORYBLOK_WEBHOOK_SECRET | Revalidering/webhook | TBD | TBD | TBD | TBD |
| VERCEL_PROJECT_ID | Vercel automation/loggar | TBD | TBD | TBD | TBD |
| VERCEL_ORG_ID | Vercel automation/loggar | TBD | TBD | TBD | TBD |

## Behorigheter som troligen behovs

| System | Behov | Status | Agare |
| --- | --- | --- | --- |
| GitHub | Repo read/write, branch och PR | TBD | TBD |
| Vercel | Preview deploys, build logs, domains, env names | TBD | TBD |
| Storyblok | Read publicerade/draft stories, component schema, webhooks | TBD | TBD |
| GA4 | Lasning for baslinje och events senare | TBD | TBD |
| Google Search Console | Lasning och sitemapstatus | TBD | TBD |
| Google Business Profile | Lasning av lokala actions/NAP | TBD | TBD |

## Acceptanskriterium for 00-01

- Ratt repo ar identifierat.
- Rekommenderad branch ar skapad eller redo att skapas.
- Next.js majorversion ar dokumenterad.
- Routertyp ar dokumenterad.
- `middleware.ts` eller `proxy.ts` ar uttryckligen verifierad.
- Storyblok-klient och tokenmodell ar dokumenterade utan att exponera hemligheter.
- Install, lint, test och build ar kanda: antingen fungerar de, eller sa finns exakt blockerare.
- Inga produktionsandringar ar gjorda.
- Paket `00-02` kan starta utan ny orientering.

