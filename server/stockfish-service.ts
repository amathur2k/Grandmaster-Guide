import { spawn, type ChildProcess } from "child_process";
import path from "path";

interface EvalResult {
  score: number;
  mate: number | null;
  bestMove: string;
  pv: string[];
  depth: number;
}

interface QueueItem {
  fen: string;
  depth: number;
  resolve: (result: EvalResult) => void;
  reject: (error: Error) => void;
}

class StockfishService {
  private process: ChildProcess | null = null;
  private ready = false;
  private queue: QueueItem[] = [];
  private processing = false;
  private outputBuffer = "";
  private currentResolve: ((result: EvalResult) => void) | null = null;
  private currentReject: ((error: Error) => void) | null = null;
  private currentResult: Partial<EvalResult> = {};
  private currentTurn: "w" | "b" = "w";
  private softTimeout: ReturnType<typeof setTimeout> | null = null;
  private hardTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.spawn();
  }

  private spawn() {
    this.ready = false;
    try {
      const enginePath = path.join(
        process.cwd(),
        "node_modules",
        "stockfish",
        "bin",
        "stockfish.js"
      );

      this.process = spawn(process.execPath, [enginePath], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.process.stdout?.on("data", (data: Buffer) => {
        this.outputBuffer += data.toString();
        this.processOutput();
      });

      this.process.stderr?.on("data", () => {});

      this.process.on("exit", (code) => {
        console.log(`[stockfish-service] Process exited (code ${code}), restarting...`);
        this.ready = false;
        this.process = null;
        this.clearTimeouts();
        if (this.currentReject) {
          this.currentReject(new Error("Stockfish process exited unexpectedly"));
          this.currentResolve = null;
          this.currentReject = null;
          this.processing = false;
        }
        setTimeout(() => this.spawn(), 1000);
      });

      this.process.on("error", (err) => {
        console.error("[stockfish-service] Process error:", err.message);
      });

      this.send("uci");
      this.send("isready");
    } catch (err) {
      console.error("[stockfish-service] Failed to spawn:", err);
      setTimeout(() => this.spawn(), 2000);
    }
  }

  private send(cmd: string) {
    if (this.process?.stdin?.writable) {
      this.process.stdin.write(cmd + "\n");
    }
  }

  private clearTimeouts() {
    if (this.softTimeout) {
      clearTimeout(this.softTimeout);
      this.softTimeout = null;
    }
    if (this.hardTimeout) {
      clearTimeout(this.hardTimeout);
      this.hardTimeout = null;
    }
  }

  private failCurrentRequest(reason: string) {
    this.clearTimeouts();
    if (this.currentReject) {
      this.currentReject(new Error(reason));
    }
    this.currentResolve = null;
    this.currentReject = null;
    this.currentResult = {};
    this.processing = false;
    this.processQueue();
  }

  private processOutput() {
    const lines = this.outputBuffer.split("\n");
    this.outputBuffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed === "readyok" || trimmed === "uciok") {
        if (trimmed === "readyok") {
          this.ready = true;
          console.log("[stockfish-service] Engine ready");
          this.processQueue();
        }
        continue;
      }

      if (trimmed.startsWith("info") && trimmed.includes("score")) {
        const depthMatch = trimmed.match(/depth (\d+)/);
        const scoreMatch = trimmed.match(/score cp (-?\d+)/);
        const mateMatch = trimmed.match(/score mate (-?\d+)/);
        const pvMatch = trimmed.match(/ pv (.+)/);
        const multipvMatch = trimmed.match(/multipv (\d+)/);

        const multipv = multipvMatch ? parseInt(multipvMatch[1]) : 1;
        if (multipv !== 1) continue;

        const depth = depthMatch ? parseInt(depthMatch[1]) : 0;
        if (depth < 4) continue;

        const rawScore = scoreMatch ? parseInt(scoreMatch[1]) / 100 : 0;
        const rawMate = mateMatch ? parseInt(mateMatch[1]) : null;

        const score = this.currentTurn === "b" ? -rawScore : rawScore;
        const mate =
          rawMate !== null
            ? this.currentTurn === "b"
              ? -rawMate
              : rawMate
            : null;

        const pv = pvMatch ? pvMatch[1].trim().split(" ") : [];

        this.currentResult = { score, mate, bestMove: pv[0] || "", pv, depth };
      }

      if (trimmed.startsWith("bestmove")) {
        const bestMoveMatch = trimmed.match(/bestmove (\S+)/);

        this.clearTimeouts();

        if (this.currentResolve) {
          this.currentResolve({
            score: this.currentResult.score ?? 0,
            mate: this.currentResult.mate ?? null,
            bestMove: this.currentResult.bestMove || bestMoveMatch?.[1] || "",
            pv: this.currentResult.pv || [],
            depth: this.currentResult.depth || 0,
          });
          this.currentResolve = null;
          this.currentReject = null;
        }

        this.processing = false;
        this.processQueue();
      }
    }
  }

  private processQueue() {
    if (!this.ready || this.processing || this.queue.length === 0) return;

    const item = this.queue.shift()!;
    this.processing = true;
    this.currentResolve = item.resolve;
    this.currentReject = item.reject;
    this.currentResult = {};

    const fenParts = item.fen.split(" ");
    this.currentTurn = (fenParts[1] || "w") as "w" | "b";

    this.send(`position fen ${item.fen}`);
    this.send(`go depth ${item.depth}`);

    this.softTimeout = setTimeout(() => {
      console.log("[stockfish-service] Evaluation timed out, sending stop");
      this.send("stop");

      this.hardTimeout = setTimeout(() => {
        console.log("[stockfish-service] Hard timeout: no bestmove after stop, failing request");
        this.failCurrentRequest("Stockfish evaluation timed out");
      }, 5000);
    }, 15000);
  }

  async evaluate(fen: string, depth = 16): Promise<EvalResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fen, depth, resolve, reject });
      if (this.ready && !this.processing) {
        this.processQueue();
      }
    });
  }

  isReady(): boolean {
    return this.ready;
  }
}

export const stockfishService = new StockfishService();
