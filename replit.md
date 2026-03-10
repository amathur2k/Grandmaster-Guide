# Chess Analyzer

## Overview
An interactive Chess Analyzer that lets users play chess on an interactive board, get real-time Stockfish engine evaluation, and receive grandmaster-style explanations and interactive coaching powered by OpenAI GPT-5-nano. Features a variation tree that preserves all explored move lines. Tagline: "LLMs fact checked by Stockfish".

## Architecture
- **Frontend**: React + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js with `/api/analyze` and `/api/chat` endpoints
- **Chess Logic**: chess.js for rules/FEN/PGN, react-chessboard@4.7.2 for the interactive board (React 18 compatible)
- **Client Engine**: Stockfish 18 lite-single WASM (`client/public/stockfish.js` + `client/public/stockfish.wasm`) loaded as a Web Worker with MultiPV 3
- **Server Engine**: Server-side Stockfish via `stockfish` npm package (`server/stockfish-service.ts`), spawned as a child process for LLM tool calling
- **AI**: OpenAI GPT-5-nano via Replit AI Integrations (no API key needed, billed to Replit credits) with Stockfish tool calling

## Key Files
- `client/src/pages/chess-coach.tsx` - Main chess page with board, controls, variation tree state, PGN input, chat state management
- `client/src/components/variation-tree.tsx` - Visual tree component showing all move variations as a horizontal tree with connecting lines
- `client/src/components/eval-bar.tsx` - Visual evaluation bar (vertical, left of board)
- `client/src/components/eval-graph.tsx` - SVG evaluation graph showing scores across the active line (below board)
- `client/src/components/engine-lines.tsx` - Top 3 engine move suggestions with per-line scores and explain buttons
- `client/src/components/move-history.tsx` - Move history panel showing the active line's moves
- `client/src/components/coach-console.tsx` - Interactive AI coach chat panel with follow-up questions
- `client/src/hooks/use-stockfish.ts` - Stockfish Web Worker integration hook with `evaluate` and `evaluateAsync` methods
- `client/public/stockfish.js` - Stockfish 18 lite-single WASM engine
- `server/routes.ts` - Backend routes for OpenAI GPT-5-nano analysis and chat with tool-calling loop
- `server/stockfish-service.ts` - Server-side Stockfish engine service (spawns child process, queued evaluation)
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
12. "Verify ON/OFF" toggle controls whether GPT-5-nano calls Stockfish tool to fact-check analysis

## Server-Side Stockfish Tool Calling
- `server/stockfish-service.ts` spawns the `stockfish` npm package binary (`node_modules/stockfish/bin/stockfish.js`) as a child process using `spawn(process.execPath, [enginePath])`
- Provides `stockfishService.evaluate(fen, depth)` returning `{ score, mate, bestMove, pv, depth }` (White POV)
- Requests are queued — only one evaluation runs at a time; auto-restarts on process crash
- `server/routes.ts` defines an OpenAI tool `evaluate_position` (fen, depth) and both `/api/analyze` and `/api/chat` use `chatWithTools()` which loops up to 5 rounds of tool calls before returning the final text response
- The LLM calls Stockfish to verify move scores it suggests, ensuring coaching advice is engine-verified

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

## No Database Required
This app is stateless - all chess state is managed client-side. Only OpenAI GPT-5-nano calls (with Stockfish tool calling) go through the backend.
