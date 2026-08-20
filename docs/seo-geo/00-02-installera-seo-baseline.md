# 00-02 Installera SEO-baseline - bastakompisar.se

Status: underlag att kopiera till repo. Inga produktionsandringar ar gjorda.

## Rekommenderad branch

```txt
seo-geo/00-02-seo-baseline
```

Starta denna branch efter att `00-01` ar klar och versionsgate ar dokumenterad.

## Filer att lagga till i malrepot

Kopiera filen fran Codex-output:

```txt
outputs/00-02-seo-baseline.mjs
```

till malrepot:

```txt
scripts/seo-baseline.mjs
```

## Filer att andra i malrepot

Andra endast dessa filer for paket `00-02`:

```txt
package.json
.gitignore
```

Lagg till denna script-rad i `package.json` under `scripts`:

```json
{
  "seo:baseline": "node scripts/seo-baseline.mjs"
}
```

Lagg till detta i `.gitignore` om rapporter inte ska versionshanteras:

```gitignore
reports/seo-baseline/
```

Om baslinjen ska versionshanteras som bevis, skapa i stallet en daterad rapportfil och committa bara den valda rapporten.

## Kommandon

```bash
pnpm seo:baseline
```

eller, om projektet anvander npm:

```bash
npm run seo:baseline
```

## Output

Scriptet skapar:

```txt
reports/seo-baseline/<timestamp>/baseline.json
reports/seo-baseline/<timestamp>/baseline.csv
reports/seo-baseline/<timestamp>/summary.json
```

## Kontrollmangd

Scriptet testar:

- `/sitemap.xml`
- startsida och hubbar: `/sv`, `/sv/cases`, `/sv/nyheter`, `/sv/marknadsfika`, `/sv/filmproduktion`
- interna lankar fran hubbarna
- Bilaga A:s 42 trasiga svenska URL:er fran masterplanen

## Deployordning

1. Skapa branch `seo-geo/00-01-teknisk-karta`.
2. Lagg till `docs/seo-geo/00-01-teknisk-karta.md`.
3. Fyll i versionsgate, kommandon, miljoer och blockerare.
4. Oppna PR for dokumentation endast. Ingen produktion.
5. Efter godkand 00-01: skapa branch `seo-geo/00-02-seo-baseline`.
6. Lagg till `scripts/seo-baseline.mjs`.
7. Uppdatera `package.json` med `seo:baseline`.
8. Uppdatera `.gitignore` eller besluta att vald baslinjerapport ska committas.
9. Kor scriptet lokalt och i preview/CI om mojligt.
10. Oppna PR for 00-02. Deploya forst till preview. Produktion endast efter uttryckligt godkannande.

## Stopregler

- Deploya inte till produktion fran 00-01.
- Deploya inte 00-02 till produktion om install/lint/build ar okanda.
- Skriv inte kod for redirects, metadata, cache eller route interception innan Next.js majorversion och `middleware.ts`/`proxy.ts` ar verifierade.
- Exponera aldrig Storyblok-, Vercel-, GA4- eller GSC-hemligheter i rapporterna.

