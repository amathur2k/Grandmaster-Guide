import { z } from "zod";

export const analyzePositionSchema = z.object({
  fen: z.string(),
  pgn: z.string(),
  evaluation: z.string(),
  topMoves: z.array(z.string()),
  turn: z.enum(["w", "b"]),
  playerColor: z.enum(["white", "black"]),
});

export type AnalyzePositionRequest = z.infer<typeof analyzePositionSchema>;

export interface AnalyzePositionResponse {
  explanation: string;
}

export interface StockfishEvaluation {
  score: number;
  bestMove: string;
  topMoves: string[];
  depth: number;
  mate: number | null;
}
