import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2, Brain } from "lucide-react";
import type { StockfishEvaluation } from "@shared/schema";

interface CoachConsoleProps {
  evaluation: StockfishEvaluation;
  explanation: string;
  isAnalyzing: boolean;
  isEngineReady: boolean;
  onExplain: () => void;
}

export function CoachConsole({
  evaluation,
  explanation,
  isAnalyzing,
  isEngineReady,
  onExplain,
}: CoachConsoleProps) {
  const { topMoves, mate } = evaluation;

  const formatScore = (score: number, mateVal: number | null) => {
    if (mateVal !== null) return `Mate in ${Math.abs(mateVal)}`;
    return score >= 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
  };

  return (
    <div className="flex flex-col gap-3 h-full" data-testid="coach-console">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
          Engine Lines
        </h3>
        <div className="space-y-1.5">
          {topMoves.length > 0 ? (
            topMoves.map((move, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border/50"
                data-testid={`engine-line-${i}`}
              >
                <span className="text-xs font-mono text-muted-foreground w-4">
                  {i + 1}.
                </span>
                <span className="text-sm font-mono font-medium">
                  {move}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground italic px-1">
              {isEngineReady ? "Waiting for position..." : "Engine loading..."}
            </p>
          )}
        </div>
      </div>

      <Button
        onClick={onExplain}
        disabled={isAnalyzing || !isEngineReady}
        className="w-full gap-2"
        size="lg"
        data-testid="button-explain"
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Thinking...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Explain This Position
          </>
        )}
      </Button>

      <div className="flex-1 min-h-0">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5" />
          Coach Says
        </h3>
        <Card className="p-4 h-[calc(100%-2rem)] overflow-auto bg-card">
          {explanation ? (
            <p className="text-sm leading-relaxed" data-testid="text-explanation">
              {explanation}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic" data-testid="text-explanation-empty">
              Click "Explain This Position" to get insights from your AI coach.
              The coach will analyze the current position, identify the opening, and
              explain what's happening on the board.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
