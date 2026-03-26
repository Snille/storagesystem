# Hyllsystem

Praktisk användning finns beskriven i [MANUAL.md](/c:/Users/eripet/Coding/Hyllsystem/MANUAL.md). README:n nedan är den tekniska översikten.

Aktuell version: `v1.2.1`

En webbapp för att inventera verkstadslådor med Immich som bildlager, JSON som datalager och AI-stöd för att känna igen etiketter, innehåll och sannolik låda/plats.

Appen är byggd för ett praktiskt arbetsflöde:

1. fota lådor med mobilen
2. låt bilderna synka till Immich
3. koppla bilderna till rätt låda i appen
4. låt AI föreslå etikett, plats, innehåll och bildroller
5. sök senare efter saker som finns i verkstan

Sedan `v1.1.x` täcker appen inte längre bara hyllor utan hela lagerstrukturen i verkstan:

- `Ivar`
- `Bänk`
- `Skåp`

## Översikt

Systemet skiljer på fyra identiteter:

- `boxId`: den fysiska lådan
- `currentLocationId`: var lådan står just nu
- `sessionId`: ett inventeringstillfälle
- `immichAssetId`: den faktiska bilden i Immich

Det gör att:

- en låda kan flyttas utan att tappa historik
- innehållet kan ändras via en ny session
- flera bilder kan kopplas till samma session
- en plats kan ha flera små lådor, till exempel `A`, `B`, `C`

Platsmodellen är nu generell och klarar flera typer av platsenheter:

- `Ivar`
- `Bänk`
- `Skåp`

Det betyder att samma inventariemodell kan användas både för hyllor, arbetsbänkar och skåp.

## Teknik

- `Next.js 15` med App Router
- `React 19`
- `TypeScript`
- `Zod` för validering
- `Immich` som bildkälla
- `data/inventory.json` som inventariedatabas
- `data/app-settings.json` för användarinställningar

## Datafiler

### `data/inventory.json`

Innehåller tre huvudlistor:

- `boxes`
- `sessions`
- `photos`

Modellen är i praktiken:

- en låda har en aktuell plats
- en låda kan ha flera sessioner över tid
- en session kan ha många bilder

Bildrollerna som används internt är:

- `label`
- `location`
- `inside`
- `spread`
- `detail`

I UI:t visas de på svenska:

- `Etikett`
- `Plats`
- `Inuti`
- `Utplockat`
- `Detalj`

Plats-ID:n kan vara både äldre och nya format:

- `A-H2-P3-A` för äldre IVAR-platser
- `BENCH:SVARV:TOP:P1:A` för bänkytor
- `CABINET:3D-PRINT:H2:P1:A` för skåpplatser

### `data/app-settings.json`

Innehåller allt som går att ändra från sidan `Inställningar`, bland annat:

- tema
- typsnitt
- textstorlek
- reducerad rörelse
- Immich-konto, åtkomstmetod och valt album
- AI-provider och modell
- promptar för analys

## Viktiga sidor

### `Översikt`

Startsidan används främst för sök.

Den visar:

- sökruta med text eller röst
- `Översiktsbild` från albumomslaget i Immich, öppningsbar i egen lightbox
- lådkort med plats, sammanfattning, sökord och bilder
- alla kopplade bilder för respektive låda i sökresultat
- statistik för registrerade lådor, aktuella platser och kopplade bilder
- aktuell appversion direkt i översikten

Lådorna i översikten sorteras nu i fysisk ordning:

- först `Ivar`
- därefter `Bänk`
- sist `Skåp`
- inom varje platsenhet sorteras lådorna i platsordning

Sökningen använder:

- lådnamn
- plats
- lådnoteringar
- sessionssammanfattning
- sessionsnoteringar
- sökord
- bildspecifika analystexter

Sökningen är också mer tolerant än tidigare och klarar nu bättre:

- bindestrecksord som `rc-bil`
- korta felskrivningar som `cr-bil`
- enklare synonymvarianter som `radiostyrd` och `rc`

### `Lagerplats`

Sidan heter `Lagerplats` i UI:t och visar alla platsenheter i systemet, till exempel `Ivar C`, `Bänk Svarv` eller `Skåp 3D-print`.

Här kan man:

- öppna en platsenhet
- se lådor grupperade per hylla eller yta
- klicka direkt på en låda för att öppna låd-vyn
- se den visuella hyllstrukturen för respektive `Ivar`

För `Ivar` visas nu en mer fysisk hyllvy med:

- sammanhängande sidostolpar
- hyllplan
- hyll-etiketter direkt på hyllplanet
- bara de platser som faktiskt används på respektive hylla

### `Bilder att koppla`

Visar endast bilder från valt Immich-album som ännu inte är kopplade till någon låda.

Här kan man:

- markera flera bilder
- köra översiktsanalys
- låta AI föreslå lådnamn, plats och innehåll
- få bildroller och ordning föreslagna
- koppla direkt till en sannolik befintlig låda
- gå vidare till registreringssidan med förifylld data

Albumomslaget i Immich används nu som `Översiktsbild` på startsidan och visas därför inte längre bland okopplade bilder i den här vyn.

### `Ny låda / inventering`

Sidan används för att registrera en ny låda eller uppdatera en befintlig session.

Här kan man:

- välja eller ändra aktuell plats först
- se och justera lådnamn, sammanfattning och sökord
- välja platskategori: `Ivar`, `Bänk`, `Skåp`
- skriva noteringar och spara sessionen direkt under `Sökord`
- ändra bildroller och bildordning
- analysera enskilda bilder direkt
- redigera eller rensa analystext per bild
- låta markerade album-bilder följa med när man sparar, även utan att först trycka på `Lägg till valda bilder`
- spara sessionen och gå tillbaka till översikten

När du skapar en helt ny låda skyddar appen nu också mot att råka skriva över en redan existerande låda på samma exakta plats. Då stoppas sparningen och du får välja annan bokstav eller redigera den befintliga lådan i stället.

För befintliga lådor går det också att klicka på `Ändra plats` för att flytta lådan i systemet utan att tappa historiken.

### `Låd-vy`

Visar en enskild låda med:

- aktuell sammanfattning
- alla bilder i aktuell session
- bildspecifik analys
- historik
- möjlighet att lägga till fler okopplade bilder
- möjlighet att släppa en felkopplad bild

Bildspecifik analys använder nu alltid unika bild-ID:n inom varje session, vilket gör att analystextrutor inte längre kan råka dela state mellan två olika bilder.

### `Inställningar`

Här kan man ändra:

- tema: `auto`, `ljust`, `mörkt`
- font: `Arial`, `System UI`, `Verdana`, `Trebuchet`, `Georgia`
- fontstorlek
- reducerad rörelse
- Immich-bas-URL
- kontoetikett
- API-nyckel eller share key
- vilket album som ska användas
- AI-provider: `LM Studio`, `OpenAI`, `Anthropic`, `OpenRouter`, `Open WebUI`
- modell och API-inställningar
- promptar för analys
- rensningsfraser och andra filter för AI-svar
- ladda ner backup av lokal data
- exportera etikettkatalogen till Excel
- importera etikettkatalog från en exporterad `.xlsx`-fil

Rensnings- och filterinställningarna är tänkta för att kunna trimma bort återkommande brus från olika modeller utan att behöva göra kodändringar.

## Immich-integration

Appen använder Immich som bildlager, men lagrar själva inventariestrukturen separat i JSON.

Det betyder att Immich ansvarar för:

- originalbilder
- album
- timestamps
- thumbnails/originalfiler

Appen ansvarar för:

- vilken låda en bild hör till
- vilken session den tillhör
- vilken roll bilden har
- analystext och sökbar metadata

Stöd finns för både:

- `API key`
- `Share key`

Det aktiva albumet väljs i `Inställningar`.

Om albumet har ett omslag i Immich används den bilden automatiskt som `Översiktsbild` på startsidan.

## DYMO och etiketter

Appen har en enkel etikettgenerator på `/labels`.

Den använder samma informationsmodell som resten av systemet:

- `Namn`
- `Beskrivning`
- `Plats`

Nuvarande DYMO-upplägg på Ubuntu-servern:

- skrivare: `DYMO LabelWriter 5XL`
- IP: `10.0.0.76`
- CUPS-kö: `DYMO_5XL`
- backend: `socket://10.0.0.76:9100`
- PPD: `lw5xl.ppd`

DYMO:s officiella `LW5xx_Linux`-drivrutin används för CUPS-filtret och PPD-filerna.

Etikettgeneratorn kan nu också skicka etiketter direkt till skrivaren via:

- `POST /api/labels/print`
- CUPS-kö `DYMO_5XL`

Mer praktisk information finns i [deploy/DYMO_CUPS.md](/c:/Users/eripet/Coding/Hyllsystem/deploy/DYMO_CUPS.md).

## Publikt REST-API

Appen har också ett enkelt integrations-API under `app/api/public/*` för till exempel Home Assistant.

Om `HYLLSYSTEM_API_KEY` är satt i miljön måste anrop skicka nyckeln som:

- `x-api-key: ...`
- eller `Authorization: Bearer ...`

Tillgängliga endpoints:

- `GET /api/public/health`
  enkel hälsokoll

- `GET /api/public/search?q=nätverkskabel&limit=5`
  textsök i inventariet

- `POST /api/public/ask`
  naturlig fråga, till exempel:

```json
{
  "query": "Var finns skarvdosorna?"
}
```

Svarar med:

- `query`
- `answer`
- `source` (`ai` eller `search`)
- `count`
- `matches`

Varje objekt i `matches` innehåller idag bland annat:

- `boxId`
- `label`
- `locationId`
- `location`
- `boxNotes`
- `sessionId`
- `sessionCreatedAt`
- `summary`
- `sessionNotes`
- `itemKeywords`
- `photos`
- `score`

- `GET /api/public/boxes/IVAR-B-H3-P2-A`
  detaljer om en viss låda

`ask` använder vanlig sökning som grund och försöker sedan formulera ett naturligt svar med vald AI-motor. Om AI inte är tillgänglig faller endpointen tillbaka till ett lokalt svar byggt från sökträffarna.

## AI-integration

Appen kan använda flera AI-leverantörer:

- `LM Studio`
- `OpenAI`
- `Anthropic`
- `OpenRouter`
- `Open WebUI`

### LM Studio

LM Studio är förstahandsvalet i den nuvarande setupen.

Appen kan:

- hämta modellista
- använda vald modell för analys
- vid sparning av AI-inställningar se till att bara en modell åt gången är laddad i LM Studio

Det används både för:

- översiktsanalys av flera bilder
- bildrollsklassning
- bildspecifik analys

### Analysjobb

Analys körs som jobb med statusuppdateringar i UI:t.

Exempel på status:

- `Kontaktar LM Studio...`
- `Laddar modell i LM Studio...`
- `LM Studio bearbetar bilderna...`
- `Tolkar AI-svaret...`
- `Matchar mot befintliga lådor...`

Det finns även timeout-hantering för långsamma anrop.

Matchningen i `Lageralbum` använder nu samma platsmodell som resten av appen, vilket gör att AI-förslag fungerar bättre även för `Bänk` och `Skåp`.

### Promptar

Promptarna är redigerbara i appen och sparas i `data/app-settings.json`.

Det gör det möjligt att:

- trimma modellbeteende utan kodändringar
- prova nya modeller
- skifta mellan mer strikta och mer toleranta instruktioner

## Matchning mot katalogen

Appen har stöd för en katalog av redan kända lådor och platser.

Vid översiktsanalys försöker den:

- matcha etikett och plats mot befintliga lådor
- prioritera lediga lådor på samma plats
- om en plats redan har bilder kopplade på `A`, föreslå nästa lediga `B` eller `C` när det passar bättre

Det hjälper särskilt när flera små lådor står på samma plats i hyllan.

För nya lådor används samma platsmodell också för att räkna fram nästa lediga bokstav på en plats, oavsett om platsen ligger i `Ivar`, `Bänk` eller `Skåp`.

## Platsenheter

Appen arbetar nu med tre typer av platsenheter:

- `Ivar`: klassiska hyllor med `Hylla` och `Plats`
- `Bänk`: arbetsbänkar med `Yta` (`Ovanpå` eller `Under`) och `Plats`
- `Skåp`: skåp med `Hylla` och `Plats`

Det gör att inventariet kan växa utanför rena IVAR-hyllor utan att datamodellen behöver göras om igen.

Stöd för lösa objekt som inte ligger i en låda är en naturlig nästa utbyggnad, men modellen är redan förberedd för att flera typer av platser ska kunna samexistera.

## Bildhantering

Förhandsbilder och originalfiler hämtas via appens egna proxyroutes mot Immich.

Det ger några fördelar:

- appen kan hantera API/share-key på serversidan
- roterade/redigerade bilder i Immich kan speglas i appen
- appen kan falla tillbaka till placeholder om en bild tagits bort i Immich
- analystext kan visas både i lightbox och som hover-tooltip på bilder där text finns

Tooltip-visning används nu genomgående på bilder där analystext finns, så att man snabbare kan få kontext utan att alltid öppna lightboxen.

Om en bild tas bort från albumet:

- inventarieposten ligger kvar
- appen kraschar inte
- den saknade bilden visas inte som ett hårt fel

## Bakgrunder och UI

Appen har stöd för:

- ljust, mörkt och auto-tema
- systemanpassad första rendering utan vitt blink i mörkt läge
- grön accentpalett
- svensk terminologi i gränssnittet
- bakgrundsillustration i `public/background-hills.svg`

Appnamnet i fliken är nu `Lagersystem` för att spegla att appen inte längre bara hanterar hyllor.

## Lokal utveckling

### Krav

- Node.js 22 eller nyare

### Kom igång

1. kopiera `.env.example` till `.env.local`
2. fyll i grundvärden för Immich och eventuell AI-provider
3. installera beroenden
4. starta utvecklingsservern

```bash
npm install
npm run dev
```

På Windows finns även ett hjälpskript som sätter upp `nvm`-miljön och startar appen:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

Skriptet:

- aktiverar `nvm`
- installerar `Node 22.14.0` om den saknas
- kör `npm install` första gången
- startar appen på `http://localhost:3000`

### Vanliga kommandon

```bash
npm run dev
npm run build
npm run start
npm run typecheck
```

## Deployment

Nuvarande produktionsmiljö är en Ubuntu-server där appen körs från:

- `/opt/hyllsystem`

Typiskt flöde:

1. synka koden till servern
2. kör säker deploy via `scripts/deploy_safe.sh`

Viktigt vid self-hosting med Next.js server actions:

- sätt en fast `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` i `.env.local`
- använd samma nyckel över deployer

Det minskar risken för fel som:

- `Failed to find Server Action "..."`
- klientkod från äldre deploy som inte längre hittar rätt action på servern

Exempel på servern:

```bash
cd /opt/hyllsystem
chmod +x scripts/deploy_safe.sh
sudo ./scripts/deploy_safe.sh /opt/hyllsystem hyllsystem.service
```

Skriptet bygger först till en tillfällig katalog (`.next-deploy`) och byter sedan atomiskt över till den nya `.next`-mappen innan tjänsten startas om. Det minskar risken för tillfälliga `500`-fel medan builden pågår.

Reverse proxy och HTTPS kan ligga framför appen separat.

## Home Assistant

Det finns nu ett första integrationspaket för Home Assistant i:

- [deploy/home-assistant-package.yaml](/c:/Users/eripet/Coding/Hyllsystem/deploy/home-assistant-package.yaml)
- [deploy/HOME_ASSISTANT.md](/c:/Users/eripet/Coding/Hyllsystem/deploy/HOME_ASSISTANT.md)

Paketet använder det publika REST-API:t och är tänkt som grund för:

- knapp i verkstaden
- röstfråga
- TTS-svar
- vidare event till ESPHome, MQTT, display eller laserlogik

## Filer att känna till

- `app/page.tsx`: översikten
- `app/hyllsystem/page.tsx`: lista över platsenheter (`Lagerplats` i UI:t)
- `app/hyllsystem/[system]/page.tsx`: visuell hyll-/platsvy för vald enhet
- `app/inbox/page.tsx`: serverdel för okopplade bilder
- `app/inbox/inbox-workspace.tsx`: klientflödet för `Bilder att koppla`
- `app/boxes/new/session-form.tsx`: registrera/uppdatera låda
- `app/boxes/[boxId]/page.tsx`: låd-vyn
- `app/settings/settings-form.tsx`: inställnings-UI
- `lib/analysis.ts`: AI-logik, tolkning och matchning
- `lib/analysis-jobs.ts`: statusjobb för analys
- `lib/data-store.ts`: läs/skriv av inventariedata
- `lib/immich.ts`: Immich-hämtning
- `lib/location-sort.ts`: fysisk sortering av lådor och platsenheter
- `lib/location-schema.ts`: parsing och generering av plats-ID för `Ivar`, `Bänk` och `Skåp`
- `lib/location-presentation.ts`: svensk presentation av platsinfo i UI:t
- `lib/shelf-map.ts`: grupperar lådor till platsenheter, rader och platser
- `lib/settings.ts`: läs/skriv av appinställningar

## Import och export av etikettkatalog

Projektet innehåller även ett importscript för etikettregister:

- `scripts/import_label_catalog.py`

Det används nu för att läsa in Excel-filer som kommer från appens egen export, så att import och export bygger på samma format.

Det finns nu också ett exportscript:

- `scripts/export_label_catalog.py`

Det skriver ut en ny Excel-fil från aktuell `inventory.json`, med de klassiska kolumnerna `Namn`, `Beskrivning` och `Plats` plus kompletterande metadata som `Box-ID`, `Plats-ID`, `Sammanfattning` och `Nyckelord`.

Exempel:

```bash
python scripts/export_label_catalog.py
```

Det skapar som standard `data/Hyllsystem - Namnetiketter-export.xlsx`, men du kan också ange egen sökväg som första argument.

Från och med `v1.2.0` finns exporten också direkt i appen under `Inställningar` i samma avsnitt som backup. Nedladdningar får tidsstämpel i filnamnet, till exempel `hyllsystem-etikettkatalog-2026-03-26-104924.xlsx`.

Från och med `v1.2.1` finns även importen direkt i appen under `Inställningar`. Den förutsätter en `.xlsx`-fil från appens egen export och uppdaterar lådor och aktuella sessioner utan att rensa bort kopplade bilder.

## Lokal testning

För lokal körning finns ett PowerShell-script:

- `scripts/start-local.ps1`

Det säkerställer rätt Node-version, installerar beroenden om det behövs och startar sedan utvecklingsservern på `http://localhost:3000`.

Mer detaljer finns i [LOCAL-TESTING.md](/c:/Users/eripet/Coding/Hyllsystem/LOCAL-TESTING.md).

## Framtida utveckling

Några naturliga nästa steg:

- online-manual/hjälpsida i appen
- bättre virtualisering/lazy loading för stora mängder thumbnails
- eventuell återkoppling till Immich-metadata om rätt konto används
- mer avancerad sökning och synonymstöd
