import type { Express } from "express";
import { createServer, type Server } from "http";
import { GoogleGenAI } from "@google/genai";
import { analyzePositionSchema, coachChatSchema } from "@shared/schema";

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

function buildContextMessage(data: { fen: string; pgn: string; evaluation: string; topMoves: string[]; turn: string; playerColor: string }) {
  const turnLabel = data.turn === "w" ? "White" : "Black";
  return `[Chess Position Context]
Full PGN of the game: ${data.pgn || "No moves yet (starting position)"}
Current position (FEN): ${data.fen}
Engine evaluation (from White's perspective): ${data.evaluation}
Top 3 engine suggestions: ${data.topMoves.length > 0 ? data.topMoves.join(", ") : "N/A"}
It is ${turnLabel}'s turn to move.
The student is playing as ${data.playerColor}.`;
}

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

      const contextMessage = buildContextMessage(parsed.data);
      const fullPrompt = SYSTEM_PROMPT + "\n\n" + contextMessage;
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

  app.post("/api/chat", async (req, res) => {
    try {
      const parsed = coachChatSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request data" });
      }

      const { messages, ...positionData } = parsed.data;
      const contextMessage = buildContextMessage(positionData);

      const contents = messages.map((msg, i) => {
        if (i === 0 && msg.role === "user") {
          return {
            role: "user" as const,
            parts: [{ text: SYSTEM_PROMPT + "\n\n" + contextMessage + "\n\n" + msg.text }],
          };
        }
        return {
          role: msg.role as "user" | "model",
          parts: [{ text: msg.text }],
        };
      });

      console.log("--- GEMINI CHAT ---");
      console.log(`Messages: ${messages.length}, Latest: "${messages[messages.length - 1]?.text?.slice(0, 100)}..."`);
      console.log("--- END CHAT ---");

      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents,
        config: {
          maxOutputTokens: 8192,
          tools: [{ googleSearch: {} }],
        },
      });

      const reply = response.text || "I'm not sure how to respond to that. Could you rephrase your question?";
      res.json({ reply });
    } catch (error) {
      console.error("Error in coach chat:", error);
      res.status(500).json({ error: "Failed to get coach response" });
    }
  });

  return httpServer;
}
