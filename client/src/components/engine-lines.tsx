import { useMemo, useCallback } from "react";
import { Chess } from "chess.js";
import { Button } from "@/components/ui/button";
import { Sparkles, Search } from "lucide-react";
import type { EngineLine } from "@shared/schema";

interface PvMoveInfo {
  san: string;
  from: string;
  to: string;
}

interface EngineLinesProps {
  lines: EngineLine[];
  fen: string;
  turn: "w" | "b";
  isReady: boolean;
  onExplainMove: (moveUci: string, moveSan: string, score: string, pvSan: string) => void;
  onAnalyzeLine: (pvUci: string[], baseFen: string) => void;
  onHoverMoves: (arrows: Array<{ from: string; to: string; moveNum: number }> | null) => void;
  onClickSequence: (fen: string, nodeId: string | undefined, sanMoves: string[]) => void;
  currentNodeId?: string;
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

function pvToMoveInfos(fen: string, pvMoves: string[]): PvMoveInfo[] {
  const result: PvMoveInfo[] = [];
  try {
    const game = new Chess(fen);
    for (const uci of pvMoves) {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      const move = game.move({ from, to, promotion });
      if (!move) break;
      result.push({ san: move.san, from: move.from, to: move.to });
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

export function EngineLines({ lines, fen, turn, isReady, onExplainMove, onAnalyzeLine, onHoverMoves, onClickSequence, currentNodeId }: EngineLinesProps) {
  const displayLines = useMemo(() => {
    return lines.map((line, i) => {
      const san = uciToSan(fen, line.move);
      const pvMoveInfos = pvToMoveInfos(fen, line.pv.slice(0, 14));
      const scoreStr = formatScore(line.score, line.mate);

      const isPositive = line.mate !== null ? line.mate > 0 : line.score > 0;
      const isNeutral = line.mate === null && Math.abs(line.score) < 0.3;

      let moveNumberPrefix = "";
      let startMoveNum = 1;
      let startIsBlack = false;
      if (pvMoveInfos.length > 0) {
        const game = new Chess(fen);
        startMoveNum = game.moveNumber();
        startIsBlack = turn === "b";
        moveNumberPrefix = startIsBlack ? `${startMoveNum}...` : `${startMoveNum}.`;
      }

      return {
        index: i,
        san: san || line.move,
        uci: line.move,
        score: scoreStr,
        isPositive,
        isNeutral,
        pvMoveInfos,
        pvSan: pvMoveInfos.map(m => m.san).join(" "),
        pvUci: line.pv,
        rawScore: scoreStr,
        startMoveNum,
        startIsBlack,
      };
    });
  }, [lines, fen, turn]);

  const handleHover = useCallback((pvMoveInfos: PvMoveInfo[], upToIndex: number, startMoveNum: number, startIsBlack: boolean) => {
    const arrows = pvMoveInfos.slice(0, upToIndex + 1).map((m, i) => {
      const moveNum = startMoveNum + Math.floor((i + (startIsBlack ? 1 : 0)) / 2);
      return { from: m.from, to: m.to, moveNum };
    });
    onHoverMoves(arrows);
  }, [onHoverMoves]);

  const handleClick = useCallback((pvMoveInfos: PvMoveInfo[], upToIndex: number) => {
    const sanMoves = pvMoveInfos.slice(0, upToIndex + 1).map(m => m.san);
    onClickSequence(fen, currentNodeId, sanMoves);
  }, [onClickSequence, fen, currentNodeId]);

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
      {displayLines.map((line) => {
        const isBlackStart = line.startIsBlack;

        return (
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
              data-testid={`engine-pv-${line.index}`}
            >
              {line.pvMoveInfos.map((moveInfo, mi) => {
                const isBlackTurn = isBlackStart ? mi % 2 === 0 : mi % 2 === 1;
                const moveNum = line.startMoveNum + Math.floor((mi + (isBlackStart ? 1 : 0)) / 2);

                let prefix = "";
                if (mi === 0) {
                  prefix = isBlackStart ? `${line.startMoveNum}…` : `${line.startMoveNum}.`;
                } else if (!isBlackTurn) {
                  prefix = `${moveNum}.`;
                }

                return (
                  <span key={mi}>
                    {prefix && <span className="text-muted-foreground/70 mr-0.5">{prefix}</span>}
                    <span
                      className="text-foreground hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-sm transition-colors"
                      onMouseEnter={() => handleHover(line.pvMoveInfos, mi, line.startMoveNum, isBlackStart)}
                      onMouseLeave={() => onHoverMoves(null)}
                      onClick={() => handleClick(line.pvMoveInfos, mi)}
                      title="Click to play up to this move"
                      data-testid={`engine-move-${line.index}-${mi}`}
                    >
                      {moveInfo.san}
                    </span>
                    {mi < line.pvMoveInfos.length - 1 && <span className="mx-px"> </span>}
                  </span>
                );
              })}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => onAnalyzeLine(line.pvUci, fen)}
              title="Analyze this line"
              data-testid={`button-analyze-line-${line.index}`}
            >
              <Search className="w-3 h-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => onExplainMove(line.uci, line.san, line.rawScore, line.pvSan)}
              title={`Explain ${line.san}`}
              data-testid={`button-explain-move-${line.index}`}
            >
              <Sparkles className="w-3 h-3" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
