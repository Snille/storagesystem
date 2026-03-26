# Home Assistant-integration

Den här appen har ett publikt REST-API som passar bra för Home Assistant.

## Filer

- paket: [home-assistant-package.yaml](/c:/Users/eripet/Coding/Hyllsystem/deploy/home-assistant-package.yaml)
- systemd-tjänst för appen: [lagersystem.service](/c:/Users/eripet/Coding/Hyllsystem/deploy/lagersystem.service)

## Förberedelser

1. Sätt `LAGERSYSTEM_API_KEY` i appens `.env.local` på servern.
2. Starta om appen.
3. Lägg följande i `secrets.yaml` i Home Assistant:

```yaml
lagersystem_api_url: "https://hylla.snille.net/api/public/ask"
lagersystem_api_key: "DIN_NYCKEL"
lagersystem_tts_entity: "tts.google_translate_sv"
lagersystem_media_player: "media_player.lager"
```

4. Lägg paketfilen i:

```text
/config/packages/lagersystem.yaml
```

5. Se till att `packages` är aktiverat i `configuration.yaml`:

```yaml
homeassistant:
  packages: !include_dir_named packages
```

6. Starta om Home Assistant.

## Vad paketet gör

Paketet lägger till:

- `script.lagersystem_fraga`
- `input_text.lagersystem_last_query`
- `input_text.lagersystem_last_answer`
- `input_text.lagersystem_last_location`
- `input_text.lagersystem_last_box_id`
- `input_text.lagersystem_last_source`
- `input_text.lagersystem_last_summary`
- `input_text.lagersystem_last_keywords`
- `input_number.lagersystem_last_match_count`
- templatesensorer för svar, plats, box-id, källa, sammanfattning, nyckelord och antal träffar

När scriptet körs:

1. en fråga skickas till `/api/public/ask`
2. svaret sparas i hjälpare
3. svaret läses upp via TTS
4. metadata som `source`, `match_count`, `summary` och `item_keywords` sparas också
5. ett event `lagersystem_result` skickas i Home Assistant

## Exempel: kalla scriptet manuellt

```yaml
action: script.lagersystem_fraga
data:
  query: "Var finns skarvdosorna?"
```

## Exempel: knyta till en knapp i ESPHome

Låt din ESPHome-knapp exponeras i Home Assistant och skapa sedan en automation:

```yaml
alias: Lagersystem - Fråga från knapp
triggers:
  - trigger: state
    entity_id: input_button.lagersystem_fraga
actions:
  - action: script.lagersystem_fraga
    data:
      query: "{{ states('input_text.lagersystem_fraga_text') }}"
mode: restart
```

## Exempel: reagera på resultat-event

Du kan använda eventet för att:

- tända LED
- skicka MQTT
- vrida servo/stegmotor
- visa text på display

Eventet innehåller nu även:

- `source`
- `match_count`
- `summary`
- `item_keywords`
- `raw`

```yaml
alias: Lagersystem - Skicka resultat vidare
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

## Rekommenderat nästa steg

När du vill koppla på fysisk hårdvara skulle jag bygga vidare så här:

1. knapp eller röstinput in i Home Assistant
2. `script.lagersystem_fraga`
3. event `lagersystem_result`
4. automation som skickar plats, `box_id`, `summary` eller `item_keywords` vidare
5. mottagare som ESPHome-display, laserpekare, servo/stegmotor eller högtalare
