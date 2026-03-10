import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Brain, Send, Trash2, Wrench, Sparkles } from "lucide-react";
import type { StockfishEvaluation, ChatMessage } from "@shared/schema";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CoachConsoleProps {
  evaluation: StockfishEvaluation;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isChatLoading: boolean;
  onClearChat: () => void;
  useToolCalling: boolean;
  onToggleToolCalling: (value: boolean) => void;
}

export function CoachConsole({
  evaluation,
  messages,
  onSendMessage,
  isChatLoading,
  onClearChat,
  useToolCalling,
  onToggleToolCalling,
}: CoachConsoleProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          AI Coach
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

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                Your AI Chess Coach
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ask about the current position, strategy, tactics, or any chess question.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
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
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            ))}
            {isChatLoading && (
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
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isChatLoading}
            className="shrink-0 h-10 w-10"
            data-testid="button-send-chat"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center justify-end mt-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onToggleToolCalling(!useToolCalling)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    useToolCalling
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                  data-testid="toggle-tool-calling"
                >
                  <Wrench className="w-3 h-3" />
                  {useToolCalling ? "Verify ON" : "Verify OFF"}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px]">
                <p className="text-xs">
                  {useToolCalling
                    ? "AI calls Stockfish to verify analysis. Slower but accurate."
                    : "AI responds without engine verification. Faster."}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
