import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useStockfish } from "@/hooks/use-stockfish";
import { EvalBar } from "@/components/eval-bar";
import { MoveHistory } from "@/components/move-history";
import { EngineLines } from "@/components/engine-lines";
import { EvalGraph } from "@/components/eval-graph";
import { VariationTree } from "@/components/variation-tree";
import { CoachConsole, type ChatMessageWithFen } from "@/components/coach-console";
import { ImportGamesDialog } from "@/components/import-games-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { analytics } from "@/lib/analytics";
import { apiRequest } from "@/lib/queryClient";
import {
  RotateCcw,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Upload,
  FlipVertical2,
  Loader2,
  LogOut,
} from "lucide-react";
import logoPath from "@assets/logo_1773342065527.png";

export interface VariationNode {
  id: string;
  move: string;
  fen: string;
  score: { score: number; mate: number | null } | null;
  children: VariationNode[];
  clock?: string;
}

export interface GameMeta {
  white: { name: string; rating?: number };
  black: { name: string; rating?: number };
}

function parseClock(comment: string): string | undefined {
  const m = comment.match(/\[%clk (\d+):(\d+):(\d+)\]/);
  if (!m) return undefined;
  const totalMins = parseInt(m[1]) * 60 + parseInt(m[2]);
  const secs = parseInt(m[3]);
  return `${totalMins}:${secs.toString().padStart(2, "0")}`;
}

const PIECE_ORDER = ["Q", "R", "B", "N", "P", "q", "r", "b", "n", "p"];
const PIECE_SYMBOLS: Record<string, string> = {
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕",
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛",
};
const PIECE_VALUES: Record<string, number> = { Q: 9, R: 5, B: 3, N: 3, P: 1 };

function computeCapturedPieces(fen: string): { whiteCaptured: string[]; blackCaptured: string[] } {
  const start: Record<string, number> = { P: 8, N: 2, B: 2, R: 2, Q: 1, p: 8, n: 2, b: 2, r: 2, q: 1 };
  const cur: Record<string, number> = {};
  for (const ch of fen.split(" ")[0]) {
    if (/[pnbrqPNBRQ]/.test(ch)) cur[ch] = (cur[ch] || 0) + 1;
  }
  const whiteCaptured: string[] = [];
  const blackCaptured: string[] = [];
  for (const p of PIECE_ORDER) {
    const diff = (start[p] || 0) - (cur[p] || 0);
    const isBlack = p === p.toLowerCase();
    for (let i = 0; i < diff; i++) {
      (isBlack ? whiteCaptured : blackCaptured).push(p);
    }
  }
  return { whiteCaptured, blackCaptured };
}

function materialAdvantage(captured: string[]): number {
  return captured.reduce((sum, p) => sum + (PIECE_VALUES[p.toUpperCase()] || 0), 0);
}

interface PlayerBandProps {
  name?: string;
  rating?: number;
  color: "white" | "black";
  captured: string[];
  netAdvantage: number;
  clock?: string;
  isBottom: boolean;
}

function PlayerBand({ name, rating, color, captured, netAdvantage, clock, isBottom }: PlayerBandProps) {
  if (!name) return null;
  return (
    <div
      className="flex items-center justify-between gap-2 py-1 px-0.5"
      data-testid={isBottom ? "player-band-bottom" : "player-band-top"}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
            color === "white"
              ? "bg-white border-muted-foreground/50"
              : "bg-foreground border-muted-foreground/50"
          }`}
        />
        <span className="font-semibold text-sm text-foreground truncate">{name}</span>
        {rating !== undefined && (
          <span className="text-xs text-muted-foreground shrink-0">({rating})</span>
        )}
        {captured.length > 0 && (
          <span className="flex items-center gap-0 ml-1">
            {captured.map((p, i) => (
              <span key={i} style={{ fontSize: 17, lineHeight: 1, color: "#1e3a5f" }}>
                {PIECE_SYMBOLS[p]}
              </span>
            ))}
            {netAdvantage > 0 && (
              <span className="ml-1 text-[11px] font-semibold" style={{ color: "#1e3a5f" }}>+{netAdvantage}</span>
            )}
          </span>
        )}
      </div>
      {clock && (
        <span className="text-sm font-mono font-semibold tabular-nums text-foreground bg-muted px-2 py-0.5 rounded shrink-0">
          {clock}
        </span>
      )}
    </div>
  );
}

let _nodeId = 0;
function nextNodeId(): string {
  return `n${++_nodeId}`;
}

function createRootNode(): VariationNode {
  return {
    id: nextNodeId(),
    move: "",
    fen: new Chess().fen(),
    score: null,
    children: [],
  };
}

function cloneTree(node: VariationNode): VariationNode {
  return {
    ...node,
    children: node.children.map(cloneTree),
  };
}

function findNodeById(node: VariationNode, id: string): VariationNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

function getPathToNode(root: VariationNode, targetId: string): string[] | null {
  if (root.id === targetId) return [root.id];
  for (const child of root.children) {
    const subPath = getPathToNode(child, targetId);
    if (subPath) return [root.id, ...subPath];
  }
  return null;
}

function getActiveLine(root: VariationNode, currentPath: string[]): VariationNode[] {
  const line: VariationNode[] = [];
  let current: VariationNode | null = root;

  for (let i = 1; i < currentPath.length; i++) {
    const child = current.children.find(c => c.id === currentPath[i]);
    if (!child) break;
    line.push(child);
    current = child;
  }

  if (current) {
    let node = current;
    while (node.children.length > 0) {
      const firstChild = node.children[0];
      if (line.includes(firstChild)) break;
      line.push(firstChild);
      node = firstChild;
    }
  }

  return line;
}

function findNodeByFen(node: VariationNode, fen: string): string | null {
  if (node.fen === fen) return node.id;
  for (const child of node.children) {
    const found = findNodeByFen(child, fen);
    if (found) return found;
  }
  return null;
}

function collectTreeFens(node: VariationNode, out: Array<{ fen: string; nodeId: string }>) {
  out.push({ fen: node.fen, nodeId: node.id });
  for (const child of node.children) {
    collectTreeFens(child, out);
  }
}

function squareToPixel(sq: string, size: number, orient: "white" | "black") {
  const f = sq.charCodeAt(0) - 97;
  const r = parseInt(sq[1]) - 1;
  const s = size / 8;
  return orient === "white"
    ? { x: f * s + s / 2, y: (7 - r) * s + s / 2 }
    : { x: (7 - f) * s + s / 2, y: r * s + s / 2 };
}

function getArrowMidpoint(from: string, to: string, size: number, orient: "white" | "black") {
  const p1 = squareToPixel(from, size, orient);
  const p2 = squareToPixel(to, size, orient);
  return { x: p1.x + 0.4 * (p2.x - p1.x), y: p1.y + 0.4 * (p2.y - p1.y) };
}

function setNodeScore(
  root: VariationNode,
  nodeId: string,
  score: { score: number; mate: number | null }
): VariationNode {
  if (root.id === nodeId) {
    return { ...root, score };
  }
  return {
    ...root,
    children: root.children.map(child => setNodeScore(child, nodeId, score)),
  };
}

const FREE_GAME_LIMIT = 5;
const GAME_COUNT_KEY = "chess_games_loaded";
const isInIframe = window.self !== window.top;

function getGameCount(): number {
  try {
    return parseInt(localStorage.getItem(GAME_COUNT_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

function incrementGameCount(): number {
  const next = getGameCount() + 1;
  try {
    localStorage.setItem(GAME_COUNT_KEY, String(next));
  } catch {}
  return next;
}

export default function ChessCoach() {
  const [game, setGame] = useState(new Chess());
  const [tree, setTree] = useState<VariationNode>(createRootNode);
  const [currentPath, setCurrentPath] = useState<string[]>(() => [tree.id]);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [gameMeta, setGameMeta] = useState<GameMeta | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessageWithFen[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [hoverArrows, setHoverArrows] = useState<Array<{ from: string; to: string; moveNum: number }>>([]);
  const coachSequencePending = useRef(false);
  const [useToolCalling, setUseToolCalling] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isComputingScores, setIsComputingScores] = useState(false);
  const [computeProgress, setComputeProgress] = useState({ current: 0, total: 0 });
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(400);
  const isNavigatingRef = useRef(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const { user, isAuthenticated, logout } = useAuth();
  const { evaluation, isReady, hasError, evaluate, evaluateAsync, endBatch } = useStockfish();
  const { toast } = useToast();

  useEffect(() => {
    if (isAuthenticated) {
      setShowPaywall(false);
    } else if (!isAuthenticated && !isInIframe && getGameCount() >= FREE_GAME_LIMIT) {
      setShowPaywall(true);
    }
  }, [isAuthenticated]);

  const activeLine = useMemo(() => getActiveLine(tree, currentPath), [tree, currentPath]);

  const currentMoveIndex = currentPath.length - 2;

  const allMoves = useMemo(() => activeLine.map(n => n.move), [activeLine]);

  const scoreHistory = useMemo(
    () => activeLine.map(n => n.score),
    [activeLine]
  );

  const hasScores = useMemo(() => activeLine.some(n => n.score !== null), [activeLine]);

  // Clocks: find most recent clock for each side up to currentMoveIndex
  const { whiteClock, blackClock } = useMemo(() => {
    let wClock: string | undefined;
    let bClock: string | undefined;
    for (let i = 0; i <= currentMoveIndex; i++) {
      const node = activeLine[i + 1];
      if (!node) break;
      if (i % 2 === 0) { if (node.clock) wClock = node.clock; }
      else              { if (node.clock) bClock = node.clock; }
    }
    return { whiteClock: wClock, blackClock: bClock };
  }, [activeLine, currentMoveIndex]);

  // Captured pieces from current FEN
  const { whiteCaptured, blackCaptured } = useMemo(
    () => computeCapturedPieces(game.fen()),
    [game]
  );

  // Net material advantage per side
  const { whiteAdv, blackAdv } = useMemo(() => {
    const wMat = materialAdvantage(whiteCaptured);
    const bMat = materialAdvantage(blackCaptured);
    return { whiteAdv: Math.max(0, wMat - bMat), blackAdv: Math.max(0, bMat - wMat) };
  }, [whiteCaptured, blackCaptured]);

  const currentNodeId = currentPath[currentPath.length - 1];

  const treeFallbackFens = useMemo(() => {
    const out: Array<{ fen: string; nodeId: string }> = [];
    collectTreeFens(tree, out);
    return out;
  }, [tree]);

  const getCurrentPgn = useCallback(() => {
    const pgnGame = new Chess();
    const movesUpToCurrent = allMoves.slice(0, currentMoveIndex + 1);
    for (const move of movesUpToCurrent) {
      pgnGame.move(move);
    }
    return pgnGame.pgn();
  }, [allMoves, currentMoveIndex]);

  const getPositionContext = useCallback(() => {
    const evalDisplay =
      evaluation.mate !== null
        ? `Mate in ${Math.abs(evaluation.mate)}`
        : evaluation.score >= 0
          ? `+${evaluation.score.toFixed(1)}`
          : evaluation.score.toFixed(1);

    return {
      fen: game.fen(),
      pgn: getCurrentPgn(),
      evaluation: evalDisplay,
      topMoves: evaluation.topMoves,
      engineLines: evaluation.lines,
      turn: game.turn() as "w" | "b",
      playerColor,
    };
  }, [game, getCurrentPgn, evaluation, playerColor]);

  useEffect(() => {
    const updateBoardSize = () => {
      if (boardContainerRef.current) {
        const container = boardContainerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;
        const size = Math.min(width, height, 480);
        setBoardSize(size);
      }
    };

    updateBoardSize();
    const observer = new ResizeObserver(updateBoardSize);
    if (boardContainerRef.current) {
      observer.observe(boardContainerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isReady && !isComputingScores) {
      isNavigatingRef.current = false;
      evaluate(game.fen(), game.turn());
    }
  }, [game, isReady, evaluate, isComputingScores]);

  useEffect(() => {
    if (currentMoveIndex >= 0 && evaluation.depth >= 10 && !isComputingScores && !isNavigatingRef.current) {
      const nodeToUpdate = currentNodeId;
      const currentNode = findNodeById(tree, nodeToUpdate);
      if (currentNode && !currentNode.score) {
        setTree(prev => setNodeScore(prev, nodeToUpdate, { score: evaluation.score, mate: evaluation.mate }));
      }
    }
  }, [currentMoveIndex, evaluation.score, evaluation.mate, evaluation.depth, isComputingScores, currentNodeId, tree]);

  const makeMove = useCallback(
    (sourceSquare: string, targetSquare: string, piece: string) => {
      const gameCopy = new Chess(game.fen());
      const isPromotion = piece[1] === "P" && (targetSquare[1] === "8" || targetSquare[1] === "1");

      try {
        const move = gameCopy.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: isPromotion ? "q" : undefined,
        });

        if (!move) return false;

        const currentNode = findNodeById(tree, currentNodeId);
        if (!currentNode) return false;

        const existingChild = currentNode.children.find(c => c.move === move.san);

        if (existingChild) {
          setCurrentPath(prev => [...prev, existingChild.id]);
          setGame(gameCopy);
          isNavigatingRef.current = true;
        } else {
          const newNode: VariationNode = {
            id: nextNodeId(),
            move: move.san,
            fen: gameCopy.fen(),
            score: null,
            children: [],
          };

          setTree(prev => {
            const clone = cloneTree(prev);
            const parent = findNodeById(clone, currentNodeId);
            if (parent) {
              parent.children.push(newNode);
            }
            return clone;
          });

          setCurrentPath(prev => [...prev, newNode.id]);
          setGame(gameCopy);
          isNavigatingRef.current = false;
        }
        return true;
      } catch {
        return false;
      }
    },
    [game, tree, currentNodeId]
  );

  const goToMove = useCallback(
    (index: number) => {
      isNavigatingRef.current = true;
      const targetDepth = index + 2;
      const line = activeLine;
      const newPath = [currentPath[0]];
      const gameCopy = new Chess();
      for (let i = 0; i < Math.min(index + 1, line.length); i++) {
        newPath.push(line[i].id);
        gameCopy.move(line[i].move);
      }
      if (newPath.length > targetDepth) {
        newPath.splice(targetDepth);
      }
      setCurrentPath(newPath);
      setGame(gameCopy);
    },
    [activeLine, currentPath]
  );

  const goToStart = useCallback(() => {
    isNavigatingRef.current = true;
    setCurrentPath(prev => [prev[0]]);
    setGame(new Chess());
  }, []);

  const goToEnd = useCallback(() => {
    if (activeLine.length > 0) {
      goToMove(activeLine.length - 1);
    }
  }, [activeLine, goToMove]);

  const goBack = useCallback(() => {
    if (currentMoveIndex >= 0) {
      if (currentMoveIndex === 0) {
        goToStart();
      } else {
        goToMove(currentMoveIndex - 1);
      }
    }
  }, [currentMoveIndex, goToMove, goToStart]);

  const goForward = useCallback(() => {
    if (currentMoveIndex < activeLine.length - 1) {
      goToMove(currentMoveIndex + 1);
    }
  }, [currentMoveIndex, activeLine, goToMove]);

  const resetBoard = useCallback(() => {
    const newRoot = createRootNode();
    setTree(newRoot);
    setCurrentPath([newRoot.id]);
    setGame(new Chess());
    setGameMeta(null);
  }, []);

  const navigateToNode = useCallback((nodeId: string) => {
    isNavigatingRef.current = true;
    const path = getPathToNode(tree, nodeId);
    if (!path) return;

    const gameCopy = new Chess();
    for (let i = 1; i < path.length; i++) {
      const node = findNodeById(tree, path[i]);
      if (node) {
        gameCopy.move(node.move);
      }
    }

    setCurrentPath(path);
    setGame(gameCopy);
  }, [tree]);

  const loadPgn = useCallback(async (pgn: string, importedUsername?: string) => {
    if (!pgn.trim()) {
      toast({
        title: "Empty PGN",
        description: "Please paste a PGN string first.",
        variant: "destructive",
      });
      return;
    }

    if (!isAuthenticated && !isInIframe) {
      const count = getGameCount();
      if (count >= FREE_GAME_LIMIT) {
        setShowPaywall(true);
        analytics.paywallShown(count);
        return;
      }
    }

    try {
      const gameCopy = new Chess();
      gameCopy.loadPgn(pgn.trim());
      const history = gameCopy.history();

      if (history.length === 0) {
        toast({
          title: "Invalid PGN",
          description: "Could not parse any moves from the PGN.",
          variant: "destructive",
        });
        return;
      }

      // Parse PGN headers for player metadata
      const headers = gameCopy.header();
      const whiteName = headers.White && headers.White !== "?" ? headers.White : undefined;
      const blackName = headers.Black && headers.Black !== "?" ? headers.Black : undefined;
      const whiteElo = headers.WhiteElo ? parseInt(headers.WhiteElo) : undefined;
      const blackElo = headers.BlackElo ? parseInt(headers.BlackElo) : undefined;

      if (whiteName || blackName) {
        setGameMeta({
          white: { name: whiteName || "White", rating: isNaN(whiteElo!) ? undefined : whiteElo },
          black: { name: blackName || "Black", rating: isNaN(blackElo!) ? undefined : blackElo },
        });
      } else {
        setGameMeta(null);
      }

      // Auto-detect which side the imported user plays
      if (importedUsername) {
        const uLower = importedUsername.toLowerCase();
        if (whiteName && whiteName.toLowerCase() === uLower) {
          setPlayerColor("white");
          setBoardOrientation("white");
        } else if (blackName && blackName.toLowerCase() === uLower) {
          setPlayerColor("black");
          setBoardOrientation("black");
        }
      }

      // Build a FEN→comment map from the PGN (clock annotations live in comments)
      const commentMap = new Map<string, string>();
      for (const { fen: cFen, comment } of gameCopy.getComments()) {
        commentMap.set(cFen, comment);
      }

      // Parse clock times by replaying move-by-move and looking up each FEN
      const clockGame = new Chess();
      const clocks: (string | undefined)[] = [];
      for (const moveSan of history) {
        clockGame.move(moveSan);
        const comment = commentMap.get(clockGame.fen()) || "";
        clocks.push(parseClock(comment));
      }

      const newRoot = createRootNode();
      let currentNode = newRoot;
      const newPath = [newRoot.id];
      const tempGame = new Chess();

      for (let i = 0; i < history.length; i++) {
        const moveSan = history[i];
        tempGame.move(moveSan);
        const child: VariationNode = {
          id: nextNodeId(),
          move: moveSan,
          fen: tempGame.fen(),
          score: null,
          children: [],
          clock: clocks[i],
        };
        currentNode.children.push(child);
        newPath.push(child.id);
        currentNode = child;
      }

      setTree(newRoot);
      setCurrentPath(newPath);
      setGame(gameCopy);

      if (!isAuthenticated && !isInIframe) {
        const newCount = incrementGameCount();
        if (newCount >= FREE_GAME_LIMIT) {
          setShowPaywall(true);
        }
      }

      if (isReady) {
        setIsComputingScores(true);
        setComputeProgress({ current: 0, total: history.length });
        const tempGame2 = new Chess();
        let updatedTree = cloneTree(newRoot);

        for (let i = 0; i < history.length; i++) {
          tempGame2.move(history[i]);
          setComputeProgress({ current: i + 1, total: history.length });
          const result = await evaluateAsync(tempGame2.fen(), tempGame2.turn(), 12);
          updatedTree = setNodeScore(updatedTree, newPath[i + 1], result);
        }

        setTree(updatedTree);
        setIsComputingScores(false);
        endBatch();
        evaluate(gameCopy.fen(), gameCopy.turn());
      }

      toast({
        title: "PGN Loaded",
        description: `Loaded ${history.length} moves successfully.`,
      });
    } catch {
      setIsComputingScores(false);
      endBatch();
      toast({
        title: "Invalid PGN",
        description: "The PGN format is invalid. Please check and try again.",
        variant: "destructive",
      });
    }
  }, [toast, isReady, evaluateAsync, evaluate, endBatch, isAuthenticated]);

  const cancelChat = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const sendChatMessage = useCallback(async (text: string) => {
    analytics.chatMessageSent(isAuthenticated);
    const msgFen = game.fen();
    const msgNodeId = currentNodeId;
    const userMessage: ChatMessageWithFen = { role: "user", text, fen: msgFen, nodeId: msgNodeId };
    setChatMessages(prev => [...prev, userMessage]);
    setIsChatLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const context = getPositionContext();
      const currentMessages = [...chatMessages, userMessage];

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...context,
          messages: currentMessages,
          useToolCalling,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text()}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No stream reader");

      const decoder = new TextDecoder();
      let accumulated = "";
      let modelMessageAdded = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "token") {
              accumulated += event.text;
              if (!modelMessageAdded) {
                modelMessageAdded = true;
                setChatMessages(prev => [...prev, { role: "model", text: accumulated, fen: msgFen, nodeId: msgNodeId }]);
              } else {
                setChatMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "model", text: accumulated, fen: msgFen, nodeId: msgNodeId };
                  return updated;
                });
              }
            } else if (event.type === "status") {
              if (!modelMessageAdded) {
                modelMessageAdded = true;
                setChatMessages(prev => [...prev, { role: "model", text: `_${event.text}_`, fen: msgFen, nodeId: msgNodeId }]);
              } else {
                setChatMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "model", text: `_${event.text}_`, fen: msgFen, nodeId: msgNodeId };
                  return updated;
                });
              }
            } else if (event.type === "error") {
              throw new Error(event.text);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }

      if (!modelMessageAdded) {
        setChatMessages(prev => [...prev, { role: "model", text: "I couldn't generate a response. Please try again.", fen: msgFen, nodeId: msgNodeId }]);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      toast({
        title: "Chat Error",
        description: "Could not get a response. Please try again.",
        variant: "destructive",
      });
    } finally {
      abortControllerRef.current = null;
      setIsChatLoading(false);
    }
  }, [chatMessages, getPositionContext, toast, useToolCalling, game, currentNodeId]);

  const explainMove = useCallback((moveUci: string, moveSan: string, score: string, pvSan: string) => {
    const turnLabel = game.turn() === "w" ? "White" : "Black";
    const question = `Why is ${moveSan} (${score}) the engine's recommended move for ${turnLabel}? The continuation is: ${pvSan}. Explain the idea behind this move.`;
    sendChatMessage(question);
  }, [game, sendChatMessage]);

  const playCoachSequence = useCallback(async (startFen: string, startNodeId: string | undefined, sanMoves: string[]) => {
    if (sanMoves.length === 0) return;
    if (coachSequencePending.current) return;
    coachSequencePending.current = true;
    setHoverArrows([]);

    const unlock = () => { coachSequencePending.current = false; };

    let branchNodeId: string | null = null;
    if (startNodeId) {
      const node = findNodeById(tree, startNodeId);
      if (node) branchNodeId = startNodeId;
    }
    if (!branchNodeId) branchNodeId = findNodeByFen(tree, startFen);
    if (!branchNodeId) {
      toast({ title: "Position not found", description: "Could not find the position in the game tree.", variant: "destructive" });
      unlock();
      return;
    }

    const branchPath = getPathToNode(tree, branchNodeId);
    if (!branchPath) { unlock(); return; }

    const branchNode = findNodeById(tree, branchNodeId);
    if (!branchNode) { unlock(); return; }

    let currentNode = branchNode;
    const followedPath = [...branchPath];
    const remainingMoves = [...sanMoves];

    while (remainingMoves.length > 0) {
      const existing = currentNode.children.find(c => c.move === remainingMoves[0]);
      if (existing) {
        followedPath.push(existing.id);
        currentNode = existing;
        remainingMoves.shift();
      } else {
        break;
      }
    }

    if (remainingMoves.length === 0) {
      isNavigatingRef.current = true;
      setCurrentPath(followedPath);
      setGame(new Chess(currentNode.fen));
      toast({ title: "Existing Line", description: "Navigated to existing variation." });
      unlock();
      return;
    }

    const playGame = new Chess(currentNode.fen);
    const newNodes: VariationNode[] = [];
    for (const san of remainingMoves) {
      try {
        const result = playGame.move(san);
        if (!result) break;
        newNodes.push({ id: nextNodeId(), move: result.san, fen: playGame.fen(), score: null, children: [] });
      } catch (_e) { break; }
    }

    if (newNodes.length === 0) {
      isNavigatingRef.current = true;
      setCurrentPath(followedPath);
      setGame(new Chess(currentNode.fen));
      unlock();
      return;
    }

    for (let i = 0; i < newNodes.length - 1; i++) newNodes[i].children.push(newNodes[i + 1]);

    const attachId = currentNode.id;
    setTree(prev => {
      const clone = cloneTree(prev);
      const parent = findNodeById(clone, attachId);
      if (parent) parent.children.push(newNodes[0]);
      return clone;
    });

    const fullPath = [...followedPath, ...newNodes.map(n => n.id)];
    setCurrentPath(fullPath);
    setGame(new Chess(playGame.fen()));

    toast({ title: "Coach Line Added", description: `Added ${newNodes.length} new moves.` });

    if (isReady) {
      setIsComputingScores(true);
      setComputeProgress({ current: 0, total: newNodes.length });
      for (let i = 0; i < newNodes.length; i++) {
        const evalG = new Chess(newNodes[i].fen);
        setComputeProgress({ current: i + 1, total: newNodes.length });
        const result = await evaluateAsync(newNodes[i].fen, evalG.turn(), 12);
        setTree(prev => setNodeScore(prev, newNodes[i].id, result));
      }
      setIsComputingScores(false);
      endBatch();
      evaluate(playGame.fen(), playGame.turn());
    }

    unlock();
  }, [tree, toast, isReady, evaluateAsync, endBatch, evaluate]);

  const handleHoverMoves = useCallback((arrows: Array<{ from: string; to: string; moveNum: number }> | null) => {
    setHoverArrows(arrows || []);
  }, []);

  const loadEngineLine = useCallback(async (pvUci: string[], baseFen: string) => {
    if (pvUci.length === 0) {
      toast({ title: "No moves", description: "Engine line is empty.", variant: "destructive" });
      return;
    }

    const pvGame = new Chess(baseFen);
    const newNodes: VariationNode[] = [];
    for (const uci of pvUci) {
      try {
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promotion = uci.length > 4 ? uci[4] : undefined;
        const move = pvGame.move({ from, to, promotion });
        if (!move) break;

        const child: VariationNode = {
          id: nextNodeId(),
          move: move.san,
          fen: pvGame.fen(),
          score: null,
          children: [],
        };
        newNodes.push(child);
      } catch {
        break;
      }
    }

    if (newNodes.length === 0) {
      toast({ title: "Could not load line", description: "No valid moves in engine PV.", variant: "destructive" });
      return;
    }

    for (let i = 0; i < newNodes.length - 1; i++) {
      newNodes[i].children.push(newNodes[i + 1]);
    }

    const branchNodeId = currentNodeId;
    const branchPath = [...currentPath];

    setTree(prev => {
      const clone = cloneTree(prev);
      const parent = findNodeById(clone, branchNodeId);
      if (parent) {
        const existing = parent.children.find(c => c.move === newNodes[0].move);
        if (!existing) {
          parent.children.push(newNodes[0]);
        }
      }
      return clone;
    });

    const newPath = [...branchPath, ...newNodes.map(n => n.id)];
    setCurrentPath(newPath);
    setGame(new Chess(pvGame.fen()));

    toast({
      title: "Engine Line Loaded",
      description: `Loaded ${newNodes.length} moves as branch. Computing evaluations...`,
    });

    setIsComputingScores(true);
    setComputeProgress({ current: 0, total: newNodes.length });

    const evalPositions = newNodes.map(n => ({ id: n.id, fen: n.fen }));

    for (let i = 0; i < evalPositions.length; i++) {
      const pos = evalPositions[i];
      const evalG = new Chess(pos.fen);
      setComputeProgress({ current: i + 1, total: evalPositions.length });
      const result = await evaluateAsync(pos.fen, evalG.turn(), 12);
      setTree(prevTree => setNodeScore(prevTree, pos.id, result));
    }

    setIsComputingScores(false);
    endBatch();
    evaluate(pvGame.fen(), pvGame.turn());
  }, [currentNodeId, currentPath, toast, evaluateAsync, endBatch, evaluate]);

  const clearChat = useCallback(() => {
    setChatMessages([]);
    setHoverArrows([]);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); goBack(); }
      if (e.key === "ArrowRight") { e.preventDefault(); goForward(); }
      if (e.key === "Home") { e.preventDefault(); goToStart(); }
      if (e.key === "End") { e.preventDefault(); goToEnd(); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goBack, goForward, goToStart, goToEnd]);

  const gameStatus = game.isCheckmate()
    ? "Checkmate!"
    : game.isDraw()
      ? "Draw"
      : game.isStalemate()
        ? "Stalemate"
        : game.isCheck()
          ? "Check!"
          : game.turn() === "w"
            ? "White to move"
            : "Black to move";


  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <img src={logoPath} alt="Chess Analysis" className="w-9 h-9 object-contain" />
          <div>
            <h1 className="text-base font-bold leading-tight" data-testid="text-app-title">
              Chess Analysis
            </h1>
            <p className="text-xs text-muted-foreground leading-tight">
              LLMs fact checked by Stockfish
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 ml-2"
            onClick={() => setShowImportModal(true)}
            data-testid="button-open-pgn"
          >
            <Upload className="w-3.5 h-3.5" />
            Import Games
          </Button>
          <ImportGamesDialog
            open={showImportModal}
            onOpenChange={setShowImportModal}
            onLoadPgn={loadPgn}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Analyse as:</span>
          <div className="flex items-center gap-1.5 border border-border rounded-md p-0.5" data-testid="player-color-selector">
            <button
              onClick={() => { setPlayerColor("white"); setBoardOrientation("white"); }}
              className={`text-xs font-medium px-2.5 py-1 rounded-sm transition-colors ${
                playerColor === "white"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground"
              }`}
              data-testid="button-play-white"
            >
              White
            </button>
            <button
              onClick={() => { setPlayerColor("black"); setBoardOrientation("black"); }}
              className={`text-xs font-medium px-2.5 py-1 rounded-sm transition-colors ${
                playerColor === "black"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground"
              }`}
              data-testid="button-play-black"
            >
              Black
            </button>
          </div>
          <span
            className={`text-xs font-medium px-2 py-1 rounded-md ${
              hasError
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : isReady
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
            }`}
            data-testid="status-engine"
          >
            {hasError ? "Engine Error" : isReady ? "Engine Ready" : "Loading Engine..."}
          </span>
          <span
            className="text-xs font-medium px-2 py-1 rounded-md bg-muted text-muted-foreground"
            data-testid="status-game"
          >
            {gameStatus}
          </span>
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2 ml-auto">
              {user.avatarUrl && (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-7 h-7 rounded-full"
                  data-testid="img-user-avatar"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="text-sm font-medium text-foreground hidden sm:inline" data-testid="text-user-name">
                {user.name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { analytics.signedOut(); logout(); }}
                className="gap-1 text-muted-foreground"
                data-testid="button-logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <a
              href="/api/auth/google"
              onClick={() => analytics.signInStarted()}
              className="ml-auto text-xs font-medium text-primary hover:underline"
              data-testid="link-sign-in"
            >
              Sign in with Google
            </a>
          )}
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex flex-1 min-h-0 min-w-0">
          <div className="flex items-stretch py-4 pl-4">
            <EvalBar evaluation={evaluation} isReady={isReady} />
          </div>

          <div className="flex flex-col flex-1 min-w-0 p-4 gap-1">
            {/* Top player band (opponent) */}
            {gameMeta && (
              <div style={{ width: boardSize }} className="mx-auto shrink-0">
                <PlayerBand
                  name={boardOrientation === "white" ? gameMeta.black.name : gameMeta.white.name}
                  rating={boardOrientation === "white" ? gameMeta.black.rating : gameMeta.white.rating}
                  color={boardOrientation === "white" ? "black" : "white"}
                  captured={boardOrientation === "white" ? blackCaptured : whiteCaptured}
                  netAdvantage={boardOrientation === "white" ? blackAdv : whiteAdv}
                  clock={boardOrientation === "white" ? blackClock : whiteClock}
                  isBottom={false}
                />
              </div>
            )}

            <div
              ref={boardContainerRef}
              className="flex items-center justify-center min-h-0"
              style={{ flex: "0 0 auto" }}
            >
              <div style={{ width: boardSize, height: boardSize, position: "relative" }}>
                <Chessboard
                  id="chess-board"
                  position={game.fen()}
                  onPieceDrop={makeMove}
                  boardOrientation={boardOrientation}
                  boardWidth={boardSize}
                  customBoardStyle={{
                    borderRadius: "6px",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                  }}
                  customDarkSquareStyle={{ backgroundColor: "#779952" }}
                  customLightSquareStyle={{ backgroundColor: "#edeed1" }}
                  customNotationStyle={{ fontSize: "14px", fontWeight: "bold", opacity: 0.8 }}
                  customArrows={hoverArrows.map(a => [a.from as Square, a.to as Square, "rgba(255, 170, 0, 0.75)"])}
                  animationDuration={200}
                />
                {hoverArrows.length > 0 && (
                  <div
                    style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10 }}
                    data-testid="arrow-overlay"
                  >
                    {hoverArrows.map((arrow, i) => {
                      const pos = getArrowMidpoint(arrow.from, arrow.to, boardSize, boardOrientation);
                      return (
                        <div
                          key={i}
                          data-testid={`arrow-badge-${i}`}
                          style={{
                            position: "absolute",
                            left: pos.x - 11,
                            top: pos.y - 11,
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            backgroundColor: "rgba(255, 170, 0, 0.95)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "12px",
                            fontWeight: 700,
                            border: "2px solid rgba(255,255,255,0.85)",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
                          }}
                        >
                          {arrow.moveNum}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom player band (user's side) */}
            {gameMeta && (
              <div style={{ width: boardSize }} className="mx-auto shrink-0">
                <PlayerBand
                  name={boardOrientation === "white" ? gameMeta.white.name : gameMeta.black.name}
                  rating={boardOrientation === "white" ? gameMeta.white.rating : gameMeta.black.rating}
                  color={boardOrientation === "white" ? "white" : "black"}
                  captured={boardOrientation === "white" ? whiteCaptured : blackCaptured}
                  netAdvantage={boardOrientation === "white" ? whiteAdv : blackAdv}
                  clock={boardOrientation === "white" ? whiteClock : blackClock}
                  isBottom={true}
                />
              </div>
            )}

            <div className="flex items-center justify-center gap-1 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                onClick={goToStart}
                disabled={currentMoveIndex < 0}
                data-testid="button-first-move"
              >
                <ChevronFirst className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={goBack}
                disabled={currentMoveIndex < 0}
                data-testid="button-prev-move"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={goForward}
                disabled={currentMoveIndex >= activeLine.length - 1}
                data-testid="button-next-move"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={goToEnd}
                disabled={currentMoveIndex >= activeLine.length - 1}
                data-testid="button-last-move"
              >
                <ChevronLast className="w-4 h-4" />
              </Button>
              <div className="w-px h-5 bg-border mx-1" />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setBoardOrientation(o => o === "white" ? "black" : "white")}
                data-testid="button-flip-board"
              >
                <FlipVertical2 className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={resetBoard}
                data-testid="button-reset"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>

            <div className="shrink-0 relative">
              <EvalGraph
                scores={hasScores ? scoreHistory : []}
                currentMoveIndex={currentMoveIndex}
                onMoveClick={goToMove}
              />
              {isComputingScores && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm rounded-md flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-xs font-medium text-muted-foreground" data-testid="text-computing-scores">
                    Computing evaluations... {computeProgress.current}/{computeProgress.total}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 min-h-[100px] border border-border rounded-md overflow-hidden bg-muted/20 flex flex-col">
              <div className="px-3 py-1.5 border-b border-border bg-muted/40 shrink-0">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Gameline Tree
                </h3>
              </div>
              <div className="flex-1 overflow-auto">
                <VariationTree
                  tree={tree}
                  currentPath={currentPath}
                  onNodeClick={navigateToNode}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-[320px] max-w-[480px] border-l border-border flex flex-col min-h-0">
          <div className="h-[160px] border-b border-border overflow-hidden shrink-0">
            <MoveHistory
              moves={allMoves}
              currentMoveIndex={currentMoveIndex}
              onMoveClick={goToMove}
            />
          </div>
          <div className="border-b border-border shrink-0">
            <div className="flex items-center px-4 pt-2 pb-1">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Engine Lines
              </h3>
              {evaluation.depth > 0 && (
                <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                  depth {evaluation.depth}
                </span>
              )}
            </div>
            <EngineLines
              lines={evaluation.lines}
              fen={game.fen()}
              turn={game.turn() as "w" | "b"}
              isReady={isReady}
              onExplainMove={explainMove}
              onAnalyzeLine={loadEngineLine}
              onHoverMoves={handleHoverMoves}
              onClickSequence={playCoachSequence}
              currentNodeId={currentNodeId}
            />
          </div>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <CoachConsole
              evaluation={evaluation}
              messages={chatMessages}
              onSendMessage={sendChatMessage}
              isChatLoading={isChatLoading}
              onClearChat={clearChat}
              onCancelChat={cancelChat}
              useToolCalling={useToolCalling}
              onToggleToolCalling={setUseToolCalling}
              gameFen={game.fen()}
              fallbackFens={treeFallbackFens}
              onHoverMoves={handleHoverMoves}
              onClickSequence={playCoachSequence}
            />
          </div>
        </div>
      </div>

      {showPaywall && !isAuthenticated && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.6)" }}
          data-testid="paywall-overlay"
        >
          <div className="bg-background rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 text-center border border-border">
            <img src={logoPath} alt="Chess Analysis" className="w-16 h-16 mx-auto mb-4 object-contain" />
            <h2 className="text-xl font-bold text-foreground mb-2">You've used your 5 free games</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Sign in with Google to get unlimited access for free.
            </p>
            <a
              href="/api/auth/google"
              onClick={() => analytics.paywallSignInClicked()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground text-background px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity w-full"
              data-testid="button-paywall-sign-in"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </a>
          </div>
        </div>
      )}

      <footer className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground mt-auto">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-foreground transition-colors">Terms of Use</a>
          <a href="/about" className="hover:text-foreground transition-colors">About Us</a>
          <a href="/contact" className="hover:text-foreground transition-colors">Contact Us</a>
        </div>
      </footer>
    </div>
  );
}
