# Chess Analysis

## Overview
An interactive Chess Analysis that lets users play chess on an interactive board, get real-time Stockfish engine evaluation, and receive grandmaster-style explanations and interactive coaching powered by OpenAI GPT-5-mini. Features a variation tree that preserves all explored move lines. Tagline: "LLMs fact checked by Stockfish".

## Architecture
- **Frontend**: React + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js with `/api/analyze` and `/api/chat` endpoints
- **Chess Logic**: chess.js for rules/FEN/PGN, react-chessboard@4.7.2 for the interactive board (React 18 compatible)
- **Client Engine**: Stockfish 18 lite-single WASM (`client/public/stockfish.js` + `client/public/stockfish.wasm`) loaded as a Web Worker with MultiPV 3
- **Server Engine**: Server-side Stockfish via `stockfish` npm package (`server/stockfish-service.ts`), spawned as a child process for LLM tool calling
- **AI**: OpenAI GPT-5.4 via direct OpenAI API (OPENAI_API_KEY secret) with real token streaming, function calling (validate_move + evaluate_position + get_position_features + get_theoria_insights tools), and Stockfish context injection
- **Position Analyzer**: `server/position-analyzer.ts` — Pure TypeScript feature extraction: material balance (Kaufman values), piece mobility, king safety (pawn shield), pawn structure (doubled/isolated/passed). Injected into prompts when Features toggle is ON.
- **Theoria Engine**: `server/theoria-service.ts` — Optional second engine (Theoria 0.2, Stockfish fork with Lc0-trained NNUE). Downloaded on first use to `engines/theoria` (~61 MB). Provides strategic eval text breakdown and LLM tool for positional analysis. Toggled via "Theoria ON/OFF" button.

## Key Files
- `client/src/pages/chess-coach.tsx` - Main chess page with board, controls, variation tree state, import games, chat state management
- `client/src/components/import-games-dialog.tsx` - Import Games dialog: source selector (Chess.com, Lichess, PGN), username fetch flow with game list, PGN paste flow
- `client/src/components/variation-tree.tsx` - Visual tree component showing all move variations as a horizontal tree with connecting lines
- `client/src/components/eval-bar.tsx` - Visual evaluation bar (vertical, left of board)
- `client/src/components/eval-graph.tsx` - SVG evaluation graph showing scores across the active line (below board)
- `client/src/components/engine-lines.tsx` - Top 3 engine move suggestions with per-line scores and explain buttons
- `client/src/components/move-history.tsx` - Move history panel showing the active line's moves
- `client/src/components/coach-console.tsx` - Interactive AI coach chat panel with follow-up questions and interactive move tokens
- `client/src/lib/parse-chess-moves.ts` - SAN move parser for AI text: regex + chess.js validation, groups consecutive legal moves into sequences
- `client/src/hooks/use-stockfish.ts` - Stockfish Web Worker integration hook with `evaluate` and `evaluateAsync` methods
- `client/public/stockfish.js` - Stockfish 18 lite-single WASM engine
- `server/routes.ts` - Backend routes for OpenAI GPT-5.4 analysis and chat with streaming, tool calling (validate_move + evaluate_position + get_position_features)
- `server/position-analyzer.ts` - Position feature extraction service (material, mobility, king safety, pawn structure)
- `server/stockfish-service.ts` - Server-side Stockfish engine service (spawns child process, queued evaluation)
- `server/theoria-service.ts` - Theoria 0.2 engine service (auto-downloads binary, UCI eval + strategic text breakdown)
- `shared/schema.ts` - Shared types and Zod validation schemas (includes EngineLine, ChatMessage types)

## Variation Tree Data Model
Game state uses a tree structure instead of flat arrays:
- **`VariationNode`**: `{ id, move (SAN), fen, score, children: VariationNode[] }` — each node is a position after a move
- **Root node**: starting position (move="", fen=starting FEN), children are first moves
- **`currentPath`**: array of node IDs from root to current position, traces the active branch
- **`getActiveLine(tree, path)`**: returns full line from root through current path, extending via first-children to the deepest descendant
- **Branching**: making a different move from an existing position creates a new child node; the original line remains as a sibling
- **Navigation**: goForward follows first-child of current node; goBack pops from currentPath; clicking a tree node uses `getPathToNode` to find the path
- **Scores**: stored per-node as nullable `{score, mate}` objects; the eval graph receives scores for the active line only

## Interactive Coach Moves
AI coach responses contain interactive chess move tokens:
- **Move parsing**: `parse-chess-moves.ts` scans AI text for SAN moves (supports annotations `!?`, move numbers `1.`, `1...`), validates each against chess.js from the message's stored FEN, and groups consecutive legal moves into sequences. Moves with explicit move-number prefixes (e.g., `11...Nxg4`, `11. Nb3`) that aren't legal from the message FEN use fallback resolution against all game tree positions, filtered by matching move number and turn color
- **Hover**: Hovering any move in a sequence shows gold arrows (`customArrows`) on the board for ALL moves in that sequence, with numbered overlay badges at 40% along each arrow
- **Click**: Clicking a move sequence plays it as a new branch in the variation tree (follows existing nodes first, creates new ones for diverging moves), then evaluates all new positions via Stockfish
- **FEN tracking**: Each chat message stores the board FEN and node ID at send time, so moves remain interactive even after navigating elsewhere
- **Markdown rendering**: Text segments get basic `**bold**` → `<strong>` rendering
- **Streaming guard**: Move parsing only runs on finalized messages (not during token streaming)
- **Re-entry guard**: `coachSequencePending` ref prevents overlapping branch creation from rapid clicks

## Data Flow
1. User makes a move on the board or loads PGN
2. chess.js computes the new FEN
3. FEN is sent to Stockfish Web Worker for evaluation (MultiPV 3)
4. Scores are recorded on the corresponding VariationNode and rendered in the eval graph
5. On PGN load: a linear chain of nodes is built and all positions evaluated sequentially with progress
6. Making a different move at any point creates a branch; both lines are preserved
7. The variation tree component renders below the eval graph when branches exist
8. Engine lines section shows top 3 moves with scores; each has an "explain" button (sparkles icon)
9. AI Coach is always-on chat — input always visible, no "Explain This Position" gate
10. Chat messages persist across moves, navigation, and position changes (only cleared via explicit clear button)
11. All chat goes through `/api/chat` which maintains full conversation history
12. "Verify ON/OFF" toggle controls whether Stockfish deep analysis is injected into the LLM context before generating
13. "Features ON/OFF" toggle controls whether position features (material, mobility, king safety, pawn structure) are injected into the prompt and available as a tool call
14. "Theoria ON/OFF" toggle controls whether Theoria engine's strategic assessment is injected into the prompt and the `get_theoria_insights` tool is available to the LLM

## Server-Side Stockfish Integration
- `server/stockfish-service.ts` spawns the `stockfish` npm package binary (`node_modules/stockfish/bin/stockfish.js`) as a child process using `spawn(process.execPath, [enginePath])`
- Provides `stockfishService.evaluate(fen, depth)` returning `{ score, mate, bestMove, pv, depth }` (White POV)
- Requests are queued — only one evaluation runs at a time; auto-restarts on process crash
- SSE heartbeat (`: heartbeat\n\n` every 15s) keeps the connection alive during long API calls

## OpenAI Function Calling Tools
- **`validate_move`** (always available): LLM calls this to check if a move is legal before suggesting it
  - Uses chess.js server-side — instant (<1ms), no latency impact
  - Returns `{ legal, move, resultingFen }` on success, or `{ legal: false, error, legalMoves[] }` on failure
  - FEN fallback: if the LLM passes a truncated FEN, the server retries with the original request FEN
- **`evaluate_position`** (available when Verify ON): LLM calls this to run Stockfish depth-18 evaluation on any FEN
  - Returns `{ fen, score, mate, scoreDisplay, bestMove (SAN), principalVariation (SAN), depth }`
  - Used by the LLM to verify its own ideas/plans against the engine mid-generation
- **`get_position_features`** (available when Features ON): LLM calls this to compute positional features for any FEN
  - Returns material balance (Kaufman values), piece mobility (trapped/active pieces), king safety (pawn shield), pawn structure (doubled/isolated/passed)
  - Used by the LLM to ground explanations in computed facts rather than hallucinating
- **`get_theoria_insights`** (available when Theoria ON): LLM calls this to get Theoria engine's strategic eval and top lines for any FEN
  - Returns `{ strategicAssessment, theoriaTopLines, depth }` with Theoria's Lc0-trained evaluation breakdown
  - Theoria finds more positionally coherent, "narrative" lines than Stockfish — better for explaining strategic ideas
- Streaming + tool calling loop: up to 15 rounds; model can chain calls (validate → evaluate → features → theoria → ...)
- `getTools(useVerify, useFeatures, useTheoria)` controls which tools are available based on the Verify, Features, and Theoria toggles
- All engine lines and Stockfish PVs are converted from UCI to SAN server-side before injection into the prompt
- Shared `handleToolCall()` dispatcher handles both tools for both `/api/chat` and `/api/analyze` endpoints

## Important Notes
- `evaluateAsync` returns a promise that resolves when `bestmove` is received — used for batch PGN evaluation
- Eval scores from Stockfish are side-to-move relative; normalized to White POV by negating when `turn === 'b'`
- Chat messages persist across moves and navigation; only cleared via the trash button
- react-chessboard must stay at @4.7.2 (v5+ requires React 19)
- "uncaught exception" from Stockfish WASM on HMR/page reconnect is transient — fresh page load clears it
- Eval graph scores are clamped to -5 to +5 range; dots colored by score swing (green/yellow/orange/red)
- Eval graph accepts nullable scores `(EvalScore | null)[]` — unscored nodes are excluded (dense prefix rendering)
- `isNavigatingRef` prevents stale eval scores from overwriting during navigation; resets when new eval starts
- Board max size is 480px (reduced from 640px) to allow space for variation tree

## Database & Authentication
- **PostgreSQL**: Used for user accounts and session storage
- **Schema**: `shared/schema.ts` defines `users` table (id, googleId, email, name, avatarUrl, createdAt) with Drizzle ORM
- **Database connection**: `server/db.ts` (pg Pool + drizzle)
- **Storage**: `server/storage.ts` with `IStorage` interface (findUserByGoogleId, findUserById, upsertUser)
- **Auth**: Google OAuth 2.0 via Passport.js with express-session + connect-pg-simple
- **Auth routes**: GET `/api/auth/google`, GET `/api/auth/google/callback`, GET `/api/auth/me`, POST `/api/auth/logout`
- **Frontend auth**: `client/src/hooks/use-auth.ts` (useAuth hook querying /api/auth/me)
- **Freemium gate**: Anonymous users can load 5 games (tracked in localStorage `chess_games_loaded`); after that a full-screen fixed overlay with blur backdrop appears requiring Google Sign-In. Signed-in users get unlimited access.
- **Secrets**: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET, OPENAI_API_KEY
