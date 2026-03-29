# History

## v1.4.4 - 2026-03-29

Patch release focused on language override links and smoother settings behavior.

### Language and Voice

- Added URL-based language override support such as `?lang=sv` and `?lang=en`.
- The override is stored in a browser cookie so navigation keeps the same UI and voice-search language.
- Added `?lang=default` to clear the temporary override and return to the normal saved app language.
- Public voice/API answers now use the current localized storage terms from the language files instead of older internal names such as `Ivar` or `CABINET`.

### Settings

- Saving `Settings` now clears any active QR/URL language override so the newly saved app language takes effect normally.
- Reduced unnecessary full-page refreshes on most settings saves so the page feels less like it hangs while reloading remote lists.

## v1.4.3 - 2026-03-29

Patch release focused on voice-search polish, public integration security, and Home Assistant image support.

### Voice Search and Overview

- Added a dedicated voice-answer prompt so microphone searches can return more natural spoken responses.
- Kept typed search focused on a shorter on-page summary while still showing the full result list below.
- Added browser speech playback for the search answer area and automatic read-aloud after voice searches.
- Cleaned up search URLs so regular typed searches no longer append `mode=text`.

### Public API and Security

- Added a `Security` section in `Settings` for the public integration base URL and public API key.
- Public API auth now reads the saved settings first and falls back to environment variables when needed.
- Added public asset routes for integration-safe image access:
  - `/api/public/assets/:assetId/thumbnail`
  - `/api/public/assets/:assetId/original`
- Public API box/search answers can now return absolute image URLs through those public asset routes.

### Home Assistant and Integrations

- Updated the Home Assistant packages to store thumbnail and original image URLs for the first matched box image.
- Updated Home Assistant documentation for the new public asset endpoints and richer image metadata.
- Added OpenRouter app headers for public ask requests so they no longer show up as `Unknown`.

## v1.4.2 - 2026-03-28

Patch release focused on photo-source expansion, box deletion, and documentation cleanup.

### Photo Sources

- Added a generic photo-source layer so the app is no longer hard-wired only to `Immich`.
- Added initial `PhotoPrism` support as a second provider with album loading, asset browsing, and token-based access from `Settings`.
- Updated settings UI and translations so the app can switch between `Immich` and `PhotoPrism` without exposing unsupported access modes.

### Boxes and Data

- Added a safe delete flow for boxes.
- Deleting a box now removes the box, all of its sessions, and all linked image references from the app data.
- Deleting a box does not remove the actual images from `Immich` or `PhotoPrism`.
- Clarified by behavior and documentation that storage locations are derived from existing boxes and disappear automatically when no box remains there.

### Documentation and Presentation

- Reorganized Markdown documentation under `docs/` while keeping the root `README.md` as the public entry point.
- Added README screenshots for overview, search, box view, edit flow, and labels.
- Updated README and MANUAL to describe the album-based photo-source model instead of only `Immich`.
- Clarified that the internal `immichAssetId` field now stores either an `Immich` asset ID or a `PhotoPrism` photo UID.

## v1.4.1 - 2026-03-28

Patch release focused on editing reliability, overview cleanup, translation-draft precision, and live deployment follow-up.

### Registration and Locations

- Fixed editing of existing boxes so unchanged locations no longer trigger false duplicate-location warnings.
- Fixed save flow for existing boxes so incorrect conflict redirects no longer build very long retry URLs.
- Added a one-time migration script for older inventory data where exact `currentLocationId` values were missing the letter variant.

### Images and Overview

- The Immich album cover is now consistently excluded both from `Images to Connect` and from box-edit / add-more-images flows.
- The overview statistics were refreshed to show storage units, unit types, and image coverage instead of the now-redundant `current locations` total.
- The overview stats layout and heading were adjusted to match the current start-page design.

### Translation Tooling

- Fixed translation draft prompts so `missing` drafts only send actually missing keys to the AI model.
- Added new overview-stat translation keys for Swedish, English, and German.

### UI and Stability

- Fixed duplicate React keys for keyword pills in overview, inbox, and box views.
- Fixed hydration/runtime issues in voice search by delaying speech-recognition capability detection until after mount.

## v1.4.0 - 2026-03-27

Release focused on translation tooling, printer queue selection, DYMO status improvements, and public-facing documentation polish.

### Translation Tooling

- Added a translation tool in `Settings` with source/target language selection.
- Added per-section translation editing so the UI does not need to load all strings at once.
- Added new-language creation from the UI.
- Added export of language JSON files from the translation tool.
- Added per-language coverage tracking.
- Added separate AI configuration for translation drafts.
- Added a dedicated translation instruction prompt used by AI translation drafts.
- Added OpenRouter app titles for translation requests so they no longer show up as `Unknown`.

### Labels and Printers

- Added remaining label count from supported DYMO printers through the network status protocol.
- Added remaining-label display both in detailed printer metadata and in the top printer status row on the labels page.
- Added selection of the active printer queue from already installed CUPS queues in `Settings`.
- Added DYMO-first recommendation text and sorting in the printer picker.

### Documentation

- Translated the main Markdown documentation to English.
- Updated README, MANUAL, deploy guides, and TODO to reflect the current app structure.
- Documented the translation tool and the new printer queue selection flow.

## v1.3.0 - 2026-03-26

Naming release that makes the app and its integrations more general and consistent.

### Naming and Integrations

- App naming, filenames, and API-related labels now consistently use `Storage System` / `Lagersystem` instead of older shelf- or workshop-specific names where the naming is user-facing or integration-facing.
- The public API is now protected with `LAGERSYSTEM_API_KEY`.
- The Home Assistant package and documentation now consistently use `lagersystem_*` and the event `lagersystem_result`.
- Backup and Excel export filenames now start with `lagersystem-`.

### Operations

- Deployment defaults now point to `/opt/lagersystem` and `lagersystem.service`.
- New service file for `lagersystem.service` with updated working directory.

## v1.2.1 - 2026-03-26

Patch release that unifies catalog import and export around the same Excel format.

### Catalog Import

- New import flow in `Settings` where you can choose an exported `.xlsx` file directly from your computer.
- Import now uses the app's current export format instead of the older manual Excel template.
- The import flow updates boxes and current sessions while keeping linked images in place.

## v1.2.0 - 2026-03-26

This release bundles export functions, overview image support, local testing, UI polish, and documentation sync into one version bump.

### Export and Backup

- New Excel catalog export via `scripts/export_label_catalog.py`.
- New in-app export endpoint and button under `Settings` in the same area as backup.
- Backup and Excel files now get timestamped filenames in the format `YYYY-MM-DD-HHMMSS`.
- Fixed Excel export metadata so workbooks no longer trigger a repair dialog in Excel.

### Immich and Overview

- The selected Immich album cover is now used as the `Overview image` on the home page.
- The `Overview image` opens in its own lightbox from the overview.
- The album cover is filtered out from `Images to Connect` so it does not mix with unassigned box images.

### Storage Map and Theme

- `Storage Map` now has a clearer visual difference between `Shelving unit`, `Cabinet`, and `Bench`.
- `Bench` now shows only the actual bench surface where relevant in the structure.
- Shelf and bench labels were adjusted to a cleaner approved position directly against the shelf surface.
- Location chips now follow the theme better and become dark in light mode.

### Operations and Documentation

- New `LOCAL-TESTING.md` guide for local startup and troubleshooting.
- `scripts/start-local.ps1` only switches Node version via `nvm use` when really needed.
- README, MANUAL, and Home Assistant documentation were updated for the new export flow, overview image, and expanded metadata.

## v1.1.2 - 2026-03-25

Patch release focused on location logic, AI matching, search, and registration flow stability.

### Locations and Sorting

- The overview now sorts boxes in physical order: `Shelving unit`, then `Bench`, then `Cabinet`.
- `Storage Map` uses the same shared location sort order for storage units.
- Added a shared location sort helper in `lib/location-sort.ts`.

### New Box / Inventory

- `Current location` now appears before `Label / box name` in the form.
- New boxes can no longer accidentally overwrite an existing box at the same exact location.
- The server now blocks save attempts if a location is already used by another box and returns a clear warning.
- The next free letter at a location is now calculated from the generic location model instead of older shelving-only assumptions.

### AI and Analysis

- `Lageralbum` now matches AI suggestions correctly for `Bench` and `Cabinet` as well.
- The analysis logic now uses the same location normalization and location comparison as the rest of the app.
- The app name in the browser tab changed from `Hyllsystem` to `Lagersystem`.

### Images and Sessions

- Fixed an issue where two photos in the same session could get the same `photoId`.
- Fixed the follow-up issue where `Analyze image` could fill several analysis editors at once.
- Tooltip-based analysis previews are now used consistently on images that have analysis text.

### Search

- Improved heuristics for hyphenated terms so searches like `rc-car` are no longer misread as filenames.
- Added better support for short typos and synonym variants such as `cr-car`, `rc-car`, and `radio controlled`.

### UI and Polish

- Fixed location chips so `Shelving unit`, `Shelf`, and `Slot` get consistent sizing and white bold values.
- Documentation updated for the new location logic, search behavior, AI matching, and duplicate protection.

## v1.1.1 - 2026-03-24

Patch release focused on registration flow, image information, and documentation sync.

### Registration and Image Flow

- Selected album images now follow the save action even if `Add selected images` is not clicked first.
- `New Box / Inventory` got a more compact layout where `Notes` and `Save session` sit directly below `Keywords`.
- `Add selected images` now uses the same primary visual style as `Save session`.

### Image Viewing

- Analysis text is now shown as a hover tooltip on images when such text exists.
- The registration page now passes analysis text to the shared image viewer so the tooltip and lightbox show the same information.

### UI and Documentation

- Documentation now uses `Storage Map` where that reflects the current UI.
- README and MANUAL updated for the latest registration flow and image viewing behavior.

## v1.1.0 - 2026-03-24

The first expansion release after `v1.0.0`, focused on location structure and navigation inside the workshop.

### Locations and Navigation

- New generic location model for `Shelving unit`, `Bench`, and `Cabinet`.
- New `Storage Map` page showing all storage units in the system.
- New detail view per storage unit with a visual shelf structure and clickable boxes.
- The overview now shows `current locations` instead of duplicated session statistics.

### Registration and Moves

- `New Box / Inventory` can now choose a location category directly.
- Existing boxes can be moved by opening and changing `Current location`.
- Support for letter variants when moving to a new location.

### Structure and Presentation

- New internal location parser and normalization for multiple location ID types.
- Localized presentation of `Shelving unit`, `Bench`, `Cabinet`, `Shelf`, `Surface`, and `Slot` across the UI.
- Improved shelf view with wood structure, shelf boards, and dynamic rows without unnecessary empty placeholders.

### Language and Polish

- Language fix for plural box text.
- Documentation updated for the new location units, storage map, and move flow.

## v1.0.0 - 2026-03-24

First stable release of the system.

### Core Features

- Overview with search (text + voice), box cards, and image lightbox viewing.
- `Images to Connect` with AI suggestions, photo roles, and direct box linking.
- `Register or update` flow with editing of summaries, keywords, photos, and roles.
- Box view with history, per-photo analysis, editing, and the ability to release wrongly attached photos.

### AI and Analysis

- Support for multiple AI providers:
  - LM Studio
  - OpenAI
  - Anthropic
  - OpenRouter
  - Open WebUI
- Clear job status during analysis flows.
- Editable prompts in `Settings`.
- Cleanup rules for AI text such as summary, keywords, notes, and photo text.

### Immich and Data

- Immich integration through API key or share key.
- Selection of active album in settings.
- JSON-based data store for boxes, sessions, photos, and app settings.
- Backup, export, and import of app settings and inventory in `.zip`.

### Labels and DYMO

- Label generator with a custom template engine.
- Visual designer with move/resize, grid, snap-to-grid, and millimeter ruler.
- Direct printing to DYMO LabelWriter 5XL through CUPS on Ubuntu.
- Automatic detection of the inserted label roll and template matching.

### Integration API

- Public REST endpoints for integration such as Home Assistant:
  - `/api/public/health`
  - `/api/public/search`
  - `/api/public/ask`
  - `/api/public/boxes/:boxId`

### Operations and Stability

- Safer deployment flow with atomic build swap through `scripts/deploy_safe.sh`.
- Improved fallback handling, parser robustness, and error messages in analysis flows.
- Support for a fixed `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` for more stable Next.js deployments with server actions.
