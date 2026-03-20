#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
#  Chess Analysis – simulate production locally
#
#  What this does:
#    1. Verifies .env exists and required variables are set
#    2. Kills any process already on PORT (default 5001)
#    3. Builds the frontend + bundles the backend (npm run build)
#    4. Starts the server with NODE_ENV=production so that:
#       - Vite dev server is NOT used (serves pre-built static files)
#       - Secure cookies are enabled
#
#  Usage:
#    bash scripts/start-prod-local.sh          # port 5001
#    PORT=3000 bash scripts/start-prod-local.sh
# ─────────────────────────────────────────────────────────────────
set -e

PORT="${PORT:-5001}"

# ── 1. Check .env ────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  echo "Error: .env file not found. Copy .env.example and fill in values."
  exit 1
fi

MISSING=""
for VAR in DATABASE_URL SESSION_SECRET OPENAI_API_KEY; do
  VAL="${!VAR}"
  if [ -z "$VAL" ] || [[ "$VAL" == *"replace"* ]] || [[ "$VAL" == "sk-..." ]]; then
    MISSING="$MISSING\n  - $VAR"
  fi
done
if [ -n "$MISSING" ]; then
  echo -e "\033[0;31mError: Missing required .env values:\033[0m$MISSING"
  exit 1
fi

# ── 2. Kill anything already on PORT ────────────────────────────
echo "[prod] Freeing port $PORT..."
if command -v lsof &>/dev/null; then
  lsof -ti tcp:"$PORT" | xargs -r kill -9 2>/dev/null || true
elif command -v netstat &>/dev/null; then
  # Git Bash / Windows fallback
  PID=$(netstat -ano 2>/dev/null | grep ":$PORT " | awk '{print $5}' | sort -u | grep -v '^0$' | head -1)
  [ -n "$PID" ] && taskkill //PID "$PID" //F 2>/dev/null || true
fi
sleep 1

# ── 3. Build ─────────────────────────────────────────────────────
echo "[prod] Building..."
npm run build

# ── 4. Start ─────────────────────────────────────────────────────
echo ""
echo "  ♟  Starting Chess Analysis in PRODUCTION mode"
echo "  ──────────────────────────────────────────────"
echo "  URL:          http://localhost:$PORT"
echo "  Hot-reload:   OFF (pre-built static files)"
echo ""

NODE_ENV=production PORT="$PORT" node --env-file=.env dist/index.cjs
