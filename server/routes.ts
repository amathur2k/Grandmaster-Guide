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

const SYSTEM_PROMPT = `You are a witty Grandmaster Chess Coach. I will provide the full PGN of the game so far, the current FEN, the engine's evaluation, and which color the student is playing.

Always address the student as the color they are playing. Analyze from their perspective.
If the eval is positive for the student, explain their advantage and what they're doing right.
If it's negative, explain the threat they missed or the mistake they made, and suggest what they should have done.
Identify the opening name precisely (e.g., 'The Sicilian Defense, Najdorf Variation'). Use web search to look up the opening if needed.
If the position is in the middlegame or endgame, identify key strategic themes (pawn structure, piece activity, king safety, etc.).
Be succinct and to the point. Be encouraging but honest.`;

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

      const { fen, pgn, evaluation, topMoves, turn, playerColor } = parsed.data;

      const turnLabel = turn === "w" ? "White" : "Black";
      const userPrompt = `Full PGN of the game: ${pgn || "No moves yet (starting position)"}
Current position (FEN): ${fen}
Engine evaluation (from White's perspective): ${evaluation}
Top 3 engine suggestions: ${topMoves.length > 0 ? topMoves.join(", ") : "N/A"}
It is ${turnLabel}'s turn to move.
The student is playing as ${playerColor}.`;

      const fullPrompt = SYSTEM_PROMPT + "\n\n" + userPrompt;
      console.log("--- GEMINI PROMPT ---");
      console.log(fullPrompt);
      console.log("--- END PROMPT ---");

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: [
          { role: "user", parts: [{ text: fullPrompt }] },
        ],
        config: {
          maxOutputTokens: 8192,
          tools: [{ googleSearch: {} }],
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
