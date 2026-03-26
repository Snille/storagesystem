# History

## v1.2.0 - 2026-03-26

Releasen samlar exportfunktioner, översiktsbild, lokal testning, UI-polish och dokumentationssynk i en gemensam versionshöjning.

### Export och backup

- Ny Excel-export av etikettkatalogen via `scripts/export_label_catalog.py`.
- Ny export-endpoint i appen och knapp under `Inställningar` i samma avsnitt som backup.
- Backup- och Excel-filer får nu tidsstämpel i filnamnet i formatet `YYYY-MM-DD-HHMMSS`.
- Fixat Excel-exporten så att workbook-metadata inte längre ger reparationsdialog i Excel.

### Immich och översikt

- Albumomslaget i valt Immich-album används nu som `Översiktsbild` på startsidan.
- `Översiktsbild` kan öppnas i egen lightbox från översikten.
- Albumomslaget filtreras bort från `Bilder att koppla` så att det inte blandas in bland okopplade lådbilder.

### Lagerplats och tema

- `Lagerplats` har nu tydligare visuell skillnad mellan `Ivar`, `Skåp` och `Bänk`.
- `Bänk` visar endast själva bänkplanet där det är relevant i strukturen.
- Hyll- och bänketiketter har justerats till godkänd position direkt mot hyllplanet.
- Platschippens värden följer nu tema bättre och blir mörka i ljust läge.

### Drift och dokumentation

- Ny guide i `LOCAL-TESTING.md` för lokal körning och felsökning.
- `scripts/start-local.ps1` växlar bara Node-version via `nvm use` när det verkligen behövs.
- README, MANUAL och Home Assistant-dokumentationen uppdaterade för nya exportflöden, översiktsbild och utökad metadata.

## v1.1.2 - 2026-03-25

Punktrelease med fokus på platslogik, AI-matchning, sökning och stabilitet i registreringsflödet.

### Platser och sortering

- Översikten sorterar nu lådor i fysisk ordning: `Ivar`, sedan `Bänk`, sedan `Skåp`.
- `Lagerplats` använder samma gemensamma platsordning för platsenheter.
- Ny hjälpare för gemensam platssortering i `lib/location-sort.ts`.

### Ny låda / inventering

- `Aktuell plats` ligger nu före `Etikett / lådnamn` i formuläret.
- Nya lådor får inte längre råka skriva över en befintlig låda på samma exakta plats.
- Servern stoppar nu sparning om platsen redan används av en annan låda och skickar tillbaka en tydlig varning.
- Nästa lediga bokstav på en plats räknas nu fram utifrån den generella platsmodellen i stället för äldre IVAR-antaganden.

### AI och analys

- `Lageralbum` matchar nu AI-förslag korrekt även för `Bänk` och `Skåp`.
- Analyslogiken använder nu samma platsnormalisering och platsjämförelse som resten av appen.
- Appnamnet i webbläsarfliken är ändrat från `Hyllsystem` till `Lagersystem`.

### Bilder och sessioner

- Fixat ett fel där två bilder i samma session kunde få samma `photoId`.
- Fixat följdfelet där `Analysera bild` kunde fylla flera analystextrutor samtidigt.
- Tooltip med analystext används nu konsekvent på bilder där analystext finns.

### Sökning

- Förbättrad heuristik för bindestrecksord så sökningar som `rc-bil` inte längre feltolkas som filnamn.
- Lagt till bättre stöd för korta felskrivningar och synonymvarianter som `cr-bil`, `rc-bil` och `radiostyrd`.

### UI och polish

- Fixat platschippen så `Ivar`, `Hylla` och `Plats` får konsekvent storlek och vita bold-värden.
- Dokumentationen uppdaterad för ny platslogik, sökbeteende, AI-matchning och skydd mot dubbletter.

## v1.1.1 - 2026-03-24

Punktrelease med fokus på registreringsflöde, bildinformation och dokumentationssynk.

### Registrering och bildflöde

- Markerade album-bilder följer nu med vid sparning även om `Lägg till valda bilder` inte trycks först.
- `Ny låda / inventering` har fått en mer kompakt layout där `Noteringar` och `Spara session` ligger direkt under `Sökord`.
- Knappen `Lägg till valda bilder` använder nu samma primärstil som `Spara session`.

### Bildvisning

- Analystext visas nu som hover-tooltip på bilder när sådan text finns.
- Registreringssidan skickar nu med analystext till den gemensamma bildvisaren så tooltip och lightbox visar samma information.

### UI och dokumentation

- Dokumentationen använder nu `Lagerplats` där det speglar dagens UI.
- README och MANUAL uppdaterade för det senaste registreringsflödet och bildvisningen.

## v1.1.0 - 2026-03-24

Första utbyggnadsreleasen efter `v1.0.0`, med fokus på platsstruktur och navigering i verkstaden.

### Platser och navigering

- Ny generell platsmodell för `Ivar`, `Bänk` och `Skåp`.
- Ny sida `Hyllsystem` som visar alla platsenheter i systemet.
- Ny detaljvy per platsenhet med visuell hyllstruktur och klickbara lådor.
- Översikten visar nu `aktuella platser` i stället för dubblerad sessionsstatistik.

### Registrering och flytt

- `Ny låda / inventering` kan nu välja platskategori direkt.
- Befintliga lådor kan flyttas genom att öppna och ändra `Aktuell plats`.
- Stöd för bokstavsvariant även vid flytt till ny plats.

### Struktur och presentation

- Ny intern platsparser och normalisering för flera typer av plats-ID.
- Svensk presentation av `Ivar`, `Bänk`, `Skåp`, `Hylla`, `Yta` och `Plats` i hela UI:t.
- Förbättrad hyllvy med trästruktur, hyllplan och dynamiska rader utan onödiga tomma platshållare.

### Språk och polish

- Språkfix för `lådor`.
- Dokumentation uppdaterad för nya platsenheter, hyllvyn och flyttflödet.

## v1.0.0 - 2026-03-24

Första stabila releasen av Hyllsystem.

### Kärnfunktioner

- Översikt med sök (text + röst), lådkort och bildvisning i lightbox.
- `Bilder att koppla` med AI-förslag, bildroller och direktkoppling till låda.
- `Registrera eller uppdatera` med redigering av sammanfattning, sökord, bilder och roller.
- Låd-vy med historik, bildspecifik analys, redigering och möjlighet att släppa felkopplad bild.

### AI och analys

- Stöd för flera AI-providers:
  - LM Studio
  - OpenAI
  - Anthropic
  - OpenRouter
  - Open WebUI
- Tydlig jobbstatus under analysflöden.
- Redigerbara promptar i `Inställningar`.
- Rensningsregler för AI-text (sammanfattning, sökord, noteringar, bildtext) via inställningar.

### Immich och data

- Immich-integrering med API-nyckel eller share key.
- Val av aktivt album i inställningar.
- JSON-baserat datalager för lådor, sessioner, bilder och appinställningar.
- Backup/export/import av appinställningar + inventarie i `.zip`.

### Etiketter och DYMO

- Etikettgenerator med egen mallmotor.
- Visuell designer med flytt/skalning, rutnät, snap-to-grid och mm-skala.
- Direktutskrift till DYMO LabelWriter 5XL via CUPS på Ubuntu.
- Automatisk detektering av isatt etikettrulle och mallmatchning.

### Integrations-API

- Publika REST-endpoints för integration (ex. Home Assistant):
  - `/api/public/health`
  - `/api/public/search`
  - `/api/public/ask`
  - `/api/public/boxes/:boxId`

### Drift och stabilitet

- Säkrare deployflöde med atomisk build-swap via `scripts/deploy_safe.sh`.
- Förbättrad hantering av fallback, parserrobusthet och felmeddelanden i analysflöden.
- Stöd för fast `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` i miljön för stabilare deployer med Next.js server actions.
