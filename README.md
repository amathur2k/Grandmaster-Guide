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

```powershell
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/chess-analysis.git
cd chess-analysis

# 2. Run the installer (in PowerShell as Administrator)
powershell -ExecutionPolicy Bypass -File install.ps1

# 3. Edit .env (see Environment Variables section below)
notepad .env

# 4. Apply the database schema (first time only)
npm run db:push

# 5. Start the app
powershell -ExecutionPolicy Bypass -File start.ps1
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

### Stockfish 12 (classical evaluation — Accuracy Check feature)

The repository includes a **Linux x86-64** binary (`engines/stockfish12`).

**macOS:**
1. Download the macOS build from [https://github.com/official-stockfish/Stockfish/releases/tag/sf_12](https://github.com/official-stockfish/Stockfish/releases/tag/sf_12)
2. Extract and rename the binary to `engines/stockfish12`
3. Make it executable and remove quarantine:
   ```bash
   chmod +x engines/stockfish12
   xattr -d com.apple.quarantine engines/stockfish12
   ```

**Windows:**
1. Download the Windows build from [https://github.com/official-stockfish/Stockfish/releases/tag/sf_12](https://github.com/official-stockfish/Stockfish/releases/tag/sf_12)
2. Extract the `.exe` file and place it at `engines\stockfish12.exe`

> **Note:** The Accuracy Check feature will show "Unavailable" if the binary is missing. All other features (AI coaching, engine lines, position analysis, eval graph) work without it.

### Theoria 0.2 (Deep Insights — optional)

The Theoria engine binary is **downloaded automatically** the first time you enable "Deep Insights ON" in the app (~61 MB). No manual setup needed.

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
│   ├── stockfish-service.ts         # Server-side Stockfish (npm)
│   ├── classical-stockfish-service.ts # SF12 classical HCE
│   ├── theoria-service.ts           # Theoria 0.2 deep insights
│   ├── python-analyzer-service.ts   # Python subprocess manager
│   ├── position_analyzer.py         # Python position analysis (30+ detectors)
│   ├── coach-logger.ts              # Coach.log debug logger
│   ├── storage.ts   # Database operations
│   └── db.ts        # PostgreSQL connection
├── shared/
│   └── schema.ts    # Drizzle ORM schema + shared types
├── engines/
│   ├── stockfish12  # Classical HCE engine (Linux binary)
│   └── theoria      # Deep insights engine (auto-downloaded)
└── migrations/      # Auto-generated DB migrations
```

**Services started by `npm run dev`:**
| Service | Description |
|---|---|
| Express server | API backend on port 5000 |
| Vite dev server | React frontend (proxied through Express) |
| Python analyzer | `position_analyzer.py` spawned as subprocess |
| Stockfish 18 | WASM-based, runs in browser via Web Worker |
| Stockfish 12 | Native binary subprocess for classical eval |
| Theoria | Native binary subprocess (auto-downloaded on demand) |

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

# Start the production server
npm start
```

The production build outputs to `dist/`. The server runs on port 5000 (or the value of the `PORT` environment variable).

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
The Stockfish 12 binary is missing, not executable, or wrong platform. See [Engine Binaries](#engine-binaries) above.

### "Cannot connect to database"
- Check `DATABASE_URL` in `.env` is correct
- Make sure PostgreSQL is running
- Run `npm run db:push` if the schema hasn't been applied yet

### Python analyzer not starting
- Make sure Python 3.10+ is installed and in your PATH
- Run `pip3 install python-chess`
- Check the terminal output for Python errors on startup

### Google Sign-In not working
- Make sure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- Verify the redirect URI `http://localhost:5000/api/auth/google/callback` is added in Google Cloud Console
- For production, add your production domain's callback URL too

### Port 5000 already in use
Set a different port:
```bash
PORT=3000 npm run dev   # macOS / Linux
```
Or on Windows: set `PORT=3000` in `.env`

---

## License

MIT
