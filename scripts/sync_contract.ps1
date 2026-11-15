# Copies shared contract files into the web app (single source of truth stays in contracts/).
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path

$WebPublic = Join-Path $RepoRoot "web\public"
$WebI18n = Join-Path $RepoRoot "web\src\i18n"
$Contracts = Join-Path $RepoRoot "contracts"

if (!(Test-Path $WebPublic)) {
    New-Item -ItemType Directory -Path $WebPublic -Force | Out-Null
}
if (!(Test-Path $WebI18n)) {
    New-Item -ItemType Directory -Path $WebI18n -Force | Out-Null
}

Copy-Item (Join-Path $Contracts "mock_result.json") (Join-Path $WebPublic "mock_result.json") -Force
Copy-Item (Join-Path $Contracts "i18n\en.json") (Join-Path $WebI18n "engine.en.json") -Force
Copy-Item (Join-Path $Contracts "i18n\ar.json") (Join-Path $WebI18n "engine.ar.json") -Force

Write-Output "contract synced to web/"
