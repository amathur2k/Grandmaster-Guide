import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, Brain, Send, Trash2 } from "lucide-react";
import type { StockfishEvaluation, ChatMessage } from "@shared/schema";

interface CoachConsoleProps {
  evaluation: StockfishEvaluation;
  isAnalyzing: boolean;
  isEngineReady: boolean;
  onExplain: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isChatLoading: boolean;
  onClearChat: () => void;
}

export function CoachConsole({
  evaluation,
  isAnalyzing,
  isEngineReady,
  onExplain,
  messages,
  onSendMessage,
  isChatLoading,
  onClearChat,
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
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                Your AI Chess Coach
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Click below to get a position analysis, then ask follow-up questions about strategy, tactics, or plans.
              </p>
            </div>
            <Button
              onClick={onExplain}
              disabled={isAnalyzing || !isEngineReady}
              className="gap-2"
              size="lg"
              data-testid="button-explain"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Explain This Position
                </>
              )}
            </Button>
            {!isEngineReady && (
              <p className="text-xs text-muted-foreground">Engine loading...</p>
            )}
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

      {hasMessages && (
        <div className="px-3 pb-3 pt-1 border-t border-border shrink-0">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a follow-up question..."
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
          <div className="flex items-center justify-between mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onExplain}
              disabled={isAnalyzing || !isEngineReady}
              className="gap-1.5 text-xs h-7"
              data-testid="button-re-explain"
            >
              <Sparkles className="w-3 h-3" />
              Re-analyze position
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
