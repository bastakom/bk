# 01-01 Startunderlag - 500-fel i nyheter och Marknadsfika

Status: underlag att kopiera till repo. Inga produktionsandringar ar gjorda.

## Syfte

Detta dokument hor till masterplanens paket `01-01 Ratta 500-felen i nyheter och Marknadsfika`.
Målet ar att reproducera 500-felen, identifiera gemensam route/mall/datamappning och forbereda minsta sakra fix.

## Rekommenderad branch

```txt
seo-geo/01-01-fixa-500-nyheter-marknadsfika
```

## Fil att lagga till

Ny fil:

```txt
docs/seo-geo/01-01-startunderlag.md
```

## Filer som sannolikt behover inspekteras innan kodandring

Redigera inget innan rotorsaken ar bekraftad.

```txt
app/
app/[...slug]/
app/[lang]/
app/[lang]/nyheter/
app/[lang]/nyheter/[slug]/
app/[lang]/marknadsfika/
app/[lang]/marknadsfika/[slug]/
components/
lib/
next.config.js
middleware.ts
package.json
```

Exakta filer avgors av faktisk struktur i repot. Projektet ar verifierat som Next.js 14 med App Router och `middleware.ts`.

## Kontroll-URL:er fran Bilaga A

Representativa 500-URL:er for reproduktion:

```txt
/sv/marknadsfika/andreas-nyberg-duni
/sv/marknadsfika/anna-roth-kaehrs
/sv/marknadsfika/elisabeth-levinsohn
/sv/marknadsfika/katarina-mesan-hsb-nordics
/sv/marknadsfika/sebastian-merloev-absfront
/sv/nyheter/baesta-kompisar-gar-med-i-komm-sveriges-kommunikationsbyraer
/sv/nyheter/baesta-kompisar-nominerade-till-arets-byra-2023
/sv/nyheter/baesta-kompisar-x-viktvaektarna
/sv/nyheter/brand-movie-foer-gaim
/sv/nyheter/davida-vaeljer-baesta-kompisar-efter-pitch
/sv/nyheter/dogman-and-friends
/sv/nyheter/film-och-soundbranding-foer-daily-greens
/sv/nyheter/gripen
/sv/nyheter/hej-jaegersro-center
/sv/nyheter/ljudets-kraft-i-varumaerkesbyggande-vart-samarbete-med-scorett
/sv/nyheter/nu-visas-baesta-kompisars-film-foer-viktvaektarna-usa-pa-nasdaq
/sv/nyheter/ny-illustration-foer-im
/sv/nyheter/ny-kund-homemaid
/sv/nyheter/ny-kund-tepe-brush-along
/sv/nyheter/ny-kund-voady
/sv/nyheter/ny-webb-at-aoptik
/sv/nyheter/nytt-ar-nytt-kontor
/sv/nyheter/re-hydrate-redo-att-ta-plats
/sv/nyheter/rf-sisu
/sv/nyheter/some-filmer-foer-granngardens-nya-tjaenst-grannhjaelpen
/sv/nyheter/varfoer-driva-en-reklambyra-och-ha-kollektivavtal
/sv/nyheter/varmt-vaelkommen-katri-
/sv/nyheter/vi-har-fatt-en-alex-
/sv/nyheter/vi-vaelkomnar-numera-maessor-till-baesta-kompisar
```

## Rotorsakscheck

Bekrafta for minst en Marknadsfika-URL och en Nyheter-URL:

```txt
1. Vilken route matchas?
2. Vilken Storyblok-slug efterfragas?
3. Returnerar Storyblok en publicerad post, en draft, tomt svar eller fel?
4. Kastar sidan exception vid saknad/null data?
5. Kastar generateMetadata samma eller annan exception?
6. Finns skillnad mellan sida och metadata i hur posten laddas?
7. Ska saknad post bli riktig 404 via notFound(), inte 500?
```

## Acceptanskriterium innan fix

- Minst en trasig nyhets-URL ar reproducerad.
- Minst en trasig Marknadsfika-URL ar reproducerad.
- Gemensam rotorsak ar dokumenterad eller sa ar klustren separerade.
- Fixytan ar avgransad till route/data-loader/metadata/null guard.
- 404-listan blandas inte in i detta paket.

## Acceptanskriterium efter fix

- Publicerad representativ Nyheter-post ger 200.
- Publicerad representativ Marknadsfika-post ger 200.
- Saknad post ger riktig 404 via `notFound()`.
- `generateMetadata` anvander samma sakra publicerade-post-loader eller samma normaliserade datakontrakt.
- Regressionstest eller dokumenterat manuellt bevis finns for 200 och 404.
- Inga godtyckliga redirects fran 404 till hubb har lagts till.

