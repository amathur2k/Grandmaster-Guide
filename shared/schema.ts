import { z } from "zod";
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const engineLineSchema = z.object({
  move: z.string(),
  score: z.number(),
  mate: z.number().nullable(),
  pv: z.array(z.string()),
});

export const analyzePositionSchema = z.object({
  fen: z.string(),
  pgn: z.string(),
  evaluation: z.string(),
  topMoves: z.array(z.string()),
  engineLines: z.array(engineLineSchema).optional().default([]),
  turn: z.enum(["w", "b"]),
  playerColor: z.enum(["white", "black"]),
  lastMove: z.string().optional(),
  useToolCalling: z.boolean().optional().default(true),
  useFeatures: z.boolean().optional().default(true),
  useTheoria: z.boolean().optional().default(false),
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
  engineLines: z.array(engineLineSchema).optional().default([]),
  turn: z.enum(["w", "b"]),
  playerColor: z.enum(["white", "black"]),
  lastMove: z.string().optional(),
  messages: z.array(chatMessageSchema).min(1),
  useToolCalling: z.boolean().optional().default(true),
  useFeatures: z.boolean().optional().default(true),
  useTheoria: z.boolean().optional().default(false),
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
