# AI Chess Coach

## Overview
An interactive AI Chess Coach MVP that lets users play chess on an interactive board, get real-time Stockfish engine evaluation, and receive grandmaster-style explanations and interactive coaching powered by Google Gemini AI.

## Architecture
- **Frontend**: React + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js with `/api/analyze` and `/api/chat` endpoints
- **Chess Logic**: chess.js for rules/FEN/PGN, react-chessboard@4.7.2 for the interactive board (React 18 compatible)
- **Engine**: Stockfish 18 lite-single WASM (`client/public/stockfish.js` + `client/public/stockfish.wasm`) loaded as a Web Worker with MultiPV 3
- **AI**: Google Gemini (gemini-2.5-pro) via Replit AI Integrations with web search enabled (no API key needed)

## Key Files
- `client/src/pages/chess-coach.tsx` - Main chess page with board, controls, PGN input, chat state management
- `client/src/components/eval-bar.tsx` - Visual evaluation bar
- `client/src/components/move-history.tsx` - Move history panel
- `client/src/components/coach-console.tsx` - Interactive AI coach chat panel with follow-up questions
- `client/src/hooks/use-stockfish.ts` - Stockfish Web Worker integration hook
- `client/public/stockfish.js` - Stockfish 18 lite-single WASM engine
- `server/routes.ts` - Backend routes for Gemini AI analysis and chat
- `shared/schema.ts` - Shared types and Zod validation schemas

## Data Flow
1. User makes a move on the board or loads PGN
2. chess.js computes the new FEN
3. FEN is sent to Stockfish Web Worker for evaluation (MultiPV 3)
4. "Explain This Position" sends FEN, full PGN, eval, and top moves to `/api/analyze`
5. Backend calls Gemini 2.5 Pro with chess coach system prompt and web search tool
6. AI explanation displayed as first message in interactive coach chat
7. User can ask follow-up questions via `/api/chat` which maintains full conversation history

## Important Notes
- `thinkingConfig` was removed from Gemini calls (was causing issues with web search tool)
- Eval scores from Stockfish are side-to-move relative; normalized to White POV by negating when `turn === 'b'`
- Chat messages are cleared when navigating to a different position
- react-chessboard must stay at @4.7.2 (v5+ requires React 19)
- "uncaught exception" from Stockfish WASM on HMR/page reconnect is transient — fresh page load clears it

## No Database Required
This app is stateless - all chess state is managed client-side. Only Gemini AI calls go through the backend.
