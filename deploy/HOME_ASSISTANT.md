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
- `input_text.lagersystem_last_query`
- `input_text.lagersystem_last_answer`
- `input_text.lagersystem_last_location`
- `input_text.lagersystem_last_box_id`
- `input_text.lagersystem_last_source`
- `input_text.lagersystem_last_summary`
- `input_text.lagersystem_last_keywords`
- `input_number.lagersystem_last_match_count`
- template sensors for answer, location, box id, source, summary, keywords, and match count

When the script runs:

1. a question is sent to `/api/public/ask`
2. the answer is stored in helpers
3. the answer is spoken through TTS
4. metadata such as `source`, `match_count`, `summary`, and `item_keywords` is also stored
5. an event `lagersystem_result` is fired in Home Assistant

## Example: Call The Script Manually

```yaml
action: script.lagersystem_fraga
data:
  query: "Where are the junction boxes?"
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
