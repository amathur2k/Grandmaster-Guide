import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useStockfish } from "@/hooks/use-stockfish";
import { EvalBar } from "@/components/eval-bar";
import { MoveHistory } from "@/components/move-history";
import { EngineLines } from "@/components/engine-lines";
import { EvalGraph } from "@/components/eval-graph";
import { VariationTree } from "@/components/variation-tree";
import { CoachConsole } from "@/components/coach-console";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ChatMessage } from "@shared/schema";
import {
  RotateCcw,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Upload,
  FlipVertical2,
  Loader2,
} from "lucide-react";
import logoPath from "@assets/logo_final.png";

export interface VariationNode {
  id: string;
  move: string;
  fen: string;
  score: { score: number; mate: number | null } | null;
  children: VariationNode[];
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

export default function ChessCoach() {
  const [game, setGame] = useState(new Chess());
  const [tree, setTree] = useState<VariationNode>(createRootNode);
  const [currentPath, setCurrentPath] = useState<string[]>(() => [tree.id]);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [pgnInput, setPgnInput] = useState("");
  const [showPgnModal, setShowPgnModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isComputingScores, setIsComputingScores] = useState(false);
  const [computeProgress, setComputeProgress] = useState({ current: 0, total: 0 });
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(400);
  const isNavigatingRef = useRef(false);

  const { evaluation, isReady, hasError, evaluate, evaluateAsync, endBatch } = useStockfish();
  const { toast } = useToast();

  const activeLine = useMemo(() => getActiveLine(tree, currentPath), [tree, currentPath]);

  const currentMoveIndex = currentPath.length - 2;

  const allMoves = useMemo(() => activeLine.map(n => n.move), [activeLine]);

  const scoreHistory = useMemo(
    () => activeLine.map(n => n.score),
    [activeLine]
  );

  const hasScores = useMemo(() => activeLine.some(n => n.score !== null), [activeLine]);

  const currentNodeId = currentPath[currentPath.length - 1];

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
          setChatMessages([]);
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
          setChatMessages([]);
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
      setChatMessages([]);
    },
    [activeLine, currentPath]
  );

  const goToStart = useCallback(() => {
    isNavigatingRef.current = true;
    setCurrentPath(prev => [prev[0]]);
    setGame(new Chess());
    setChatMessages([]);
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
    setChatMessages([]);
    setPgnInput("");
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
    setChatMessages([]);
  }, [tree]);

  const loadPgn = useCallback(async () => {
    if (!pgnInput.trim()) {
      toast({
        title: "Empty PGN",
        description: "Please paste a PGN string first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const gameCopy = new Chess();
      gameCopy.loadPgn(pgnInput.trim());
      const history = gameCopy.history();

      if (history.length === 0) {
        toast({
          title: "Invalid PGN",
          description: "Could not parse any moves from the PGN.",
          variant: "destructive",
        });
        return;
      }

      const newRoot = createRootNode();
      let currentNode = newRoot;
      const newPath = [newRoot.id];
      const tempGame = new Chess();

      for (const moveSan of history) {
        tempGame.move(moveSan);
        const child: VariationNode = {
          id: nextNodeId(),
          move: moveSan,
          fen: tempGame.fen(),
          score: null,
          children: [],
        };
        currentNode.children.push(child);
        newPath.push(child.id);
        currentNode = child;
      }

      setTree(newRoot);
      setCurrentPath(newPath);
      setGame(gameCopy);
      setChatMessages([]);

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
  }, [pgnInput, toast, isReady, evaluateAsync, evaluate, endBatch]);

  const explainPosition = useCallback(async () => {
    setIsAnalyzing(true);
    setChatMessages([]);
    try {
      const context = getPositionContext();
      const response = await apiRequest("POST", "/api/analyze", context);
      const data = await response.json();

      setChatMessages([
        { role: "user", text: "Explain this position" },
        { role: "model", text: data.explanation },
      ]);
    } catch {
      toast({
        title: "Analysis Failed",
        description: "Could not get AI explanation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [getPositionContext, toast]);

  const sendChatMessage = useCallback(async (text: string) => {
    const userMessage: ChatMessage = { role: "user", text };
    setChatMessages(prev => [...prev, userMessage]);
    setIsChatLoading(true);

    try {
      const context = getPositionContext();
      const currentMessages = [...chatMessages, userMessage];
      const response = await apiRequest("POST", "/api/chat", {
        ...context,
        messages: currentMessages,
      });
      const data = await response.json();

      setChatMessages(prev => [...prev, { role: "model", text: data.reply }]);
    } catch {
      toast({
        title: "Chat Error",
        description: "Could not get a response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsChatLoading(false);
    }
  }, [chatMessages, getPositionContext, toast]);

  const explainMove = useCallback((moveUci: string, moveSan: string, score: string, pvSan: string) => {
    const turnLabel = game.turn() === "w" ? "White" : "Black";
    const question = `Why is ${moveSan} (${score}) the engine's recommended move for ${turnLabel}? The continuation is: ${pvSan}. Explain the idea behind this move.`;
    sendChatMessage(question);
  }, [game, sendChatMessage]);

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
    setChatMessages([]);

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
          <img src={logoPath} alt="Chess Analyzer" className="w-9 h-9 object-contain" />
          <div>
            <h1 className="text-base font-bold leading-tight" data-testid="text-app-title">
              Chess Analyzer
            </h1>
            <p className="text-xs text-muted-foreground leading-tight">
              LLMs fact checked by Stockfish
            </p>
          </div>
          <Dialog open={showPgnModal} onOpenChange={setShowPgnModal}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 ml-2"
                data-testid="button-open-pgn"
              >
                <Upload className="w-3.5 h-3.5" />
                Load PGN
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Load PGN</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <Textarea
                  value={pgnInput}
                  onChange={(e) => setPgnInput(e.target.value)}
                  placeholder="Paste PGN here...&#10;e.g. 1. e4 e5 2. Nf3 Nc6 3. Bb5 a6"
                  className="resize-none text-sm font-mono min-h-[120px]"
                  rows={5}
                  data-testid="input-pgn"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPgnModal(false)}
                    data-testid="button-cancel-pgn"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      loadPgn();
                      setShowPgnModal(false);
                    }}
                    disabled={isComputingScores || !pgnInput.trim()}
                    className="gap-1.5"
                    data-testid="button-load-pgn"
                  >
                    {isComputingScores ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    Load
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex flex-1 min-h-0 min-w-0">
          <div className="flex items-stretch py-4 pl-4">
            <EvalBar evaluation={evaluation} isReady={isReady} />
          </div>

          <div className="flex flex-col flex-1 min-w-0 p-4 gap-2">
            <div
              ref={boardContainerRef}
              className="flex items-center justify-center min-h-0"
              style={{ flex: "0 0 auto" }}
            >
              <div style={{ width: boardSize, height: boardSize }}>
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
                  animationDuration={200}
                />
              </div>
            </div>

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
            />
          </div>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <CoachConsole
              evaluation={evaluation}
              isAnalyzing={isAnalyzing}
              isEngineReady={isReady}
              onExplain={explainPosition}
              messages={chatMessages}
              onSendMessage={sendChatMessage}
              isChatLoading={isChatLoading}
              onClearChat={clearChat}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
