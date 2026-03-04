import type { Express } from "express";
import { createServer, type Server } from "http";
import { GoogleGenAI } from "@google/genai";
import { analyzePositionSchema } from "@shared/schema";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const SYSTEM_PROMPT = `You are a witty Grandmaster Chess Coach. I will provide a FEN, the last few moves of the PGN, and the engine's evaluation.

If the eval is positive for the player, explain their advantage.
If it's negative, explain the threat they missed.
Use the PGN to identify the opening name (e.g., 'The Sicilian Defense').
Keep it under 3 sentences. Be encouraging but honest.`;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/analyze", async (req, res) => {
    try {
      const parsed = analyzePositionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request data" });
      }

      const { fen, lastMoves, evaluation, topMoves, turn } = parsed.data;

      const turnLabel = turn === "w" ? "White" : "Black";
      const userPrompt = `Current position (FEN): ${fen}
Last moves played: ${lastMoves.length > 0 ? lastMoves.join(", ") : "None yet (starting position)"}
Engine evaluation: ${evaluation}
Top 3 engine suggestions: ${topMoves.length > 0 ? topMoves.join(", ") : "N/A"}
It is ${turnLabel}'s turn to move.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\n" + userPrompt }] },
        ],
        config: {
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
        },
      });

      const explanation = response.text || "I couldn't analyze this position. Try making a few more moves!";

      res.json({ explanation });
    } catch (error) {
      console.error("Error analyzing position:", error);
      res.status(500).json({ error: "Failed to analyze position" });
    }
  });

  return httpServer;
}
