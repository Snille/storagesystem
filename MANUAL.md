# User Manual

This manual is intended for day-to-day use of the app. For technical details, see [README.md](./README.md).

Current version: `v1.4.1`

## The Basic Idea

Each physical box has its own identity, and every time the contents are updated, a new inventory session is created for the same box.

That means you can:

- move a box without losing history
- add more photos later
- change the contents of a box while keeping the same box identity

A box can now be stored in several kinds of places:

- in a `Shelving unit`
- on or under a `Bench`
- in a `Cabinet`

## Typical Workflow

1. Photograph the box with your phone.
2. Let the photos sync to Immich.
3. Open `Images to Connect`.
4. Select the photos that belong to the same box.
5. Click `Analyze selected images`.
6. Review the AI suggestion.
7. Click `Attach box` or continue to `New Box / Inventory`.
8. Adjust text, photo roles, and analysis text if needed.
9. Save the session.

After saving, the app returns to the overview.

## Good Photo Types

The app works best when each box has at least:

- one clear label photo
- one or more photos of the contents

Useful extra photos are:

- contents spread out on a table
- detail photos of small parts
- a location photo if the label is hard to read

## Photo Roles

The roles in the app mean:

- `Label`: the label or location tag is the main subject
- `Location`: the image shows where the box is stored
- `Inside`: the contents inside the box
- `Spread`: the contents laid out outside the box
- `Detail`: a close-up of a specific item or part

If the AI chooses the wrong role, you can change it manually.

## Overview

From the start page you can:

- search for items in the workshop
- use voice search
- open the `Overview image` in its own lightbox
- open a box by clicking the box card
- click photos to view them in a lightbox
- hover on images with analysis text to see a quick description
- see overview statistics for storage units, storage types, and image coverage

The `Overview image` is automatically taken from the album cover of the selected Immich album.

Boxes are shown in physical order in the overview:

- first `Shelving unit`
- then `Bench`
- finally `Cabinet`

Search does not only use box names. It also finds:

- summaries
- keywords
- per-photo analysis text

## Storage Map

The `Storage Map` page shows all storage units, for example:

- `Shelving unit C`
- `Bench Lathe`
- `Cabinet 3D Print`

Here you can:

- open the correct storage unit
- see boxes grouped by shelf or surface
- open a box directly from the storage map

In the shelving unit view, only the positions that are actually used on each shelf are shown. If one shelf has 2 positions it shows 2, and if another has 4 it shows 4 there.

This is especially useful when you want to find something based on how the workshop physically looks, rather than by free-text search.

## Images to Connect

This page only shows images that are not yet linked to any box.

The Immich album cover is excluded here because it is used as the overview image on the start page.

It is also excluded when you edit a box and add more images from the album.

Here you can:

- select multiple images
- let AI suggest a box and a location
- see likely existing boxes
- attach directly to a good match

If several small boxes share the same place, the app tries to choose the next free variant, such as `A`, `B`, or `C`.

## New Box / Inventory

This is where registration happens.

You can:

- adjust the box name
- choose the location category: `Shelving unit`, `Bench`, or `Cabinet`
- choose or change the current location
- select the location before typing the box name
- write notes and save the session directly after `Keywords`
- change image order
- change photo roles
- analyze individual images
- edit the analysis text manually
- let selected album images follow automatically when you save, even if you do not click `Add selected images` first

If you try to create a new box at a location that is already occupied, saving is blocked. In that case you should:

- choose another letter
- or open and edit the existing box instead

For an existing box, you can use `Change location` if the box has been moved in the workshop.

If you only edit text on an older box without changing its place, the app should now keep the current location correctly and avoid false duplicate warnings.

This is often the best page to use when the AI is almost right but needs a bit of help.

## Box View

Here you see the completed box.

You can:

- view the current summary
- open all photos
- analyze individual photos afterwards
- edit analysis text
- add more photos
- release an incorrectly linked photo
- open the history

If a photo has analysis text, you can also see it directly as a tooltip when hovering over the image in different parts of the app.

History remains available even if the box moves to a new location.

## When the AI Is Wrong

It is completely normal for the AI to need help sometimes.

The simplest fix is usually to:

1. correct the photo roles
2. correct the box name
3. correct the analysis text
4. save

Helpful things to keep in mind:

- the label photo should be clear and close
- 2 to 6 photos usually gives the best overview analysis
- too many photos at once can make analysis slower or worse

Search is also more tolerant than before, so it can often understand terms such as:

- `rc-car`
- `cr-car`
- `radio controlled`

as the same kind of box or content.

## Settings

From the `Settings` page you can change:

- theme
- font
- text size
- Immich account and album
- AI provider and model
- prompts that guide the model
- cleanup phrases and other filters that clean up AI output
- download a backup
- export the catalog to Excel
- import a catalog from an exported Excel file
- choose which installed CUPS printer queue to use for label printing
- choose the app language
- open the translation tool
- configure a separate AI model for translation drafts

## Translation Tool

The translation tool is opened from `Settings`.

It is intended for maintaining the language files that ship with the app.

You can:

- choose a source language and a target language
- translate one section at a time
- filter missing strings
- create a new language from the UI
- export the current language JSON file
- use a dedicated AI model for translation drafts

This makes it possible to keep the app UI multilingual without editing JSON files manually every time.

When `Missing` is selected, AI drafts now focus on the currently missing keys in that scope instead of sending the whole section as extra context.

## Label Printing

The app is still optimized for DYMO workflows, but you can now choose among installed CUPS queues in `Settings`.

For the current DYMO setup, the app can also show:

- the active roll
- the detected SKU
- queued jobs
- firmware version
- labels remaining on the roll when supported by the printer

This is especially useful if you test different models in LM Studio or compare different printer setups.

## If Something Looks Wrong

Some common situations:

- A photo is missing:
  it may have been removed in Immich. The app should still continue working.

- An analysis looks empty or strange:
  try again, or write your own analysis text manually.

- The wrong box is suggested:
  check the label photo and choose the correct box manually.

- A photo ended up in the wrong box:
  use `Release image` from the box page.

- A box is shown at the wrong location:
  open the box or the registration page and use `Change location`.

## Recommended Everyday Workflow

- Photograph the label first whenever possible.
- Then take 1 to 3 content photos.
- Use `Images to Connect` for quick sorting.
- Make fine adjustments in `New Box / Inventory`.
- Use the overview as your main search page.
- Use `Storage Map` when you want to navigate visually between shelving units, benches, and cabinets.
