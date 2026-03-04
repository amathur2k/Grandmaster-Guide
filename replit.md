# AI Chess Coach

## Overview
An interactive AI Chess Coach MVP that lets users play chess on an interactive board, get real-time Stockfish engine evaluation, and receive witty grandmaster-style explanations powered by Google Gemini AI.

## Architecture
- **Frontend**: React + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js with a single `/api/analyze` endpoint
- **Chess Logic**: chess.js for rules/FEN/PGN, react-chessboard for the interactive board
- **Engine**: Stockfish 16 WASM loaded via CDN in a Web Worker (`client/public/stockfish-worker.js`)
- **AI**: Google Gemini (gemini-2.5-flash) via Replit AI Integrations (no API key needed)

## Key Files
- `client/src/pages/chess-coach.tsx` - Main chess page with board, controls, PGN input
- `client/src/components/eval-bar.tsx` - Visual evaluation bar
- `client/src/components/move-history.tsx` - Move history panel
- `client/src/components/coach-console.tsx` - AI coach panel with engine lines and explanation
- `client/src/hooks/use-stockfish.ts` - Stockfish Web Worker integration hook
- `client/public/stockfish-worker.js` - Web Worker that runs Stockfish engine
- `server/routes.ts` - Backend route for Gemini AI analysis
- `shared/schema.ts` - Shared types and Zod validation schemas

## Data Flow
1. User makes a move on the board or loads PGN
2. chess.js computes the new FEN
3. FEN is sent to Stockfish Web Worker for evaluation (MultiPV 3)
4. "Explain This Position" sends FEN, last 4 moves, eval, and top moves to backend
5. Backend calls Gemini with chess coach system prompt
6. AI explanation displayed in Coach Console

## No Database Required
This app is stateless - all chess state is managed client-side. Only the Gemini AI call goes through the backend.
