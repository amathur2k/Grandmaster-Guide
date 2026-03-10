# AI Chess Coach

## Overview
An interactive AI Chess Coach MVP that lets users play chess on an interactive board, get real-time Stockfish engine evaluation, and receive grandmaster-style explanations and interactive coaching powered by Google Gemini AI. Features a variation tree that preserves all explored move lines.

## Architecture
- **Frontend**: React + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js with `/api/analyze` and `/api/chat` endpoints
- **Chess Logic**: chess.js for rules/FEN/PGN, react-chessboard@4.7.2 for the interactive board (React 18 compatible)
- **Engine**: Stockfish 18 lite-single WASM (`client/public/stockfish.js` + `client/public/stockfish.wasm`) loaded as a Web Worker with MultiPV 3
- **AI**: Google Gemini (gemini-2.5-pro) via Replit AI Integrations with web search enabled (no API key needed)

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
- `server/routes.ts` - Backend routes for Gemini AI analysis and chat
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
8. Engine lines section shows top 3 moves with scores; each has an "explain" button
9. "Explain This Position" sends FEN, full PGN, eval, and top moves to `/api/analyze`
10. Backend calls Gemini 2.5 Pro with chess coach system prompt and web search tool
11. AI explanation displayed as first message in interactive coach chat
12. User can ask follow-up questions via `/api/chat` which maintains full conversation history

## Important Notes
- `evaluateAsync` returns a promise that resolves when `bestmove` is received — used for batch PGN evaluation
- Eval scores from Stockfish are side-to-move relative; normalized to White POV by negating when `turn === 'b'`
- Chat messages are cleared when navigating to a different position
- react-chessboard must stay at @4.7.2 (v5+ requires React 19)
- "uncaught exception" from Stockfish WASM on HMR/page reconnect is transient — fresh page load clears it
- Eval graph scores are clamped to -5 to +5 range; dots colored by score swing (green/yellow/orange/red)
- Eval graph accepts nullable scores `(EvalScore | null)[]` — unscored nodes are excluded (dense prefix rendering)
- `isNavigatingRef` prevents stale eval scores from overwriting during navigation; resets when new eval starts
- Board max size is 480px (reduced from 640px) to allow space for variation tree

## No Database Required
This app is stateless - all chess state is managed client-side. Only Gemini AI calls go through the backend.
