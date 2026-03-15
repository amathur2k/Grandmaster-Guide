#!/usr/bin/env bash
# ─────────────────────────────────────────────
#  Chess Analysis – start script (macOS / Linux)
# ─────────────────────────────────────────────
set -e

# Load .env variables into the environment
if [ -f ".env" ]; then
  export $(grep -v '^#' .env | grep -v '^$' | xargs)
else
  echo "Error: .env file not found. Run ./install.sh first."
  exit 1
fi

# Verify required variables
MISSING=""
for VAR in DATABASE_URL SESSION_SECRET OPENAI_API_KEY; do
  if [ -z "${!VAR}" ] || [[ "${!VAR}" == *"replace"* ]] || [[ "${!VAR}" == "sk-..." ]]; then
    MISSING="$MISSING\n  - $VAR"
  fi
done
if [ -n "$MISSING" ]; then
  echo -e "\033[0;31mError: Missing required .env values:\033[0m $MISSING"
  echo ""
  echo "Edit .env and fill in the values above, then re-run ./start.sh"
  exit 1
fi

echo ""
echo "  ♟  Starting Chess Analysis..."
echo "  ──────────────────────────────"
echo "  URL: http://localhost:5000"
echo ""

npm run dev
