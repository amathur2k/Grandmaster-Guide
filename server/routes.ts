import type { Express } from "express";
import { createServer, type Server } from "http";
import OpenAI from "openai";
import { analyzePositionSchema, coachChatSchema } from "@shared/schema";
import { stockfishService } from "./stockfish-service";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SYSTEM_PROMPT = `You are a witty Grandmaster Chess Coach. I will provide the full PGN of the game so far, the current FEN, the engine's evaluation, and which color the student is playing.

Always address the student as the color they are playing. Analyze from their perspective.
If the eval is positive for the student, explain their advantage and what they're doing right.
If it's negative, explain the threat they missed or the mistake they made, and suggest what they should have done.
Identify the opening name precisely (e.g., 'The Sicilian Defense, Najdorf Variation').
If the position is in the middlegame or endgame, identify key strategic themes (pawn structure, piece activity, king safety, etc.).
Be succinct and to the point. Be encouraging but honest.

You have access to a Stockfish chess engine tool. Use it to verify the evaluation of any moves or positions you discuss. When suggesting alternative moves, call evaluate_position with the resulting FEN to confirm the engine agrees with your assessment. This ensures your coaching advice is factually accurate.`;

const tools: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "evaluate_position",
      description:
        "Evaluate a chess position using Stockfish engine. Returns centipawn score from White's perspective, mate distance if applicable, best move in UCI notation, and principal variation. Use this to verify your analysis and move suggestions.",
      parameters: {
        type: "object",
        properties: {
          fen: {
            type: "string",
            description:
              "The FEN string of the chess position to evaluate (e.g. 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')",
          },
          depth: {
            type: "number",
            description:
              "Search depth for Stockfish (default 16, max 20). Higher depth gives more accurate results but takes longer.",
          },
        },
        required: ["fen"],
      },
    },
  },
];

function sanitizeFen(fen: string): string | null {
  if (typeof fen !== "string" || fen.length > 200) return null;
  const cleaned = fen.replace(/[\r\n\x00-\x1f]/g, "").trim();
  if (!/^[rnbqkpRNBQKP1-8/]+ [wb] [KQkq-]+ [a-h1-8-]+ \d+ \d+$/.test(cleaned)) return null;
  return cleaned;
}

function clampDepth(raw: unknown): number {
  const n = typeof raw === "number" ? raw : 16;
  if (!Number.isFinite(n) || n < 6) return 6;
  if (n > 20) return 20;
  return Math.round(n);
}

async function handleToolCalls(
  toolCalls: OpenAI.ChatCompletionMessageToolCall[]
): Promise<OpenAI.ChatCompletionToolMessageParam[]> {
  const results: OpenAI.ChatCompletionToolMessageParam[] = [];

  for (const call of toolCalls) {
    if (call.function.name === "evaluate_position") {
      try {
        const args = JSON.parse(call.function.arguments);
        const fen = sanitizeFen(args.fen);
        if (!fen) {
          results.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: "Invalid FEN string provided" }),
          });
          continue;
        }
        const depth = clampDepth(args.depth);

        console.log(`[stockfish-tool] Evaluating: ${fen} at depth ${depth}`);
        const result = await stockfishService.evaluate(fen, depth);
        console.log(`[stockfish-tool] Result: score=${result.score}, bestMove=${result.bestMove}`);

        const scoreDisplay =
          result.mate !== null
            ? `Mate in ${result.mate} (${result.mate > 0 ? "White wins" : "Black wins"})`
            : `${result.score > 0 ? "+" : ""}${result.score.toFixed(2)} (${result.score > 0.5 ? "White is better" : result.score < -0.5 ? "Black is better" : "roughly equal"})`;

        results.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({
            fen,
            score: result.score,
            mate: result.mate,
            scoreDisplay,
            bestMove: result.bestMove,
            principalVariation: result.pv.slice(0, 8).join(" "),
            depth: result.depth,
          }),
        });
      } catch (error) {
        results.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({
            error: "Failed to evaluate position",
            details: error instanceof Error ? error.message : "Unknown error",
          }),
        });
      }
    } else {
      results.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify({ error: `Unknown tool: ${call.function.name}` }),
      });
    }
  }

  return results;
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

async function chatWithTools(
  messages: OpenAI.ChatCompletionMessageParam[],
  useToolCalling = true,
  maxToolRounds = 5
): Promise<string> {
  let currentMessages = [...messages];

  for (let round = 0; round < maxToolRounds; round++) {
    const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model: "gpt-5-mini",
      messages: currentMessages,
      max_completion_tokens: 8192,
    };
    if (useToolCalling) {
      params.tools = tools;
    }

    const response = await callOpenAIWithRetry(params);

    const choice = response.choices[0];
    if (!choice) {
      return "I couldn't generate a response. Please try again.";
    }

    const message = choice.message;

    if (message.tool_calls && message.tool_calls.length > 0) {
      currentMessages.push(message);
      const toolResults = await handleToolCalls(message.tool_calls);
      currentMessages.push(...toolResults);
      continue;
    }

    return message.content || "I couldn't generate a response. Please try again.";
  }

  const finalResponse = await callOpenAIWithRetry({
    model: "gpt-5-mini",
    messages: currentMessages,
    max_completion_tokens: 8192,
  });

  return finalResponse.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";
}

function buildContextMessage(data: {
  fen: string;
  pgn: string;
  evaluation: string;
  topMoves: string[];
  turn: string;
  playerColor: string;
}) {
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

      const { useToolCalling, ...positionData } = parsed.data;
      const contextMessage = buildContextMessage(positionData);

      const explanation = await chatWithTools(
        [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: contextMessage },
        ],
        useToolCalling
      );

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
      const contextMessage = buildContextMessage(positionData);

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

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      let currentMsgs = [...chatMessages];

      if (useToolCalling) {
        for (let round = 0; round < 5; round++) {
          const toolCheckResponse = await callOpenAIWithRetry({
            model: "gpt-5-mini",
            messages: currentMsgs,
            tools,
            max_completion_tokens: 8192,
          });

          const choice = toolCheckResponse.choices[0];
          if (!choice) break;

          const message = choice.message;
          if (message.tool_calls && message.tool_calls.length > 0) {
            res.write(`data: ${JSON.stringify({ type: "status", text: "Verifying with Stockfish..." })}\n\n`);
            currentMsgs.push(message);
            const toolResults = await handleToolCalls(message.tool_calls);
            currentMsgs.push(...toolResults);
            continue;
          }

          if (message.content) {
            res.write(`data: ${JSON.stringify({ type: "token", text: message.content })}\n\n`);
            res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
            res.end();
            return;
          }
          break;
        }
      }

      const stream = await openai.chat.completions.create({
        model: "gpt-5-mini",
        messages: currentMsgs,
        max_completion_tokens: 8192,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          res.write(`data: ${JSON.stringify({ type: "token", text: delta })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
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
