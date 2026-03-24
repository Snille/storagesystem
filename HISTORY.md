# History

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

