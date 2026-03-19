import { useState, useEffect, useRef, useCallback } from "react";
import type { StockfishEvaluation } from "@shared/schema";

interface EvalResult {
  score: number;
  mate: number | null;
}

/**
 * Drop-in replacement for useStockfish() that fetches engine lines from the
 * server-side Theoria NNUE engine instead of the client-side Stockfish WASM.
 *
 * The returned interface is identical to useStockfish() so it can be swapped
 * in chess-coach-hooha.tsx with no other changes.
 *
 * evaluateAsync (used for batch game import scoring) falls back to the
 * Stockfish WASM worker so import scoring still works correctly.
 */
export function useTheoraEngine() {
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [evaluation, setEvaluation] = useState<StockfishEvaluation>({
    score: 0,
    bestMove: "",
    topMoves: [],
    lines: [],
    depth: 0,
    mate: null,
  });

  // Abort controller for in-flight Theoria requests
  const abortRef = useRef<AbortController | null>(null);

  // ── Stockfish WASM worker (used only for evaluateAsync / batch scoring) ──────
  const workerRef = useRef<Worker | null>(null);
  const workerReadyRef = useRef(false);
  const batchModeRef = useRef(false);
  const evalResolveRef = useRef<((r: EvalResult) => void) | null>(null);
  const readyResolveRef = useRef<(() => void) | null>(null);
  const turnRef = useRef<"w" | "b">("w");
  const requestIdRef = useRef(0);
  const currentRequestIdRef = useRef(0);
  // Accumulate the latest score across all depth iterations; resolve on bestmove
  const latestBatchScoreRef = useRef<number>(0);
  const latestBatchMateRef = useRef<number | null>(null);

  useEffect(() => {
    // Check Theoria is available
    fetch("/api/theoria-status")
      .then(r => r.json())
      .then(d => { if (d.ready || d.hasBinary) setIsReady(true); })
      .catch(() => setHasError(true));

    // Spin up Stockfish WASM worker for batch eval
    try {
      const worker = new Worker("/stockfish.js");
      workerRef.current = worker;

      worker.onmessage = (e) => {
        const line = typeof e.data === "string" ? e.data : "";
        if (!line) return;

        if (line === "readyok") {
          workerReadyRef.current = true;
          readyResolveRef.current?.();
          readyResolveRef.current = null;
          return;
        }

        if (line.startsWith("bestmove")) {
          if (evalResolveRef.current) {
            evalResolveRef.current({ score: latestBatchScoreRef.current, mate: latestBatchMateRef.current });
            evalResolveRef.current = null;
          }
        }

        if (line.startsWith("info") && line.includes("score")) {
          const depthMatch = line.match(/depth (\d+)/);
          const scoreMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);
          const multiPvMatch = line.match(/multipv (\d+)/);
          if (multiPvMatch && parseInt(multiPvMatch[1]) !== 1) return;

          const depth = depthMatch ? parseInt(depthMatch[1]) : 0;
          if (depth < 4) return;

          const rawScore = scoreMatch ? parseInt(scoreMatch[1]) / 100 : 0;
          const rawMate = mateMatch ? parseInt(mateMatch[1]) : null;
          const score = turnRef.current === "b" ? -rawScore : rawScore;
          const mate = rawMate !== null ? (turnRef.current === "b" ? -rawMate : rawMate) : null;

          // Accumulate — resolve happens on bestmove with the deepest score
          latestBatchScoreRef.current = score;
          latestBatchMateRef.current = mate;
        }
      };

      worker.postMessage("uci");
      worker.postMessage("setoption name MultiPV value 1");
      worker.postMessage("isready");
    } catch {
      // WASM worker failed — batch eval will return 0, but Theoria lines still work
    }

    return () => {
      abortRef.current?.abort();
      workerRef.current?.terminate();
    };
  }, []);

  // ── Live evaluation via Theoria API ─────────────────────────────────────────
  const evaluate = useCallback((fen: string, _turn: "w" | "b", depth = 16) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    fetch(`/api/theoria-eval?fen=${encodeURIComponent(fen)}&depth=${depth}&multiPV=3`, {
      signal: ctrl.signal,
    })
      .then(r => r.json())
      .then(data => {
        if (ctrl.signal.aborted) return;
        setIsReady(true);
        setEvaluation({
          score: data.score ?? 0,
          mate: data.mate ?? null,
          bestMove: data.bestMove ?? "",
          topMoves: (data.lines ?? []).map((l: any) => l.move).filter(Boolean),
          lines: data.lines ?? [],
          depth: data.depth ?? depth,
        });
      })
      .catch(err => {
        if (err.name === "AbortError") return;
        console.error("[useTheoraEngine] eval error:", err);
        setHasError(true);
      });
  }, []);

  // ── Batch async eval (delegated to Stockfish WASM) ──────────────────────────
  const evaluateAsync = useCallback((fen: string, turn: "w" | "b", depth = 12): Promise<EvalResult> => {
    return new Promise(resolve => {
      if (!workerRef.current) return resolve({ score: 0, mate: null });
      try {
        turnRef.current = turn;
        batchModeRef.current = true;
        const id = ++requestIdRef.current;
        currentRequestIdRef.current = id;

        const timeout = setTimeout(() => {
          readyResolveRef.current = null;
          resolve({ score: 0, mate: null });
        }, 5000);

        readyResolveRef.current = () => {
          clearTimeout(timeout);
          latestBatchScoreRef.current = 0;
          latestBatchMateRef.current = null;
          evalResolveRef.current = resolve;
          workerRef.current!.postMessage("position fen " + fen);
          workerRef.current!.postMessage("go depth " + depth);
        };
        workerRef.current.postMessage("stop");
        workerRef.current.postMessage("isready");
      } catch {
        batchModeRef.current = false;
        resolve({ score: 0, mate: null });
      }
    });
  }, []);

  const endBatch = useCallback(() => {
    batchModeRef.current = false;
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    try { workerRef.current?.postMessage("stop"); } catch {}
  }, []);

  return { evaluation, isReady, hasError, evaluate, evaluateAsync, endBatch, stop };
}
