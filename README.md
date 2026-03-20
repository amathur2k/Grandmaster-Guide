# ♟ Chess Analysis

**Your personal chess coach** — an AI-powered chess analysis web app with interactive board, multi-engine evaluation, GPT coaching, position analysis, eval graph, variation explorer, game import, and analytics.

> Live at [chessanalysis.co](https://chessanalysis.co)

---

## Features

### Core Analysis
- **Interactive chessboard** — drag-and-drop moves with arrow annotations (react-chessboard v4.7.2)
- **Stockfish 18 engine lines** — top 3 best-move lines with scores, powered by WASM Web Worker (MultiPV 3)
- **Accuracy Check** — classical Stockfish 12 HCE evaluation with 13-term eval breakdown (Material, Imbalance, Pawns, Knights, Bishops, Rooks, Queens, Mobility, King safety, Threats, Passed, Space, Winnable)
- **Position Findings** — 30+ tactical and strategic detectors via Python/python-chess (hanging pieces, forks, pins, outposts, king safety, pawn structure, endgame patterns, Lichess tablebase lookups for ≤5 pieces)
- **Eval graph** — centipawn evaluation across the entire game with color-coded score swings
- **Variation tree** — "What if?" explorer for alternative move lines with full branching

### AI Coach
- **GPT AI Coaching** — contextual chess coaching powered by OpenAI GPT-5.4 with real token streaming
- **Interactive move tokens** — hover to see arrow sequences on the board, click to play as a new branch
- **Function calling** — LLM verifies moves via chess.js, evaluates positions via Stockfish, queries position features and engine insights mid-generation
- **Quick questions** — 6 pre-built coaching prompts: analyze last move, game learnings, last few moves, key plans, weaknesses, opponent's plans
- **Coach feedback** — thumbs up/down rating on each coach response (tracked via Amplitude analytics)
- **Deep Insights** — optional Theoria 0.2 engine (Stockfish fork with Lc0-trained NNUE) for strategic positional understanding

### Game Import
- **Chess.com** — fetch recent games by username
- **Lichess** — fetch recent games by username
- **PGN paste** — load any game from PGN text

### Authentication & Access
- **Google Sign-In** — OAuth 2.0 via Passport.js
- **Freemium gate** — 5 free game imports without sign-in; unlimited after signing in
- **Welcome video** — first/second-time visitors on production see a popup offering a tutorial video

### Analytics
- **Google Analytics 4** — server-side measurement protocol + client-side gtag
- **Amplitude** — dual SDK setup (browser + Node.js) with user identification by email, event tracking for all user interactions, coach feedback, and LLM tool usage

---

## Requirements

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 20 or higher | https://nodejs.org |
| npm | 9 or higher | Bundled with Node.js |
| Python | 3.10 or higher | https://python.org |
| PostgreSQL | 14 or higher | Local or cloud (e.g. Supabase, Neon) |
| OpenAI API key | — | https://platform.openai.com |
| Google OAuth credentials | — | For Sign-in with Google (optional but recommended) |

---

## Quick Start

### macOS / Linux

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/chess-analysis.git
cd chess-analysis

# 2. Run the installer
chmod +x install.sh
./install.sh

# 3. Edit .env (see Environment Variables section below)
nano .env

# 4. Apply the database schema (first time only)
npm run db:push

# 5. Start the app
chmod +x start.sh
./start.sh
```

### Windows

Use **Git Bash** (comes with Git for Windows) for all commands below.

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/chess-analysis.git
cd chess-analysis

# 2. Install dependencies
npm install

# 3. Install Python packages
pip install python-chess requests

# 4. Copy the env template and fill in your values
cp .env.example .env
# Edit .env with your favourite editor, e.g.:
notepad .env

# 5. Apply the database schema (first time only)
npm run db:push

# 6. Start the app
npm run dev
```

Open your browser at **http://localhost:5000**

---

## Environment Variables

Create a `.env` file in the project root (the install script creates a template automatically).

```env
# ── Database ──────────────────────────────────────────────────────────────
# Local PostgreSQL:
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/chess_analysis

# Cloud PostgreSQL (e.g. Neon, Supabase):
# DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# ── Session security ──────────────────────────────────────────────────────
# Generate a random secret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=your_random_64_char_hex_string_here

# ── OpenAI (required for AI coaching) ────────────────────────────────────
OPENAI_API_KEY=sk-...

# ── Google OAuth (required for Sign-in with Google) ──────────────────────
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

# ── Google Analytics GA4 (optional) ──────────────────────────────────────
GA4_MEASUREMENT_ID=G-XXXXXXXXXX
GA4_API_SECRET=your_ga4_api_secret
VITE_GA4_MEASUREMENT_ID=G-XXXXXXXXXX

# ── Amplitude Analytics (optional) ───────────────────────────────────────
AMPLITUDE_API_KEY=your_amplitude_api_key
VITE_AMPLITUDE_API_KEY=your_amplitude_api_key
```

### Getting your OpenAI API key

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **Create new secret key**
3. Copy the key and paste it as `OPENAI_API_KEY` in `.env`

### Setting up Google Sign-In (optional)

1. Go to [https://console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Set application type to **Web application**
6. Add to **Authorised redirect URIs**: `http://localhost:5000/api/auth/google/callback`
7. Copy the **Client ID** and **Client Secret** into `.env`

### Setting up Amplitude Analytics (optional)

1. Go to [https://amplitude.com](https://amplitude.com) and create a project
2. Copy the API key from **Settings → Projects → your project**
3. Set both `AMPLITUDE_API_KEY` and `VITE_AMPLITUDE_API_KEY` in `.env`

---

## Database Setup

The app uses PostgreSQL to store user accounts. Run this once after setting up `.env`:

```bash
npm run db:push
```

This creates the `users` table automatically. No manual SQL needed.

### Using a local PostgreSQL database

**macOS (with Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
createdb chess_analysis
```

**Ubuntu / Debian:**
```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres createdb chess_analysis
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'yourpassword';"
```

**Windows:**
Download and install from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/), then create a database named `chess_analysis` using pgAdmin or the psql shell.

### Using a cloud database

Any PostgreSQL-compatible cloud database works:
- **Neon** (free tier): https://neon.tech
- **Supabase** (free tier): https://supabase.com
- **Railway**: https://railway.app

Just paste the connection string they provide as your `DATABASE_URL`.

---

## Engine Binaries

The app uses two chess engines stored in the `engines/` folder:

### Theoria 0.2 (NNUE position assessment)

| Platform | File | How obtained |
|---|---|---|
| Linux | `engines/theoria` | Included in repo |
| Windows | `engines/theoria.exe` | **Downloaded automatically on first start** (~61 MB) |
| macOS | `engines/theoria` | Downloaded automatically on first start |

No manual action needed — the server downloads the correct binary for your platform at startup.

### Stockfish 12 (classical evaluation — Accuracy Check feature)

The repository includes the **Linux x86-64** binary (`engines/stockfish12`) used on the production server.

**Windows — compile from source (no admin required):**

The server will attempt to build `engines/stockfish12.exe` automatically on first start by running `scripts/build-sf12-windows.sh`. You can also run it manually:

```bash
bash scripts/build-sf12-windows.sh
```

What the script does:
1. Downloads a portable **MinGW-w64 GCC 15.2** toolchain (~167 MB) to your system temp folder — no installation, no admin rights needed
2. Downloads the Stockfish 12 source code (~220 KB) from GitHub
3. Compiles with `mingw32-make ARCH=x86-64 COMP=mingw` (1–3 minutes)
4. Places the finished binary at `engines/stockfish12.exe`

The MinGW toolchain is cached in `%TEMP%\mingw_portable` so re-runs after the first are fast.

**macOS:**
1. Download from the [SF12 GitHub release](https://github.com/official-stockfish/Stockfish/releases/tag/sf_12)
2. Extract and rename to `engines/stockfish12`
3. Make it executable:
   ```bash
   chmod +x engines/stockfish12
   xattr -d com.apple.quarantine engines/stockfish12
   ```

> The Accuracy Check panel shows "Unavailable" if the binary is absent. All other features continue to work normally.

---

## Architecture

```
chess-analysis/
├── client/          # React frontend (Vite)
│   └── src/
│       ├── pages/   # chess-coach.tsx (main app), static pages
│       ├── components/
│       │   ├── coach-console.tsx    # AI coach chat with feedback
│       │   ├── eval-bar.tsx         # Vertical eval bar
│       │   ├── eval-graph.tsx       # SVG eval graph
│       │   ├── engine-lines.tsx     # Top 3 engine lines
│       │   ├── move-history.tsx     # Move history panel
│       │   ├── variation-tree.tsx   # Branching variation tree
│       │   ├── position-findings.tsx # Tactical/strategic findings
│       │   └── import-games-dialog.tsx # Game import modal
│       ├── hooks/
│       │   ├── use-stockfish.ts     # Stockfish WASM integration
│       │   └── use-auth.ts          # Google OAuth hook
│       └── lib/
│           ├── analytics.ts         # GA4 + Amplitude dual tracking
│           ├── parse-chess-moves.ts  # SAN move parser for AI text
│           └── queryClient.ts       # TanStack Query client
├── server/          # Express backend
│   ├── index.ts     # Server entry, Passport config
│   ├── routes.ts    # API endpoints + OpenAI + tool calling
│   ├── amplitude.ts # Amplitude server-side SDK
│   ├── analytics.ts # GA4 server-side measurement protocol
│   ├── classical-stockfish-service.ts # SF12 classical HCE (Accuracy Check)
│   ├── theoria-service.ts           # Theoria 0.2 NNUE (strategic assessment)
│   ├── python-analyzer-service.ts   # Python subprocess manager
│   ├── position_analyzer.py         # Python position analysis (30+ detectors)
│   ├── coach-logger.ts              # Coach.log debug logger
│   ├── storage.ts   # Database operations
│   └── db.ts        # PostgreSQL connection
├── shared/
│   └── schema.ts    # Drizzle ORM schema + shared types
├── engines/
│   ├── stockfish12     # SF12 classical HCE (Linux binary, production)
│   ├── stockfish12.exe # SF12 classical HCE (Windows — not in repo, place manually)
│   ├── theoria         # Theoria 0.2 NNUE (Linux binary, included)
│   └── theoria.exe     # Theoria 0.2 NNUE (Windows, auto-downloaded on first start)
└── migrations/      # Auto-generated DB migrations
```

**Services started by `npm run dev`:**
| Service | Description |
|---|---|
| Express server | API backend on port 5000 |
| Vite dev server | React frontend (proxied through Express) |
| Python analyzer | `position_analyzer.py` spawned as subprocess |
| Stockfish 18 | WASM-based, runs in browser via Web Worker |
| Stockfish 12 | Native binary subprocess for classical eval (Linux/macOS; manual install on Windows) |
| Theoria 0.2 | Native binary subprocess — auto-downloaded for your platform on first start |

---

## Running in Development

```bash
npm run dev
```

All services (Express, Vite, Python analyzer, engines) start together.
The app is available at **http://localhost:5000**.

Hot-reload is enabled — changes to frontend or backend files restart automatically.

---

## Building for Production

```bash
# Build the frontend and bundle the backend
npm run build

# Start the production server (loads .env, sets NODE_ENV=production)
npm start
```

The production build outputs to `dist/`. The server runs on port 5000 (or the value of the `PORT` environment variable).

> **Important:** always start the production server via `npm start` (not `node dist/index.cjs` directly). The npm script sets `NODE_ENV=production` and loads `.env` via `--env-file`.

---

## Simulating Production Locally

Use the dedicated script to replicate a production launch on your local machine:

```bash
# Default port 5001
bash scripts/start-prod-local.sh

# Custom port
PORT=3000 bash scripts/start-prod-local.sh
```

The script does the following in order:

1. **Validates `.env`** — exits if required variables are missing
2. **Frees the port** — kills any process already listening on `PORT`
3. **Builds** — runs `npm run build` (frontend + backend bundle)
4. **Starts with `NODE_ENV=production`** — enables secure cookies and pre-built static file serving (no Vite dev server)

---

## Static Pages

The app includes several SEO-optimized static pages:

| Page | Path | Description |
|---|---|---|
| Free Chess Game Review | `/free-chess-game-review` | Landing page with tutorial video |
| About Us | `/about` | Company and product information |
| Privacy Policy | `/privacy` | Privacy policy |
| Terms of Use | `/terms` | Terms of service |
| Contact Us | `/contact` | Contact information |
| Credits | `/credits` | Open-source attributions |

---

## Troubleshooting

### "Accuracy Check Module Down" error
The Stockfish 12 binary is missing or wrong platform.
- **Windows:** Run `bash scripts/build-sf12-windows.sh` (or let the server build it automatically on next start). Requires Git Bash and internet access; no admin rights needed.
- **macOS/Linux:** See [Engine Binaries](#engine-binaries) above for the download link.

### "Cannot connect to database"
- Check `DATABASE_URL` in `.env` is correct
- Make sure PostgreSQL is running
- Run `npm run db:push` if the schema hasn't been applied yet

### Python analyzer not starting
- Make sure Python 3.10+ is installed
- **macOS / Linux:** Python must be on your `PATH` as `python3` — run `python3 --version` to confirm
- **Windows:** The server looks for Python at `C:\Python313\python.exe`. If you installed Python elsewhere, update the path in `server/python-analyzer-service.ts`
- Install required packages: `pip install python-chess requests`
- Check the terminal output for Python errors on startup

### Google Sign-In not working
- Make sure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- Verify the redirect URI `http://localhost:5000/api/auth/google/callback` is added in Google Cloud Console
- For production, add your production domain's callback URL too

### Port 5000 already in use
Set `PORT=3000` (or any free port) in your `.env` file.

### `npm run dev` fails with "NODE_ENV is not recognized"
Make sure you are using **Git Bash** (not PowerShell or CMD). The `cross-env` package in the dev script handles this, but requires bash-style execution.

### Theoria engine not starting on Windows
The server auto-downloads `engines/theoria.exe` (~61 MB) on first start. If the download fails, delete the partial file at `engines/theoria.exe` and restart — it will retry.

---

## License

MIT
