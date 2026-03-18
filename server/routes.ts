import type { Express } from "express";
import { createServer, type Server } from "http";
import OpenAI from "openai";
import { Chess } from "chess.js";
import passport from "passport";
import { analyzePositionSchema, coachChatSchema, type PositionHistoryEntry, type User } from "@shared/schema";

import { theoriaService } from "./theoria-service";
import { sendGA4Event } from "./analytics";
import { trackServerEvent } from "./amplitude";
import { pythonAnalyzerService, formatFeaturesForPrompt } from "./python-analyzer-service";
import { classicalStockfishService, formatClassicalEvalForPrompt } from "./classical-stockfish-service";
import { logCoachInteraction, type CoachTimings, type GptRound } from "./coach-logger";

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
2. Use the [Theoria Suggested moves] from [Theoria Strategic Assessment] as the primary source for move suggestions. Explain the chess idea behind each candidate move and why it leads to a better position — do not quote raw numeric evaluations in your response.
3. SAN notation only (Nf3, O-O, exd5). Never UCI (e2e4). Every move must include a complete destination square — never write a partial piece move like "Nc" or "Rb" without a rank digit; the shortest valid piece move is 3 characters (e.g. Nc6, Rb1). Castling is always capital letter O: O-O (kingside) or O-O-O (queenside) — never use zero, lowercase, or any other character.
4. Show concrete continuations (2-4 moves deep). Use the principal variations from the Theoria assessment.
5. **Move numbering**: ALWAYS use the game's actual move numbers from the PGN — never omit them, especially in variation lines. For Black moves, use the ellipsis format: "6...◊d6". For White: "7. ◊g4". Every variation/line MUST start with the correct move number and every time the move number increments it must be written. A full sequence example: "6...◊d6 7. ◊g4 ◊exd5 8. ◊cxd5 ◊Bxf1". When a line starts with Black's move, the very first token must use the "N..." format (e.g. "6...◊d6") so the reader knows it is Black's move.
6. Do NOT call validate_move on moves already listed in [Theoria Suggested moves] — they are pre-validated. Use validate_move only for checking a single self-generated move; use validate_move_sequence for checking a multi-move continuation (see rule 17). Never mention move legality in your response — do not write phrases like "this is a legal move" or "I've verified this move is legal".
7. When the evaluate_position tool is available, call it to verify your ideas — especially when suggesting plans that deviate from the Theoria top line. If the engine disagrees, defer to it.
8. Identify the opening precisely.
9. Never end your response with a question.
10. Trust engine data completely — prefer it over your own calculation.
11. Each position block includes [Computed observations about the position] (material, tactics, pawn structure, king safety, strategic themes). Use these facts to ground your explanations of imbalances, weaknesses, and piece activity. When get_position_features is available, call it before discussing alternative lines that significantly change the position.
12. When [Theoria Strategic Assessment] data is present, use it to enrich your positional explanations — it reflects an Lc0-trained evaluation that emphasises strategic themes over tactical complexity. When get_theoria_insights is available, call it to analyse any alternative line you want to explain.
13. When get_classical_eval is available, call it whenever you want hard numerical engine data to back up your explanation of king safety, mobility, threats, passed pawns, or space. Reference the term scores directly in your response (e.g. "Stockfish scores King safety −11 MG for White").
14. Limit all strategic advice to the top 3 most critical points.
15. When referencing a specific board square (not as a move), prefix it with ^ — e.g., "the ^g3 square", "weakness on ^f4", "control of ^d5". This marker is hidden from the user and used to highlight the square on the board.
16. Prefix every individual move reference with exactly one ◊ character — e.g., ◊Nf3, ◊exd5, ◊O-O. For sequences write each move separately: 1. ◊e4 ◊e5 2. ◊Nf3 ◊Nc6. ONLY apply ◊ to valid SAN moves — never apply it to English words, piece names, or anything that is not a legal chess move notation. Wrong: "◊pawn break", "◊ppNf3", "♠Bg5". Right: "pawn break with ◊d5", "◊Nf3", "◊Bg5". The ◊ must be immediately followed by the move SAN with nothing in between — no extra letters, no "pp", no spaces.
17. Before including any move sequence in your response, call validate_move_sequence to confirm every move is legal starting from the relevant position FEN. This applies to ALL lines — including those you derived from Theoria data, lines you rearranged, and lines you generated yourself. The only exception is a single Theoria top-line quoted verbatim with no changes. If validate_move_sequence returns an error for any move, remove that move and all subsequent moves from the sequence — never include a move that failed validation. When in doubt, always validate.
18. Never use markdown bold (**) around moves, move sequences, or variation lines. The ◊ prefix already handles move highlighting — wrapping in ** causes display issues.`;

const validateMoveTool: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "validate_move",
    description:
      "Check whether a chess move is legal in a given position. Pass the COMPLETE FEN (all 6 fields) and the move in SAN. Returns legality, resulting FEN if legal, or legal moves if illegal. Only call this for moves you generate yourself — do NOT call it for moves already listed in [Theoria Suggested moves], which are pre-validated.",
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

const validateMoveSequenceTool: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "validate_move_sequence",
    description:
      "Validate that a list of moves is legal in sequence starting from a given FEN. " +
      "Call this whenever you construct a move sequence yourself before including it in your response. " +
      "Sequences from [Theoria Suggested moves] are pre-validated — do NOT call this for them. " +
      "Returns { valid: true, finalFen } on success, or { valid: false, errorAt, move, error, legalMoves } " +
      "pinpointing the first illegal move so you can correct or drop the sequence.",
    parameters: {
      type: "object",
      properties: {
        fen: {
          type: "string",
          description:
            "Starting COMPLETE FEN (all 6 fields). Copy from the position context.",
        },
        moves: {
          type: "array",
          items: { type: "string" },
          description:
            'Array of moves in SAN order, e.g. ["Rfc8", "Qd4", "Kg8", "g3", "Rc3"].',
        },
      },
      required: ["fen", "moves"],
    },
  },
};

const evaluatePositionTool: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "evaluate_position",
    description:
      "Evaluate a chess position using the Theoria engine at depth 12. Returns the top 3 candidate moves with centipawn scores (White POV), mate distances, best moves in SAN, and principal variations. Also returns a strategicAssessment string with per-term positional breakdown (Material, King Safety, Piece Activity, Pawn Structure, Passed Pawns, Space, etc.) and an overall evaluation score. Use this to verify whether a plan or idea actually works and to understand the positional factors at play.",
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
      "Analyze a chess position for tactical themes (hanging pieces, forks, pins, skewers, discovered attacks, overloaded defenders, trapped pieces, mating threats), strategic factors (development, center control, rook placement, outposts, weak squares, bad bishops, backward pawns, space, piece coordination), and endgame factors (active king, opposition, outside passers, rook behind passer, pawn majorities, king cutoff). Returns structured findings with plain-English descriptions. Use before discussing plans that change the position significantly.",
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

const getTheoriaInsightsTool: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "get_theoria_insights",
    description:
      "Get Theoria engine's strategic evaluation and top lines for a position. Theoria is an Lc0-trained engine that finds more positionally coherent lines than Stockfish — better for explaining strategic ideas. Use when exploring alternative lines to understand positional themes.",
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

const getClassicalEvalTool: OpenAI.ChatCompletionTool = {
  type: "function",
  function: {
    name: "get_classical_eval",
    description:
      "Get Stockfish 12's classical (hand-crafted) evaluation breakdown for a position. " +
      "Returns centipawn scores for each evaluation term: Material, Imbalance, Pawns, Mobility, " +
      "King safety, Threats, Passed pawns, Space, and Winnable — split by White/Black and " +
      "middlegame/endgame phase. Use when you want hard numerical engine data to ground your " +
      "explanation of king safety, piece activity, pawn structure, threats, or space in a position.",
    parameters: {
      type: "object",
      properties: {
        fen: {
          type: "string",
          description: "The COMPLETE FEN string with all 6 fields for the position to evaluate.",
        },
      },
      required: ["fen"],
    },
  },
};

const MAX_TOOL_ROUNDS = 15;

function getTools(useVerify: boolean, useFeatures: boolean, useTheoria: boolean = false): OpenAI.ChatCompletionTool[] {
  const t: OpenAI.ChatCompletionTool[] = [validateMoveTool, validateMoveSequenceTool];
  if (useVerify) t.push(evaluatePositionTool);
  if (useFeatures) {
    t.push(getPositionFeaturesTool);
    t.push(getClassicalEvalTool);
  }
  if (useTheoria) t.push(getTheoriaInsightsTool);
  return t;
}

async function handleEvaluatePosition(fen: string, fallbackFen: string): Promise<object> {
  const cleanFen = sanitizeFen(fen) || sanitizeFen(fallbackFen);
  if (!cleanFen) {
    return { error: "Invalid FEN string" };
  }
  try {
    const { lines, evalText } = await theoriaService.evaluateWithText(cleanFen, 12, 3);
    const top = lines[0];
    const topMoveSan = uciToSan(cleanFen, top.bestMove);
    const topPvSan = pvToSan(cleanFen, top.pv.slice(0, 10));
    const alternatives = lines.slice(1).map((r, i) => {
      const moveSan = uciToSan(cleanFen, r.bestMove);
      const pvSan = pvToSan(cleanFen, r.pv.slice(0, 8));
      return {
        rank: i + 2,
        move: moveSan,
        score: r.score,
        mate: r.mate,
        scoreDisplay: formatScore(r.score, r.mate),
        principalVariation: pvSan.join(" "),
      };
    });
    return {
      fen: cleanFen,
      score: top.score,
      mate: top.mate,
      scoreDisplay: formatScore(top.score, top.mate),
      bestMove: topMoveSan,
      principalVariation: topPvSan.join(" "),
      depth: top.depth,
      alternatives,
      strategicAssessment: evalText.formatted,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Theoria evaluation failed" };
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

async function executeGetClassicalEval(fen: string, fallbackFen: string): Promise<string> {
  const cleanFen = sanitizeFen(fen) || sanitizeFen(fallbackFen);
  if (!cleanFen) throw new Error("Accuracy Check Module Down: invalid FEN");

  const pieceValues: Record<string, number> = { q: 9, r: 5, b: 3, n: 3, p: 1 };
  const boardChess = new Chess(cleanFen);
  let totalMaterial = 0;
  for (const piece of boardChess.board().flat()) {
    if (piece && piece.type !== "k") {
      totalMaterial += pieceValues[piece.type] ?? 0;
    }
  }
  if (totalMaterial < 14) {
    return "[SF12 Classical Evaluation Breakdown]\nNot available for endgame positions (fewer than 14 points of material on the board).";
  }

  // Don't gate on isReady() — getEvalFeatures() calls ensureProcess() internally,
  // which restarts SF12 after a transient crash. Only permanent failures (unavailable=true)
  // will bubble up as "Accuracy Check Module Down" errors.
  const result = await classicalStockfishService.getEvalFeatures(cleanFen);
  return formatClassicalEvalForPrompt(result);
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

type ClassifyResult = {
  contextType: "current" | "last_move" | "last_few" | "full_game" | "continuation";
  contextNote: string;
  continuationMoves?: string[];
};

type ResolvedPosition = {
  label: string;
  beforeFen: string | null;
  afterFen: string;
  move?: string | null;
};

async function preCoachClassify(
  userMessage: string,
  recentTurns: OpenAI.ChatCompletionMessageParam[],
  currentMoveIndex: number,
  positionHistory: PositionHistoryEntry[]
): Promise<ClassifyResult> {
  const fallback: ClassifyResult = { contextType: "current", contextNote: "" };

  try {
    const currentIdx = currentMoveIndex + 1;
    const currentEntry = positionHistory[currentIdx];
    const moveName = currentEntry?.move || "";
    const moveNum = currentMoveIndex >= 0 ? Math.ceil((currentMoveIndex + 1) / 2) : 0;
    const totalMoves = positionHistory.length - 1;

    const systemPrompt =
      `Classify the chess coaching question into exactly one context type. Output ONLY a JSON object, no other text.\n\n` +
      `Normal output: {"contextType":"current"|"last_move"|"last_few"|"full_game","contextNote":"<1-sentence note>"}\n` +
      `Continuation output: {"contextType":"continuation","contextNote":"<1-sentence note>","moves":["<san1>","<san2>",...]}\n\n` +
      `Rules:\n` +
      `- "current": future plans, what to play, best move, evaluate this position\n` +
      `- "last_move": why was that move good/bad, the move just played${moveName ? ` (move ${moveNum} — ${moveName})` : ""}\n` +
      `- "last_few": last few moves, recently, what happened, past few turns\n` +
      `- "full_game": entire game, game analysis, what to learn, game review\n` +
      `- "continuation": user asks "what is the idea behind X", "explain this line", or provides a move list/continuation. Extract the moves array from the user message or coach response in SAN notation.\n\n` +
      `Game length: ${totalMoves} moves. Currently at move ${moveNum}${moveName ? ` (${moveName})` : ""}.`;

    const msgs: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...recentTurns.slice(-3),
      { role: "user", content: userMessage },
    ];

    const resp = await Promise.race([
      openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: msgs,
        max_completion_tokens: 200,
        temperature: 0,
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("classify timeout")), 4000)),
    ]);

    const text = resp.choices[0]?.message?.content?.trim() ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : null;

    if (parsed && ["current", "last_move", "last_few", "full_game"].includes(parsed.contextType)) {
      return { contextType: parsed.contextType, contextNote: parsed.contextNote ?? "" };
    }
    if (parsed && parsed.contextType === "continuation") {
      const moves = Array.isArray(parsed.moves) ? parsed.moves.filter((m: unknown) => typeof m === "string" && m.length > 0) : [];
      return { contextType: "continuation", contextNote: parsed.contextNote ?? "", continuationMoves: moves };
    }
  } catch (e) {
    console.warn("[pre-coach] classify failed, using 'current':", e instanceof Error ? e.message : String(e));
  }

  return fallback;
}

function resolveRelevantPositions(
  contextType: string,
  positionHistory: PositionHistoryEntry[],
  currentMoveIndex: number
): { positions: ResolvedPosition[]; resolvedIndices: number[] } {
  const currentIdx = currentMoveIndex + 1;

  if (positionHistory.length === 0 || currentIdx < 0 || currentIdx >= positionHistory.length) {
    return { positions: [], resolvedIndices: [] };
  }

  const moveNum = (idx: number) => Math.ceil(idx / 2);

  const getScoreVal = (entry: PositionHistoryEntry | undefined): number | null => {
    if (!entry?.score) return null;
    if (entry.score.mate !== null) return entry.score.mate > 0 ? 100 : -100;
    return entry.score.score;
  };

  const moveName = (idx: number) => positionHistory[idx]?.move ?? null;

  const makePair = (idx: number, label: string): ResolvedPosition => ({
    label,
    beforeFen: idx > 0 ? positionHistory[idx - 1].fen : null,
    afterFen: positionHistory[idx].fen,
    move: positionHistory[idx].move ?? null,
  });

  if (contextType === "current") {
    const label = currentIdx === 0
      ? "Starting position"
      : `Current position — move ${moveNum(currentIdx)}${moveName(currentIdx) ? ` (${moveName(currentIdx)})` : ""}`;
    return {
      positions: [{ label, beforeFen: null, afterFen: positionHistory[currentIdx].fen }],
      resolvedIndices: [currentIdx],
    };
  }

  if (contextType === "last_move") {
    const label = currentIdx === 0
      ? "Starting position"
      : `Last move — move ${moveNum(currentIdx)}${moveName(currentIdx) ? ` (${moveName(currentIdx)})` : ""}`;
    return {
      positions: [makePair(currentIdx, label)],
      resolvedIndices: currentIdx > 0 ? [currentIdx - 1, currentIdx] : [currentIdx],
    };
  }

  if (contextType === "last_few" || contextType === "full_game") {
    const startIdx = contextType === "last_few" ? Math.max(1, currentIdx - 8) : 1;
    const endIdx = contextType === "last_few" ? currentIdx : positionHistory.length - 1;
    const limit = contextType === "last_few" ? 4 : 5;

    const selected: { idx: number; swing: number }[] = [];

    if (contextType === "last_few") {
      for (let i = currentIdx; i >= startIdx && selected.length < limit; i--) {
        const scoreBefore = getScoreVal(positionHistory[i - 1]);
        const scoreAfter = getScoreVal(positionHistory[i]);
        if (scoreBefore === null || scoreAfter === null) continue;
        const swing = Math.abs(scoreAfter - scoreBefore);
        if (swing > 0.5) selected.push({ idx: i, swing });
      }
      selected.sort((a, b) => a.idx - b.idx);
    } else {
      const swings: { idx: number; swing: number }[] = [];
      for (let i = startIdx; i <= endIdx; i++) {
        const scoreBefore = getScoreVal(positionHistory[i - 1]);
        const scoreAfter = getScoreVal(positionHistory[i]);
        if (scoreBefore === null || scoreAfter === null) continue;
        const swing = Math.abs(scoreAfter - scoreBefore);
        if (swing > 0.5) swings.push({ idx: i, swing });
      }
      swings.sort((a, b) => b.swing - a.swing);
      selected.push(...swings.slice(0, limit));
    }

    if (selected.length === 0) {
      return {
        positions: [makePair(currentIdx, `Current position — move ${moveNum(currentIdx)}${moveName(currentIdx) ? ` (${moveName(currentIdx)})` : ""}`)],
        resolvedIndices: [Math.max(0, currentIdx - 1), currentIdx],
      };
    }

    const positions: ResolvedPosition[] = [];
    const resolvedIndices: number[] = [];
    for (const { idx, swing } of selected) {
      positions.push(makePair(idx, `Move ${moveNum(idx)}${moveName(idx) ? ` (${moveName(idx)})` : ""} — swing ${swing.toFixed(1)}p`));
      resolvedIndices.push(idx - 1, idx);
    }
    return { positions, resolvedIndices };
  }

  return { positions: [], resolvedIndices: [] };
}

const SECTION_SEP = "────────────────────────────────────────";

async function enrichPosition(
  fen: string,
  cachedTheoriaText?: string,
  lastMove?: string | null,
  useFeatures?: boolean
): Promise<string> {
  const header = `FEN: ${fen}`;
  const evalBlocks: string[] = [];

  try {
    const classicalText = await executeGetClassicalEval(fen, "");
    evalBlocks.push(classicalText);
  } catch {
    evalBlocks.push("[SF12 classical eval unavailable for this position]");
  }

  if (cachedTheoriaText) {
    evalBlocks.push(cachedTheoriaText);
  } else {
    try {
      const evalResult = await theoriaService.getEvalText(fen);
      evalBlocks.push(evalResult.formatted);
    } catch {
    }
  }

  if (useFeatures && pythonAnalyzerService.isReady()) {
    try {
      const features = await pythonAnalyzerService.analyze(fen, lastMove || "");
      evalBlocks.push(formatFeaturesForPrompt(features));
    } catch {
    }
  }

  return header + "\n\n" + evalBlocks.join(`\n\n${SECTION_SEP}\n\n`);
}

async function buildContinuationPositions(
  startFen: string,
  sanMoves: string[],
  useFeatures: boolean,
  cachedTheoriaText?: string,
): Promise<string> {
  const MOVE_SEP = "════════════════════════════════════════";

  const steps: { label: string; fen: string; move: string }[] = [];
  try {
    const chess = new Chess(startFen);
    for (let i = 0; i < sanMoves.length; i++) {
      const result = chess.move(sanMoves[i]);
      if (!result) {
        steps.push({ label: `move ${i + 1}: ${sanMoves[i]} (illegal — sequence stopped)`, fen: chess.fen(), move: sanMoves[i] });
        break;
      }
      steps.push({ label: `move ${i + 1}: ${result.san}`, fen: chess.fen(), move: result.san });
    }
  } catch {
    return "";
  }

  if (steps.length === 0) return "";

  const enrichments = await Promise.all(
    steps.map((s, i) => enrichPosition(s.fen, i === 0 ? cachedTheoriaText : undefined, s.move, useFeatures))
  );

  const parts = steps.map((s, i) => `[After ${s.label}]\n${enrichments[i]}`);
  return parts.join(`\n\n${MOVE_SEP}\n\n`);
}

async function buildContextMessage(data: {
  fen: string;
  pgn: string;
  evaluation: string;
  topMoves: string[];
  engineLines?: { move: string; score: number; mate: number | null; pv: string[] }[];
  turn: string;
  playerColor: string;
  lastMove?: string;
  useFeatures?: boolean;
  theoriaText?: string;
  resolvedPositions?: ResolvedPosition[];
  contextNote?: string;
  continuationBlock?: string;
}) {
  const turnLabel = data.turn === "w" ? "White" : "Black";

  const classicalStart = Date.now();
  let enrichmentBlock = "";

  if (data.continuationBlock) {
    enrichmentBlock = "\n\n" + data.continuationBlock;
  } else if (data.resolvedPositions && data.resolvedPositions.length > 0) {
    const enrichCache = new Map<string, Promise<string>>();
    const cachedEnrich = (fen: string, lastMove?: string | null): Promise<string> => {
      if (!enrichCache.has(fen)) {
        const cachedTheoria = fen === data.fen ? data.theoriaText : undefined;
        enrichCache.set(fen, enrichPosition(fen, cachedTheoria, lastMove, data.useFeatures));
      }
      return enrichCache.get(fen)!;
    };

    const MOVE_SEP = "════════════════════════════════════════";
    const parts: string[] = [];
    for (const pos of data.resolvedPositions) {
      const subParts: string[] = [];
      if (pos.beforeFen) {
        const beforeAnalysis = await cachedEnrich(pos.beforeFen, null);
        subParts.push(`[Position: before ${pos.label}]\n${beforeAnalysis}`);
      }
      const afterAnalysis = await cachedEnrich(pos.afterFen, pos.move);
      subParts.push(`[Position: after ${pos.label}]\n${afterAnalysis}`);
      parts.push(subParts.join(`\n\n${SECTION_SEP}\n\n`));
    }
    enrichmentBlock = "\n\n" + parts.join(`\n\n${MOVE_SEP}\n\n`);
  } else {
    enrichmentBlock = "\n\n" + await enrichPosition(data.fen, data.theoriaText, data.lastMove, data.useFeatures);
  }
  const classicalMs = Date.now() - classicalStart;

  const contextNoteBlock = data.contextNote
    ? `\n\n[Coach Context Note]\n${data.contextNote}`
    : "";

  const message = `[Chess Position Context]
Full PGN of the game: ${data.pgn || "No moves yet (starting position)"}
Current position (FEN): ${data.fen}
Overall evaluation (from White's perspective): ${data.evaluation}
It is ${turnLabel}'s turn to move.
The student is playing as ${data.playerColor}.${contextNoteBlock}${enrichmentBlock}`;

  return { message, timings: { featureMs: 0, classicalMs } };
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
  lastMove?: string,
  userId?: string,
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
      trackServerEvent("llm_validate_move", { move, legal, tag }, userId);
      return { role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) };
    }
    if (name === "validate_move_sequence") {
      let fen = (args.fen as string) || "";
      const moves: string[] = Array.isArray(args.moves) ? args.moves : [];
      if (!fen) fen = fallbackFen;
      try {
        const g = new Chess(fen);
        for (let i = 0; i < moves.length; i++) {
          const r = g.move(moves[i]);
          if (!r) {
            const legalMoves = g.moves().slice(0, 20);
            const result = {
              valid: false,
              errorAt: i,
              move: moves[i],
              error: `"${moves[i]}" is not a legal move in this position.`,
              legalMoves,
            };
            console.log(`[${tag}] validate_move_sequence: invalid at index ${i} ("${moves[i]}")`);
            sendGA4Event(clientId, "llm_validate_move_sequence", { valid: false, errorAt: i, tag }).catch(() => {});
            trackServerEvent("llm_validate_move_sequence", { valid: false, errorAt: i, tag }, userId);
            return { role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) };
          }
        }
        const result = { valid: true, finalFen: g.fen(), moves };
        console.log(`[${tag}] validate_move_sequence: all ${moves.length} moves valid`);
        sendGA4Event(clientId, "llm_validate_move_sequence", { valid: true, count: moves.length, tag }).catch(() => {});
        trackServerEvent("llm_validate_move_sequence", { valid: true, count: moves.length, tag }, userId);
        return { role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) };
      } catch (e) {
        return { role: "tool", tool_call_id: tc.id, content: JSON.stringify({ valid: false, error: "Invalid FEN or SAN format" }) };
      }
    }
    if (name === "evaluate_position") {
      const fen = args.fen || "";
      const result = await handleEvaluatePosition(fen, fallbackFen);
      console.log(`[${tag}] evaluate_position => ${JSON.stringify(result).slice(0, 120)}`);
      sendGA4Event(clientId, "llm_evaluate_position", { tag }).catch(() => {});
      trackServerEvent("llm_evaluate_position", { tag }, userId);
      return { role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) };
    }
    if (name === "get_position_features") {
      const fen = args.fen || "";
      const cleanFen = sanitizeFen(fen) || sanitizeFen(fallbackFen);
      if (!cleanFen) {
        return { role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: "Invalid FEN string" }) };
      }
      if (!pythonAnalyzerService.isReady()) {
        return { role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: "Position analyzer is starting up" }) };
      }
      try {
        const result = await pythonAnalyzerService.analyze(cleanFen, lastMove);
        console.log(`[${tag}] get_position_features => summary="${result.summary.slice(0, 120)}"`);
        sendGA4Event(clientId, "llm_get_position_features", { tag }).catch(() => {});
        trackServerEvent("llm_get_position_features", { tag }, userId);
        return { role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) };
      } catch (e: unknown) {
        console.error(`[${tag}] get_position_features error:`, e instanceof Error ? e.message : String(e));
        return { role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: "Position analysis failed" }) };
      }
    }
    if (name === "get_theoria_insights") {
      const fen = args.fen || "";
      const cleanFen = sanitizeFen(fen) || sanitizeFen(fallbackFen);
      if (!cleanFen) {
        return { role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: "Invalid FEN string" }) };
      }
      try {
        const [evalResults, evalText] = await Promise.all([
          theoriaService.evaluate(cleanFen, 10, 3),
          theoriaService.getEvalText(cleanFen),
        ]);
        const linesFormatted = evalResults.map((r, i) => {
          const moveSan = uciToSan(cleanFen, r.bestMove);
          const pvSan = pvToSan(cleanFen, r.pv.slice(0, 8));
          const scoreStr = formatScore(r.score, r.mate);
          return `  ${i + 1}. ${moveSan} (eval: ${scoreStr}) — ${pvSan.join(" ")}`;
        }).join("\n");
        const result = {
          strategicAssessment: evalText.formatted,
          theoriaTopLines: linesFormatted,
          depth: evalResults[0]?.depth || 0,
        };
        console.log(`[${tag}] get_theoria_insights => ${evalText.formatted.slice(0, 120)}`);
        sendGA4Event(clientId, "llm_get_theoria_insights", { tag }).catch(() => {});
        trackServerEvent("llm_get_theoria_insights", { tag }, userId);
        return { role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) };
      } catch (e) {
        console.error(`[${tag}] get_theoria_insights error:`, e);
        return { role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: "Theoria evaluation failed" }) };
      }
    }
    if (name === "get_classical_eval") {
      const fen = args.fen || "";
      try {
        const text = await executeGetClassicalEval(fen, fallbackFen);
        console.log(`[${tag}] get_classical_eval => OK for FEN="${fen.slice(0, 40)}..."`);
        sendGA4Event(clientId, "llm_get_classical_eval", { tag }).catch(() => {});
        trackServerEvent("llm_get_classical_eval", { tag }, userId);
        return { role: "tool", tool_call_id: tc.id, content: text };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[${tag}] get_classical_eval error:`, msg);
        return { role: "tool", tool_call_id: tc.id, content: JSON.stringify({ error: msg }) };
      }
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

      const { useToolCalling, useFeatures, useTheoria, ...positionData } = parsed.data;

      let theoriaText: string | undefined;
      try {
        const evalResult = await theoriaService.getEvalText(positionData.fen);
        theoriaText = evalResult.formatted;
      } catch (e) {
        console.error("[analyze] Theoria eval failed:", e);
      }

      const { message: contextMessage } = await buildContextMessage({ ...positionData, useFeatures, theoriaText });
      const activeTools = getTools(useToolCalling, useFeatures, useTheoria);

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
          temperature: 0.1,
          frequency_penalty: 0.6,
          tools: activeTools,
        });
        const choice = response.choices[0];
        if (!choice) break;

        if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
          msgs.push(choice.message);
          const clientId = req.sessionID || "server";
          const userId = (req.user as User | undefined)?.id;
          for (const tc of choice.message.tool_calls) {
            msgs.push(await handleToolCall(tc, positionData.fen, "analyze", clientId, positionData.lastMove, userId));
          }
          continue;
        }

        explanation = choice.message.content || "";
        break;
      }

      res.json({ explanation: explanation || "I couldn't generate a response. Please try again." });
    } catch (error: unknown) {
      console.error("Error analyzing position:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      const isAccuracyModule = errMsg.startsWith("Accuracy Check Module Down");
      const isRateLimit =
        error instanceof Error &&
        "status" in error &&
        (error as { status: number }).status === 429;
      const status = isAccuracyModule ? 503 : isRateLimit ? 429 : 500;
      const msg = isAccuracyModule
        ? errMsg
        : isRateLimit
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

      const { messages, useToolCalling, useFeatures, useTheoria, positionHistory, currentMoveIndex, ...positionData } = parsed.data;

      let theoriaToolUsed = false;
      const promptPhaseStart = Date.now();

      const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.text ?? "";
      const recentTurns: OpenAI.ChatCompletionMessageParam[] = messages.slice(-6).map(m => ({
        role: m.role === "model" ? "assistant" as const : "user" as const,
        content: m.text,
      }));

      let classifyResult: ClassifyResult = { contextType: "current", contextNote: "" };
      let theoriaMs = 0;

      let classifyMs = 0;
      let warmupTheoriaText: string | undefined;

      {
        const timedClassify = async () => {
          if (positionHistory.length === 0) return classifyResult;
          const cs = Date.now();
          const r = await preCoachClassify(lastUserMsg, recentTurns.slice(0, -1), currentMoveIndex, positionHistory);
          classifyMs = Date.now() - cs;
          return r;
        };
        const timedTheoria = async () => {
          const ts = Date.now();
          const r = await theoriaService.getEvalText(positionData.fen).catch(() => null);
          theoriaMs = Date.now() - ts;
          return r;
        };
        let warmupResult: { formatted: string } | null = null;
        [classifyResult, warmupResult] = await Promise.all([timedClassify(), timedTheoria()]);
        warmupTheoriaText = warmupResult?.formatted;
      }

      if (classifyResult.contextType === "full_game") {
        classifyResult.contextNote = "Analyzing the entire game to identify key learnings and improvements. I will give you the before and after analysis of key pivot points in the game";
      }

      if (classifyResult.contextType === "continuation") {
        classifyResult.contextNote = "The user is asking about the idea behind a continuation. Below is full SF12, Theoria NNUE, and computed observations after each move.";
      }

      const { positions: resolvedPositions, resolvedIndices } = resolveRelevantPositions(
        classifyResult.contextType,
        positionHistory,
        currentMoveIndex
      );

      let continuationBlock: string | undefined;
      if (
        classifyResult.contextType === "continuation" &&
        classifyResult.continuationMoves &&
        classifyResult.continuationMoves.length > 0
      ) {
        continuationBlock = await buildContinuationPositions(
          positionData.fen,
          classifyResult.continuationMoves,
          useFeatures,
          warmupTheoriaText,
        );
      }

      const { message: contextMessage, timings: promptTimings } = await buildContextMessage({
        ...positionData,
        useFeatures,
        resolvedPositions: !continuationBlock && resolvedPositions.length > 0 ? resolvedPositions : undefined,
        contextNote: classifyResult.contextNote || undefined,
        theoriaText: warmupTheoriaText,
        continuationBlock,
      });
      const promptTotalMs = Date.now() - promptPhaseStart;

      const activeTools = getTools(useToolCalling, useFeatures, useTheoria);

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

        const userQuery = [...messages].reverse().find(m => m.role === "user")?.text ?? "";
        let finalResponse = "";

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
        const gptRounds: GptRound[] = [];
        let forcedResponseMs: number | undefined;

        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          if (clientDisconnected) break;

          const roundLLMStart = Date.now();
          const stream = await openai.chat.completions.create({
            model: MODEL,
            messages: chatMessages,
            max_completion_tokens: 4096,
            temperature: 0.1,
            frequency_penalty: 0.6,
            verbosity: 'low',
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

          const roundLLMMs = Date.now() - roundLLMStart;

          if (!hasToolCalls || toolCallAccum.size === 0) {
            gptRounds.push({ round: round + 1, llmMs: roundLLMMs });
            finalResponse = assistantContent;
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
          const userId = (req.user as User | undefined)?.id;
          const toolNames: string[] = [];
          const toolExecStart = Date.now();
          for (const tc of toolCallAccum.values()) {
            toolNames.push(tc.name);
            chatMessages.push(await handleToolCall(
              { id: tc.id, function: { name: tc.name, arguments: tc.args } },
              positionData.fen,
              "chat",
              clientId,
              positionData.lastMove,
              userId,
            ));
          }
          const toolMs = Date.now() - toolExecStart;

          gptRounds.push({ round: round + 1, llmMs: roundLLMMs, toolNames, toolMs });

          if (toolNames.includes("get_theoria_insights")) {
            theoriaToolUsed = true;
          }
          const statusText = toolNames.includes("get_theoria_insights")
            ? "Consulting Theoria engine..."
            : toolNames.includes("evaluate_position")
            ? "Running Theoria verification..."
            : toolNames.includes("get_position_features")
            ? "Analyzing position features..."
            : "Validating moves...";
          res.write(`data: ${JSON.stringify({ type: "status", text: statusText })}\n\n`);
        }

        if (tokenCount === 0 && !clientDisconnected) {
          console.log(`[chat] Tool rounds exhausted with 0 text tokens — forcing final response without tools`);
          const forcedStart = Date.now();
          const forcedStream = await openai.chat.completions.create({
            model: MODEL,
            messages: chatMessages,
            max_completion_tokens: 1024,
            temperature: 0.1,
            frequency_penalty: 0.6,
            verbosity: 'low',
            stream: true,
          });
          for await (const chunk of forcedStream) {
            if (clientDisconnected) break;
            const delta = chunk.choices[0]?.delta?.content;
            if (!delta) continue;
            finalResponse += delta;
            tokenCount++;
            res.write(`data: ${JSON.stringify({ type: "token", text: delta })}\n\n`);
          }
          forcedResponseMs = Date.now() - forcedStart;
        }

        const gptMs = Date.now() - startTime;
        console.log(`[chat] Streamed ${tokenCount} tokens in ${gptMs}ms`);

        logCoachInteraction({
          userQuery,
          prompt: contextMessage,
          response: finalResponse,
          timings: {
            theoriaMs,
            featureMs: promptTimings.featureMs,
            classicalMs: promptTimings.classicalMs,
            classifyMs,
            classifyContextType: classifyResult.contextType,
            resolvedIndices: resolvedIndices.filter(i => i >= 0),
            promptTotalMs,
            gptMs,
            gptRounds,
            forcedResponseMs,
          },
        });

        const chatUserId = (req.user as User | undefined)?.id;
        trackServerEvent("coach_session_complete", {
          latency_ms: gptMs,
          prompt_ms: promptTotalMs,
          theoria_ms: theoriaMs,
          token_count: tokenCount,
          tool_rounds: gptRounds.length,
          context_type: classifyResult.contextType,
          theoria_tool_used: theoriaToolUsed,
        }, chatUserId);

        clearInterval(heartbeat);
        if (!clientDisconnected) {
          res.write(`data: ${JSON.stringify({ type: "done", theoriaToolUsed })}\n\n`);
          res.end();
        }
      } catch (innerError) {
        clearInterval(heartbeat);
        throw innerError;
      }
    } catch (error: unknown) {
      console.error("Error in coach chat:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      const isAccuracyModule = errMsg.startsWith("Accuracy Check Module Down");
      const isRateLimit =
        error instanceof Error &&
        "status" in error &&
        (error as { status: number }).status === 429;
      const status = isAccuracyModule ? 503 : isRateLimit ? 429 : 500;
      const msg = isAccuracyModule
        ? errMsg
        : isRateLimit
        ? "AI service is busy. Please wait a moment and try again."
        : "Failed to get coach response";
      if (!res.headersSent) {
        res.status(status).json({ error: msg });
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

  app.get("/api/python-analyzer-status", (_req, res) => {
    const { status, retries } = pythonAnalyzerService.getStatus();
    res.json({ ready: status === "ready", status, retries });
  });

  app.post("/api/position-features", async (req, res) => {
    const { fen, lastMove } = req.body || {};
    if (!fen || typeof fen !== "string") {
      return res.status(400).json({ error: "Missing or invalid FEN" });
    }
    const cleanFen = sanitizeFen(fen);
    if (!cleanFen) return res.status(400).json({ error: "Invalid FEN string" });
    if (!pythonAnalyzerService.isReady()) {
      return res.status(503).json({ error: "Analyzer not ready" });
    }
    try {
      const result = await pythonAnalyzerService.analyze(cleanFen, typeof lastMove === "string" ? lastMove : undefined);
      return res.json(result);
    } catch (e: unknown) {
      console.error("[position-features]", e instanceof Error ? e.message : String(e));
      return res.status(500).json({ error: "Analysis failed" });
    }
  });

  app.get("/api/theoria-status", (_req, res) => {
    res.json({
      ready: theoriaService.isReady(),
      downloading: theoriaService.isDownloading(),
      hasBinary: theoriaService.hasBinary(),
      justDownloaded: theoriaService.consumeJustDownloaded(),
    });
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
