import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { randomUUID } from "crypto";

export interface TacticalItem {
  type: string;
  side: string;
  description: string;
  squares: string[];
}

export interface StrategicItem {
  type: string;
  side?: string;
  description: string;
  squares?: string[];
  [key: string]: unknown;
}

export interface MaterialInfo {
  type: string;
  white_score: number;
  black_score: number;
  balance: number;
  white_bishop_pair: boolean;
  black_bishop_pair: boolean;
  description: string;
}

export interface KingSafetyInfo {
  white: {
    king_square: string;
    pawn_shield_intact: boolean;
    shield_pawns_missing: string[];
    open_files_near_king: number;
    description: string;
  };
  black: {
    king_square: string;
    pawn_shield_intact: boolean;
    shield_pawns_missing: string[];
    open_files_near_king: number;
    description: string;
  };
}

export interface PawnStructureInfo {
  white: { doubled: number; isolated: number; passed: number; passed_squares: string[] };
  black: { doubled: number; isolated: number; passed: number; passed_squares: string[] };
  description: string;
}

export interface CenterControlInfo {
  type: string;
  white_control: number;
  black_control: number;
  description: string;
}

export interface SpaceInfo {
  type: string;
  white_space: number;
  black_space: number;
  description: string;
}

export interface RichPositionFeatures {
  material: MaterialInfo;
  king_safety: KingSafetyInfo;
  pawn_structure: PawnStructureInfo;
  center_control: CenterControlInfo;
  space: SpaceInfo;
  tactical: TacticalItem[];
  strategic: StrategicItem[];
  endgame: StrategicItem[];
  is_endgame: boolean;
  summary: string;
}

interface PendingRequest {
  resolve: (result: RichPositionFeatures) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

class PythonAnalyzerService {
  private process: ChildProcess | null = null;
  private ready = false;
  private outputBuffer = "";
  private pending = new Map<string, PendingRequest>();
  private spawnAttempts = 0;

  constructor() {
    this.spawn();
  }

  private spawn() {
    this.ready = false;
    this.spawnAttempts++;

    try {
      const scriptPath = path.join(process.cwd(), "server", "position_analyzer.py");
      this.process = spawn("python3", [scriptPath], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.process.stdout?.on("data", (data: Buffer) => {
        this.outputBuffer += data.toString();
        this.processOutput();
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        const msg = data.toString().trim();
        if (msg) {
          console.error("[python-analyzer] stderr:", msg);
        }
      });

      this.process.on("exit", (code) => {
        console.log(`[python-analyzer] Process exited (code ${code})`);
        this.ready = false;
        this.process = null;

        for (const [id, req] of this.pending) {
          clearTimeout(req.timer);
          req.reject(new Error("Python analyzer process exited"));
          this.pending.delete(id);
        }

        const delay = Math.min(1000 * Math.pow(2, this.spawnAttempts - 1), 30000);
        console.log(`[python-analyzer] Restarting in ${delay}ms...`);
        setTimeout(() => this.spawn(), delay);
      });

      this.process.on("error", (err) => {
        console.error("[python-analyzer] Process error:", err.message);
      });

      console.log("[python-analyzer] Spawned python3 position_analyzer.py");
    } catch (err: any) {
      console.error("[python-analyzer] Failed to spawn:", err?.message);
      const delay = Math.min(1000 * Math.pow(2, this.spawnAttempts - 1), 30000);
      setTimeout(() => this.spawn(), delay);
    }
  }

  private processOutput() {
    const lines = this.outputBuffer.split("\n");
    this.outputBuffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const data = JSON.parse(trimmed);

        if (data.status === "ready") {
          this.ready = true;
          this.spawnAttempts = 0;
          console.log("[python-analyzer] Engine ready");
          continue;
        }

        const id = data.id;
        if (!id) continue;

        const req = this.pending.get(id);
        if (!req) continue;

        clearTimeout(req.timer);
        this.pending.delete(id);

        if (data.error) {
          req.reject(new Error(data.error));
        } else {
          req.resolve(data.result as RichPositionFeatures);
        }
      } catch {
        // ignore malformed JSON
      }
    }
  }

  async analyze(fen: string): Promise<RichPositionFeatures> {
    if (!this.ready || !this.process?.stdin?.writable) {
      throw new Error("Python analyzer is not ready");
    }

    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Python analyzer timed out"));
      }, 10000);

      this.pending.set(id, { resolve, reject, timer });
      this.process!.stdin!.write(JSON.stringify({ id, fen }) + "\n");
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  getStatus(): { status: "starting" | "ready" | "unavailable"; retries: number } {
    if (this.ready) return { status: "ready", retries: 0 };
    if (this.spawnAttempts <= 3) return { status: "starting", retries: this.spawnAttempts };
    return { status: "unavailable", retries: this.spawnAttempts };
  }
}

export const pythonAnalyzerService = new PythonAnalyzerService();

export function formatFeaturesForPrompt(features: RichPositionFeatures): string {
  const lines: string[] = [
    `[Position Features — computed facts about the current position]`,
    `Summary: ${features.summary}`,
    ``,
    `Material: ${features.material.description} (balance: ${features.material.balance > 0 ? "+" : ""}${features.material.balance.toFixed(1)})`,
  ];

  if (features.tactical.length > 0) {
    lines.push(``);
    lines.push(`Tactical Findings:`);
    for (const t of features.tactical) {
      lines.push(`  ⚠ ${t.description}`);
    }
  }

  lines.push(``);
  lines.push(`King Safety:`);
  if (features.king_safety.white?.description) {
    lines.push(`  White: ${features.king_safety.white.description}`);
  }
  if (features.king_safety.black?.description) {
    lines.push(`  Black: ${features.king_safety.black.description}`);
  }

  lines.push(`Pawn Structure: ${features.pawn_structure.description}`);
  lines.push(`Center: ${features.center_control.description}`);
  lines.push(`Space: ${features.space.description}`);

  if (features.strategic.length > 0) {
    lines.push(``);
    lines.push(`Strategic Observations:`);
    for (const s of features.strategic) {
      lines.push(`  • ${s.description}`);
    }
  }

  if (features.is_endgame && features.endgame.length > 0) {
    lines.push(``);
    lines.push(`Endgame Factors:`);
    for (const e of features.endgame) {
      lines.push(`  ▸ ${e.description}`);
    }
  }

  return lines.join("\n");
}
