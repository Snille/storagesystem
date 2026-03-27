# Local Testing

This app can be run locally in development mode on Windows through the PowerShell script:

```powershell
.\scripts\start-local.ps1
```

## What The Script Does

`start-local.ps1`:

- requires `NVM for Windows`
- ensures that Node `22.14.0` is installed
- activates that version through `nvm use`
- runs `npm install` if `node_modules` is missing
- starts the development server with `npm run dev`

When everything is running, the app is normally available at:

```text
http://localhost:3000
```

## Requirements

You should have:

- `NVM for Windows` installed
- PowerShell
- a local `.env.local` if you want integrations such as Immich, AI, or the public API to work fully

You can start from:

```text
.env.example
```

and create:

```text
.env.local
```

## Normal Usage

1. Open PowerShell in the project root.
2. Run:

```powershell
.\scripts\start-local.ps1
```

3. Wait until Next.js has fully started.
4. Open `http://localhost:3000`.

## Stopping The Server

Press:

```text
Ctrl+C
```

in the PowerShell window where the server is running.

## Good To Know

- The script runs the app in development mode, not as a production build.
- Local code and CSS changes normally reload automatically.
- If something looks odd in the browser, a hard reload may help.

## Common Problems

### `nvm` Was Not Found

Install `NVM for Windows` first. The script expects `nvm.exe` to be available locally.

### Wrong Node Version

The script will try to install and switch to the correct version automatically:

```text
22.14.0
```

### The Page Starts But Some Features Do Not Work

That is usually because `.env.local` is missing values such as:

- `IMMICH_BASE_URL`
- `IMMICH_API_KEY` or `IMMICH_SHARE_KEY`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- AI settings such as `OPENAI_API_KEY` or `LMSTUDIO_BASE_URL`

### Port 3000 Is Already In Use

Stop the other process using the port, or restart the terminal and try again.

## Recommendation

For quick UI testing, `.\scripts\start-local.ps1` is the right way to run the project locally.
For verification in the real environment, use the server deployment to `/opt/lagersystem` instead.
