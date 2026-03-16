import { spawn, type ChildProcess } from "child_process";
import { createWriteStream, existsSync, mkdirSync, chmodSync, statSync, renameSync, readFileSync, unlinkSync } from "fs";
import { createHash } from "crypto";
import https from "https";
import path from "path";

const THEORIA_DIR = path.join(process.cwd(), "engines");
const THEORIA_BIN = path.join(THEORIA_DIR, "theoria");
const DOWNLOAD_URL =
  "https://www.theoriachess.org/download/assets/v0.2/theoria-0.2-linux-avx2";
const EXPECTED_SHA256 = "eb296012a6b24869645fdf64d9cc43fcae545b3893245e2195795c50ab34eb07";

interface TheoriaEvalResult {
  score: number;
  mate: number | null;
  bestMove: string;
  pv: string[];
  depth: number;
}

interface EvalTextResult {
  raw: string;
  formatted: string;
}

type QueueCallback = {
  resolve: (lines: string[]) => void;
  reject: (err: Error) => void;
};

class TheoriaService {
  private process: ChildProcess | null = null;
  private ready = false;
  private downloadPromise: Promise<void> | null = null;
  private startupPromise: Promise<void> | null = null;
  private downloading = false;
  private justDownloaded = false;
  private outputBuffer = "";
  private collectingLines: string[] = [];
  private currentCallback: QueueCallback | null = null;
  private waitForToken: string | null = null;
  private queue: Array<{
    commands: string[];
    waitFor: string;
    resolve: (lines: string[]) => void;
    reject: (err: Error) => void;
  }> = [];
  private processing = false;
  private timeout: ReturnType<typeof setTimeout> | null = null;

  async ensureBinary(): Promise<void> {
    if (existsSync(THEORIA_BIN)) {
      const stat = statSync(THEORIA_BIN);
      if (stat.size > 1_000_000) return;
    }

    if (this.downloadPromise) return this.downloadPromise;

    this.downloading = true;
    this.downloadPromise = new Promise<void>((resolve, reject) => {
      if (!existsSync(THEORIA_DIR)) {
        mkdirSync(THEORIA_DIR, { recursive: true });
      }

      console.log("[theoria] Downloading Theoria 0.2 binary...");
      const tmpPath = THEORIA_BIN + ".tmp";

      const download = (url: string, redirects = 5) => {
        if (redirects <= 0) {
          reject(new Error("Too many redirects"));
          return;
        }

        https
          .get(url, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              const redirectUrl = res.headers.location;
              if (!redirectUrl.startsWith("https://")) {
                this.downloading = false;
                this.downloadPromise = null;
                reject(new Error(`Theoria download refused non-HTTPS redirect to: ${redirectUrl}`));
                return;
              }
              download(redirectUrl, redirects - 1);
              return;
            }

            if (res.statusCode !== 200) {
              this.downloading = false;
              this.downloadPromise = null;
              reject(new Error(`Download failed: HTTP ${res.statusCode}`));
              return;
            }

            const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
            let downloaded = 0;
            let lastLog = 0;

            const file = createWriteStream(tmpPath);
            res.on("data", (chunk: Buffer) => {
              downloaded += chunk.length;
              const now = Date.now();
              if (now - lastLog > 5000) {
                const pct = totalBytes > 0 ? ((downloaded / totalBytes) * 100).toFixed(1) : "?";
                console.log(`[theoria] Downloaded ${(downloaded / 1e6).toFixed(1)} MB (${pct}%)`);
                lastLog = now;
              }
            });

            res.pipe(file);
            file.on("finish", () => {
              file.close(() => {
                try {
                  const hash = createHash("sha256");
                  const fileData = readFileSync(tmpPath);
                  hash.update(fileData);
                  const computed = hash.digest("hex");
                  console.log(`[theoria] Downloaded binary SHA-256: ${computed}`);
                  if (computed !== EXPECTED_SHA256) {
                    try { unlinkSync(tmpPath); } catch {}
                    this.downloading = false;
                    this.downloadPromise = null;
                    reject(new Error(`Theoria binary integrity check failed. Expected ${EXPECTED_SHA256}, got ${computed}`));
                    return;
                  }
                  renameSync(tmpPath, THEORIA_BIN);
                  chmodSync(THEORIA_BIN, 0o755);
                  console.log("[theoria] Download complete, binary ready");
                  this.downloading = false;
                  this.justDownloaded = true;
                  resolve();
                } catch (e) {
                  this.downloading = false;
                  this.downloadPromise = null;
                  reject(e);
                }
              });
            });

            file.on("error", (err) => {
              this.downloading = false;
              this.downloadPromise = null;
              reject(err);
            });
          })
          .on("error", (err) => {
            this.downloading = false;
            this.downloadPromise = null;
            reject(err);
          });
      };

      download(DOWNLOAD_URL);
    });

    return this.downloadPromise;
  }

  private startupResolve: (() => void) | null = null;
  private startupPhase: "uci" | "isready" | "done" = "done";

  private async ensureProcess(): Promise<void> {
    await this.ensureBinary();

    if (this.process && this.ready) return;

    if (this.startupPromise) return this.startupPromise;

    this.startupPromise = new Promise<void>((resolve, reject) => {
      this.process = spawn(THEORIA_BIN, [], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.process.stderr?.on("data", () => {});

      this.process.on("exit", (code) => {
        console.log(`[theoria] Process exited (code ${code})`);
        this.ready = false;
        this.process = null;
        this.startupPromise = null;
        if (this.currentCallback) {
          this.currentCallback.reject(new Error("Theoria process exited"));
          this.currentCallback = null;
        }
        if (this.startupResolve) {
          this.startupResolve = null;
          reject(new Error(`Theoria process exited during startup (code ${code})`));
        }
        this.processing = false;
      });

      this.process.on("error", (err) => {
        console.error("[theoria] Process error:", err.message);
        if (this.startupResolve) {
          this.startupResolve = null;
          this.startupPromise = null;
          reject(err);
        }
      });

      this.startupResolve = resolve;
      this.startupPhase = "uci";

      this.process.stdout?.on("data", (data: Buffer) => {
        this.outputBuffer += data.toString();
        if (this.startupPhase !== "done") {
          this.handleStartupOutput();
        } else {
          this.processOutput();
        }
      });

      this.send("uci");
    });

    return this.startupPromise;
  }

  private handleStartupOutput() {
    const lines = this.outputBuffer.split("\n");
    this.outputBuffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (this.startupPhase === "uci" && trimmed === "uciok") {
        this.startupPhase = "isready";
        this.send("isready");
      } else if (this.startupPhase === "isready" && trimmed === "readyok") {
        this.startupPhase = "done";
        this.ready = true;
        this.startupPromise = null;
        console.log("[theoria] Engine ready");
        if (this.startupResolve) {
          const resolve = this.startupResolve;
          this.startupResolve = null;
          resolve();
        }
      }
    }
  }

  private send(cmd: string) {
    if (this.process?.stdin?.writable) {
      this.process.stdin.write(cmd + "\n");
    }
  }

  private processOutput() {
    const lines = this.outputBuffer.split("\n");
    this.outputBuffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      this.collectingLines.push(trimmed);

      const tokenMatches = this.waitForToken && this.waitForToken.split("|").some(tok => trimmed.startsWith(tok));
      if (tokenMatches) {
        if (this.timeout) {
          clearTimeout(this.timeout);
          this.timeout = null;
        }
        const callback = this.currentCallback;
        const collected = [...this.collectingLines];
        this.currentCallback = null;
        this.waitForToken = null;
        this.collectingLines = [];
        this.processing = false;

        if (callback) callback.resolve(collected);
        this.processQueue();
      }
    }
  }

  private processQueue() {
    if (this.processing || this.queue.length === 0) return;

    const item = this.queue.shift()!;
    this.processing = true;
    this.currentCallback = { resolve: item.resolve, reject: item.reject };
    this.waitForToken = item.waitFor;
    this.collectingLines = [];

    for (const cmd of item.commands) {
      this.send(cmd);
    }

    this.timeout = setTimeout(() => {
      console.log("[theoria] Command timed out");
      const cb = this.currentCallback;
      this.currentCallback = null;
      this.waitForToken = null;
      this.collectingLines = [];
      this.processing = false;
      if (cb) cb.reject(new Error("Theoria command timed out"));
      this.processQueue();
    }, 20000);
  }

  private runCommand(commands: string[], waitFor: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.queue.push({ commands, waitFor, resolve, reject });
      if (!this.processing) this.processQueue();
    });
  }

  async evaluate(fen: string, depth = 16, multiPV = 1): Promise<TheoriaEvalResult[]> {
    await this.ensureProcess();

    const cmds = ["ucinewgame", "isready"];
    const readyLines = await this.runCommand(cmds, "readyok");

    const goCmds = [`position fen ${fen}`, `setoption name MultiPV value ${multiPV}`, `go depth ${depth}`];
    const lines = await this.runCommand(goCmds, "bestmove");

    const fenParts = fen.split(" ");
    const turn = (fenParts[1] || "w") as "w" | "b";

    const results: Map<number, TheoriaEvalResult> = new Map();

    for (const line of lines) {
      if (!line.startsWith("info") || !line.includes("score")) continue;

      const depthMatch = line.match(/depth (\d+)/);
      const scoreMatch = line.match(/score cp (-?\d+)/);
      const mateMatch = line.match(/score mate (-?\d+)/);
      const pvMatch = line.match(/ pv (.+)/);
      const multipvMatch = line.match(/multipv (\d+)/);

      const mpv = multipvMatch ? parseInt(multipvMatch[1]) : 1;
      const d = depthMatch ? parseInt(depthMatch[1]) : 0;
      if (d < 4) continue;

      const rawScore = scoreMatch ? parseInt(scoreMatch[1]) / 100 : 0;
      const rawMate = mateMatch ? parseInt(mateMatch[1]) : null;

      const score = turn === "b" ? -rawScore : rawScore;
      const mate = rawMate !== null ? (turn === "b" ? -rawMate : rawMate) : null;
      const pv = pvMatch ? pvMatch[1].trim().split(" ") : [];

      results.set(mpv, { score, mate, bestMove: pv[0] || "", pv, depth: d });
    }

    const sorted = Array.from(results.entries())
      .sort(([a], [b]) => a - b)
      .map(([, v]) => v);

    return sorted.length > 0 ? sorted : [{ score: 0, mate: null, bestMove: "", pv: [], depth: 0 }];
  }

  async getEvalText(fen: string): Promise<EvalTextResult> {
    await this.ensureProcess();

    await this.runCommand(["ucinewgame", "isready"], "readyok");

    await this.runCommand([`position fen ${fen}`, `go depth 12`], "bestmove");

    const evalLines = await this.runCommand(["eval"], "Final evaluation|Total evaluation");

    const raw = evalLines.join("\n");
    const formatted = this.parseEvalOutput(evalLines, fen);

    return { raw, formatted };
  }

  async evaluateWithText(fen: string, depth = 12, multiPV = 3): Promise<{ lines: TheoriaEvalResult[]; evalText: EvalTextResult }> {
    await this.ensureProcess();

    await this.runCommand(["ucinewgame", "isready"], "readyok");

    const pvLines = await this.runCommand(
      [`position fen ${fen}`, `setoption name MultiPV value ${multiPV}`, `go depth ${depth}`],
      "bestmove"
    );

    const evalLines = await this.runCommand(["eval"], "Final evaluation|Total evaluation");

    const fenParts = fen.split(" ");
    const turn = (fenParts[1] || "w") as "w" | "b";

    const results: Map<number, TheoriaEvalResult> = new Map();
    for (const line of pvLines) {
      if (!line.startsWith("info") || !line.includes("score")) continue;

      const depthMatch = line.match(/depth (\d+)/);
      const scoreMatch = line.match(/score cp (-?\d+)/);
      const mateMatch = line.match(/score mate (-?\d+)/);
      const pvMatch = line.match(/ pv (.+)/);
      const multipvMatch = line.match(/multipv (\d+)/);

      const mpv = multipvMatch ? parseInt(multipvMatch[1]) : 1;
      const d = depthMatch ? parseInt(depthMatch[1]) : 0;
      if (d < 4) continue;

      const rawScore = scoreMatch ? parseInt(scoreMatch[1]) / 100 : 0;
      const rawMate = mateMatch ? parseInt(mateMatch[1]) : null;

      const score = turn === "b" ? -rawScore : rawScore;
      const mate = rawMate !== null ? (turn === "b" ? -rawMate : rawMate) : null;
      const pv = pvMatch ? pvMatch[1].trim().split(" ") : [];

      results.set(mpv, { score, mate, bestMove: pv[0] || "", pv, depth: d });
    }

    const sorted = Array.from(results.entries())
      .sort(([a], [b]) => a - b)
      .map(([, v]) => v);
    const lines = sorted.length > 0 ? sorted : [{ score: 0, mate: null, bestMove: "", pv: [], depth: 0 }];

    const raw = evalLines.join("\n");
    const formatted = this.parseEvalOutput(evalLines, fen);

    return { lines, evalText: { raw, formatted } };
  }

  private parseEvalOutput(lines: string[], fen: string): string {
    const parts: string[] = [];

    const fenParts = fen.split(" ");
    const turn = fenParts[1] === "b" ? "Black" : "White";

    const termMap: Record<string, string> = {
      "Material": "Material",
      "Imbalance": "Material Imbalance",
      "Pawns": "Pawn Structure",
      "Knights": "Knights",
      "Bishops": "Bishops",
      "Rooks": "Rooks",
      "Queens": "Queens",
      "Mobility": "Piece Activity",
      "King safety": "King Safety",
      "Threats": "Threats",
      "Passed": "Passed Pawns",
      "Space": "Space",
    };

    for (const line of lines) {
      const tableMatch = line.match(
        /\|\s*([A-Za-z ]+?)\s*\|\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\|\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\|\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\|/
      );
      if (tableMatch) {
        const term = tableMatch[1].trim();
        const totalMg = parseFloat(tableMatch[6]);
        const totalEg = parseFloat(tableMatch[7]);
        const avg = (totalMg + totalEg) / 2;

        const label = termMap[term] || term;
        if (label === term && !termMap[term]) continue;
        if (Math.abs(avg) < 0.05) continue;

        const sign = avg > 0 ? "White" : "Black";
        const desc =
          Math.abs(avg) < 0.2 ? "slight edge" :
          Math.abs(avg) < 0.5 ? "noticeable advantage" :
          Math.abs(avg) < 1.0 ? "clear advantage" : "decisive advantage";

        parts.push(`${label}: ${sign} has ${desc} (${avg > 0 ? "+" : ""}${avg.toFixed(2)})`);
      }
    }

    let nnueScore = "";
    let finalScore = "";
    for (const line of lines) {
      const nnueMatch = line.match(/NNUE evaluation\s+(-?[\d.]+)/);
      if (nnueMatch) nnueScore = nnueMatch[1];

      const finalMatch = line.match(/(?:Final|Total) evaluation\s+(-?[\d.]+)\s+\((\w+) side\)/);
      if (finalMatch) {
        const val = parseFloat(finalMatch[1]);
        const side = finalMatch[2];
        const adjusted = side === "black" ? -val : val;
        finalScore = `${adjusted > 0 ? "+" : ""}${adjusted.toFixed(2)}`;
      }
    }

    if (parts.length === 0 && !finalScore) {
      return `[Theoria Strategic Assessment]\nEvaluation computed. ${turn} to move. Use Theoria's lines for more positionally coherent strategic analysis compared to Stockfish.`;
    }

    let result = "[Theoria Strategic Assessment]\n";
    if (parts.length > 0) {
      result += parts.join("\n") + "\n";
    }
    if (finalScore) {
      result += `Overall: ${finalScore} from White's perspective`;
    } else if (nnueScore) {
      result += `NNUE eval: ${nnueScore}`;
    }

    return result;
  }

  async warmup(): Promise<void> {
    try {
      console.log("[theoria] Starting background warmup...");
      await this.ensureProcess();
      console.log("[theoria] Background warmup complete — engine ready");
    } catch (err: any) {
      console.error("[theoria] Background warmup failed:", err?.message ?? err);
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  isDownloading(): boolean {
    return this.downloading;
  }

  consumeJustDownloaded(): boolean {
    if (this.justDownloaded) {
      this.justDownloaded = false;
      return true;
    }
    return false;
  }

  hasBinary(): boolean {
    if (!existsSync(THEORIA_BIN)) return false;
    try {
      return statSync(THEORIA_BIN).size > 1_000_000;
    } catch {
      return false;
    }
  }
}

export const theoriaService = new TheoriaService();
