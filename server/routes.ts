import type { Express } from "express";
import { createServer, type Server } from "http";
import OpenAI from "openai";
import { Chess } from "chess.js";
import { analyzePositionSchema, coachChatSchema } from "@shared/schema";
import { stockfishService } from "./stockfish-service";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function uciToSan(fen: string, uci: string): string {
  try {
    const g = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const move = g.move({ from, to, promotion });
    return move ? move.san : uci;
  } catch {
    return uci;
  }
}

function pvToSan(fen: string, pvUci: string[]): string[] {
  const result: string[] = [];
  const g = new Chess(fen);
  for (const uci of pvUci) {
    try {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      const move = g.move({ from, to, promotion });
      if (!move) break;
      result.push(move.san);
    } catch {
      break;
    }
  }
  return result;
}

const SYSTEM_PROMPT = `You are a witty Grandmaster Chess Coach. You receive the full PGN, current FEN, engine evaluation, and the top engine-recommended moves with their scores and principal variations (PV).

## Rules

1. **Address the student by their color.** Analyze from their perspective.
2. **Use the top engine moves.** When suggesting moves, draw from the engine lines provided. Cite the engine score to justify why a move is strong or weak.
3. **Standard Algebraic Notation (SAN) only.** Always write moves in SAN (e.g. Nf3, Bb5, O-O, exd5). Never use UCI notation (e.g. e2e4) or coordinate-only formats.
4. **Demonstrate ideas with full move sequences.** When explaining an idea, plan, or tactic, show the concrete continuation — at least 2-4 moves deep (both sides). Use the principal variations from the engine lines to support your sequences.
5. **Verify with Stockfish.** When you are given Stockfish verification data, use it to confirm whether the idea actually works. If the engine shows the idea loses material or the position, say so honestly and suggest the engine's preferred continuation instead.
6. **Identify the opening** precisely (e.g., "Sicilian Defense, Najdorf Variation").
7. **In middlegame/endgame**, identify key strategic themes (pawn structure, piece activity, king safety, etc.).
8. **Be succinct, encouraging, and honest.** If the position is bad, explain what went wrong and how to improve.

## Engine data you can trust
The engine lines, scores, and Stockfish deep analysis in the context come from a real Stockfish engine. You can trust them completely. Always prefer engine data over your own calculation when they conflict.`;

function sanitizeFen(fen: string): string | null {
  if (typeof fen !== "string" || fen.length > 200) return null;
  const cleaned = fen.replace(/[\r\n\x00-\x1f]/g, "").trim();
  if (!/^[rnbqkpRNBQKP1-8/]+ [wb] [KQkq-]+ [a-h1-8-]+ \d+ \d+$/.test(cleaned)) return null;
  return cleaned;
}

async function callOpenAIWithRetry(
  params: OpenAI.ChatCompletionCreateParamsNonStreaming,
  maxRetries = 3
): Promise<OpenAI.ChatCompletion> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await openai.chat.completions.create(params);
    } catch (error: unknown) {
      const isRateLimit =
        error instanceof Error &&
        "status" in error &&
        (error as { status: number }).status === 429;
      if (isRateLimit && attempt < maxRetries) {
        const delay = Math.min(2000 * Math.pow(2, attempt), 15000);
        console.log(
          `[openai] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unreachable");
}

function formatScore(score: number, mate: number | null): string {
  if (mate !== null) return `Mate in ${Math.abs(mate)} (${mate > 0 ? "White wins" : "Black wins"})`;
  return `${score > 0 ? "+" : ""}${score.toFixed(2)}`;
}

function buildContextMessage(data: {
  fen: string;
  pgn: string;
  evaluation: string;
  topMoves: string[];
  engineLines?: { move: string; score: number; mate: number | null; pv: string[] }[];
  turn: string;
  playerColor: string;
}) {
  const turnLabel = data.turn === "w" ? "White" : "Black";

  let engineLinesBlock = "No engine lines available.";
  if (data.engineLines && data.engineLines.length > 0) {
    const lines = data.engineLines.map((line, i) => {
      const moveSan = uciToSan(data.fen, line.move);
      const pvSan = pvToSan(data.fen, line.pv.slice(0, 10));
      const scoreStr = formatScore(line.score, line.mate);
      return `  ${i + 1}. ${moveSan} (eval: ${scoreStr}) — continuation: ${pvSan.join(" ")}`;
    });
    engineLinesBlock = lines.join("\n");
  }

  return `[Chess Position Context]
Full PGN of the game: ${data.pgn || "No moves yet (starting position)"}
Current position (FEN): ${data.fen}
Overall evaluation (from White's perspective): ${data.evaluation}
It is ${turnLabel}'s turn to move.
The student is playing as ${data.playerColor}.

[Top Engine Moves — use these for your suggestions]
${engineLinesBlock}`;
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

      const { useToolCalling, ...positionData } = parsed.data;
      let contextMessage = buildContextMessage(positionData);

      if (useToolCalling) {
        const fen = sanitizeFen(positionData.fen);
        if (fen) {
          try {
            const evalResult = await stockfishService.evaluate(fen, 18);
            const scoreDisplay = formatScore(evalResult.score, evalResult.mate);
            const bestMoveSan = uciToSan(fen, evalResult.bestMove);
            const pvSan = pvToSan(fen, evalResult.pv.slice(0, 10));
            contextMessage += `\n\n[Stockfish Deep Verification (depth ${evalResult.depth})]
Score: ${scoreDisplay}
Best move: ${bestMoveSan}
Best continuation: ${pvSan.join(" ")}`;
          } catch (e) {
            console.error("[analyze] Stockfish pre-eval failed:", e);
          }
        }
      }

      const response = await callOpenAIWithRetry({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contextMessage },
        ],
        max_completion_tokens: 8192,
      });

      const explanation = response.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";
      res.json({ explanation });
    } catch (error: unknown) {
      console.error("Error analyzing position:", error);
      const isRateLimit =
        error instanceof Error &&
        "status" in error &&
        (error as { status: number }).status === 429;
      const status = isRateLimit ? 429 : 500;
      const msg = isRateLimit
        ? "AI service is busy. Please wait a moment and try again."
        : "Failed to analyze position";
      res.status(status).json({ error: msg });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const parsed = coachChatSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid request data" });
      }

      const { messages, useToolCalling, ...positionData } = parsed.data;
      let contextMessage = buildContextMessage(positionData);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      let clientDisconnected = false;
      const heartbeat = setInterval(() => {
        if (!clientDisconnected) {
          res.write(`: heartbeat\n\n`);
        }
      }, 15000);

      res.on("close", () => {
        clientDisconnected = true;
        clearInterval(heartbeat);
      });

      try {
        const startTime = Date.now();

        if (useToolCalling) {
          res.write(`data: ${JSON.stringify({ type: "status", text: "Running Stockfish verification..." })}\n\n`);
          const fen = sanitizeFen(positionData.fen);
          if (fen) {
            try {
              console.log(`[chat] Pre-evaluating position: ${fen}`);
              const evalResult = await stockfishService.evaluate(fen, 18);
              const scoreDisplay = formatScore(evalResult.score, evalResult.mate);
              const bestMoveSan = uciToSan(fen, evalResult.bestMove);
              const pvSan = pvToSan(fen, evalResult.pv.slice(0, 10));
              contextMessage += `\n\n[Stockfish Deep Verification (depth ${evalResult.depth})]
Score: ${scoreDisplay}
Best move: ${bestMoveSan}
Best continuation: ${pvSan.join(" ")}
Use this to verify any ideas or plans you suggest. If your suggested line differs from the engine's best line, explain why or defer to the engine.`;
              console.log(`[chat] Stockfish eval done: score=${evalResult.score}, bestMove=${bestMoveSan}`);
            } catch (e) {
              console.error("[chat] Stockfish pre-eval failed:", e);
            }
          }
        }

        if (clientDisconnected) {
          console.log(`[chat] Client disconnected before LLM call`);
          return;
        }

        const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
          { role: "system", content: SYSTEM_PROMPT },
        ];

        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          if (i === 0 && msg.role === "user") {
            chatMessages.push({
              role: "user",
              content: contextMessage + "\n\n" + msg.text,
            });
          } else {
            chatMessages.push({
              role: msg.role === "model" ? "assistant" : "user",
              content: msg.text,
            });
          }
        }

        console.log(`[chat] === PROMPT SENT TO OPENAI ===`);
        chatMessages.forEach((m, i) => {
          const preview = typeof m.content === 'string' ? m.content.slice(0, 500) : JSON.stringify(m.content).slice(0, 500);
          console.log(`[chat] Message[${i}] role=${m.role} (${typeof m.content === 'string' ? m.content.length : 0} chars): ${preview}${(typeof m.content === 'string' && m.content.length > 500) ? '...' : ''}`);
        });
        console.log(`[chat] === END PROMPT (${chatMessages.length} messages) ===`);

        const stream = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: chatMessages,
          max_completion_tokens: 8192,
          stream: true,
        });

        let tokenCount = 0;
        for await (const chunk of stream) {
          if (clientDisconnected) break;
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            tokenCount++;
            res.write(`data: ${JSON.stringify({ type: "token", text: delta })}\n\n`);
          }
        }
        console.log(`[chat] Streamed ${tokenCount} tokens in ${Date.now() - startTime}ms`);

        clearInterval(heartbeat);
        if (!clientDisconnected) {
          res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
          res.end();
        }
      } catch (innerError) {
        clearInterval(heartbeat);
        throw innerError;
      }
    } catch (error: unknown) {
      console.error("Error in coach chat:", error);
      const isRateLimit =
        error instanceof Error &&
        "status" in error &&
        (error as { status: number }).status === 429;
      const msg = isRateLimit
        ? "AI service is busy. Please wait a moment and try again."
        : "Failed to get coach response";
      if (!res.headersSent) {
        res.status(isRateLimit ? 429 : 500).json({ error: msg });
      } else {
        res.write(`data: ${JSON.stringify({ type: "error", text: msg })}\n\n`);
        res.end();
      }
    }
  });

  return httpServer;
}
