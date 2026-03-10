import { useMemo } from "react";
import { Chess } from "chess.js";
import { Button } from "@/components/ui/button";
import { Sparkles, Search } from "lucide-react";
import type { EngineLine } from "@shared/schema";

interface EngineLinesProps {
  lines: EngineLine[];
  fen: string;
  turn: "w" | "b";
  isReady: boolean;
  onExplainMove: (moveUci: string, moveSan: string, score: string, pvSan: string) => void;
  onAnalyzeLine: (pvUci: string[], baseFen: string) => void;
}

function uciToSan(fen: string, uciMove: string): string | null {
  try {
    const game = new Chess(fen);
    const from = uciMove.slice(0, 2);
    const to = uciMove.slice(2, 4);
    const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
    const move = game.move({ from, to, promotion });
    return move ? move.san : null;
  } catch {
    return null;
  }
}

function pvToSan(fen: string, pvMoves: string[]): string[] {
  const result: string[] = [];
  try {
    const game = new Chess(fen);
    for (const uci of pvMoves) {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      const move = game.move({ from, to, promotion });
      if (!move) break;
      result.push(move.san);
    }
  } catch {
  }
  return result;
}

function formatScore(score: number, mate: number | null): string {
  if (mate !== null) {
    return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`;
  }
  return score >= 0 ? `+${score.toFixed(1)}` : score.toFixed(1);
}

export function EngineLines({ lines, fen, turn, isReady, onExplainMove, onAnalyzeLine }: EngineLinesProps) {
  const displayLines = useMemo(() => {
    return lines.map((line, i) => {
      const san = uciToSan(fen, line.move);
      const pvSanMoves = pvToSan(fen, line.pv.slice(0, 6));
      const scoreStr = formatScore(line.score, line.mate);

      const isPositive = line.mate !== null ? line.mate > 0 : line.score > 0;
      const isNeutral = line.mate === null && Math.abs(line.score) < 0.3;

      let moveNumberPrefix = "";
      if (pvSanMoves.length > 0) {
        const game = new Chess(fen);
        const moveNum = game.moveNumber();
        moveNumberPrefix = turn === "w" ? `${moveNum}.` : `${moveNum}...`;
      }

      const pvDisplay = pvSanMoves.length > 0
        ? `${moveNumberPrefix} ${pvSanMoves.join(" ")}`
        : line.move;

      return {
        index: i,
        san: san || line.move,
        uci: line.move,
        score: scoreStr,
        isPositive,
        isNeutral,
        pvDisplay,
        pvSan: pvSanMoves.join(" "),
        pvUci: line.pv,
        rawScore: scoreStr,
      };
    });
  }, [lines, fen, turn]);

  if (!isReady) {
    return (
      <div className="px-4 py-3">
        <p className="text-xs text-muted-foreground italic">Engine loading...</p>
      </div>
    );
  }

  if (displayLines.length === 0) {
    return (
      <div className="px-4 py-3">
        <p className="text-xs text-muted-foreground italic">Waiting for evaluation...</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-1" data-testid="engine-lines">
      {displayLines.map((line) => (
        <div
          key={line.index}
          className="flex items-center gap-2 group"
          data-testid={`engine-line-${line.index}`}
        >
          <span
            className={`text-xs font-mono font-bold w-12 text-right shrink-0 ${
              line.isNeutral
                ? "text-muted-foreground"
                : line.isPositive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
            }`}
            data-testid={`engine-score-${line.index}`}
          >
            {line.score}
          </span>
          <span
            className="text-xs font-mono text-foreground truncate flex-1"
            title={line.pvDisplay}
            data-testid={`engine-pv-${line.index}`}
          >
            {line.pvDisplay}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={() => onAnalyzeLine(line.pvUci, fen)}
            title={`Analyze this line`}
            data-testid={`button-analyze-line-${line.index}`}
          >
            <Search className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={() => onExplainMove(line.uci, line.san, line.rawScore, line.pvSan)}
            title={`Explain ${line.san}`}
            data-testid={`button-explain-move-${line.index}`}
          >
            <Sparkles className="w-3 h-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
