import { useState, useRef, useEffect, useMemo } from "react";
import { Chess } from "chess.js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Brain, Send, Trash2, Wrench, Sparkles, Square, Microscope, Lightbulb, HelpCircle } from "lucide-react";
import type { StockfishEvaluation } from "@shared/schema";
import {
  parseMovesInText,
  type MoveSequence,
  type FallbackFen,
} from "@/lib/parse-chess-moves";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ChatMessageWithFen {
  role: "user" | "model";
  text: string;
  fen?: string;
  nodeId?: string;
}

interface CoachConsoleProps {
  evaluation: StockfishEvaluation;
  messages: ChatMessageWithFen[];
  onSendMessage: (text: string) => void;
  isChatLoading: boolean;
  onClearChat: () => void;
  onCancelChat: () => void;
  useToolCalling: boolean;
  onToggleToolCalling: (value: boolean) => void;
  useFeatures: boolean;
  onToggleFeatures: (value: boolean) => void;
  useTheoria: boolean;
  onToggleTheoria: (value: boolean) => void;
  gameFen: string;
  fallbackFens?: FallbackFen[];
  onHoverMoves: (arrows: Array<{ from: string; to: string; moveNum: number }> | null) => void;
  onClickSequence: (fen: string, nodeId: string | undefined, sanMoves: string[]) => void;
  onHoverSquare: (square: string | null) => void;
}

function StatusMessage({ text }: { text: string }) {
  const label = text.startsWith("_") && text.endsWith("_") ? text.slice(1, -1) : text;
  return (
    <div className="flex items-center gap-2.5 text-sm text-muted-foreground py-0.5">
      <div className="flex items-center gap-[3px]">
        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:160ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:320ms]" />
      </div>
      <span className="animate-pulse">{label}</span>
    </div>
  );
}

const FAQ_QUESTIONS = [
  "Why was the last move bad?",
  "Why was the last move good?",
  "Analyse the game up to now",
  "What's the best plan for me here?",
  "What are my main weaknesses in this position?",
  "Is this position winning, losing, or drawn?",
  "What opening is this?",
  "What should I be thinking about right now?",
  "Where should I put my pieces?",
  "Explain the key pieces in this position",
];

function isSquareRef(content: string, matchIndex: number): boolean {
  const before = content.slice(Math.max(0, matchIndex - 5), matchIndex);
  if (/\d+\.{1,3}\s*$/.test(before)) return false;
  if (/\d$/.test(before.trimEnd())) return false;
  return true;
}

function renderTextWithSquares(
  content: string,
  onHoverSquare?: (square: string | null) => void
): (string | JSX.Element)[] {
  const parts: (string | JSX.Element)[] = [];
  const re = /(\*\*[^*]+\*\*|\b[a-h][1-8]\b)/g;
  let last = 0;
  let key = 0;
  let match;
  while ((match = re.exec(content)) !== null) {
    if (match.index > last) parts.push(content.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={`b${key++}`}>{token.slice(2, -2)}</strong>);
    } else if (onHoverSquare && isSquareRef(content, match.index)) {
      const sq = token;
      parts.push(
        <span
          key={`sq${key++}`}
          data-testid={`square-ref-${sq}`}
          className="font-semibold underline decoration-dotted decoration-amber-500 underline-offset-2 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-sm px-0.5 transition-colors cursor-default"
          onMouseEnter={() => onHoverSquare(sq)}
          onMouseLeave={() => onHoverSquare(null)}
        >
          {sq}
        </span>
      );
    } else {
      parts.push(token);
    }
    last = match.index + token.length;
  }
  if (last < content.length) parts.push(content.slice(last));
  return parts.length > 0 ? parts : [content];
}

function countPlayedMoves(sourceFen: string, moves: Array<{ san: string }>, currentBoardFen: string): number {
  const boardPos = currentBoardFen.split(" ").slice(0, 4).join(" ");
  let played = 0;
  try {
    const g = new Chess(sourceFen);
    for (const m of moves) {
      const r = g.move(m.san);
      if (!r) break;
      const pos = g.fen().split(" ").slice(0, 4).join(" ");
      if (pos === boardPos) {
        played = moves.indexOf(m) + 1;
      }
    }
  } catch {}
  return played;
}

function InteractiveMessage({
  text,
  fen,
  nodeId,
  fallbackFens,
  currentBoardFen,
  onHover,
  onClick,
  onHoverSquare,
}: {
  text: string;
  fen: string;
  nodeId?: string;
  fallbackFens?: FallbackFen[];
  currentBoardFen: string;
  onHover: (arrows: Array<{ from: string; to: string; moveNum: number }> | null) => void;
  onClick: (fen: string, nodeId: string | undefined, moves: string[]) => void;
  onHoverSquare: (square: string | null) => void;
}) {
  const { segments, sequences } = useMemo(
    () => parseMovesInText(text, fen, fallbackFens),
    [text, fen, fallbackFens]
  );

  return (
    <div className="whitespace-pre-wrap">
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <span key={i}>{renderTextWithSquares(seg.content, onHoverSquare)}</span>;
        }
        const seq = sequences.find((s) => s.id === seg.seqId);
        const movesUpTo = seq ? seq.moves.slice(0, seg.orderInSeq + 1) : [];

        const effectiveFen = seq?.sourceFen || seg.sourceFen || fen;
        const effectiveNodeId = seq?.sourceNodeId || seg.sourceNodeId || nodeId;

        return (
          <span
            key={i}
            className="text-blue-600 dark:text-blue-400 font-semibold underline decoration-dotted underline-offset-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-sm px-0.5 transition-colors"
            onMouseEnter={() => {
              if (movesUpTo.length > 0) {
                const alreadyPlayed = countPlayedMoves(effectiveFen, movesUpTo, currentBoardFen);
                const unplayed = movesUpTo.slice(alreadyPlayed);
                if (unplayed.length > 0) {
                  const meta = getMoveNumMeta(effectiveFen);
                  const arrows = unplayed.map((m, idx) => {
                    const globalIdx = alreadyPlayed + idx;
                    const moveNum = meta.startMoveNum + Math.floor((globalIdx + (meta.startIsBlack ? 1 : 0)) / 2);
                    return { from: m.from, to: m.to, moveNum };
                  });
                  onHover(arrows);
                } else {
                  onHover(null);
                }
              }
            }}
            onMouseLeave={() => onHover(null)}
            onClick={() => {
              if (movesUpTo.length > 0) {
                const alreadyPlayed = countPlayedMoves(effectiveFen, movesUpTo, currentBoardFen);
                const unplayedSan = movesUpTo.slice(alreadyPlayed).map((m) => m.san);
                if (unplayedSan.length > 0) {
                  const playFromFen = alreadyPlayed > 0 ? currentBoardFen : effectiveFen;
                  onClick(playFromFen, undefined, unplayedSan);
                }
              }
            }}
            title="Click to play up to this move"
            data-testid={`move-token-${seg.san}-${i}`}
          >
            {seg.san}
          </span>
        );
      })}
    </div>
  );
}

function getMoveNumMeta(fen: string) {
  try {
    const g = new Chess(fen);
    return { startMoveNum: g.moveNumber(), startIsBlack: g.turn() === "b" };
  } catch {
    return { startMoveNum: 1, startIsBlack: false };
  }
}

export function CoachConsole({
  evaluation,
  messages,
  onSendMessage,
  isChatLoading,
  onClearChat,
  onCancelChat,
  useToolCalling,
  onToggleToolCalling,
  useFeatures,
  onToggleFeatures,
  useTheoria,
  onToggleTheoria,
  gameFen,
  fallbackFens,
  onHoverMoves,
  onClickSequence,
  onHoverSquare,
}: CoachConsoleProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [theoriaStatus, setTheoriaStatus] = useState<{ ready: boolean; downloading: boolean; hasBinary: boolean } | null>(null);
  const [analyzerStatus, setAnalyzerStatus] = useState<"starting" | "ready" | "unavailable">("starting");

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/python-analyzer-status");
        if (!cancelled && res.ok) {
          const data = await res.json();
          setAnalyzerStatus(data.status as "starting" | "ready" | "unavailable");
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    if (!useTheoria) {
      setTheoriaStatus(null);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/theoria-status");
        if (!cancelled && res.ok) {
          const data = await res.json();
          setTheoriaStatus({ ready: data.ready, downloading: data.downloading, hasBinary: data.hasBinary });
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [useTheoria]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isChatLoading]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isChatLoading) return;
    onSendMessage(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full" data-testid="coach-console">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          Chess Coach
        </h3>
        <div className="flex items-center gap-1">
          {hasMessages && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onClearChat}
              data-testid="button-clear-chat"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div className="w-[28%] shrink-0 border-r border-border overflow-y-auto" data-testid="faq-panel">
          <div className="px-2.5 py-2 border-b border-border bg-muted/30 sticky top-0">
            <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <HelpCircle className="w-3 h-3" />
              FAQ's
            </h4>
          </div>
          <div className="p-1.5 flex flex-col gap-0.5">
            {FAQ_QUESTIONS.map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => !isChatLoading && onSendMessage(q)}
                disabled={isChatLoading}
                className="text-left text-xs leading-snug px-2 py-1.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid={`faq-question-${i}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto px-4 py-3">
          {!hasMessages ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">
                  Your Chess Coach
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Ask about the current position, strategy, tactics, or any chess question.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg, i) => {
                const isStreaming =
                  isChatLoading &&
                  i === messages.length - 1 &&
                  msg.role === "model";
                const isStatus =
                  msg.role === "model" &&
                  msg.text.startsWith("_") &&
                  msg.text.endsWith("_") &&
                  !msg.text.slice(1, -1).includes("\n");
                const showInteractive =
                  msg.role === "model" && !isStreaming && !isStatus && !!msg.fen;

                return (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    data-testid={`chat-message-${i}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted border border-border/50 rounded-bl-sm"
                      }`}
                    >
                      {isStatus ? (
                        <StatusMessage text={msg.text} />
                      ) : showInteractive ? (
                        <InteractiveMessage
                          text={msg.text}
                          fen={msg.fen!}
                          nodeId={msg.nodeId}
                          fallbackFens={fallbackFens}
                          currentBoardFen={gameFen}
                          onHover={onHoverMoves}
                          onClick={onClickSequence}
                          onHoverSquare={onHoverSquare}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap">
                          {renderTextWithSquares(msg.text, onHoverSquare)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {isChatLoading && !messages.some((m, i) => m.role === "model" && i === messages.length - 1) && (
                <div className="flex justify-start" data-testid="chat-loading">
                  <div className="bg-muted border border-border/50 rounded-xl rounded-bl-sm px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Thinking...
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      <div className="px-3 pb-3 pt-1 border-t border-border shrink-0">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this position..."
            className="resize-none text-sm min-h-[40px] max-h-[100px]"
            rows={1}
            disabled={isChatLoading}
            data-testid="input-chat"
          />
          {isChatLoading ? (
            <Button
              size="icon"
              variant="destructive"
              onClick={onCancelChat}
              className="shrink-0 h-10 w-10"
              data-testid="button-cancel-chat"
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim()}
              className="shrink-0 h-10 w-10"
              data-testid="button-send-chat"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 mt-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => analyzerStatus === "ready" && onToggleFeatures(!useFeatures)}
                  disabled={analyzerStatus !== "ready"}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    analyzerStatus !== "ready"
                      ? "bg-muted text-muted-foreground/50 border border-border/50 cursor-not-allowed opacity-60"
                      : useFeatures
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                  data-testid="toggle-features"
                >
                  {analyzerStatus === "starting" ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Microscope className="w-3 h-3" />
                  )}
                  {analyzerStatus === "starting"
                    ? "Starting..."
                    : analyzerStatus === "unavailable"
                    ? "Unavailable"
                    : useFeatures ? "Position Detail ON" : "Position Detail OFF"}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px]">
                <p className="text-xs">
                  {analyzerStatus === "starting"
                    ? "Position analysis is starting up. It will be available shortly."
                    : analyzerStatus === "unavailable"
                    ? "Position analysis is currently unavailable. The system will keep trying to restart it."
                    : useFeatures
                    ? "The coach receives rich tactical and strategic detail about the position — forks, pins, king safety, pawn structure, center control, and more."
                    : "Extra position detail is off. The coach uses only the best-move lines."}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onToggleTheoria(!useTheoria)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    useTheoria
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                  data-testid="toggle-theoria"
                >
                  {useTheoria && theoriaStatus && (theoriaStatus.downloading || (theoriaStatus.hasBinary && !theoriaStatus.ready)) ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Lightbulb className="w-3 h-3" />
                  )}
                  {useTheoria
                    ? theoriaStatus?.downloading
                      ? "Downloading..."
                      : theoriaStatus?.hasBinary && !theoriaStatus.ready
                      ? "Starting..."
                      : theoriaStatus?.ready
                      ? "Deep Insights ON"
                      : "Deep Insights OFF"
                    : "Deep Insights OFF"}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px]">
                <p className="text-xs">
                  {useTheoria
                    ? theoriaStatus?.downloading
                      ? "Downloading the deep insights module (~61 MB). This only happens once."
                      : theoriaStatus?.hasBinary && !theoriaStatus.ready
                      ? "Deep insights module is starting up..."
                      : theoriaStatus?.ready
                      ? "Deep insights active. The coach receives richer positional understanding for more detailed explanations."
                      : "Deep insights module is not yet available. It will start automatically."
                    : "Deep insights off. The coach uses standard computer analysis only."}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onToggleToolCalling(!useToolCalling)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    useToolCalling
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                  data-testid="toggle-tool-calling"
                >
                  <Wrench className="w-3 h-3" />
                  {useToolCalling ? "Accuracy Check ON" : "Accuracy Check OFF"}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px]">
                <p className="text-xs">
                  {useToolCalling
                    ? "The coach double-checks every move against the chess computer before showing it to you. Slower but more accurate."
                    : "The coach responds without double-checking moves. Faster but occasionally less precise."}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
