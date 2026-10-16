# Rapportplattform

Whatagraph-liknande plattform för Reklambyrån Bästa Kompisar: koppla kundernas marknadsföringskonton, bygg live-dashboards och exportera PDF-rapporter.

**Status:** Fas 6 klar – alla fem plattformar har riktiga connectors, plus white label och delningslänkar. Se [Faser](#faser) och [docs/KOPPLINGAR.md](docs/KOPPLINGAR.md) för att aktivera kopplingarna.

## Kom igång

Kräver Node 24 och pnpm. Ingen Docker behövs, eftersom en lokal PostgreSQL 18 startas via `embedded-postgres`.

```bash
pnpm install
cp .env.example .env          # fyll i TOKEN_ENCRYPTION_KEY och BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm db:start                 # startar Postgres på :5433, låt den köra i en egen terminal
pnpm db:migrate               # skapar tabeller, rollen rp_app och row level security
pnpm --filter @rp/db fx:sync 2023-01-01   # ECB-kurser (seed gör detta automatiskt)
pnpm db:seed                  # demobyrå, 5 kunder, 14 mockkonton, ~3 års data, årsrapport + mall (~45 s)
pnpm dev                      # http://localhost:3000
pnpm fake-google              # simulerad Google-server (GA4 + Google Ads) på :4010
pnpm fake-platforms           # simulerade Meta, LinkedIn och TikTok på :4011
pnpm worker                   # (valfritt) synk var 4:e timme, utskick och valutakurser
```

Utan `RESEND_API_KEY` i `.env` hamnar mejlen i en lokal utkorg (`.outbox/`), som du ser under **Utskick** i appen. Med en nyckel och `MAIL_FROM` skickas de via Resend.

Demoanvändare (lösenord: `SEED_USER_PASSWORD` i `.env`):

| E-post | Roll |
|---|---|
| `demo@bastakompisar.se` | Admin |
| `redaktor@bastakompisar.se` | Redaktör |
| `lasare@bastakompisar.se` | Endast läsning |

```bash
pnpm test                       # enhetstester (core) + databastester (db, kräver db:start)
pnpm typecheck
node scripts/e2e-phase2.mjs     # röktest i headless Chromium mot `pnpm dev`: builder och mallar
node scripts/e2e-phase3.mjs     # röktest: valuta, källfördelning, egna metrics
node scripts/e2e-phase4.mjs     # röktest: PDF-export, schemaläggning, utkorg, worker
node scripts/e2e-phase5.mjs     # röktest: GA4 via OAuth, synk, token-förnyelse, återkallad behörighet, larm
node scripts/e2e-phase6.mjs     # röktest: Meta-token, LinkedIn, TikTok, Google Ads, delningslänk, white label
node scripts/e2e-filters.mjs    # röktest: datafilter (tillfällig dashboard för Demo Tandvård)
node scripts/e2e-english.mjs    # röktest: rapport på engelska (delad länk och PDF)
node scripts/e2e-portal.mjs     # röktest: inbjudan, kundportal och behörighet per kund
pnpm --filter @rp/reports render "Årsrapport" paged ut.pdf   # PDF från kommandoraden
pnpm --filter @rp/reports pdf2png ut.pdf bilder/ 1-3          # PDF-sidor som PNG för granskning
node scripts/screenshot.mjs /clients ut.png --full   # skärmdump som inloggad demoanvändare
```

Röktest 5–6 kör ett produktionsbygge på port 3100 mot de simulerade servrarna (`pnpm --filter web build`, `pnpm fake-google`, `pnpm fake-platforms`). Om ett bygge visar gammal CSS: `rm -rf apps/web/.next/cache` och bygg om.

Playwright används för röktester och skärmdumpar (och för PDF-exporten i fas 4): `npx playwright install chromium` första gången.

## Struktur

```
apps/web            Next.js 16 (App Router), Tailwind 4, shadcn/ui, Better Auth
packages/core       Connector-interface, metric-register, beräkningar, formatering, mock-connectors
packages/db         Prisma-schema, migrationer (inkl. RLS), tenant-klient, synk, seed
docs/               API-godkännanden m.m.
```

## Arkitektur i korthet

**Hierarki:** byrå (`Workspace`) → kunder (`Client`) → kopplade konton (`ConnectedAccount`) och dashboards → widgets. En `Connection` är en OAuth-inloggning på byrånivå som kan ge åtkomst till många konton. Varje konto knyts till exakt en kund.

**Tenant-isolering, två lager:**
1. All åtkomst går via `requireWorkspace()` i `apps/web/src/lib/dal.ts`, som ger `ctx.tx(...)`.
2. `ctx.tx` sätter `app.workspace_id` i Postgres-transaktionen. Appen ansluter som rollen `rp_app`, och row level security på alla tenant-tabeller visar bara den egna byråns rader. Utan satt byrå syns ingenting.

Databasen hindrar även att ett konto används i en annan kunds widget, via en sammansatt främmande nyckel `(accountId, clientId)`. Samma externa konto kan inte heller kopplas till två kunder (`@@unique([workspaceId, connectorId, externalId])`).

**Data:** connectors anropas aldrig när en dashboard visas. Synken hämtar data och skriver normaliserade dagliga fakta till `metric_facts`: en rad per konto, datum och dimensionsvärde, med endast additiva metrics i originalvaluta. Kvoter som CTR, CPC, CPM och bounce rate räknas alltid om från summor (`computeMetric` i `packages/core/src/metrics.ts`), aldrig som medelvärde av medelvärden.

**Säkerhet:** OAuth-tokens lagras AES-256-GCM-krypterade (`packages/core/src/crypto.ts`). OAuth-flödet skyddas med `state`-cookie. Connectors begär bara lässcopes.

**GDPR:** "Koppla bort" raderar kontot och all dess data. "Radera kund" raderar kunden med konton, dashboards och data (kaskad).

## Dashboards

- **Widgettyper** (`packages/core/src/widgets.ts`): KPI-kort (med sparkline och delta), trendgraf (linje, yta eller stapel), donut, tabell, funnel, annonsgalleri, text och sektionsrubrik. Kartvy kommer senare.
- **Query-motorn** (`packages/core/src/query.ts`) är en ren funktion från fakta till widgetresultat, och samma motor används i dashboarden och i editorns förhandsvisning.
  - Kvoter räknas om per rad och bucket.
  - Årsperioder visas per månad och kvartal per vecka (automatisk upplösning).
  - Metrics med olika enheter ritas som små multiplar, aldrig med två y-axlar.
- **Period:** `?range=last_30&compare=previous_period`, eller `range=custom&from=…&to=…`.
  - Kalenderperioder jämförs med föregående kalenderperiod.
  - Saknas data för jämförelseperioden visas "–" och en notis, aldrig en falsk ökning.
- **Mallar** (`packages/db/src/templates.ts`): en dashboard sparas utan konto-id:n, med källplatser per plattform. När mallen appliceras mappas varje plats mot kundens konto. Samma flöde används för att kopiera en dashboard till en annan kund.
- **Inget klipps:** i visningsläge växer tabeller, gallerier och textblock till sitt innehåll.

## Filter

Filtren fungerar som i Whatagraph.

**Nivåer:**
- Per widget: i widget-editorn.
- För hela dashboarden: knappen **Filter** i kontrollfältet. Dashboardens filter gäller även delade länkar, PDF:er och schemalagda utskick.

**Hur ett filter sätts:**
- Varje filter gäller en kanal, eller alla kanaler.
- Det filtrerar på ett fält, till exempel kampanj, annonsgrupp, sökord, land, enhet, ålder eller jobbtitel.
- Villkoren är "är någon av", "är inte någon av", "innehåller" och "innehåller inte".
- För "är någon av" väljer man bland kundens faktiska värden (senast aktiva först) eller skriver egna.

**Så räknas det:**
- Fakta lagras per dimension. Ett kampanjfilter på ett nyckeltal räknar därför från kampanjraderna i stället för dagstotalerna. Det blir rätt eftersom alla lagrade metrics är additiva (se `packages/core/src/filters.ts`).
- Plattformarna levererar inte korsningar av två fält, till exempel kampanj och ålder. Därför används ett filterfält per kanal och widget.
- En tabell uppdelad på ett annat fält än filtret visar den kanalen ofiltrerad, med en förklaring på widgeten.
- Annonsgalleriet filtreras på kampanj via annonsens kampanj.
- Filtrerade widgets har en filterikon med en lista över filtren. I PDF:en skrivs filtren ut under rubriken.

## AI-analys (intern)

Knappen **AI-analys** på en dashboard tar fram en analys av vald period, skriven som av en performance marketing-strateg på en stor digital byrå:
- vad som fungerar och vad som kan bli bättre,
- om annonserna når rätt målgrupp,
- bedömning av annonserna,
- prioriterade nästa steg,
- takten mot budget.

**Den är intern.** Den visas aldrig på delade länkar, i PDF:er eller i utskick, och sparas per dashboard så att teamet kan läsa tidigare analyser.

**Underlaget** byggs med samma dataladdning som dashboarden, så filter, kundens källfilter och valutaomräkning gäller. Det består av:
- nyckeltal mot jämförelseperioden,
- de största kampanjerna och annonsgrupperna,
- fördelningen på ålder, kön, region, enhet och (LinkedIn) yrkesnivå, bransch och jobbtitel,
- de största annonserna med text och bild.

Underlaget fylls i på kundsidan: siffermål och budget under **Mål och budget**, och inriktning, målgrupp, marknader, erbjudande och övrigt under **Kundprofil**.

**Video:** för videoannonser skickas omslagsbilden och tittarstatistiken (25/50/75/100 %). Claude kan inte titta på själva videon.

**Aktivera:** sätt `ANTHROPIC_API_KEY` i `.env` och starta om appen. Modell väljs med `AI_MODEL` (standard `claude-opus-5-5`). Koden finns i `apps/web/src/lib/ai/insights.ts`, och röktestet är `node scripts/e2e-ai.mjs` (simulerad AI-tjänst).

## Merge, valuta och egna metrics

- **Merge:** en widget kan ha valfritt antal källor.
  - Additiva metrics summeras.
  - Kvoter (CTR, CPC, CPM, CPA, bounce rate m.fl.) räknas om från summorna per rad och bucket.
  - Varje summa sparas även per källa (`spend@meta_ads`), så källfördelning och källbegränsade formler räknas korrekt.
- **Källfördelning:**
  - KPI-kort visar till exempel "Google 81 %, LinkedIn 19 %".
  - Trendgrafer kan staplas per källa, och tooltippen visar källornas andel.
  - Dimensionen "Källa" fungerar i donut och tabell.
  - Tabellrader visar vilka källor som bidrar.
- **Dimensioner och metrics som bara vissa källor har:**
  - Källor som saknar dimensionen tas bort ur widgeten, med en notis om det.
  - Metrics som bara vissa källor har visas med en notis om vilka källor som inte bidrar.
  - Konverteringar från både GA4 och annonsplattformar ger en varning för dubbelräkning.
- **Valuta:** belopp lagras i kontots originalvaluta i `metric_facts`, och ECB:s dagskurser lagras i `fx_rates`.
  - Vid visning räknas varje dag om till kundens rapportvaluta. Helger och helgdagar använder senast publicerade kurs.
  - Det omräknade värdet är deterministiskt och lagras därför inte separat. Då behöver inget synkas om när rapportvalutan eller en kurs ändras.
- **Tidszon:** plattformarna rapporterar hela dagar i kontots tidszon. Konton i en annan tidszon än kundens anges en gång per dashboard.
- **Egna metrics** (Inställningar → Egna metrics) definieras med en formel, till exempel `conversion_value / spend` eller `spend / sessions[ga4]`.
  - Parsern (`packages/core/src/formula.ts`) bygger ett syntaxträd. Formler körs alltså aldrig som kod.
  - Formeln räknas alltid på summor.

## GA4 och schemalagd synk

**GA4-connectorn** (`packages/core/src/connectors/ga4.ts`) är den första riktiga connectorn.
- **OAuth:** Google med `analytics.readonly` plus e-post. `access_type=offline` ger en refresh token.
- **Properties:** listas via Admin API (`accountSummaries`), och valuta och tidszon läses per property.
- **Data:** hämtas via Data API (`runReport`) med paginering. API-namnen mappas till det gemensamma schemat:
  - `sessions`, `totalUsers`, `newUsers`, `engagedSessions` och `keyEvents`
  - besökstid räknas som `averageSessionDuration × sessions` per rad
  - dimensionerna är kanal, sida, enhet, region, land och kampanj

**Felhantering:**
- 429 och 5xx försöks igen med exponentiell backoff och jitter. `Retry-After` respekteras (`packages/core/src/http.ts`).
- Samtidiga anrop begränsas för hela appen.
- 401 (access token ogiltig): token förnyas och anropet görs om en gång.
- `invalid_grant` (inloggningen återkallad): kopplingen och alla dess konton markeras "Behörighet saknas".
- 403 på en enskild property: bara det kontot markeras.

**Synk** (`packages/db/src/sync.ts`): data hämtas utanför databastransaktioner och skrivs i korta transaktioner, så att läsare ser antingen gammal eller ny data. Förnyade tokens sparas krypterade.

**Workern** (`apps/worker`) kör varje minut och gör tre saker:
- Låser förfallna konton atomiskt och synkar dem: var `SYNC_INTERVAL_HOURS` (standard 4), med de senaste `SYNC_LOOKBACK_DAYS` (standard 7) dagarna.
- Skickar förfallna rapporter.
- Hämtar ECB-kurser.

Loggarna skrivs som JSON-rader.

**Larm:** när ett konto går från fungerande till trasigt skapas ett larm som mejlas till byråns admins. Det sker en gång per fel, inte vid varje omförsök. Larmet stängs automatiskt när kontot synkar igen. Larm och de senaste synkarna visas under Inställningar → Synk och larm.

### Byta till riktiga Google-nycklar

1. Skapa en OAuth-klient (typ Web) i Google Cloud. Se `docs/API-GODKANNANDEN.md`, avsnitt 1.
2. Registrera redirect-URI:n `${BETTER_AUTH_URL}/api/connect/callback`, i utveckling `http://localhost:3000/api/connect/callback`.
3. Sätt `GOOGLE_CLIENT_ID` och `GOOGLE_CLIENT_SECRET` i `.env` och ta bort raderna `GOOGLE_AUTH_BASE`, `GOOGLE_TOKEN_URL`, `GA4_ADMIN_BASE` och `GA4_DATA_BASE`.
4. Starta om `pnpm dev` och `pnpm worker`. Under Koppla konto → "Google Analytics 4 – Riktig koppling via Google" loggar du nu in mot Google på riktigt.

Den simulerade servern (`packages/core/src/dev/fake-google.ts`) använder samma URL:er, format och felkoder som Google. Därför testas samma kod som används i produktion.

## PDF och utskick

- **Utskriftsvy** (`/print/[dashboardId]`): öppnas av Playwright med en signerad token som gäller i 5 minuter. Token ger läsrätt till exakt en dashboard och kräver ingen inloggning.
  - Dashboarden renderas som "band", alltså rader av widgets som hålls ihop.
  - Diagram och tabellrader delas aldrig.
  - Tabeller och annonsgallerier delas mellan rader och kort när de är längre än en sida.
  - Text trunkeras aldrig i PDF:en.
- **A4, paginerad** (`packages/reports/src/pdf.ts`), i fyra steg:
  1. Innehållet renderas med sidfot och sidnummer.
  2. Sektionernas sidnummer läses ur PDF:ens text.
  3. Omslag och innehållsförteckning renderas och läggs först (`pdf-lib`). Innehållsförteckningen tas bara med när innehållet har flera sidor.
  4. Innehållet renderas om utan mätmarkörer.
- **En lång sida:** samma innehåll på en enda sida, som referensrapporten.
- **Filnamn** följer referensens format, till exempel `Demo-Finans-Arsrapport-2025-01-01_2025-12-31.pdf`.
- **Schemalagda utskick:** veckovis eller månadsvis, en viss dag och timme i kundens tidszon (sommartid hanteras).
  - Workern låser varje schema atomiskt (`FOR UPDATE SKIP LOCKED`), så flera workers kan köras samtidigt.
  - Varje leverans loggas.

## Connectors (fas 6)

| Plattform | Fil | Inloggning | Data |
|---|---|---|---|
| GA4 | `connectors/ga4.ts` | Google OAuth | Data API, paginering |
| Google Ads | `connectors/google-ads.ts` | Google OAuth (samma klient) | GAQL `searchStream`, MCC-kundkonton |
| Meta | `connectors/meta.ts` | Systemanvändar-token (klistras in) | Insights per dag i 90-dagarsbitar, actions → engagemang och konverteringar |
| LinkedIn | `connectors/linkedin.ts` | OAuth | `adAnalytics` med pivoter, URN → namn |
| TikTok | `connectors/tiktok.ts` | Annonsörsauktorisering (`auth_code`) | `report/integrated` i 30-dagarsbitar |

Alla connectors har två slags fel:
- **Behörighetsfel** gäller antingen hela inloggningen eller bara ett konto. Är inloggningen ogiltig markeras alla konton på den; saknas åtkomst till ett enskilt konto påverkas bara det.
- **Tillfälliga fel** och anropsgränser försöks igen med backoff.

Varje connector testas mot en simulerad server (`packages/core/src/dev/`), bland annat att totalerna stämmer med källan efter uppdelning och paginering.

## Delningslänkar och white label

- **Delningslänkar:** Dashboard → meny → Dela med kund.
  - Länken (`/s/<token>`) har en slumpad token på 32 byte och kan ha lösenord (scrypt), utgångsdatum, låst period och PDF på eller av.
  - Gissningsskydd: högst 5 felaktiga lösenordsförsök per 15 minuter.
  - Sidan indexeras inte, och adressen skickas inte vidare som Referer.
  - Länken slås upp via databasfunktionen `share_link_by_token`, så den publika sidan når bara den enda länken, aldrig andra rader.
- **White label:** Inställningar → Varumärke. Byråns namn, logga, accentfärg (med kontrollkoll) och typsnitt används i appen, på delningssidor, på PDF-omslag och i mejl.
  - Kundens logga och färger ställs in på kundsidan under Inställningar.

## Team, behörighet per kund och kundportal

- **Roller** (Inställningar → Team och roller): Admin, Redaktör, Läsare och Kund.
  - Redaktör och läsare kan begränsas till valda kunder. Admin ser alltid alla.
  - Begränsade personer kan inte skapa kunder eller välja bland byråns källor (då skulle de kunna se andra kunders data).
- **Skyddet sitter i databasen:** `withTenant()` sätter `app.client_ids`, och policyn `client_access` (RESTRICTIVE) döljer andra kunders kunder, dashboards, widgets, länkar, mål, larm och AI-analyser. Ett fel i appkoden kan alltså inte visa en annan kunds rapport.
- **Inbjudan via mejl:** "Bjud in" skickar en länk (`/invite/<token>`, gäller 14 dagar, kan användas en gång). Mottagaren väljer namn och lösenord. Har personen redan ett konto loggar hen in och läggs till.
- **Kundportal** (`/portal`): kundens egen inloggning (rollen Kund).
  - Visar bara rapporter där "Visa i kundportalen" är påslaget (Dashboard → Dela med kund).
  - Samma kundvy som delade länkar: byte av period, sidor och PDF, men ingen AI-analys, inga interna händelser och ingen redigering.
  - Har kunden bara en rapport öppnas den direkt. Kundinloggningar som går till appen skickas till portalen.
  - Byråns personal når portalen under "Kundportal" i menyn för att se hur det ser ut.
- **Språk:** kundens Inställningar → Rapportspråk (svenska eller engelska) styr delade länkar, portalen, PDF och utskicksmejl.

## Lägga till en ny connector

1. Skapa en fil, t.ex. `packages/core/src/connectors/ga4.ts`, som exporterar ett objekt som implementerar `Connector` (`packages/core/src/types.ts`):

   ```ts
   export const ga4Connector: Connector = {
     id: "ga4",
     platform: "ga4",              // mallar och merge matchar på plattform, så mock → riktig är transparent
     label: "Google Analytics 4",
     auth: { type: "oauth2", scopes: [...], getAuthorizationUrl, exchangeCode, refresh },
     listAccounts: async (ctx) => [...],
     availableMetrics: () => ["sessions", "users", ...],      // kanoniska MetricId
     availableDimensions: () => ["date", "channel_group", ...],
     fetch: async (ctx, query) => ({ currency, rows }),       // NormalizedRow[], additiva metrics
     fetchCreatives: async (ctx, account) => [...],           // valfri (annonsgalleri)
   };
   ```

2. Lägg till den i listan i `packages/core/src/connectors/registry.ts`.

Inget annat behöver ändras. Kasta `ConnectorAuthError` när token har återkallats (kontot markeras då "Behörighet saknas" och användaren får "Koppla om"). Kasta `ConnectorRetryableError` vid rate limit. Mock-connectorerna i `mock.ts` är en fungerande referensimplementation.

Om plattformen har en metric som saknas i det gemensamma schemat lägger du till den i `MetricId` och `METRICS`. Beräknade metrics definieras med en formel och räknas automatiskt rätt även vid merge.

## Faser

- [x] **Fas 0:** analys av referensrapporten, stack, aggregator kontra direktintegration
- [x] **Fas 1:** skelett, auth, multi-tenant, schema, mock-connectors, kundöversikt med status, API-godkännanden (`docs/API-GODKANNANDEN.md`)
- [x] **Fas 2:** dashboard-builder, widgets, datumväljare, jämförelseperiod, mallar
- [x] **Fas 3:** merge, valutaomräkning, tidszoner, blended metrics
- [x] **Fas 4:** PDF-export, schemalagd mejlning
- [x] **Fas 5:** riktig GA4-connector, schemalagd synk, felhantering och larm (testad mot simulerad Google-server – byt till riktiga nycklar enligt ovan)
- [x] **Fas 6:** Google Ads, Meta, LinkedIn och TikTok, white label, delningslänkar

## Design

Appen följer bastakompisar.se: navy `#25364F` (rubriker, knappar, sidomeny), korall `#FF6062` (markeringar och primärfärg i mörkt läge) och persika `#F7DAD2` (ytor). Loggan ligger i `apps/web/public/brand/bk-logo.png`; den är svart och inverteras på mörka ytor. Färgerna är definierade som tokens i `apps/web/src/app/globals.css`.

Sajten använder typsnittet Sofia Pro, som kräver en webblicens. Appen använder därför det fria Figtree, som ligger nära. Med licens: lägg filerna i `apps/web/src/app/fonts/` och byt `Figtree` mot `next/font/local` i `apps/web/src/app/layout.tsx`.
