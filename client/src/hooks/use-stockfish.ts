import { useState, useEffect, useRef, useCallback } from "react";
import type { StockfishEvaluation } from "@shared/schema";

export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const requestIdRef = useRef(0);
  const currentRequestIdRef = useRef(0);
  const turnRef = useRef<"w" | "b">("w");
  const [evaluation, setEvaluation] = useState<StockfishEvaluation>({
    score: 0,
    bestMove: "",
    topMoves: [],
    depth: 0,
    mate: null,
  });

  useEffect(() => {
    try {
      const worker = new Worker("/stockfish.js");
      workerRef.current = worker;

      let topMovesCollected: string[] = [];
      let currentEval: StockfishEvaluation = {
        score: 0,
        bestMove: "",
        topMoves: [],
        depth: 0,
        mate: null,
      };

      worker.onmessage = (e) => {
        const line = typeof e.data === "string" ? e.data : "";
        if (!line) return;

        if (line === "readyok") {
          setIsReady(true);
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

            if (multipv === 1) {
              currentEval.score = score;
              currentEval.depth = depth;
              currentEval.mate = mate;
              currentEval.bestMove = pv[0] || "";
              topMovesCollected = [pv[0] || ""];
            } else if (multipv <= 3) {
              topMovesCollected[multipv - 1] = pv[0] || "";
            }

            currentEval.topMoves = [...topMovesCollected];

            const reqId = currentRequestIdRef.current;
            if (reqId === requestIdRef.current) {
              setEvaluation({ ...currentEval });
            }
          }
        }

        if (line.startsWith("bestmove")) {
          const bestMoveMatch = line.match(/bestmove (\S+)/);
          if (bestMoveMatch) {
            currentEval.bestMove = bestMoveMatch[1];
          }
          const reqId = currentRequestIdRef.current;
          if (reqId === requestIdRef.current) {
            setEvaluation({ ...currentEval });
          }
        }
      };

      worker.onerror = () => {
        setHasError(true);
      };

      worker.postMessage("uci");
      worker.postMessage("setoption name MultiPV value 3");
      worker.postMessage("isready");
    } catch {
      setHasError(true);
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const evaluate = useCallback((fen: string, turn: "w" | "b", depth = 18) => {
    if (workerRef.current && isReady) {
      const id = ++requestIdRef.current;
      currentRequestIdRef.current = id;
      turnRef.current = turn;
      workerRef.current.postMessage("stop");
      workerRef.current.postMessage("position fen " + fen);
      workerRef.current.postMessage("go depth " + depth);
    }
  }, [isReady]);

  const stop = useCallback(() => {
    workerRef.current?.postMessage("stop");
  }, []);

  return { evaluation, isReady, hasError, evaluate, stop };
}
