# ─────────────────────────────────────────────
#  Chess Analysis – start script (Windows)
# ─────────────────────────────────────────────
# Run with:  powershell -ExecutionPolicy Bypass -File start.ps1

if (-not (Test-Path ".env")) {
  Write-Host "Error: .env file not found. Run install.ps1 first." -ForegroundColor Red
  exit 1
}

# Load .env into current process environment
Get-Content ".env" | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' } | ForEach-Object {
  $parts = $_ -split '=', 2
  $key   = $parts[0].Trim()
  $value = $parts[1].Trim()
  [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
}

# Verify required variables
$missing = @()
foreach ($var in @("DATABASE_URL", "SESSION_SECRET", "OPENAI_API_KEY")) {
  $val = [System.Environment]::GetEnvironmentVariable($var, "Process")
  if (-not $val -or $val -match "replace" -or $val -eq "sk-...") {
    $missing += $var
  }
}
if ($missing.Count -gt 0) {
  Write-Host "Error: Missing required .env values:" -ForegroundColor Red
  $missing | ForEach-Object { Write-Host "  - $_" }
  Write-Host ""
  Write-Host "Edit .env, fill in the values above, then re-run start.ps1"
  exit 1
}

Write-Host ""
Write-Host "  ♟  Starting Chess Analysis..." -ForegroundColor Cyan
Write-Host "  ──────────────────────────────"
Write-Host "  URL: http://localhost:5000"
Write-Host ""

npm run dev
