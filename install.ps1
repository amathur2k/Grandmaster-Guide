# ─────────────────────────────────────────────
#  Chess Analysis – installer (Windows)
# ─────────────────────────────────────────────
# Run with:  powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = "Stop"

function ok   { Write-Host "  [OK] $args" -ForegroundColor Green  }
function warn { Write-Host "  [!!] $args" -ForegroundColor Yellow }
function fail { Write-Host "  [X]  $args" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  ♟  Chess Analysis - Installation (Windows)" -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────────────────"
Write-Host ""

# ── Node.js (≥ 20) ─────────────────────────
try {
  $nodeVer = (node --version 2>&1)
  $nodeMajor = [int]($nodeVer -replace 'v(\d+)\..*','$1')
  if ($nodeMajor -lt 20) {
    fail "Node.js >= 20 required (found $nodeVer). Download from https://nodejs.org"
  }
  ok "Node.js $nodeVer"
} catch {
  fail "Node.js not found. Install Node.js 20+ from https://nodejs.org"
}

# ── Python 3 ───────────────────────────────
$pythonCmd = $null
foreach ($cmd in @("python", "python3")) {
  try {
    $ver = & $cmd --version 2>&1
    if ($ver -match "Python 3") { $pythonCmd = $cmd; break }
  } catch {}
}
if (-not $pythonCmd) {
  fail "Python 3 not found. Install from https://python.org (tick 'Add to PATH')"
}
ok "Python found ($pythonCmd)"

# ── python-chess ───────────────────────────
$chessOk = & $pythonCmd -c "import chess; print('ok')" 2>&1
if ($chessOk -ne "ok") {
  Write-Host "  Installing python-chess..."
  & $pythonCmd -m pip install python-chess
  ok "python-chess installed"
} else {
  ok "python-chess already installed"
}

# ── PostgreSQL ─────────────────────────────
try {
  $pgVer = (psql --version 2>&1)
  ok "PostgreSQL: $pgVer"
} catch {
  warn "psql not found in PATH."
  Write-Host "  --> Download from https://www.postgresql.org/download/windows/"
  Write-Host "  --> Or set DATABASE_URL to a remote/cloud PostgreSQL instance."
  Write-Host ""
  $yn = Read-Host "  Continue anyway? [y/N]"
  if ($yn -notmatch '^[Yy]$') { exit 1 }
}

# ── npm install ────────────────────────────
Write-Host ""
Write-Host "  Installing Node.js dependencies..."
npm install
ok "npm dependencies installed"

# ── Stockfish 12 binary ────────────────────
Write-Host ""
$sfBin = "engines\stockfish12.exe"
if (Test-Path $sfBin) {
  ok "Stockfish 12 binary present"
} else {
  warn "engines\stockfish12.exe not found."
  Write-Host ""
  Write-Host "  The included Stockfish 12 binary is for Linux only." -ForegroundColor Yellow
  Write-Host "  To enable the Accuracy Check feature on Windows:"
  Write-Host "   1. Go to https://github.com/official-stockfish/Stockfish/releases/tag/sf_12"
  Write-Host "   2. Download the Windows build (stockfish_12_win.zip)"
  Write-Host "   3. Extract stockfish_20_64bit.exe and place it at: engines\stockfish12.exe"
  Write-Host ""
  Write-Host "  All other features work without it."
}

# ── .env file ──────────────────────────────
Write-Host ""
if (Test-Path ".env") {
  ok ".env already exists - skipping"
} else {
  Write-Host "  Creating .env template..."
  @"
# ── Database ─────────────────────────────────────────────────────────────
# Local PostgreSQL example:
DATABASE_URL=postgresql://postgres:password@localhost:5432/chess_analysis

# ── Session ──────────────────────────────────────────────────────────────
# Generate a random string (e.g. run in Node: require('crypto').randomBytes(32).toString('hex'))
SESSION_SECRET=replace_with_a_random_64_char_hex_string

# ── OpenAI ───────────────────────────────────────────────────────────────
OPENAI_API_KEY=sk-...

# ── Google OAuth (for Sign-in with Google) ───────────────────────────────
# Get credentials at https://console.cloud.google.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ── Google Analytics GA4 (optional) ─────────────────────────────────────
GA4_MEASUREMENT_ID=
GA4_API_SECRET=
VITE_GA4_MEASUREMENT_ID=
"@ | Set-Content ".env" -Encoding UTF8
  ok ".env template created - fill in your values before running"
}

Write-Host ""
Write-Host "  ✔ Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:"
Write-Host "   1. Edit .env and fill in all required values"
Write-Host "   2. Run:  npm run db:push        (first time only)"
Write-Host "   3. Run:  .\start.ps1            (to launch the app)"
Write-Host ""
