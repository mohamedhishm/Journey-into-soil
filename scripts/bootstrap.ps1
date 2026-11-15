# One-shot setup for a fresh clone on Windows PowerShell.
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Green
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..")).Path
Set-Location $RepoRoot

Write-Step "Checking tools"
$Missing = $false

$PythonBin = $null
if (Get-Command "python" -ErrorAction SilentlyContinue) {
    $PythonBin = "python"
} elseif (Get-Command "py" -ErrorAction SilentlyContinue) {
    $PythonBin = "py"
} elseif (Get-Command "python3" -ErrorAction SilentlyContinue) {
    $PythonBin = "python3"
}

if (!$PythonBin) {
    Write-Host "Missing tool: python (install Python 3.11+)" -ForegroundColor Red
    $Missing = $true
}

if (!(Get-Command "node" -ErrorAction SilentlyContinue)) {
    Write-Host "Missing tool: node (install Node 20+)" -ForegroundColor Red
    $Missing = $true
}

if (!(Get-Command "npm" -ErrorAction SilentlyContinue)) {
    Write-Host "Missing tool: npm (comes with Node)" -ForegroundColor Red
    $Missing = $true
}

if (!(Get-Command "docker" -ErrorAction SilentlyContinue)) {
    Write-Host "Note: docker not found (only needed for deployment)." -ForegroundColor Yellow
}

if ($Missing) {
    exit 1
}

$pyVer = & $PythonBin -c "import sys; print(f'{sys.version_info[0]}.{sys.version_info[1]}')"
$nodeVer = & node -v
Write-Host "Python $pyVer, Node $nodeVer"

Write-Step "Creating .env"
$EnvPath = Join-Path $RepoRoot ".env"
$EnvExample = Join-Path $RepoRoot ".env.example"
if (!(Test-Path $EnvPath)) {
    Copy-Item $EnvExample $EnvPath
}

$envContent = Get-Content $EnvPath -Raw -ErrorAction SilentlyContinue
if ((!$envContent) -or ($envContent -notmatch "(?m)^LOCAL_OVERRIDES=1")) {
    $NormalizedRoot = $RepoRoot.Replace('\', '/')
    $overrides = @"

LOCAL_OVERRIDES=1
DATABASE_URL=sqlite:///$NormalizedRoot/data/app.db
KNOWLEDGE_DIR=$NormalizedRoot/knowledge
CONTRACTS_DIR=$NormalizedRoot/contracts
PACKS_DIR=$NormalizedRoot/data/packs
"@
    Add-Content -Path $EnvPath -Value $overrides -Encoding utf8
}

Write-Step "Python venv + API dependencies"
$VenvDir = Join-Path $RepoRoot ".venv"
if (!(Test-Path $VenvDir)) {
    & $PythonBin -m venv $VenvDir
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create python virtual environment at $VenvDir"
        exit 1
    }
}

$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
if (!(Test-Path $VenvPython)) {
    Write-Error "Virtual environment python executable not found at $VenvPython"
    exit 1
}

& $VenvPython -m pip install -q --upgrade pip
& $VenvPython -m pip install -q -r (Join-Path $RepoRoot "api\requirements.txt") -r (Join-Path $RepoRoot "api\requirements-dev.txt")
try {
    & $VenvPython -m pip install -q -r (Join-Path $RepoRoot "pipelines\requirements.txt")
} catch {
    Write-Host "pipelines deps skipped (optional, laptop only)"
}

Write-Step "Generating mock result from the real sim + engine"
& $VenvPython (Join-Path $RepoRoot "scripts\make_mock_result.py")
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to generate mock result."
    exit 1
}

& (Join-Path $RepoRoot "scripts\sync_contract.ps1")
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to sync contracts."
    exit 1
}

Write-Step "API tests"
Push-Location (Join-Path $RepoRoot "api")
try {
    & $VenvPython -m pytest -q
    if ($LASTEXITCODE -ne 0) {
        Write-Error "API tests failed."
        exit 1
    }
} finally {
    Pop-Location
}

Write-Step "Web dependencies + typecheck"
Push-Location (Join-Path $RepoRoot "web")
try {
    & npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install failed in web/"
        exit 1
    }
    & npm run typecheck
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm run typecheck failed in web/"
        exit 1
    }
} finally {
    Pop-Location
}

Write-Step "Done"
Write-Host @"
Next:
  Terminal 1 (FastAPI backend):
    cd api
    ..\.venv\Scripts\Activate.ps1
    uvicorn app.main:app --reload --port 8000
    # docs at http://localhost:8000/docs

  Terminal 2 (Web frontend):
    cd web
    npm run dev
    # http://localhost:5173

  Read AGENTS.md and docs/BOOTSTRAP_PROMPT.md, then pick a task in docs/tasks/BACKLOG.md
  Earthdata: docs/earthdata-setup.md (backlog B2 builds pipelines/earthdata/check_access.py)
"@
