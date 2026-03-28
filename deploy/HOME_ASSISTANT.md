# Home Assistant Integration

This app exposes a public REST API that works well with Home Assistant.

## Files

- package: [home-assistant-package.yaml](./home-assistant-package.yaml)
- systemd service for the app: [lagersystem.service](./lagersystem.service)

## Preparation

1. Set `LAGERSYSTEM_API_KEY` in the app's `.env.local` on the server.
2. Restart the app.
3. Add the following to `secrets.yaml` in Home Assistant:

```yaml
lagersystem_api_url: "https://lager.yourdomain.com/api/public/ask"
lagersystem_search_url: "https://lager.yourdomain.com/api/public/search?q={{ query }}&limit=5"
lagersystem_api_health_url: "https://lager.yourdomain.com/api/public/health"
lagersystem_api_key: "YOUR_KEY"
lagersystem_tts_entity: "tts.google_translate_sv"
lagersystem_media_player: "media_player.storage"
```

4. Place the package file at:

```text
/config/packages/lagersystem.yaml
```

5. Make sure `packages` is enabled in `configuration.yaml`:

```yaml
homeassistant:
  packages: !include_dir_named packages
```

6. Restart Home Assistant.

## What The Package Adds

The package adds:

- `script.lagersystem_fraga`
- `script.lagersystem_sok`
- `input_text.lagersystem_last_query`
- `input_text.lagersystem_last_search_query`
- `input_text.lagersystem_last_answer`
- `input_text.lagersystem_last_location`
- `input_text.lagersystem_last_location_id`
- `input_text.lagersystem_last_box_id`
- `input_text.lagersystem_last_label`
- `input_text.lagersystem_last_session_id`
- `input_text.lagersystem_last_source`
- `input_text.lagersystem_last_summary`
- `input_text.lagersystem_last_keywords`
- `input_number.lagersystem_last_match_count`
- `input_number.lagersystem_last_photo_count`
- REST sensors for API health and API timestamp
- template sensors for answer, location, location id, box id, label, session id, source, summary, keywords, match count, and photo count

The bundled package is intentionally centered around `/api/public/ask`, because that is the most natural flow for voice assistants, buttons, and spoken feedback in Home Assistant.

The public API currently also exposes:

- `GET /api/public/health`
- `GET /api/public/search?q=...&limit=...`
- `GET /api/public/boxes/:boxId`

When the script runs:

1. a question is sent to `/api/public/ask`
2. the answer is stored in helpers
3. the answer is spoken through TTS
4. metadata such as `source`, `match_count`, `summary`, and `item_keywords` is also stored
5. an event `lagersystem_result` is fired in Home Assistant

The package now also handles failed API responses more gracefully. If the app is unreachable or returns a non-2xx response, the helper entities are filled with safe fallback values instead of assuming the body is valid JSON.

The package also includes a second script, `script.lagersystem_sok`, which uses `/api/public/search` directly. That is useful when you want structured top-match metadata without an AI-generated spoken answer.

## Example: Call The Script Manually

```yaml
action: script.lagersystem_fraga
data:
  query: "Where are the junction boxes?"
```

## Example: Call The Search Script Manually

```yaml
action: script.lagersystem_sok
data:
  query: "junction boxes"
```

## Example: Connect To A Button In ESPHome

Expose your ESPHome button in Home Assistant and then create an automation:

```yaml
alias: Storage System - Ask From Button
triggers:
  - trigger: state
    entity_id: input_button.lagersystem_fraga
actions:
  - action: script.lagersystem_fraga
    data:
      query: "{{ states('input_text.lagersystem_fraga_text') }}"
mode: restart
```

## Example: React To The Result Event

You can use the event to:

- light an LED
- publish MQTT
- move a servo or stepper motor
- show text on a display

The event now also contains:

- `source`
- `match_count`
- `location_id`
- `label`
- `session_id`
- `photo_count`
- `summary`
- `item_keywords`
- `raw`

```yaml
alias: Storage System - Forward Result
triggers:
  - trigger: event
    event_type: lagersystem_result
actions:
  - action: mqtt.publish
    data:
      topic: lagersystem/result
      payload: >-
        {{ trigger.event.data | to_json }}
mode: queued
```

## Recommended Next Step

When you want to connect physical hardware, a good next flow is:

1. button or voice input into Home Assistant
2. `script.lagersystem_fraga`
3. event `lagersystem_result`
4. automation that forwards location, `box_id`, `summary`, or `item_keywords`
5. receiver such as an ESPHome display, laser pointer, servo/stepper, or speaker

## About Label Printing Through REST

The app already has label-printing endpoints used by the web UI, such as:

- `POST /api/labels/print`
- `GET /api/labels/printer-status`

Those are not part of the public API and should not simply be exposed as-is to Home Assistant or other external callers. Printing is an action endpoint with real side effects, so it deserves stricter control than search/read endpoints.

Recommended approach if you want Home Assistant-driven label printing later:

1. add a dedicated print API for integrations instead of reusing the generic public search API
2. protect it with its own auth boundary or at least a separate API key
3. limit the payload to explicit safe fields such as `boxId`, `templateId`, and perhaps a small set of print options
4. log print requests clearly so accidental or repeated prints are easy to trace

That would make label printing possible from Home Assistant without making the current public REST API too permissive.

## Suggested Dashboard Helpers

The updated package now gives you enough metadata to build a much better dashboard card in Home Assistant, for example:

- API status
- latest answer
- latest location
- latest box id
- latest label
- latest session id
- latest match count
- latest photo count
