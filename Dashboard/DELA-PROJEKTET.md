# Till dig som tar över projektet

Zip-filen innehåller hela rapportplattformen: koden, dokumentationen, `.env` med nycklar och en kopia av databasen (`databas-export/`). README.md beskriver appen. Den här filen beskriver hur du kommer igång, lägger koden på GitHub och kör appen på Vercel.

> **`.env` och `databas-export/` innehåller hemligheter och kunddata.** Båda står i `.gitignore` och följer därför inte med till GitHub. Lägg in värdena i Vercel (och i en lösenordshanterare), inte i repot.

## 1. Kör lokalt (Mac eller Linux)

Kräver Node 24 och pnpm.

```bash
pnpm install
pnpm db:start                                   # lokal Postgres på :5433, låt den köra i en egen terminal
pnpm db:migrate                                 # tabeller, rollen rp_app och radsäkerhet
pnpm --filter @rp/db data:import ../../databas-export   # läser in kunder, kopplingar och data
pnpm dev                                        # http://localhost:3000
```

Logga in med samma konton som tidigare. Användarna och lösenorden finns med i databaskopian.

## 2. Lägg koden på GitHub

```bash
git add -A
git commit -m "Rapportplattform"
git remote add origin git@github.com:<organisation>/<repo>.git
git push -u origin main
```

Gör repot **privat**. Kontrollera med `git status` att varken `.env` eller `databas-export/` är med.

## 3. Kör på Vercel

### Databas

Vercel har ingen egen Postgres. Använd till exempel Neon eller Supabase, i EU-region.

1. Skapa databasen och notera ägarens anslutningsadress. Den blir `DATABASE_OWNER_URL`.
2. Skapa appens roll **innan** migreringarna, eftersom de ger rättigheter till den:
   ```sql
   CREATE ROLE rp_app LOGIN PASSWORD '<nytt lösenord>' NOSUPERUSER NOBYPASSRLS;
   GRANT USAGE ON SCHEMA public TO rp_app;
   ```
   Anslutningsadressen med rp_app blir `DATABASE_URL`. Appen kör alltid som rp_app, så att radsäkerheten skiljer byråer och kunder åt.
3. Kör migreringar och import mot molndatabasen från din dator:
   ```bash
   DATABASE_OWNER_URL="<ägarens adress>" pnpm --filter @rp/db migrate:deploy
   DATABASE_OWNER_URL="<ägarens adress>" pnpm --filter @rp/db data:import ../../databas-export
   ```

### Projektet på Vercel

- **Root directory:** `apps/web` (Vercel känner igen Next.js och pnpm).
- **Environment variables:** samma som i `.env`, med dessa ändringar:
  - `DATABASE_URL` och `DATABASE_OWNER_URL`: molndatabasens adresser.
  - `BETTER_AUTH_URL` och `APP_INTERNAL_URL`: appens nya adress, t.ex. `https://rapport.bastakompisar.se`.
  - `TOKEN_ENCRYPTION_KEY`: **samma värde som i `.env`**. Kundernas Google- och Meta-token i databasen är krypterade med den. Med en ny nyckel måste alla kopplingar göras om.
  - `BETTER_AUTH_SECRET`: samma värde, annars loggas alla ut (det är inget farligt).
  - Ta bort de simulerade adresserna (`GOOGLE_AUTH_BASE`, `META_GRAPH_BASE` m.fl.) om de finns.
- **Google Cloud Console:** lägg till `https://<ny adress>/api/connect/callback` som godkänd redirect-URI för OAuth-klienten. Annars går det inte att koppla GA4 och Google Ads.

### Två delar som inte körs på Vercel som de är

1. **PDF-export** startar en Chromium-webbläsare via Playwright (`packages/reports/src/pdf.ts`). Den ryms inte i en vanlig Vercel-funktion. Två sätt att lösa det:
   - en separat tjänst för PDF, t.ex. på Railway, Render eller Fly.io
   - byta till `@sparticuz/chromium`, som är anpassad för serverless
2. **Workern** (`apps/worker`: synk var 4:e timme, schemalagda utskick, valutakurser) är en process som körs hela tiden. Kör den på t.ex. Railway, Render eller Fly.io med samma miljövariabler (`pnpm worker`), eller gör om den till Vercel Cron Jobs.

Utan workern visas befintlig data, men den uppdateras inte automatiskt.

### E-post

Inbjudningar och rapportutskick kräver `RESEND_API_KEY` och `MAIL_FROM` (en verifierad avsändardomän i Resend). Utan dem hamnar mejlen i appens utkorg och skickas inte.

## Fortsätta utveckla med Claude Code

Öppna repot i Claude Code. Läs först README.md och `docs/KOPPLINGAR.md`.

Testerna körs med:
- `pnpm test`
- `pnpm typecheck`
- e2e-skripten i `scripts/`, mot ett produktionsbygge på port 3100

## Ny databaskopia senare

```bash
pnpm --filter @rp/db data:export ../../databas-export
```

Exporten innehåller alla tabeller utom inloggningssessioner. Importen kräver en tom databas där migreringarna redan är körda.
