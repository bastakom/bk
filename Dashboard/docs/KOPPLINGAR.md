# Koppla plattformarna

Så aktiverar du de riktiga kopplingarna. Varje plattform kräver en app hos plattformen (en gång för hela byrån). Därefter kopplas kunderna i appen under **Kunder → kund → Koppla konto**. Ansökningar och ledtider finns i [API-GODKANNANDEN.md](API-GODKANNANDEN.md).

Alla kopplingar begär bara läsrättigheter. Tokens lagras krypterade (AES-256-GCM).

Redirect-URI att registrera hos Google, LinkedIn och TikTok:

```
http://localhost:3000/api/connect/callback          (utveckling)
https://<er-domän>/api/connect/callback             (produktion)
```

Efter ändringar i `.env`: starta om `pnpm dev` och `pnpm worker`.

---

## Google Analytics 4 och Google Ads

GA4 och Google Ads använder **samma OAuth-klient** i Google Cloud (projektet `bk-rapport`).

1. Följ GA4-stegen i API-GODKANNANDEN.md, avsnitt 1: projekt, API:er och OAuth-klient (typ Web application, redirect-URI enligt ovan).
2. Aktivera **Google Analytics Data API**, **Google Analytics Admin API** och **Google Ads API** i projektet.
3. **Samtyckesskärmen** (Data Access) ska innehålla de scopes appen begär:
   - GA4: `openid`, `email` och `analytics.readonly`.
   - Google Ads: även `https://www.googleapis.com/auth/adwords`. Lägg till det innan du kopplar Google Ads.
4. **Google Ads åtkomstnivå hanteras i Cloud Console** (Google Ads API → Access levels), inte via API Center i MCC.
   - **Test** fungerar bara mot testkonton.
   - **Explorer** eller högre krävs för riktiga kundkonton.
   - Se API-GODKANNANDEN.md, avsnitt 2.
5. Lägg in i `.env`:

```
GOOGLE_CLIENT_ID="….apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-…"
# Lämnas tom: åtkomstnivån följer Cloud-projektet. Headern skickas bara om ett värde finns.
GOOGLE_ADS_DEVELOPER_TOKEN=""
# Version av Google Ads API. v22 stängdes 7 okt 2026; v25 gäller till aug 2027.
GOOGLE_ADS_API_VERSION="v25"
```

6. **Riktiga eller simulerade servrar:** raderna `GOOGLE_AUTH_BASE`, `GOOGLE_TOKEN_URL`, `GA4_ADMIN_BASE`, `GA4_DATA_BASE` och `GOOGLE_ADS_BASE` får **inte** finnas i `.env` när riktiga konton ska användas. Utan dem används Googles riktiga adresser (`accounts.google.com`, `oauth2.googleapis.com`, `analytics*.googleapis.com`, `googleads.googleapis.com`). Röktesten sätter dem själva mot de simulerade servrarna.

**I appen:**
- GA4: "Google Analytics 4 – Riktig koppling via Google". Logga in med ditt @bastakompisar.se-konto och välj properties.
- Google Ads: "Google Ads – Riktig koppling via Google". Både direktkopplade konton och alla kundkonton under byråns MCC listas. Konton under MCC hämtas med rätt `login-customer-id` automatiskt.

**Med åtkomstnivå Test** sparas inloggningen, men riktiga konton kan inte läsas.
- Appen visar då "Google Ads-åtkomsten är bara godkänd för testkonton …" i stället för ett allmänt fel.
- Synkade källor får status **Synkfel**, inte "Behörighet saknas", eftersom det inte hjälper att koppla om.
- När Explorer är godkänd: tryck **Uppdatera kontolista** på inloggningen i Databaser.

## Meta (Facebook/Instagram) – systemanvändare

Meta kopplas med en **systemanvändar-token** från byråns Business Manager, inte via inloggning. En token ger åtkomst till alla annonskonton som tilldelats systemanvändaren, även kunders konton som delats med byrån.

1. **Meta-app:** [developers.facebook.com/apps](https://developers.facebook.com/apps) → Skapa app → typ **Business** → koppla till byråns BM → lägg till produkten **Marketing API**.
2. **Systemanvändare:** [business.facebook.com/settings](https://business.facebook.com/settings) → Användare → **Systemanvändare** → Lägg till ("Rapportplattform", roll **Anställd**).
3. **Tilldela tillgångar:**
   - Annonskonton: välj alla, behörighet **Visa resultat** (endast läsning).
   - Appar: appen från steg 1.
4. **Generera token:** välj appen, utgång **Aldrig**, behörighet endast **`ads_read`**.
5. **Kundernas egna konton:** kunden delar kontot med ert BM (Företagsinställningar → Partner, behörighet "Visa resultat"). Därefter tilldelar ni det till systemanvändaren.
6. **Valfritt men rekommenderat:** lägg appens hemlighet i `.env`, så signeras alla anrop med `appsecret_proof`:

```
META_APP_SECRET=""
META_API_VERSION="v23.0"
# Vilka actions som räknas som konverteringar (kommaseparerat)
META_CONVERSION_ACTIONS="purchase,lead"
```

**Annonsbilder och video:**
- Bilderna sparas i appen vid varje synk, eftersom Metas bildlänkar slutar gälla efter några dagar.
- Videor hämtas från Meta när man trycker på play.
- Annonser som bygger på Instagram-inlägg får bild, bildtext och video med enbart `ads_read`.
- Annonser som bygger på Facebook-inlägg visas med Metas egen förhandsvisning ("Visa annonsen").
- Vill ni även ha Facebook-inläggens bild och text direkt i galleriet och i PDF:en: tilldela byråns Facebook-sidor till systemanvändaren och generera en ny token som även har `pages_read_engagement` och `pages_show_list`.

**I appen:** Meta Ads → **Klistra in systemanvändar-token**. Därefter väljer du vilka annonskonton som hör till kunden.
- Token läggs **inte** i `.env`. Den klistras in per koppling.
- Token kontrolleras direkt mot Meta: att den fungerar och att den har behörigheten `ads_read`.
- Token sparas krypterad (AES-256-GCM med `TOKEN_ENCRYPTION_KEY`).
- `META_APP_SECRET` är valfri. Är den satt skickas `appsecret_proof` med varje anrop. Den krävs om appen i Meta har "Require App Secret" påslaget.

Om token återkallas markeras kontona "Behörighet saknas" och ett larm mejlas. Lös det med **Koppla om** och en ny token; alla konton flyttas då över.

## LinkedIn Ads

1. Skapa en app i [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps), kopplad till byråns LinkedIn-sida.
2. Begär produkten **Advertising API** (avsnitt 4 i API-GODKANNANDEN.md). Scopes: `r_ads` och `r_ads_reporting`.
3. Lägg till redirect-URI:n ovan under Auth.
4. Lägg in i `.env`:

```
LINKEDIN_CLIENT_ID=""
LINKEDIN_CLIENT_SECRET=""
# Version (YYYYMM). LinkedIn stödjer varje version i ett år.
LINKEDIN_API_VERSION="202609"
```

**I appen:** LinkedIn Ads → Logga in och koppla → välj annonskonton.

Så hämtas och visas datan:
- Demografi (jobbtitel, yrkesnivå, bransch, företag, region) hämtas med namn.
- LinkedIn avrundar demografin och visar bara de 100 största värdena per annons och dag.
- Dagar räknas i UTC.

## TikTok Ads

1. Registrera dig som utvecklare på [business-api.tiktok.com](https://business-api.tiktok.com) och skapa en app med läsbehörigheter för annonser och rapporter (avsnitt 5).
2. Ange redirect-URI:n ovan som "Advertiser redirect URL".
3. Lägg in i `.env`:

```
TIKTOK_APP_ID=""
TIKTOK_APP_SECRET=""
```

**I appen:** TikTok Ads → Logga in och koppla → auktorisera annonsörer i TikTok Business Center → välj annonsörer.

---

## Utan nycklar: simulerade servrar

Alla kopplingar kan köras mot simulerade servrar med samma adresser, format och felkoder som de riktiga. Det används i tester och för demo:

```bash
pnpm fake-google        # GA4 + Google Ads på :4010
pnpm fake-platforms     # Meta, LinkedIn, TikTok på :4011 (Meta-testtoken skrivs ut vid start)
```

Röktesten för fas 5 och 6 kör ett produktionsbygge på port 3100 som pekar på dessa servrar. De påverkar därför inte riktiga nycklar i `.env`.

Demokopplingarna med mockdata visas under "Demodata" på kopplingssidan. Dölj dem i produktion med `SHOW_MOCK_CONNECTORS="false"`.
