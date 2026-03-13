import type { Express } from "express";
import { createServer, type Server } from "http";
import OpenAI from "openai";
import { Chess } from "chess.js";
import passport from "passport";
import { analyzePositionSchema, coachChatSchema, type User } from "@shared/schema";
import { stockfishService } from "./stockfish-service";
import { sendGA4Event } from "./analytics";
import { analyzePosition, formatFeaturesForPrompt } from "./position-analyzer";

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

const SYSTEM_PROMPT = `You are a chess coach. Be brief and direct — no filler, no rhetorical questions, no sign-offs.

## Rules
1. Address the student by their color. Analyze from their perspective.
2. Use the top engine moves provided. The scores are shown to the student in the UI — do not quote or repeat numeric evaluations (e.g. +1.74) in your response. Instead explain the chess idea behind each move and why it leads to a better position.
3. SAN notation only (Nf3, O-O, exd5). Never UCI (e2e4).
4. Show concrete continuations (2-4 moves deep). Use engine PVs.
5. **Move numbering**: Use the game's actual move numbers from the PGN. For Black moves, use the ellipsis format: "19...Qxb2". For White: "19. Na4". A sequence example: "19. Na4 Qb4 20. Bd2 Qa5 21. c4".
6. Validate every move via the validate_move tool before suggesting it. Chain validations for sequences (use resultingFen from each call). Never mention move legality in your response — do not write phrases like "this is a legal move" or "I've verified this move is legal".
7. When the evaluate_position tool is available, call it to verify your ideas — especially when suggesting plans that deviate from the engine's top line. If Stockfish disagrees, defer to the engine.
8. Identify the opening precisely.
9. Never end your response with a question.
10. Trust engine data completely — prefer it over your own calculation.
11. When [Position Features] data is provided, reference it when explaining material imbalances, pawn weaknesses, piece activity, or king safety. Ground your explanations in the computed facts. When get_position_features is available, call it before discussing alternative lines that significantly change the position.`;

const validateMoveTool: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "validate_move",
    description:
      "Check whether a chess move is legal in a given position. Pass the COMPLETE FEN (all 6 fields) and the move in SAN. Returns legality, resulting FEN if legal, or legal moves if illegal. ALWAYS call this for every move you suggest.",
    parameters: {
      type: "object",
      properties: {
        fen: {
          type: "string",
          description: "The COMPLETE FEN string with all 6 fields (e.g. 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'). Copy the full FEN from the position context — do not truncate it.",
        },
        move: {
          type: "string",
          description:
            "The move in Standard Algebraic Notation (SAN), e.g. 'Nf3', 'e4', 'O-O', 'exd5', 'Qxf7#'.",
        },
      },
      required: ["fen", "move"],
    },
  },
};

const evaluatePositionTool: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "evaluate_position",
    description:
      "Evaluate a chess position using Stockfish engine at depth 18. Returns centipawn score (White POV), mate distance, best move in SAN, and principal variation. Use this to verify whether a plan or idea actually works before suggesting it.",
    parameters: {
      type: "object",
      properties: {
        fen: {
          type: "string",
          description: "The COMPLETE FEN string with all 6 fields to evaluate.",
        },
      },
      required: ["fen"],
    },
  },
};

const getPositionFeaturesTool: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "get_position_features",
    description:
      "Compute positional features for a chess position: material balance (Kaufman values), piece mobility, king safety (pawn shield), and pawn structure (doubled/isolated/passed). Use before discussing plans that change the position significantly.",
    parameters: {
      type: "object",
      properties: {
        fen: {
          type: "string",
          description: "The COMPLETE FEN string with all 6 fields to analyze.",
        },
      },
      required: ["fen"],
    },
  },
};

const MAX_TOOL_ROUNDS = 15;

function getTools(useVerify: boolean, useFeatures: boolean): OpenAI.ChatCompletionTool[] {
  const t: OpenAI.ChatCompletionTool[] = [validateMoveTool];
  if (useVerify) t.push(evaluatePositionTool);
  if (useFeatures) t.push(getPositionFeaturesTool);
  return t;
}

async function handleEvaluatePosition(fen: string, fallbackFen: string): Promise<object> {
  const cleanFen = sanitizeFen(fen) || sanitizeFen(fallbackFen);
  if (!cleanFen) {
    return { error: "Invalid FEN string" };
  }
  try {
    const result = await stockfishService.evaluate(cleanFen, 18);
    const bestMoveSan = uciToSan(cleanFen, result.bestMove);
    const pvSan = pvToSan(cleanFen, result.pv.slice(0, 10));
    return {
      fen: cleanFen,
      score: result.score,
      mate: result.mate,
      scoreDisplay: formatScore(result.score, result.mate),
      bestMove: bestMoveSan,
      principalVariation: pvSan.join(" "),
      depth: result.depth,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Stockfish evaluation failed" };
  }
}

function handleValidateMove(fen: string, moveSan: string): object {
  try {
    const g = new Chess(fen);
    const result = g.move(moveSan);
    if (result) {
      return {
        legal: true,
        move: result.san,
        resultingFen: g.fen(),
        captured: result.captured || null,
        isCheck: g.isCheck(),
        isCheckmate: g.isCheckmate(),
      };
    }
    const legalMoves = new Chess(fen).moves();
    return {
      legal: false,
      move: moveSan,
      error: `"${moveSan}" is not a legal move in this position.`,
      legalMoves: legalMoves.slice(0, 30),
      totalLegalMoves: legalMoves.length,
    };
  } catch (e) {
    return {
      legal: false,
      move: moveSan,
      error: e instanceof Error ? e.message : "Invalid FEN or move format",
    };
  }
}

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
  useFeatures?: boolean;
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

  let featuresBlock = "";
  if (data.useFeatures) {
    try {
      const features = analyzePosition(data.fen);
      featuresBlock = "\n\n" + formatFeaturesForPrompt(features);
    } catch (e) {
      console.error("[position-analyzer] Error computing features:", e);
    }
  }

  return `[Chess Position Context]
Full PGN of the game: ${data.pgn || "No moves yet (starting position)"}
Current position (FEN): ${data.fen}
Overall evaluation (from White's perspective): ${data.evaluation}
It is ${turnLabel}'s turn to move.
The student is playing as ${data.playerColor}.

[Top Engine Moves — use these for your suggestions]
${engineLinesBlock}${featuresBlock}`;
}

const MODEL = "gpt-5.4";

function normalizeChessComResult(result: string): "win" | "loss" | "draw" {
  if (result === "win") return "win";
  const draws = ["agreed", "stalemate", "insufficient", "repetition", "50move", "timevsinsufficient", "kingofthehill", "threecheck", "bughousepartnerwin"];
  if (draws.includes(result)) return "draw";
  return "loss";
}

async function handleToolCall(
  tc: { id: string; function: { name: string; arguments: string } },
  fallbackFen: string,
  tag: string,
  clientId = "server",
): Promise<OpenAI.ChatCompletionToolMessageParam> {
  const name = tc.function.name;
  try {
    const args = JSON.parse(tc.function.arguments);
    if (name === "validate_move") {
      let fen = args.fen || "";
      const move = args.move || "";
      let result = handleValidateMove(fen, move);
      if ((result as any).error?.includes("Invalid FEN")) {
        fen = fallbackFen;
        result = handleValidateMove(fen, move);
      }
      const legal = (result as any).legal as boolean;
      console.log(`[${tag}] validate_move: move="${move}" => legal=${legal}`);
      sendGA4Event(clientId, "llm_validate_move", { move, legal, tag }).catch(() => {});
      return { role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) };
    }
    if (name === "evaluate_position") {
      const fen = args.fen || "";
      const result = await handleEvaluatePosition(fen, fallbackFen);
      console.log(`[${tag}] evaluate_position => ${JSON.stringify(result).slice(0, 120)}`);
      sendGA4Event(clientId, "llm_evaluate_position", { tag }).catch(() => {});
      return { role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) };
    }
    if (name === "get_position_features") {
      const fen = args.fen || "";
      const cleanFen = sanitizeFen(fen) || sanitizeFen(fallbackFen);
      if (!cleanFen) {
        return { role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: "Invalid FEN string" }) };
      }
      const result = analyzePosition(cleanFen);
      console.log(`[${tag}] get_position_features => summary="${result.summary.slice(0, 120)}"`);
      sendGA4Event(clientId, "llm_get_position_features", { tag }).catch(() => {});
      return { role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) };
    }
    return { role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: `Unknown tool: ${name}` }) };
  } catch {
    return { role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: "Failed to parse arguments" }) };
  }
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

      const { useToolCalling, useFeatures, ...positionData } = parsed.data;
      const contextMessage = buildContextMessage({ ...positionData, useFeatures });
      const activeTools = getTools(useToolCalling, useFeatures);

      const msgs: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contextMessage },
      ];

      let explanation = "";
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const response = await callOpenAIWithRetry({
          model: MODEL,
          messages: msgs,
          max_completion_tokens: 8192,
          tools: activeTools,
        });
        const choice = response.choices[0];
        if (!choice) break;

        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
          msgs.push(choice.message);
          const clientId = req.sessionID || "server";
          for (const tc of choice.message.tool_calls) {
            msgs.push(await handleToolCall(tc, positionData.fen, "analyze", clientId));
          }
          continue;
        }

        explanation = choice.message.content || "";
        break;
      }

      res.json({ explanation: explanation || "I couldn't generate a response. Please try again." });
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

      const { messages, useToolCalling, useFeatures, ...positionData } = parsed.data;
      const contextMessage = buildContextMessage({ ...positionData, useFeatures });
      const activeTools = getTools(useToolCalling, useFeatures);

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
        console.log(`[chat] === END PROMPT (${chatMessages.length} messages, tools=${activeTools.map(t => t.function.name).join(",")}) ===`);

        let tokenCount = 0;
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          if (clientDisconnected) break;

          const stream = await openai.chat.completions.create({
            model: MODEL,
            messages: chatMessages,
            max_completion_tokens: 8192,
            tools: activeTools,
            stream: true,
          });

          let assistantContent = "";
          const toolCallAccum: Map<number, { id: string; name: string; args: string }> = new Map();
          let hasToolCalls = false;
          const bufferedTokens: string[] = [];

          for await (const chunk of stream) {
            if (clientDisconnected) break;
            const choice = chunk.choices[0];
            if (!choice) continue;

            if (choice.delta?.content) {
              assistantContent += choice.delta.content;
              bufferedTokens.push(choice.delta.content);
            }

            if (choice.delta?.tool_calls) {
              hasToolCalls = true;
              for (const tc of choice.delta.tool_calls) {
                const idx = tc.index;
                if (!toolCallAccum.has(idx)) {
                  toolCallAccum.set(idx, { id: tc.id || "", name: tc.function?.name || "", args: "" });
                }
                const entry = toolCallAccum.get(idx)!;
                if (tc.id) entry.id = tc.id;
                if (tc.function?.name) entry.name = tc.function.name;
                if (tc.function?.arguments) entry.args += tc.function.arguments;
              }
            }
          }

          if (!hasToolCalls || toolCallAccum.size === 0) {
            for (const token of bufferedTokens) {
              if (clientDisconnected) break;
              tokenCount++;
              res.write(`data: ${JSON.stringify({ type: "token", text: token })}\n\n`);
            }
            break;
          }

          const assistantMsg: OpenAI.ChatCompletionMessageParam = {
            role: "assistant",
            content: assistantContent || null,
            tool_calls: Array.from(toolCallAccum.values()).map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: tc.args },
            })),
          };
          chatMessages.push(assistantMsg);

          const clientId = req.sessionID || "server";
          const toolNames: string[] = [];
          for (const tc of toolCallAccum.values()) {
            toolNames.push(tc.name);
            chatMessages.push(await handleToolCall(
              { id: tc.id, function: { name: tc.name, arguments: tc.args } },
              positionData.fen,
              "chat",
              clientId,
            ));
          }

          const statusText = toolNames.includes("evaluate_position")
            ? "Running Stockfish verification..."
            : toolNames.includes("get_position_features")
            ? "Analyzing position features..."
            : "Validating moves...";
          res.write(`data: ${JSON.stringify({ type: "status", text: statusText })}\n\n`);
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

  // ── Game import routes ────────────────────────────────────────────────────

  app.get("/api/games/chess-com", async (req, res) => {
    const username = ((req.query.username as string) || "").trim();
    if (!username) return res.status(400).json({ error: "username required" });

    try {
      const archivesRes = await fetch(
        `https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`,
        { headers: { "User-Agent": "ChessAnalyzer/1.0" } }
      );
      if (!archivesRes.ok) {
        const status = archivesRes.status;
        return res.status(status === 404 ? 404 : 502).json({
          error: status === 404 ? `User "${username}" not found on Chess.com` : "Chess.com API error",
        });
      }
      const archivesData = (await archivesRes.json()) as { archives: string[] };
      const archives = archivesData.archives || [];
      if (archives.length === 0) return res.json({ games: [] });

      const recentArchives = archives.slice(-2).reverse();
      const allGames: unknown[] = [];

      for (const archiveUrl of recentArchives) {
        const monthRes = await fetch(archiveUrl, {
          headers: { "User-Agent": "ChessAnalyzer/1.0" },
        });
        if (!monthRes.ok) continue;
        const monthData = (await monthRes.json()) as { games: unknown[] };
        const reversed = [...(monthData.games || [])].reverse();
        allGames.push(...reversed);
        if (allGames.length >= 30) break;
      }

      const normalized = allGames.slice(0, 30).map((g: unknown) => {
        const game = g as Record<string, Record<string, unknown>>;
        return {
          id: (game.url as string) || String(game.end_time),
          date: game.end_time
            ? new Date((game.end_time as number) * 1000).toISOString()
            : new Date().toISOString(),
          white: { name: (game.white?.username as string) || "?", rating: game.white?.rating as number | undefined },
          black: { name: (game.black?.username as string) || "?", rating: game.black?.rating as number | undefined },
          whiteResult: normalizeChessComResult((game.white?.result as string) || ""),
          blackResult: normalizeChessComResult((game.black?.result as string) || ""),
          timeClass: (game.time_class as string) || "blitz",
          timeControl: (game.time_control as string) || "",
          pgn: (game.pgn as string) || "",
        };
      });

      res.json({ games: normalized });
    } catch {
      res.status(500).json({ error: "Failed to fetch games from Chess.com" });
    }
  });

  app.get("/api/games/lichess", async (req, res) => {
    const username = ((req.query.username as string) || "").trim();
    if (!username) return res.status(400).json({ error: "username required" });

    try {
      const response = await fetch(
        `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=20&pgnInJson=true`,
        { headers: { Accept: "application/x-ndjson" } }
      );
      if (!response.ok) {
        const status = response.status;
        return res.status(status === 404 ? 404 : 502).json({
          error: status === 404 ? `User "${username}" not found on Lichess` : "Lichess API error",
        });
      }

      const text = await response.text();
      const lines = text.trim().split("\n").filter(Boolean);

      const games = lines
        .map((line: string) => {
          try {
            const g = JSON.parse(line) as Record<string, unknown>;
            const players = g.players as Record<string, Record<string, Record<string, unknown>>>;
            const clock = g.clock as Record<string, number> | undefined;
            const winner = g.winner as string | undefined;
            return {
              id: g.id as string,
              date: g.createdAt
                ? new Date(g.createdAt as number).toISOString()
                : new Date().toISOString(),
              white: {
                name: (players?.white?.user?.name as string) || "Anonymous",
                rating: players?.white?.rating as number | undefined,
              },
              black: {
                name: (players?.black?.user?.name as string) || "Anonymous",
                rating: players?.black?.rating as number | undefined,
              },
              whiteResult: (winner === "white" ? "win" : winner === "black" ? "loss" : "draw") as "win" | "loss" | "draw",
              blackResult: (winner === "black" ? "win" : winner === "white" ? "loss" : "draw") as "win" | "loss" | "draw",
              timeClass: (g.perf as string) || "blitz",
              timeControl: clock
                ? `${Math.floor(clock.initial / 60)}+${clock.increment}`
                : "?",
              pgn: (g.pgn as string) || "",
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      res.json({ games });
    } catch {
      res.status(500).json({ error: "Failed to fetch games from Lichess" });
    }
  });

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    app.get(
      "/api/auth/google",
      passport.authenticate("google", { scope: ["profile", "email"] }),
    );

    app.get(
      "/api/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/" }),
      (_req, res) => {
        res.redirect("/");
      },
    );
  } else {
    app.get("/api/auth/google", (_req, res) => {
      res.status(503).json({ error: "Google OAuth not configured" });
    });
  }

  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated() && req.user) {
      const user = req.user as User;
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      });
    } else {
      res.json(null);
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ ok: true });
      });
    });
  });

  return httpServer;
}
