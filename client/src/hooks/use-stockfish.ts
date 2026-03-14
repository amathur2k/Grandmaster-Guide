import { useState, useEffect, useRef, useCallback } from "react";
import type { StockfishEvaluation } from "@shared/schema";

interface EvalResult {
  score: number;
  mate: number | null;
}

export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const requestIdRef = useRef(0);
  const currentRequestIdRef = useRef(0);
  const turnRef = useRef<"w" | "b">("w");
  const evalResolveRef = useRef<((result: EvalResult) => void) | null>(null);
  const batchModeRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenInfoForCurrentReqRef = useRef(false);
  const [evaluation, setEvaluation] = useState<StockfishEvaluation>({
    score: 0,
    bestMove: "",
    topMoves: [],
    lines: [],
    depth: 0,
    mate: null,
  });

  const createWorker = useCallback(() => {
    try {
      workerRef.current?.terminate();
    } catch {}

    try {
      const worker = new Worker("/stockfish.js");
      workerRef.current = worker;

      let topMovesCollected: string[] = [];
      let linesCollected: { move: string; score: number; mate: number | null; pv: string[] }[] = [];
      let currentEval: StockfishEvaluation = {
        score: 0,
        bestMove: "",
        topMoves: [],
        lines: [],
        depth: 0,
        mate: null,
      };

      worker.onmessage = (e) => {
        const line = typeof e.data === "string" ? e.data : "";
        if (!line) return;

        if (line === "readyok") {
          setIsReady(true);
          setHasError(false);
          retryCountRef.current = 0;
          return;
        }

        if (line.startsWith("info") && line.includes("score")) {
          const depthMatch = line.match(/depth (\d+)/);
          const scoreMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);
          const pvMatch = line.match(/ pv (.+)/);
          const multiPvMatch = line.match(/multipv (\d+)/);

          const depth = depthMatch ? parseInt(depthMatch[1]) : 0;
          const multipv = multiPvMatch ? parseInt(multiPvMatch[1]) : 1;

          if (depth < 4) return;

          if (scoreMatch || mateMatch) {
            const rawScore = scoreMatch ? parseInt(scoreMatch[1]) / 100 : 0;
            const rawMate = mateMatch ? parseInt(mateMatch[1]) : null;

            const score = turnRef.current === "b" ? -rawScore : rawScore;
            const mate = rawMate !== null ? (turnRef.current === "b" ? -rawMate : rawMate) : null;
            const pv = pvMatch ? pvMatch[1].split(" ") : [];

            const lineData = { move: pv[0] || "", score, mate, pv };

            seenInfoForCurrentReqRef.current = true;

            if (multipv === 1) {
              currentEval.score = score;
              currentEval.depth = depth;
              currentEval.mate = mate;
              currentEval.bestMove = pv[0] || "";
              topMovesCollected = [pv[0] || ""];
              linesCollected = [lineData];
            } else if (multipv <= 3) {
              topMovesCollected[multipv - 1] = pv[0] || "";
              linesCollected[multipv - 1] = lineData;
            }

            currentEval.topMoves = [...topMovesCollected];
            currentEval.lines = [...linesCollected];

            if (!batchModeRef.current) {
              const reqId = currentRequestIdRef.current;
              if (reqId === requestIdRef.current) {
                setEvaluation({ ...currentEval });
              }
            }
          }
        }

        if (line.startsWith("bestmove")) {
          const bestMoveMatch = line.match(/bestmove (\S+)/);
          if (bestMoveMatch) {
            currentEval.bestMove = bestMoveMatch[1];
          }
          if (!batchModeRef.current) {
            const reqId = currentRequestIdRef.current;
            if (reqId === requestIdRef.current) {
              setEvaluation({ ...currentEval });
            }
          }
          if (evalResolveRef.current && seenInfoForCurrentReqRef.current) {
            evalResolveRef.current({ score: currentEval.score, mate: currentEval.mate });
            evalResolveRef.current = null;
          }
        }
      };

      worker.onerror = (e) => {
        e.preventDefault();
        setIsReady(false);
        if (evalResolveRef.current) {
          evalResolveRef.current({ score: 0, mate: null });
          evalResolveRef.current = null;
        }
        batchModeRef.current = false;

        if (retryCountRef.current < 3) {
          retryCountRef.current++;
          retryTimerRef.current = setTimeout(() => {
            createWorker();
          }, 1000 * retryCountRef.current);
        } else {
          setHasError(true);
        }
      };

      worker.postMessage("uci");
      worker.postMessage("setoption name MultiPV value 3");
      worker.postMessage("isready");
    } catch {
      if (retryCountRef.current < 3) {
        retryCountRef.current++;
        retryTimerRef.current = setTimeout(() => {
          createWorker();
        }, 1000 * retryCountRef.current);
      } else {
        setHasError(true);
      }
    }
  }, []);

  useEffect(() => {
    const handleGlobalError = (e: ErrorEvent) => {
      if (e.filename?.includes("stockfish") || e.message?.includes("stockfish")) {
        e.preventDefault();
      }
    };
    const handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      const reason = String(e.reason || "");
      if (reason.includes("stockfish") || reason.includes("Worker")) {
        e.preventDefault();
      }
    };
    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    createWorker();

    return () => {
      workerRef.current?.terminate();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [createWorker]);

  const evaluate = useCallback((fen: string, turn: "w" | "b", depth = 18) => {
    if (workerRef.current && isReady) {
      try {
        setEvaluation(prev => ({ ...prev, depth: 0 }));
        const id = ++requestIdRef.current;
        currentRequestIdRef.current = id;
        turnRef.current = turn;
        workerRef.current.postMessage("stop");
        workerRef.current.postMessage("position fen " + fen);
        workerRef.current.postMessage("go depth " + depth);
      } catch {
        setIsReady(false);
        setHasError(true);
      }
    }
  }, [isReady]);

  const evaluateAsync = useCallback((fen: string, turn: "w" | "b", depth = 12): Promise<EvalResult> => {
    return new Promise((resolve) => {
      if (!workerRef.current || !isReady) {
        resolve({ score: 0, mate: null });
        return;
      }
      try {
        if (evalResolveRef.current) {
          evalResolveRef.current({ score: 0, mate: null });
        }
        batchModeRef.current = true;
        evalResolveRef.current = resolve;
        seenInfoForCurrentReqRef.current = false;
        const id = ++requestIdRef.current;
        currentRequestIdRef.current = id;
        turnRef.current = turn;
        workerRef.current.postMessage("stop");
        workerRef.current.postMessage("position fen " + fen);
        workerRef.current.postMessage("go depth " + depth);
      } catch {
        batchModeRef.current = false;
        resolve({ score: 0, mate: null });
      }
    });
  }, [isReady]);

  const endBatch = useCallback(() => {
    batchModeRef.current = false;
  }, []);

  const stop = useCallback(() => {
    try {
      workerRef.current?.postMessage("stop");
    } catch {
    }
  }, []);

  return { evaluation, isReady, hasError, evaluate, evaluateAsync, endBatch, stop };
}
