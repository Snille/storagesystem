$ErrorActionPreference = "Stop"

$nvmHome = Join-Path $env:LOCALAPPDATA "nvm"
$nvmExe = Join-Path $nvmHome "nvm.exe"
$nvmSymlink = "C:\nvm4w\nodejs"
$nodeVersion = "22.14.0"
$nodeInstallDir = Join-Path $nvmHome "v$nodeVersion"

if (-not (Test-Path $nvmExe)) {
  throw "nvm hittades inte på $nvmExe. Installera NVM for Windows först."
}

$env:NVM_HOME = $nvmHome
$env:NVM_SYMLINK = $nvmSymlink
$env:Path = "$nvmSymlink;$nvmHome;$env:Path"

$installedVersions = & $nvmExe list
if ($installedVersions -notmatch [regex]::Escape($nodeVersion)) {
  Write-Host "Installerar Node $nodeVersion via nvm..." -ForegroundColor Cyan
  & $nvmExe install $nodeVersion
}

$nodeExe = Join-Path $nodeInstallDir "node.exe"
$npmCmd = Join-Path $nodeInstallDir "npm.cmd"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Aktiverar Node $nodeVersion..." -ForegroundColor Cyan
  & $nvmExe use $nodeVersion
}
else {
  $currentNodeVersion = (& node -v).TrimStart("v")
  if ($currentNodeVersion -ne $nodeVersion) {
    Write-Host "Aktiverar Node $nodeVersion..." -ForegroundColor Cyan
    & $nvmExe use $nodeVersion
  }
}

if (-not (Test-Path $nodeExe)) {
  throw "node.exe hittades inte på $nodeExe."
}

if (-not (Test-Path $npmCmd)) {
  throw "npm.cmd hittades inte på $npmCmd."
}

Write-Host "Node version:" -ForegroundColor DarkGray
& $nodeExe -v
Write-Host "npm version:" -ForegroundColor DarkGray
& $npmCmd -v

if (-not (Test-Path (Join-Path $PSScriptRoot "..\node_modules"))) {
  Write-Host "Installerar projektberoenden..." -ForegroundColor Cyan
  Push-Location (Join-Path $PSScriptRoot "..")
  try {
    & $npmCmd install
  }
  finally {
    Pop-Location
  }
}

Write-Host "Startar lokal utvecklingsserver på http://localhost:3000 ..." -ForegroundColor Green
Push-Location (Join-Path $PSScriptRoot "..")
try {
  & $npmCmd run dev
}
finally {
  Pop-Location
}
