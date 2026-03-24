# History

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
