import { appendFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const IS_DEV = process.env.NODE_ENV !== "production";
const LOG_PATH = path.join(process.cwd(), "Coach.log");

function ts(): string {
  return new Date().toISOString();
}

function divider(label: string): string {
  const line = "═".repeat(80);
  return `\n${line}\n  ${label}  —  ${ts()}\n${line}`;
}

function section(title: string, body: string): string {
  return `\n┌── ${title}\n${body.split("\n").map(l => "│  " + l).join("\n")}\n└──`;
}

export function logCoachInteraction(opts: {
  userQuery: string;
  prompt: string;
  response: string;
}): void {
  if (!IS_DEV) return;

  const entry = [
    divider("COACH INTERACTION"),
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
