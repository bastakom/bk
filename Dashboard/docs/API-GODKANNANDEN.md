# API-godkännanden: Reklambyrån Bästa Kompisar

Status: research gjord 2026-10-12. Gäller vår egen rapport-SaaS, som bara läser data. Det är en app för alla byråns kunder.
Allt som är markerat **(ej verifierat)** kommer från tredjepartskällor eller från egen kunskap och måste kontrolleras i respektive konsol innan vi förlitar oss på det.

> **Stor nyhet (Google Ads):** Developer tokens fasades ut **2026-09-09**. API-åtkomstnivåer sitter nu på **Google Cloud-projektet**, och man ansöker i Cloud Console i stället för i API Center. **Brand verification** är obligatoriskt för nya Basic- och Standard-ansökningar.
> Källa: https://developers.google.com/google-ads/api/docs/first-call/dev-token
>
> **Stor nyhet (Meta):** Nivåerna har bytt namn. "Ads Management Standard Access" heter nu **Marketing API Access Tier**, "Standard" heter **Limited** och "Advanced" heter **Full**. Tröskeln för Full är numera 500 anrop på 15 dagar.
> Källa: https://developers.facebook.com/docs/marketing-api/overview/authorization

---

> **Koppla i appen:** när en app är godkänd står det i [KOPPLINGAR.md](KOPPLINGAR.md) vilka nycklar som ska in i `.env` och hur kunderna kopplas.
>
> **Meta – rekommenderad väg för byrån:** systemanvändare i byråns Business Manager med en token (endast `ads_read`) som har tilldelats alla annonskonton, även kunders delade. Inga personliga inloggningar och ingen token som går ut. Se KOPPLINGAR.md.

## Gör detta denna vecka (prioriterat)

1. **Publicera en integritetspolicy och en publik startsida** för appen på vår egen domän, t.ex. `app.bastakompisar.se` och `/privacy`. Policyn ska beskriva hur Google-, Meta-, LinkedIn- och TikTok-data används, lagras och raderas. Alla plattformar kräver detta, så det blockerar allt annat.
2. **Google Cloud-projekt** (ett separat projekt för integrationen): koppla ett betalkonto som inte är Free Trial, slå på Analytics Data API, Analytics Admin API och Google Ads API, och konfigurera OAuth-samtyckesskärmen. Gör sedan **Brand verification** och verifiera domänen i Search Console.
3. **Ansök om Google Ads API Basic** från sidan *Google Ads API Overview* i Cloud Console, direkt efter brand verification. Granskningen är automatiserad och tar minuter.
4. **Starta Meta Business Verification** för byråns Business Manager. Det tar några dagar och kräver bolagsdokument, t.ex. registreringsbevis från Bolagsverket. Skapa samtidigt en Meta-app av typen Business.
5. **LinkedIn:** se till att byråns **LinkedIn-sida** finns och att Alex är superadmin. Skapa appen i Developer Portal, låt sidan verifiera appen och ansök om **Advertising API**.
6. **TikTok:** registrera dig som utvecklare på business-api.tiktok.com med en **företagsmejladress**, skapa appen och välj bara läsbehörigheter.
7. **Windsor.ai som brygga:** starta en provperiod, koppla 1–2 kunder och testa `select_accounts`. Begär ett DPA via e-post.

---

## Sammanfattning

| Plattform | Vad som ska sökas | Vem ansöker / vilket konto | Ungefärlig ledtid | Blockerar vad |
|---|---|---|---|---|
| GA4 | OAuth-klient + `analytics.readonly` (+ eventuell verifiering av känsligt scope) | Alex som Owner på byråns GCP-projekt | Brand verification: minuter. Känsligt scope: 3–5 arbetsdagar enligt Google, i praktiken ofta veckor | GA4-rapporter för fler än testanvändare |
| Google Ads | Åtkomstnivå **Basic** på GCP-projektet (förr: developer token) | Samma GCP-projekt. MCC behövs bara för att nå många kundkonton | Basic: minuter efter brand verification. Standard: cirka 10 arbetsdagar | Annonsdata från produktionskonton (Test/Explorer räcker inte) |
| Meta | Marketing API, `ads_read` (Advanced) + **Full** access tier, Business Verification, App Review | Meta-app ägd av byråns Business Manager | BV: några dagar. App Review: upp till flera veckor | Läsning av kunders annonskonton i produktion |
| LinkedIn Ads | Produkten **Advertising API** (Development tier) | App i LinkedIn Developer Portal, verifierad av byråns LinkedIn-sida | Ingen fast tid, case-by-case **(ej verifierat: oftast dagar–veckor)** | Annonsrapporter och demografi |
| LinkedIn organiskt | **Community Management API** (Dev → Standard) | Ny separat app, juridisk person, företagsmejl | Ingen fast tid. Standard kräver screencast | Organisk siddata. Kan avslås för rena analysfall |
| TikTok | Developer-konto + app med läsbehörigheter (Reporting m.fl.) | TikTok for Business-konto med företagsmejl | 2–3 arbetsdagar enligt TikTok-docs (v1.3) | TikTok-annonsrapporter |
| Windsor.ai | Betalplan med API-nyckel, DPA | Byråns Windsor-konto | Direkt. DPA på förfrågan | Inget, det är en tillfällig lösning |

---

## 1. Google Analytics 4 (Data API + Admin API)

**Scopes (minimalt):** `https://www.googleapis.com/auth/analytics.readonly`. Det räcker både för Data API (`runReport`) och Admin API (`accountSummaries.list` för att lista properties).
Källa: https://developers.google.com/identity/protocols/oauth2/scopes

### Checklista
1. Skapa ett GCP-projekt för integrationen, t.ex. `bk-rapport-prod`, under byråns Google-organisation om det finns en.
2. Koppla ett betalkonto som inte är Free Trial. Det krävs egentligen för Google Ads, se nedan, men gör det nu.
3. Slå på **Google Analytics Data API** och **Google Analytics Admin API**.
4. Konfigurera OAuth-samtyckesskärmen (Overview → Get Started):
   - Appnamn, supportmejl, logotyp, startsida, länk till integritetspolicy och auktoriserade domäner.
   - Verifiera domänen i **Google Search Console** med ett konto som är Owner eller Editor på projektet.
5. **Välj User type:**
   - **Internal:** möjligt om alla som loggar in har konton i byråns Google Workspace. Då krävs ingen verifiering och inget användartak gäller (https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification). Det fungerar bara om personalens Workspace-konton har läsåtkomst till kundernas GA4-properties.
   - **External:** krävs om kunder ska logga in själva. Krävs också för Google Ads Basic, där projektet ska vara External + In production.
6. Lägg till scopet `analytics.readonly` under Data Access.
7. Om appen är External: kör **Brand verification**, publicera branding och ställ in "In production".
8. Skicka in **verifiering av känsligt scope**. Det behövs:
   - Motivering per scope, inklusive varför ett smalare scope inte räcker.
   - En **demovideo på YouTube (olistad)** som visar samtyckesflödet på engelska, appnamnet på samtyckesskärmen, **OAuth client ID i adressfältet** och hur GA4-data faktiskt visas i appen.
   - En integritetspolicy på samma domän som startsidan, som beskriver åtkomst, användning, lagring och delning av Google-data.
   - Källa: https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification

### Gotchas
- **Är `analytics.readonly` känsligt?** Googles scope-lista på webben visar inte markeringen. Cloud Console märker känsliga scopes med en indikator. Enligt tredjepartskällor och min erfarenhet är Analytics-scopes "sensitive" **(ej verifierat i officiell lista; kontrollera markeringen i Cloud Console)**.
- **Overifierad External-app:** varningsskärmen "unverified app" visas och appen begränsas till **100 nya användare** tills den verifierats (https://support.google.com/cloud/answer/7454865). För en byrå med under 100 interna användare går det att leva med på kort sikt, men det ser oproffsigt ut mot kunder.
- **Testing-läge:** refresh tokens går ut efter **7 dagar** för External-appar i Testing om de använder annat än grundläggande scopes **(ej verifierat i officiell källa; källa: https://nango.dev/docs/api-integrations/google-analytics/how-to-register-your-own-google-analytics-api-oauth-app)**. Kör därför inte produktion i Testing-läge.
- Scopes i koden måste exakt matcha de som deklarerats på samtyckesskärmen. Annars visas varningen för overifierad app.
- Kompatibilitet med Google Ads: vill vi att GA4 och Ads ska dela OAuth-klient måste projektet vara External. Ett enkelt alternativ är **två projekt**: ett Internal för GA4 (ingen verifiering) och ett External med brand verification för Google Ads. Enligt Googles policy från augusti 2026 krävs ändå ett dedikerat projekt per integration **(ej verifierat i originalkälla; källa: https://ppc.land/google-drops-developer-tokens-from-ads-api-access-decisions/)**.

---

## 2. Google Ads API

**Scope:** `https://www.googleapis.com/auth/adwords`. Det är det enda scopet och det ger både läs- och skrivrätt, eftersom det inte finns något read-only-scope. Läsbegränsningen gör vi i koden, och i Google Ads kan användaren ges läsroll.
Källa: https://developers.google.com/identity/protocols/oauth2/scopes (listas under Local Services API med beskrivningen "See, edit, create, and delete your Google Ads accounts and data")

### Åtkomstnivåer (nu kopplade till GCP-projektet)
Källa: https://developers.google.com/google-ads/api/docs/access-levels

| Nivå | Konton | Gräns |
|---|---|---|
| Test | Endast testkonton | 15 000 operationer/dygn |
| Explorer | Test + produktion | 2 880 operationer/dygn mot produktion. Vissa tjänster är spärrade (kontoskapande, användarhantering, planeringsverktyg, fakturering) |
| Basic | Test + produktion | 15 000 operationer/dygn |
| Standard | Test + produktion | Obegränsat för de flesta tjänster. Manuell granskning, cirka 10 arbetsdagar |

Dygnsgränsen räknas som ett rullande 24-timmarsfönster. **Basic räcker för oss**: rapportering via `GoogleAdsService.SearchStream` med några dussin kunder ligger långt under 15 000 operationer per dygn.

### Checklista
1. Använd det External-projekt som har brand verification (se GA4, punkt 7). Kontrollera först de kända problemen:
   - Projekt på **Free Trial** eller med avstängt betalkonto kan nekas Basic. Uppgradera till betald nivå.
   - Källa: https://developers.google.com/google-ads/api/docs/first-call/dev-token
2. Slå på **Google Ads API** i projektet.
3. Gå till **Google Ads API Overview** i Cloud Console. Där ska nuvarande nivå vara Test eller Explorer.
4. Klicka **Apply for access** och välj Basic. Ansök **inte** via API Center i MCC: de ansökningarna behandlas inte längre.
5. Beslutet för Basic kommer automatiskt inom minuter efter brand verification.
6. **MCC (manager-konto):** krävs inte längre för att få åtkomst. Däremot är det det praktiska sättet att nå alla kunders konton. Länka in kundkonton under byråns MCC och skicka `login-customer-id` = MCC-ID (utan bindestreck) i varje anrop när du autentiserar som MCC-användare.
   - Källa om MCC: https://developers.google.com/google-ads/api/docs/first-call/dev-token
   - Källa om `login-customer-id`: https://developers.google.com/google-ads/api/docs/concepts/call-structure **(ej verifierat i denna session)**
7. Ge personerna i projektets IAM-roller Owner och Editor rätt mejladresser, eftersom obligatoriska tjänstemeddelanden går dit.

### Vad som efterfrågas
- Basic: brand verification, External + In production, och sedan klick på Apply. Inget designdokument nämns längre.
- Standard: manuell granskning av vad verktyget gör och vilken målgrupp det har. Har verktyget externa användare krävs ett demokonto för inloggning, och verktyget ska uppfylla *Required Minimum Functionality* (https://developers.google.com/google-ads/api/docs/access-levels). Ett rent rapportverktyg behöver troligen inte uppfylla RMF, eftersom det främst gäller verktyg för kampanjhantering **(ej verifierat)**.

### Status för Bästa Kompisar (14 okt 2026)
- Projektet `bk-rapport` har nivån **Test**. Ansökan om **Explorer** är inskickad i Cloud Console.
- Utvecklartoken används inte. `GOOGLE_ADS_DEVELOPER_TOKEN` lämnas tom, och appen skickar headern bara om ett värde finns.
- Appen använder API-version **v25**. v22 stängdes 7 okt 2026.
- Så länge nivån är Test visar appen ett begripligt fel för riktiga konton och markerar dem som **Synkfel**, inte "Behörighet saknas". Felkoderna som känns igen är `DEVELOPER_TOKEN_NOT_APPROVED` och `CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION`.
- Samtyckesskärmen är **Internal**. Scopet `adwords` måste läggas till under Data Access innan Google Ads kopplas.

### Gotchas
- Det finns ett känt fel: vissa projekt som uppgraderats efter 2026-09-09 får `AUTHORIZATION_ERROR` på produktionsanrop. Den tillfälliga lösningen är att söka Explorer med ett nytt projekt (dev-token-sidan ovan).
- Developer token skickas fortfarande i befintliga bibliotek men ignoreras. En framtida större API-version kommer att avvisa den, så bygg nytt utan token.
- Ett testprojekt som anropar produktionskonton får felet `CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION` från v25 **(ej verifierat i originalkälla; källa: ppc.land ovan)**.
- Våren 2026 var det en kö för Basic och Standard. Den är löst för Basic via automatiseringen (https://ppc.land/google-faces-developer-token-application-backlog-as-new-api-tier-debuts/).

---

## 3. Meta Marketing API

**Permissions (minimalt, read-only):**
- `ads_read`: Ads Insights för annonskonton vi äger eller fått åtkomst till. Tillåten användning enligt Meta: "custom dashboards and data analytics".
- Valfritt: `business_management`, bara om vi måste lista eller läsa Business Manager-tillgångar via API. Det är en skrivbehörighet som granskas hårdare, så **undvik den om möjligt**.
- `read_insights` gäller sid- och appinsikter (organiskt), inte annonser. Ta bara med den om organisk Facebook-statistik ska ingå.
- Källa: https://developers.facebook.com/docs/permissions

### Nivåer (nya namn)
Källa: https://developers.facebook.com/docs/marketing-api/overview/authorization

| Marketing API Access Tier | Hur | Rate limit (per annonskonto) |
|---|---|---|
| **Limited** (tidigare Standard) | Standard när Marketing API läggs till | Max score 60, spärr 300 s. Insights-kvot 600 + 400 × aktiva annonser per timme |
| **Full** (tidigare Advanced) | +Upgrade i App Dashboard. Kräver ≥500 lyckade anrop de senaste 15 dagarna, <15 % felfrekvens och App Review | Max score 9000, spärr 60 s. Insights-kvot 190 000 + 400 × aktiva annonser per timme |

Källa för rate limits: https://developers.facebook.com/docs/marketing-api/overview/rate-limiting. Övervaka headrarna `X-Ad-Account-Usage`, `X-Business-Use-Case` och `X-FB-Ads-Insights-Throttle`.

### Checklista
1. I byråns **Business Manager**: kör **Business Verification** (Säkerhetscenter). Underlag är t.ex. registreringsbevis, bolagsordning eller faktura med företagsnamn och adress. Det tar normalt några dagar (https://developers.facebook.com/docs/resp-plat-initiatives/app-review/faqs).
2. Skapa en Meta-app av typen **Business** och låt byråns BM äga den (claim).
3. Lägg till produkten **Marketing API**. Då får appen Limited tier direkt.
4. Fyll i appinställningarna: integritetspolicy-URL, URL för dataradering eller instruktioner, appikon, kategori och kontaktmejl.
5. Bygg flödet: Facebook Login for Business **eller** en systemanvändare i BM med kundernas annonskonton delade till byråns BM.
6. Kör **minst 500 lyckade Marketing API-anrop på 15 dagar** med under 15 % fel. Det gör vi genom att köra rapportjobbet mot egna och delade konton.
7. Skicka in **App Review**: `ads_read` (Advanced Access) och uppgradering av tier till **Full**.
8. Vad granskarna vill se:
   - En screencast av hela inloggningsflödet där användaren ger `ads_read`, och där **riktig annonsdata** (impressions, spend, klick) visas i appen.
   - Granskaren måste kunna nå appen. Kan Meta inte testa den avslås hela inskickningen, så skicka med testinloggning.
   - Källa för screencast-kraven: tredjepartskällor **(ej verifierat)**. Källa för att Meta måste kunna testa appen: https://developers.facebook.com/docs/resp-plat-initiatives/individual-processes/app-review

### Gotchas
- **Behöver vi ens App Review?** Appar som bara används av personer med roll i appen, eller i den Business som äger appen, behöver ingen App Review (app-review-sidan ovan). Om byråns personal loggar in och kunderna har delat sina annonskonton till byråns BM, räcker det kanske med Limited i början. Men Limited är kraftigt rate-limiterat och avsett för utveckling, och Meta skriver att man behöver Advanced `ads_read` för att hantera "other people's ad accounts". Planera därför för Full **(ej verifierat exakt var gränsen går för BM-delade kundkonton)**.
- Business Verification krävs för all Advanced Access, och en ansökan som skickas in medan BV pågår returneras (permissions-sidan ovan, samt tredjepartskällor).
- Tredjepartskällor hävdar att screencast inte längre krävs för tier-ansökan sedan maj 2026 **(ej verifierat)**. Spela in en ändå.
- App Review tar upp till flera veckor, och ett avslag innebär ny kö.

---

## 4. LinkedIn Marketing API

### 4a. Advertising API (annonser)
**Scopes (minimalt):** `r_ads` (lista annonskonton; fungerar även med rollen VIEWER) och `r_ads_reporting` (adAnalytics). Begär **inte** `rw_ads`. Alla scopes är 3-legged och det finns inget client-credentials-flöde.
Källa: https://learn.microsoft.com/en-us/linkedin/marketing/getting-started

**Tiers** (https://learn.microsoft.com/en-us/linkedin/marketing/integrations/marketing-tiers):

| Tier | Läsa | Skapa/ändra |
|---|---|---|
| Development | **Obegränsad läsning** av annonskonton som den inloggade administrerar | 1 testkonto. Ändringar i högst 5 konton |
| Standard | Obegränsat | Obegränsat |

För ren rapportering **räcker Development tier långt**, eftersom gränsen på 5 konton bara gäller skrivning. Kontrollera ändå hur kontolistan i Developer Portal ("Add up to 5 accounts") påverkar läsning, eftersom getting-started-sidan anger att bara konton i listan kan hanteras via API **(ej verifierat om det även gäller GET)**.

**Checklista:**
1. Byråns **LinkedIn-sida** ska finnas, och Alex ska vara superadmin.
2. Skapa en app på https://www.linkedin.com/developers/apps och koppla den till byråns sida.
3. Sidans superadmin **verifierar appen** (Settings → Verify).
4. Under fliken **Products**, ansök om **Advertising API**. Var beredd på att uppge:
   - Företagsmejl
   - Juridiskt namn och adress
   - Webbplats och integritetspolicy
   - Användningsfall ("internal reporting for our agency's clients, read-only")
5. Den användare som ska autentisera behöver minst rollen **VIEWER** på varje kunds annonskonto i Campaign Manager.
6. Standard tier söks via inställningen View Ad Accounts under Added products. Det behövs bara om vi ska skriva.

**Demografiska pivots** (https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads-reporting/ads-reporting):
- `MEMBER_JOB_TITLE`, `MEMBER_SENIORITY`, `MEMBER_INDUSTRY`, `MEMBER_COMPANY`, `MEMBER_JOB_FUNCTION`, `MEMBER_COMPANY_SIZE`, `MEMBER_COUNTRY_V2`, `MEMBER_REGION_V2`, `MEMBER_COUNTY`. Gamla `MEMBER_REGION` ersätts av `_V2` (Bing-baserad). Börja med V2.
- **Integritetsregler:**
  - Värdena är **approximerade**, så summor av dagar eller kampanjer stämmer inte exakt. Hämta hela perioden och högsta nivån.
  - **Minst 3 händelser** per värde. Värden under tröskeln tas bort.
  - Annonser med för få engagerade medlemmar ger inga demografiska värden.
  - Bara **topp 100 värden per creative och dag**.
- **Fördröjning:** demografi är 12–24 timmar efter. Prestandamått är nästan i realtid.
- **Lagring hos LinkedIn:** demografi sparas i 2 år, prestandadata i 10 år, dagsdata i 6 månader.
- Vissa mått saknas för demografiska pivots: `approximateMemberReach`, `conversionValueInLocalCurrency` och carousel-mått.
- Throttling: 45 miljoner metric values per 5 minuter. Ingen paginering och max 15 000 element per svar.

### 4b. Community Management API (organisk siddata)
**Scopes:** `r_organization_admin` (sidans följar-, besöks- och innehållsstatistik) och eventuellt `r_organization_social` (inlägg och kommentarer). Källa: getting-started-sidan ovan.

**Checklista** (https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review):
1. Skapa en **ny, separat app** som inte har några andra produkter. Development-ansökan för CMA får bara göras från en sådan app (https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-api-migration-guide).
2. Krav:
   - Registrerad juridisk person och kommersiellt användningsfall.
   - Verifierat företagsmejl. Personliga adresser underkänns.
   - Juridiskt namn, adress, webbplats och integritetspolicy.
   - Appen verifierad av byråns LinkedIn-sida.
3. Fyll i vetting-enkäten inom **21 dagar** **(ej verifierat på officiell sida)**.
4. Standard tier kräver:
   - En fullt integrerad app.
   - Testinloggning.
   - En **screencast** i hög upplösning, nedladdningsbar och gärna med berättarröst, som visar OAuth-flödet och hur postprestanda och eventuella persondata visas ("Page Analytics use case").
5. **Vid avslag** måste man skapa en **ny app** och börja om. Det går inte att söka igen med samma app.

**Gotchas:**
- Det finns uppgifter om att uppgraderingar för **rena data- och analysfall avslås** **(ej verifierat; formuleringen hittades i sökresultat men inte på den aktuella officiella sidan)**. Prioritera annons-API:t först och ta organisk data i en senare fas, eller via Windsor.
- **Version 202510 stängs 2026-10-15.** Bygg mot den senaste versionen (`Linkedin-Version: 2026xx`).
- Ledtid: LinkedIn anger ingen fast tid och granskar "at its discretion".

---

## 5. TikTok API for Business (Marketing API)

**Scopes:** när appen skapas väljs kategorier under "Scope of permission". För rapportering behövs troligen **Ad Account Management** (läsa annonskonton), **Ads Management** (läsa kampanjer, annonsgrupper och annonser) och **Reporting** **(ej verifierat i officiell dokumentation)**. Varje endpoints exakta scope står i sista kolumnen i tabellen "List of available endpoints" i portalen.
Källa: https://business-api.tiktok.com/portal/docs/create-a-developer-app/v1.3

### Checklista
1. Logga in på https://business-api.tiktok.com/portal med ett TikTok for Business-konto (**företagsmejl**, inte Gmail **(ej verifierat)**).
2. Klicka **Become a Developer** och fyll i företagsuppgifter.
3. **My Apps → Create an App**. Ange:
   - Namn
   - **Konkret** beskrivning (vaga beskrivningar fördröjer)
   - Redirect-URL (`https://app.bastakompisar.se/oauth/tiktok/callback`)
   - Endast läs-scopes
4. Granskningen tar **2–3 arbetsdagar** enligt TikTok-dokumentationen (v1.3, se ovan).
5. När appen är godkänd: varje kund eller annonsör godkänner appen via auktoriseringslänken. Spara `access_token` och listan med `advertiser_id`.
6. Testa mot sandbox-konton (https://business-api.tiktok.com/portal/docs/sandbox-accounts/v1.3).

### Gotchas
- Begär **inte** scopet "TikTok Accounts". Sedan 2026-03-20 kräver det ett separat ansökningsformulär (Accounts API Access Application Form).
- Medan en scope-ändring granskas kan andra ändringar i appen vara låsta.
- Stora rapporter bör köras asynkront. Reservation-rapporter är deprecated (https://business-api.tiktok.com/portal/docs/reporting-guides/v1.3).
- Versionsbyten (t.ex. v1.3 → nästa) kan komma med kort varsel **(ej verifierat)**.

---

## 6. Windsor.ai (tillfällig aggregator)

- **API:** ja. Endpoint-mönstret är `https://connectors.windsor.ai/{connector}?api_key=...&fields=...`, med `date_from`/`date_to` eller `date_preset`, och **`select_accounts`** för att filtrera per konto. Med `all` prefixas id:t, t.ex. `facebook__123`. Rate limit är 600 anrop/min och 10 000 anrop/dygn.
  - Källa: https://windsor.ai/api-documentation/
- **Pris:** månadsabonnemang i nivåer, där priset styrs av **antal datakällor**, **antal konton** (summan av annonskonton och GA4-properties), destinationer och uppdateringsfrekvens.
  - Ungefärligt intervall: från cirka 19–23 USD/mån (Basic: 3 källor, 75 konton) till cirka 500–600 USD/mån (Professional: 14 källor, 500 konton). Enterprise får offert.
  - API ingår från Basic (https://windsor.ai/llms.txt).
  - Källa: https://windsor.ai/pricing/. Kontrollera aktuella siffror innan köp.
  - För oss (GA4 + Ads + Meta + LinkedIn + TikTok = 5 källor) krävs minst **Standard** (7 källor, 75 konton). Plus behövs om vi har fler än 75 konton.
- **GDPR och DPA:**
  - Windsor uppger att de är GDPR-kompatibla och SOC 2 Type II-granskade, med servrar i ett datacenter i **Tyskland**.
  - Bolaget är Windsor Group AG (Schweiz) och tillämpar FADP samt GDPR (https://windsor.ai/privacy-statement/, https://windsor.ai/security/).
  - Ett **DPA nämns bara för Enterprise ("custom agreements")**. Begär ett DPA och en lista över underbiträden skriftligt även för lägre planer **(ej verifierat att de erbjuder det)**.
- **Gotcha:** Windsor ersätter inte våra egna API-godkännanden. Kunderna auktoriserar då Windsors appar, och vi blir beroende av Windsors fältnamn. Använd det som brygga medan Meta och LinkedIn granskas.

---

## Gemensamt underlag att ta fram en gång

- [ ] Publik startsida + integritetspolicy + villkor på `bastakompisar.se`. Domänen ska vara verifierad i Google Search Console.
- [ ] Sida eller instruktioner för dataradering (krävs av Meta).
- [ ] Bolagsdokument som PDF: registreringsbevis från Bolagsverket och faktura eller annat dokument med adress.
- [ ] Företagsmejl, t.ex. `alex@bastakompisar.se`, används i alla utvecklarportaler.
- [ ] Testinloggning till appen för granskare (Meta, LinkedIn Standard, Google Ads Standard).
- [ ] En screencast-mall på engelska med berättarröst: logga in → OAuth-samtycke → lista konton → rapportvy med riktig data. Visa client ID i adressfältet för Google.
- [ ] En kort engelsk text om användningsfallet: "Read-only performance reporting for the agency's own clients; no campaign management; data stored in EU; deleted on client offboarding."
