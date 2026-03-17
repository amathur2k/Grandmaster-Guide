import { appendFileSync } from "fs";
import path from "path";

const IS_DEV = process.env.NODE_ENV !== "production";
const LOG_PATH = path.join(process.cwd(), "Coach.log");

function tsIST(): string {
  return new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }) + " IST";
}

function ms(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(2)}s` : `${n}ms`;
}

function divider(label: string): string {
  const line = "═".repeat(80);
  return `\n${line}\n  ${label}  —  ${tsIST()}\n${line}`;
}

function section(title: string, body: string): string {
  return `\n┌── ${title}\n${body.split("\n").map(l => "│  " + l).join("\n")}\n└──`;
}

function pad(label: string, width = 30): string {
  return label.padEnd(width);
}

export interface GptRound {
  round: number;
  llmMs: number;
  toolNames?: string[];
  toolMs?: number;
}

export interface CoachTimings {
  theoriaMs: number;
  featureMs: number;
  classicalMs: number;
  classifyMs?: number;
  classifyContextType?: string;
  resolvedIndices?: number[];
  promptTotalMs: number;
  gptMs: number;
  gptRounds: GptRound[];
  forcedResponseMs?: number;
}

export function logCoachInteraction(opts: {
  userQuery: string;
  prompt: string;
  response: string;
  timings: CoachTimings;
}): void {
  if (!IS_DEV) return;

  const { timings: t } = opts;

  const resolvedStr = t.resolvedIndices && t.resolvedIndices.length > 0
    ? `  [history idx: ${t.resolvedIndices.join(",")} → move ${t.resolvedIndices.map(i => Math.ceil(i / 2)).join(",")}]`
    : "";
  const classifyLine = t.classifyMs !== undefined
    ? `  ${pad("├─ Pre-coach classify:")}   ${ms(t.classifyMs)}${t.classifyContextType ? `  → ${t.classifyContextType}` : ""}${resolvedStr}`
    : null;

  const promptLines = [
    `${pad("Prompt generation (total):")} ${ms(t.promptTotalMs)}`,
    ...(classifyLine ? [classifyLine] : []),
    `  ${pad("├─ Theoria evaluation:")}   ${ms(t.theoriaMs)}`,
    `  ${pad("├─ Position features:")}    ${ms(t.featureMs)}`,
    `  ${pad("└─ SF12 classical eval:")}  ${ms(t.classicalMs)}`,
  ];

  const totalRounds = t.gptRounds.length;
  const gptRoundLines: string[] = [];
  t.gptRounds.forEach((r, i) => {
    const isLast = i === totalRounds - 1;
    const branch = isLast && !t.forcedResponseMs ? "└─" : "├─";
    const isFinalText = !r.toolNames || r.toolNames.length === 0;

    if (isFinalText) {
      gptRoundLines.push(`  ${branch} [R${r.round}] ${pad("Final text response:")}  ${ms(r.llmMs)}`);
    } else {
      const tools = r.toolNames!.join(", ");
      gptRoundLines.push(`  ├─ [R${r.round}] ${pad("LLM decision:")}         ${ms(r.llmMs)}  → called: ${tools}`);
      const toolBranch = isLast && !t.forcedResponseMs ? "  │    └─" : "  │    └─";
      gptRoundLines.push(`${toolBranch} ${pad("Tool execution:")}       ${ms(r.toolMs ?? 0)}`);
    }
  });

  if (t.forcedResponseMs !== undefined) {
    gptRoundLines.push(`  └─ ${pad("[FORCED] Final response:")} ${ms(t.forcedResponseMs)}`);
  }

  const gptLines = [
    `${pad("GPT response (total):")}     ${ms(t.gptMs)}`,
    ...gptRoundLines,
  ];

  const timingLines = [...promptLines, ...gptLines].join("\n");

  const entry = [
    divider("COACH INTERACTION"),
    section("TIMINGS", timingLines),
    section("USER QUERY", opts.userQuery),
    section("PROMPT SENT TO LLM", opts.prompt),
    section("COACH RESPONSE", opts.response),
    "",
  ].join("\n");

  try {
    appendFileSync(LOG_PATH, entry, "utf8");
  } catch (e) {
    console.error("[coach-logger] Failed to write Coach.log:", e);
  }
}
