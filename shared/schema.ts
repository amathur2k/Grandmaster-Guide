import { z } from "zod";

export const analyzePositionSchema = z.object({
  fen: z.string(),
  pgn: z.string(),
  evaluation: z.string(),
  topMoves: z.array(z.string()),
  turn: z.enum(["w", "b"]),
  playerColor: z.enum(["white", "black"]),
  useToolCalling: z.boolean().optional().default(true),
});

export type AnalyzePositionRequest = z.infer<typeof analyzePositionSchema>;

export const chatMessageSchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string(),
});

export const coachChatSchema = z.object({
  fen: z.string(),
  pgn: z.string(),
  evaluation: z.string(),
  topMoves: z.array(z.string()),
  turn: z.enum(["w", "b"]),
  playerColor: z.enum(["white", "black"]),
  messages: z.array(chatMessageSchema).min(1),
  useToolCalling: z.boolean().optional().default(true),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type CoachChatRequest = z.infer<typeof coachChatSchema>;

export interface AnalyzePositionResponse {
  explanation: string;
}

export interface EngineLine {
  move: string;
  score: number;
  mate: number | null;
  pv: string[];
}

export interface StockfishEvaluation {
  score: number;
  bestMove: string;
  topMoves: string[];
  lines: EngineLine[];
  depth: number;
  mate: number | null;
}
