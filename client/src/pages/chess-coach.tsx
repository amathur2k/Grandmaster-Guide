import { useState, useCallback, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useStockfish } from "@/hooks/use-stockfish";
import { EvalBar } from "@/components/eval-bar";
import { MoveHistory } from "@/components/move-history";
import { EngineLines } from "@/components/engine-lines";
import { EvalGraph } from "@/components/eval-graph";
import { CoachConsole } from "@/components/coach-console";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

export default function ChessCoach() {
  const [game, setGame] = useState(new Chess());
  const [allMoves, setAllMoves] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [pgnInput, setPgnInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [scoreHistory, setScoreHistory] = useState<{ score: number; mate: number | null }[]>([]);
  const [isComputingScores, setIsComputingScores] = useState(false);
  const [computeProgress, setComputeProgress] = useState({ current: 0, total: 0 });
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(400);
  const isNavigatingRef = useRef(false);

  const { evaluation, isReady, hasError, evaluate, evaluateAsync, endBatch } = useStockfish();
  const { toast } = useToast();

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
        const size = Math.min(width, height, 640);
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
      evaluate(game.fen(), game.turn());
    }
  }, [game, isReady, evaluate, isComputingScores]);

  useEffect(() => {
    if (currentMoveIndex >= 0 && evaluation.depth >= 10 && !isComputingScores && !isNavigatingRef.current) {
      setScoreHistory(prev => {
        const updated = [...prev];
        updated[currentMoveIndex] = { score: evaluation.score, mate: evaluation.mate };
        return updated;
      });
    }
  }, [currentMoveIndex, evaluation.score, evaluation.mate, evaluation.depth, isComputingScores]);

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

        const nextStoredMove = allMoves[currentMoveIndex + 1];
        if (nextStoredMove && nextStoredMove === move.san) {
          setCurrentMoveIndex(currentMoveIndex + 1);
          setGame(gameCopy);
          setChatMessages([]);
          isNavigatingRef.current = true;
        } else {
          const newMoves = [...allMoves.slice(0, currentMoveIndex + 1), move.san];
          setAllMoves(newMoves);
          setCurrentMoveIndex(newMoves.length - 1);
          setGame(gameCopy);
          setChatMessages([]);
          setScoreHistory(prev => prev.slice(0, currentMoveIndex + 1));
          isNavigatingRef.current = false;
        }
        return true;
      } catch {
        return false;
      }
    },
    [game, allMoves, currentMoveIndex]
  );

  const goToMove = useCallback(
    (index: number) => {
      isNavigatingRef.current = true;
      const gameCopy = new Chess();
      for (let i = 0; i <= index; i++) {
        gameCopy.move(allMoves[i]);
      }
      setCurrentMoveIndex(index);
      setGame(gameCopy);
      setChatMessages([]);
    },
    [allMoves]
  );

  const goToStart = useCallback(() => {
    isNavigatingRef.current = true;
    setCurrentMoveIndex(-1);
    setGame(new Chess());
    setChatMessages([]);
  }, []);

  const goToEnd = useCallback(() => {
    if (allMoves.length > 0) {
      goToMove(allMoves.length - 1);
    }
  }, [allMoves, goToMove]);

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
    if (currentMoveIndex < allMoves.length - 1) {
      goToMove(currentMoveIndex + 1);
    }
  }, [currentMoveIndex, allMoves, goToMove]);

  const resetBoard = useCallback(() => {
    setGame(new Chess());
    setAllMoves([]);
    setCurrentMoveIndex(-1);
    setChatMessages([]);
    setPgnInput("");
    setScoreHistory([]);
  }, []);

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

      setAllMoves(history);
      setCurrentMoveIndex(history.length - 1);
      setGame(gameCopy);
      setChatMessages([]);
      setScoreHistory([]);

      if (isReady) {
        setIsComputingScores(true);
        setComputeProgress({ current: 0, total: history.length });
        const scores: { score: number; mate: number | null }[] = [];
        const tempGame = new Chess();

        for (let i = 0; i < history.length; i++) {
          tempGame.move(history[i]);
          setComputeProgress({ current: i + 1, total: history.length });
          const result = await evaluateAsync(tempGame.fen(), tempGame.turn(), 12);
          scores.push(result);
        }

        setScoreHistory(scores);
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
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">CC</span>
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight" data-testid="text-app-title">
              AI Chess Coach
            </h1>
            <p className="text-xs text-muted-foreground leading-tight">
              Powered by Stockfish + Gemini
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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

          <div className="flex flex-col flex-1 min-w-0 p-4 gap-3">
            <div
              ref={boardContainerRef}
              className="flex-1 flex items-center justify-center min-h-0"
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
                disabled={currentMoveIndex >= allMoves.length - 1}
                data-testid="button-next-move"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={goToEnd}
                disabled={currentMoveIndex >= allMoves.length - 1}
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
                scores={scoreHistory}
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

            <div className="flex gap-2 shrink-0 items-end">
              <Textarea
                value={pgnInput}
                onChange={(e) => setPgnInput(e.target.value)}
                placeholder="Paste PGN..."
                className="resize-none text-xs font-mono h-9 max-w-[180px]"
                rows={1}
                data-testid="input-pgn"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={loadPgn}
                disabled={isComputingScores}
                className="shrink-0 gap-1.5"
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
