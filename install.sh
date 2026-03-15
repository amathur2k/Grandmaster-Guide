#!/usr/bin/env bash
# ─────────────────────────────────────────────
#  Chess Analysis – installer (macOS / Linux)
# ─────────────────────────────────────────────
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✔ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✘ $1${NC}"; exit 1; }

echo ""
echo "  ♟  Chess Analysis – Installation"
echo "  ─────────────────────────────────"
echo ""

# ── Detect OS ──────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS" in
  Darwin) PLATFORM="macos" ;;
  Linux)  PLATFORM="linux" ;;
  *)      fail "Unsupported OS: $OS. Use install.ps1 on Windows." ;;
esac
ok "Platform detected: $PLATFORM ($ARCH)"

# ── Node.js (≥ 20) ─────────────────────────
if command -v node &>/dev/null; then
  NODE_VER=$(node -e "process.exit(+process.version.slice(1).split('.')[0] < 20 ? 1 : 0)" 2>/dev/null && echo ok || echo old)
  if [ "$NODE_VER" = "old" ]; then
    fail "Node.js ≥ 20 required. Visit https://nodejs.org to upgrade."
  fi
  ok "Node.js $(node --version)"
else
  fail "Node.js not found. Install Node.js 20+ from https://nodejs.org then re-run this script."
fi

# ── Python 3 ───────────────────────────────
if command -v python3 &>/dev/null; then
  ok "Python $(python3 --version)"
else
  fail "Python 3 not found. Install from https://python.org then re-run this script."
fi

# ── python-chess ───────────────────────────
if python3 -c "import chess" &>/dev/null; then
  ok "python-chess already installed"
else
  echo "Installing python-chess..."
  pip3 install python-chess || pip install python-chess || \
    fail "Could not install python-chess. Run: pip3 install python-chess"
  ok "python-chess installed"
fi

# ── PostgreSQL ─────────────────────────────
if command -v psql &>/dev/null; then
  ok "PostgreSQL $(psql --version | awk '{print $3}')"
else
  warn "psql not found in PATH."
  if [ "$PLATFORM" = "macos" ]; then
    echo "  → Install with: brew install postgresql@16 && brew services start postgresql@16"
  else
    echo "  → Install with: sudo apt install postgresql postgresql-contrib && sudo systemctl start postgresql"
  fi
  echo ""
  read -p "  Continue anyway? (you can set DATABASE_URL to an external DB) [y/N]: " yn
  [[ "$yn" =~ ^[Yy]$ ]] || exit 1
fi

# ── npm install ────────────────────────────
echo ""
echo "Installing Node.js dependencies..."
npm install
ok "npm dependencies installed"

# ── Stockfish 12 binary ────────────────────
echo ""
SF_BIN="engines/stockfish12"
if [ -f "$SF_BIN" ] && [ -x "$SF_BIN" ]; then
  ok "Stockfish 12 binary present"
else
  if [ "$PLATFORM" = "linux" ]; then
    warn "engines/stockfish12 missing. Downloading Linux x86-64 binary..."
    mkdir -p engines
    curl -L "https://github.com/official-stockfish/Stockfish/releases/download/sf_12/stockfish_20_linux_x64.zip" \
      -o /tmp/sf12.zip 2>/dev/null || \
    curl -L "https://www.dropbox.com/s/stockfish12-linux" -o /tmp/sf12.zip 2>/dev/null || true
    # Fallback instructions
    echo ""
    warn "Auto-download unavailable. Please download Stockfish 12 manually:"
    echo "  1. Go to https://github.com/official-stockfish/Stockfish/releases/tag/sf_12"
    echo "  2. Download the Linux x86-64 build"
    echo "  3. Extract and rename the binary to: engines/stockfish12"
    echo "  4. Run: chmod +x engines/stockfish12"
    echo ""
    echo "  The Accuracy Check feature will be disabled until this is done."
  elif [ "$PLATFORM" = "macos" ]; then
    echo ""
    warn "The included Stockfish 12 binary is for Linux only."
    echo "  To enable the Accuracy Check feature on macOS:"
    echo "  1. Go to https://github.com/official-stockfish/Stockfish/releases/tag/sf_12"
    echo "  2. Download the macOS build"
    echo "  3. Extract and rename the binary to: engines/stockfish12"
    echo "  4. Run: chmod +x engines/stockfish12 && xattr -d com.apple.quarantine engines/stockfish12"
    echo ""
    echo "  The Accuracy Check feature will be disabled until this is done."
    echo "  All other features (AI coaching, engine lines, board analysis) work without it."
  fi
fi

# ── .env file ──────────────────────────────
echo ""
if [ -f ".env" ]; then
  ok ".env already exists – skipping"
else
  echo "Creating .env template..."
  cat > .env << 'ENVEOF'
# ── Database ─────────────────────────────────────────────────────────────
# Local PostgreSQL example:
DATABASE_URL=postgresql://postgres:password@localhost:5432/chess_analysis

# ── Session ──────────────────────────────────────────────────────────────
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=replace_with_a_random_64_char_hex_string

# ── OpenAI ───────────────────────────────────────────────────────────────
OPENAI_API_KEY=sk-...

# ── Google OAuth (for Sign-in with Google) ───────────────────────────────
# Get credentials at https://console.cloud.google.com → APIs & Services → Credentials
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ── Google Analytics GA4 (optional) ─────────────────────────────────────
GA4_MEASUREMENT_ID=
GA4_API_SECRET=
VITE_GA4_MEASUREMENT_ID=
ENVEOF
  ok ".env template created – fill in your values before running the app"
fi

# ── Database schema ────────────────────────
echo ""
if grep -q "^DATABASE_URL=postgresql" .env 2>/dev/null && \
   ! grep -q "^DATABASE_URL=postgresql://postgres:password" .env 2>/dev/null; then
  echo "Pushing database schema..."
  npm run db:push && ok "Database schema applied" || warn "db:push failed – check DATABASE_URL in .env"
else
  warn "Skipping db:push – update DATABASE_URL in .env first, then run: npm run db:push"
fi

echo ""
echo -e "${GREEN}  ✔ Installation complete!${NC}"
echo ""
echo "  Next steps:"
echo "   1. Edit .env and fill in all required values"
echo "   2. Run: npm run db:push   (first time only)"
echo "   3. Run: ./start.sh        (to launch the app)"
echo ""
