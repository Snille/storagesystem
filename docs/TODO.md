# TODO

## Printing

- Prioritize DYMO workflows as the primary label-printing path while CUPS printer support matures.
- Keep printer selection based on already installed CUPS queues in Settings.
- Add clearer recommendation badges or labels for DYMO queues in the printer picker.
- Investigate support for more DYMO models that expose compatible status commands over the network.
- Add graceful fallback when a selected printer supports printing but not detailed DYMO status fields such as roll SKU or labels remaining.

## A4 Label Sheets

- Add a separate `A4 sheet` print mode alongside the current `roll label` mode.
- Support sheet templates such as common multi-label A4 layouts.
- Generate full-page PDF/browser-print output for laser printers before attempting direct printer integration.
- Let users choose sheet format, margins, rows, columns, and label spacing.
- Evaluate support for mixed setups where DYMO is used for single labels and A4 printers for batch printing.

## Printer Administration

- Keep printer installation out of the web UI for now.
- Revisit a safe admin flow for adding new CUPS queues from the app only after the selection flow is stable.
- If installation is added later, lock it down to validated device URIs and minimal sudo permissions.

## Translation Tool

- Add review markers for AI-generated drafts before save.
- Add completion overview per language with clearer progress states.

## Image Sources

- Investigate support for Google Photos as an optional source, likely through a manual picker-style flow rather than a full album mirror.
- Validate `PhotoPrism` support against a real instance and document any API differences or limitations compared with `Immich`.
- Investigate support for `Nextcloud`-based photo libraries as the next optional self-hosted source.
- Evaluate whether Synology Photos is realistic to support with stable enough authentication and album access.
- Document tradeoffs for each provider: album model, authentication model, read-only vs write-back, and API stability.

## General

- Continue scanning for remaining hardcoded UI strings during normal usage.
- Add a small smoke test around public API fields used by the Home Assistant package.
