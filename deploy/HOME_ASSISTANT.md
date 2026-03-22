# Home Assistant-integration

Den här appen har ett publikt REST-API som passar bra för Home Assistant.

## Filer

- paket: [home-assistant-package.yaml](/c:/Users/eripet/Coding/Hyllsystem/deploy/home-assistant-package.yaml)
- systemd-tjänst för appen: [hyllsystem.service](/c:/Users/eripet/Coding/Hyllsystem/deploy/hyllsystem.service)

## Förberedelser

1. Sätt `HYLLSYSTEM_API_KEY` i appens `.env.local` på servern.
2. Starta om appen.
3. Lägg följande i `secrets.yaml` i Home Assistant:

```yaml
hyllsystem_api_url: "https://hylla.snille.net/api/public/ask"
hyllsystem_api_key: "DIN_NYCKEL"
hyllsystem_tts_entity: "tts.google_translate_sv"
hyllsystem_media_player: "media_player.verkstad"
```

4. Lägg paketfilen i:

```text
/config/packages/hyllsystem.yaml
```

5. Se till att `packages` är aktiverat i `configuration.yaml`:

```yaml
homeassistant:
  packages: !include_dir_named packages
```

6. Starta om Home Assistant.

## Vad paketet gör

Paketet lägger till:

- `script.hyllsystem_fraga_verkstan`
- `input_text.hyllsystem_last_query`
- `input_text.hyllsystem_last_answer`
- `input_text.hyllsystem_last_location`
- två enkla templatesensorer för senaste svar/plats

När scriptet körs:

1. en fråga skickas till `/api/public/ask`
2. svaret sparas i hjälpare
3. svaret läses upp via TTS
4. ett event `hyllsystem_result` skickas i Home Assistant

## Exempel: kalla scriptet manuellt

```yaml
action: script.hyllsystem_fraga_verkstan
data:
  query: "Var finns skarvdosorna?"
```

## Exempel: knyta till en knapp i ESPHome

Låt din ESPHome-knapp exponeras i Home Assistant och skapa sedan en automation:

```yaml
alias: Hyllsystem - Fråga från verkstadsknapp
triggers:
  - trigger: state
    entity_id: input_button.verkstad_fraga
actions:
  - action: script.hyllsystem_fraga_verkstan
    data:
      query: "{{ states('input_text.verkstad_fraga_text') }}"
mode: restart
```

## Exempel: reagera på resultat-event

Du kan använda eventet för att:

- tända LED
- skicka MQTT
- vrida servo/stegmotor
- visa text på display

```yaml
alias: Hyllsystem - Skicka resultat vidare
triggers:
  - trigger: event
    event_type: hyllsystem_result
actions:
  - action: mqtt.publish
    data:
      topic: verkstad/hyllsystem/result
      payload: >-
        {{ trigger.event.data | to_json }}
mode: queued
```

## Rekommenderat nästa steg

När du vill koppla på fysisk hårdvara skulle jag bygga vidare så här:

1. knapp eller röstinput in i Home Assistant
2. `script.hyllsystem_fraga_verkstan`
3. event `hyllsystem_result`
4. automation som skickar plats eller `box_id` till:
   - ESPHome-display
   - laserpekare
   - servo/stegmotor
   - högtalare
