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

export interface CoachTimings {
  theoriaMs: number;
  featureMs: number;
  classicalMs: number;
  promptTotalMs: number;
  gptMs: number;
}

export function logCoachInteraction(opts: {
  userQuery: string;
  prompt: string;
  response: string;
  timings: CoachTimings;
}): void {
  if (!IS_DEV) return;

  const { timings: t } = opts;
  const timingLines = [
    `Prompt generation (total) : ${ms(t.promptTotalMs)}`,
    `  ├─ Theoria evaluation    : ${ms(t.theoriaMs)}`,
    `  ├─ Position features     : ${ms(t.featureMs)}`,
    `  └─ SF12 classical eval   : ${ms(t.classicalMs)}`,
    `GPT response (incl. tools) : ${ms(t.gptMs)}`,
  ].join("\n");

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
