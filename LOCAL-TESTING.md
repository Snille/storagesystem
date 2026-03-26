# Lokal Testning

Den här appen kan köras lokalt i utvecklingsläge på Windows via PowerShell-scriptet:

```powershell
.\scripts\start-local.ps1
```

## Vad scriptet gör

`start-local.ps1`:

- kräver `NVM for Windows`
- säkerställer att Node `22.14.0` finns installerad
- aktiverar den versionen via `nvm use`
- kör `npm install` om `node_modules` saknas
- startar utvecklingsservern med `npm run dev`

När allt är igång nås appen normalt på:

```text
http://localhost:3000
```

## Förutsättningar

Du bör ha:

- `NVM for Windows` installerat
- PowerShell
- en lokal `.env.local` om du vill att integrationer som Immich, AI eller publikt API ska fungera fullt ut

Du kan utgå från:

```text
.env.example
```

och skapa:

```text
.env.local
```

## Normal användning

1. Öppna PowerShell i projektroten.
2. Kör:

```powershell
.\scripts\start-local.ps1
```

3. Vänta tills Next.js har startat klart.
4. Öppna `http://localhost:3000`.

## Stoppa servern

Tryck:

```text
Ctrl+C
```

i PowerShell-fönstret där servern körs.

## Bra att veta

- Scriptet kör appen i utvecklingsläge, inte som produktionsbuild.
- Lokala ändringar i kod och CSS laddas normalt om automatiskt.
- Om något ser konstigt ut i webbläsaren kan en hård omladdning hjälpa.

## Vanliga problem

### `nvm hittades inte`

Installera `NVM for Windows` först. Scriptet kräver att `nvm.exe` finns lokalt.

### Fel Node-version

Scriptet försöker själv installera och växla till rätt version:

```text
22.14.0
```

### Sidan startar men vissa funktioner fungerar inte

Det beror oftast på att `.env.local` saknar värden för till exempel:

- `IMMICH_BASE_URL`
- `IMMICH_API_KEY` eller `IMMICH_SHARE_KEY`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- AI-inställningar som `OPENAI_API_KEY` eller `LMSTUDIO_BASE_URL`

### Port 3000 används redan

Stäng den andra processen som använder porten, eller starta om terminalen och försök igen.

## Rekommendation

För snabb UI-testning är `.\scripts\start-local.ps1` rätt sätt att köra projektet lokalt.
För verifiering i riktig miljö används i stället serverdeployen till `/opt/hyllsystem`.
