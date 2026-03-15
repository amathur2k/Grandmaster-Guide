import { spawn, exec, type ChildProcess } from "child_process";
import { existsSync, mkdirSync, chmodSync, createWriteStream, statSync } from "fs";
import https from "https";
import http from "http";
import path from "path";

const ENGINES_DIR = path.join(process.cwd(), "engines");
const SF12_BIN = path.join(ENGINES_DIR, "stockfish12");
const SF12_SOURCE_URL =
  "https://github.com/official-stockfish/Stockfish/archive/refs/tags/sf_12.tar.gz";
const BUILD_EXTRACT_DIR = "/tmp/Stockfish-sf_12";
const BUILD_SRC_DIR = `${BUILD_EXTRACT_DIR}/src`;

export interface ClassicalEvalTerm {
  white_mg: number | null;
  white_eg: number | null;
  black_mg: number | null;
  black_eg: number | null;
  total_mg: number;
  total_eg: number;
}

export interface ClassicalEvalResult {
  terms: Record<string, ClassicalEvalTerm>;
  total: ClassicalEvalTerm;
  final_pawns: number | null;
  fen: string;
}

type QueueItem = {
  commands: string[];
  sentinel: string;
  resolve: (lines: string[]) => void;
  reject: (err: Error) => void;
};

class ClassicalStockfishService {
  private process: ChildProcess | null = null;
  private ready = false;
  private unavailable = false;
  private buildPromise: Promise<void> | null = null;
  private startupPromise: Promise<void> | null = null;
  private outputBuffer = "";
  private phase: "starting" | "ready" = "starting";
  private startupResolve: (() => void) | null = null;
  private startupReject: ((e: Error) => void) | null = null;
  private collectingLines: string[] = [];
  private currentSentinel: string | null = null;
  private currentResolve: ((lines: string[]) => void) | null = null;
  private currentReject: ((err: Error) => void) | null = null;
  private currentTimeout: ReturnType<typeof setTimeout> | null = null;
  private queue: QueueItem[] = [];
  private processing = false;

  private binaryExists(): boolean {
    try {
      return existsSync(SF12_BIN) && statSync(SF12_BIN).size > 100_000;
    } catch {
      return false;
    }
  }

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const download = (currentUrl: string, redirects = 10) => {
        if (redirects <= 0) {
          reject(new Error("Too many redirects"));
          return;
        }
        const mod = currentUrl.startsWith("https://") ? https : http;
        mod
          .get(currentUrl, (res) => {
            if (
              res.statusCode &&
              res.statusCode >= 300 &&
              res.statusCode < 400 &&
              res.headers.location
            ) {
              download(res.headers.location, redirects - 1);
              return;
            }
            if (res.statusCode !== 200) {
              reject(new Error(`Download failed: HTTP ${res.statusCode}`));
              return;
            }
            const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
            let downloaded = 0;
            let lastLog = 0;
            const file = createWriteStream(dest);
            res.on("data", (chunk: Buffer) => {
              downloaded += chunk.length;
              const now = Date.now();
              if (now - lastLog > 10000) {
                const pct =
                  totalBytes > 0 ? ((downloaded / totalBytes) * 100).toFixed(1) : "?";
                console.log(
                  `[classical-sf] Downloaded ${(downloaded / 1e6).toFixed(1)} MB (${pct}%)`
                );
                lastLog = now;
              }
            });
            res.pipe(file);
            file.on("finish", () => file.close(() => resolve()));
            file.on("error", reject);
          })
          .on("error", reject);
      };
      download(url);
    });
  }

  private runAsync(cmd: string, opts: { cwd?: string; timeout?: number } = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      exec(cmd, { ...opts, maxBuffer: 64 * 1024 * 1024 }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async build(): Promise<void> {
    if (!existsSync(ENGINES_DIR)) mkdirSync(ENGINES_DIR, { recursive: true });

    console.log("[classical-sf] Downloading Stockfish 12 source (~11 MB)...");
    await this.downloadFile(SF12_SOURCE_URL, "/tmp/sf12.tar.gz");

    console.log("[classical-sf] Extracting source...");
    await this.runAsync("tar -xzf /tmp/sf12.tar.gz -C /tmp/", { timeout: 60_000 });

    console.log("[classical-sf] Compiling SF12 classical (may take 3-5 minutes)...");
    await this.runAsync(
      `make build ARCH=x86-64-avx2 COMP=gcc EXE="${SF12_BIN}" -j4`,
      { cwd: BUILD_SRC_DIR, timeout: 600_000 }
    );

    chmodSync(SF12_BIN, 0o755);
    console.log("[classical-sf] SF12 compiled and ready at:", SF12_BIN);
  }

  private async ensureBuilt(): Promise<void> {
    if (this.binaryExists()) return;
    if (this.buildPromise) return this.buildPromise;
    this.buildPromise = this.build().catch((e) => {
      this.buildPromise = null;
      throw e;
    });
    return this.buildPromise;
  }

  private handleLine(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return;

    if (this.phase === "starting") {
      if (trimmed === "readyok") {
        this.phase = "ready";
        this.ready = true;
        this.startupPromise = null;
        console.log("[classical-sf] SF12 engine ready (classical HCE mode)");
        this.startupResolve?.();
        this.startupResolve = null;
        this.startupReject = null;
        this.processQueue();
      }
      return;
    }

    if (!this.currentSentinel) return;

    this.collectingLines.push(trimmed);

    if (trimmed.startsWith(this.currentSentinel)) {
      if (this.currentTimeout) clearTimeout(this.currentTimeout);
      const lines = [...this.collectingLines];
      const resolve = this.currentResolve!;
      this.clearCurrent();
      resolve(lines);
      this.processQueue();
    }
  }

  private clearCurrent() {
    if (this.currentTimeout) clearTimeout(this.currentTimeout);
    this.currentSentinel = null;
    this.currentResolve = null;
    this.currentReject = null;
    this.collectingLines = [];
    this.currentTimeout = null;
    this.processing = false;
  }

  private processQueue() {
    if (this.processing || this.queue.length === 0) return;
    const item = this.queue.shift()!;
    this.processing = true;
    this.collectingLines = [];
    this.currentSentinel = item.sentinel;
    this.currentResolve = item.resolve;
    this.currentReject = item.reject;

    this.currentTimeout = setTimeout(() => {
      const lines = [...this.collectingLines];
      const reject = this.currentReject!;
      this.clearCurrent();
      // Kill the stale process so the next request gets a fresh one
      if (this.process) {
        console.warn("[classical-sf] Timeout — killing stale SF12 process for restart");
        try { this.process.kill(); } catch {}
        this.process = null;
        this.ready = false;
        this.startupPromise = null;
      }
      reject(new Error(`SF12 eval timed out. Collected ${lines.length} lines`));
      this.processQueue();
    }, 8000);

    for (const cmd of item.commands) {
      this.process?.stdin?.write(cmd + "\n");
    }
  }

  private sendToQueue(commands: string[], sentinel: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.queue.push({ commands, sentinel, resolve, reject });
      if (!this.processing) this.processQueue();
    });
  }

  private async ensureProcess(): Promise<void> {
    if (this.process && this.ready) return;
    if (this.startupPromise) return this.startupPromise;

    this.phase = "starting";
    this.ready = false;

    this.startupPromise = new Promise<void>((resolve, reject) => {
      this.startupResolve = resolve;
      this.startupReject = reject;

      this.process = spawn(SF12_BIN, [], { stdio: ["pipe", "pipe", "pipe"] });

      this.process.stderr?.on("data", () => {});

      this.process.on("exit", (code) => {
        console.log(`[classical-sf] Process exited (code ${code})`);
        this.ready = false;
        this.process = null;
        this.startupPromise = null;
        if (this.currentReject) {
          const rej = this.currentReject;
          this.clearCurrent();
          rej(new Error("SF12 process exited unexpectedly"));
        }
        const queuedRejects = this.queue.map((q) => q.reject);
        this.queue = [];
        for (const r of queuedRejects) r(new Error("SF12 process exited"));
      });

      this.process.on("error", (err) => {
        console.error("[classical-sf] Process error:", err.message);
        this.startupReject?.(err);
        this.startupResolve = null;
        this.startupReject = null;
      });

      this.process.stdout?.on("data", (chunk: Buffer) => {
        this.outputBuffer += chunk.toString();
        const lines = this.outputBuffer.split("\n");
        this.outputBuffer = lines.pop() || "";
        for (const line of lines) this.handleLine(line);
      });

      this.process.stdin?.write("uci\n");
      this.process.stdin?.write("setoption name Use NNUE value false\n");
      this.process.stdin?.write("isready\n");
    });

    return this.startupPromise;
  }

  async warmup(): Promise<void> {
    try {
      await this.ensureBuilt();
      await this.ensureProcess();
    } catch (e) {
      this.unavailable = true;
      console.error(
        "[classical-sf] Warmup failed — classical eval unavailable:",
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  async getEvalFeatures(fen: string): Promise<ClassicalEvalResult> {
    await this.ensureBuilt();
    await this.ensureProcess();

    const lines = await this.sendToQueue(
      [`position fen ${fen}`, "eval"],
      "Classical evaluation"
    );

    return this.parseEvalOutput(lines, fen);
  }

  private parseEvalOutput(lines: string[], fen: string): ClassicalEvalResult {
    const terms: Record<string, ClassicalEvalTerm> = {};
    const zero: ClassicalEvalTerm = {
      white_mg: null, white_eg: null,
      black_mg: null, black_eg: null,
      total_mg: 0, total_eg: 0,
    };
    let total: ClassicalEvalTerm = { ...zero };
    let final_pawns: number | null = null;

    const cellRe = /(-?\d+\.\d+|----)/g;
    const finalRe = /Classical evaluation:\s*([+-]?\d+\.?\d*)/;

    for (const line of lines) {
      const finalMatch = finalRe.exec(line);
      if (finalMatch) {
        final_pawns = parseFloat(finalMatch[1]);
        continue;
      }

      if (!line.includes("|")) continue;
      if (line.includes("Term") || line.includes("MG")) continue;
      if (line.includes("---+")) continue;

      const parts = line.split("|");
      if (parts.length < 4) continue;

      const name = parts[0].trim();
      if (!name || name.toLowerCase() === "term") continue;

      const parseCell = (s: string): number | null => {
        const m = s.trim();
        if (!m || m === "----") return null;
        const v = parseFloat(m);
        return isNaN(v) ? null : v;
      };

      const whiteCells = (parts[1].match(cellRe) || []);
      const blackCells = (parts[2].match(cellRe) || []);
      const totalCells = (parts[3].match(cellRe) || []);

      const white_mg = parseCell(whiteCells[0] || "");
      const white_eg = parseCell(whiteCells[1] || "");
      const black_mg = parseCell(blackCells[0] || "");
      const black_eg = parseCell(blackCells[1] || "");
      const total_mg_raw = parseCell(totalCells[0] || "");
      const total_eg_raw = parseCell(totalCells[1] || "");

      const term: ClassicalEvalTerm = {
        white_mg,
        white_eg,
        black_mg,
        black_eg,
        total_mg: total_mg_raw ?? 0,
        total_eg: total_eg_raw ?? 0,
      };

      if (name.toLowerCase() === "total") {
        total = term;
      } else {
        terms[name] = term;
      }
    }

    return { terms, total, final_pawns, fen };
  }

  isReady(): boolean {
    return this.ready && !this.unavailable;
  }

  isUnavailable(): boolean {
    return this.unavailable;
  }

  getStatus(): { status: "starting" | "ready" | "unavailable" } {
    if (this.unavailable) return { status: "unavailable" };
    if (this.ready) return { status: "ready" };
    return { status: "starting" };
  }
}

export const classicalStockfishService = new ClassicalStockfishService();

export function formatClassicalEvalForPrompt(result: ClassicalEvalResult): string {
  const sign = (n: number) => (n >= 0 ? `+${n.toFixed(2)}` : `${n.toFixed(2)}`);
  const fmtNull = (n: number | null) => (n === null ? " ----" : sign(n).padStart(6));

  const TERM_ORDER = [
    "Material",
    "Imbalance",
    "Pawns",
    "Knights",
    "Bishops",
    "Rooks",
    "Queens",
    "Mobility",
    "King safety",
    "Threats",
    "Passed",
    "Space",
    "Winnable",
  ];

  const lines: string[] = [
    "[Stockfish 12 Classical Evaluation Breakdown]",
    "(pawns, positive = White advantage, MG = middlegame, EG = endgame)",
  ];

  for (const termName of TERM_ORDER) {
    const t = result.terms[termName];
    if (!t) continue;

    const totalMg = t.total_mg;
    const totalEg = t.total_eg;
    const isZero = totalMg === 0 && totalEg === 0;

    if (isZero && t.white_mg === null) {
      lines.push(`- ${termName.padEnd(12)}: Total  0.00 /  0.00`);
    } else if (isZero) {
      lines.push(`- ${termName.padEnd(12)}: Total  0.00 /  0.00`);
    } else {
      const detail =
        t.white_mg !== null
          ? `  (White MG: ${sign(t.white_mg)}, Black MG: ${fmtNull(t.black_mg)})`
          : "";
      lines.push(
        `- ${termName.padEnd(12)}: Total ${sign(totalMg).padStart(6)} / ${sign(totalEg).padStart(6)}${detail}`
      );
    }
  }

  const { total, final_pawns } = result;
  const finalSuffix =
    final_pawns !== null ? `  (final: ${sign(final_pawns)} pawns)` : "";
  lines.push(
    `- ${"Overall".padEnd(12)}: ${sign(total.total_mg).padStart(6)} MG / ${sign(total.total_eg).padStart(6)} EG${finalSuffix}`
  );

  return lines.join("\n");
}
