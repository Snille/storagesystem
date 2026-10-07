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
- Consider MCP write tools (move box, edit notes) once read-only use has settled.

## Next session (left over from the v1.6 review, 2026-10-07)

- Split `app/settings/settings-form.tsx` (1300 lines) and `app/labels/label-editor.tsx` (1300 lines) into one component per section. Verify each section in the browser before moving on.
- Fix the 5 remaining ESLint warnings (`npm run lint`): unused `setBoxId`/`setSessionId` in `app/boxes/new/session-form.tsx`, and missing hook dependencies in `app/labels/label-editor.tsx` and `app/settings/translations/translations-editor.tsx`.
- Translations edited live on the server (Settings -> Translations) still have no way back into git. `deploy_safe.sh` refuses to deploy while they are uncommitted; add an export or commit step.
- The settings page waits for the model, album and printer lists before it renders (up to 5 s each when a host is down). Load them in the browser after the page shows.
- Remove `getImmichConfig` from `lib/config.ts`; nothing uses it since analysis goes through the photo source adapter.
- `saveBoxSessionFromFormData` checks for location conflicts before it takes the inventory lock. Move the check inside `updateInventoryData` if two people ever edit at the same time.
- Secrets live in `data/app-settings.json`, which overrides the environment. Decide whether the app should read keys from the environment instead, so rotation does not mean editing the settings file.
