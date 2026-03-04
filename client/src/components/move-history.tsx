import { ScrollArea } from "@/components/ui/scroll-area";

interface MoveHistoryProps {
  moves: string[];
  currentMoveIndex: number;
  onMoveClick: (index: number) => void;
}

export function MoveHistory({ moves, currentMoveIndex, onMoveClick }: MoveHistoryProps) {
  const movePairs: { number: number; white: string; black?: string; whiteIndex: number; blackIndex?: number }[] = [];

  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
      whiteIndex: i,
      blackIndex: i + 1 < moves.length ? i + 1 : undefined,
    });
  }

  return (
    <div className="flex flex-col h-full" data-testid="move-history">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">
        Moves
      </h3>
      <ScrollArea className="flex-1">
        <div className="px-2 pb-2">
          {movePairs.length === 0 ? (
            <p className="text-sm text-muted-foreground px-1 py-3 text-center italic">
              No moves yet. Play a move or load a PGN.
            </p>
          ) : (
            <div className="space-y-0.5">
              {movePairs.map((pair) => (
                <div
                  key={pair.number}
                  className="flex items-center text-sm font-mono gap-1"
                >
                  <span className="text-muted-foreground w-7 text-right text-xs shrink-0">
                    {pair.number}.
                  </span>
                  <button
                    onClick={() => onMoveClick(pair.whiteIndex)}
                    className={`px-1.5 py-0.5 rounded-sm flex-1 text-left transition-colors ${
                      currentMoveIndex === pair.whiteIndex
                        ? "bg-primary text-primary-foreground"
                        : "hover-elevate"
                    }`}
                    data-testid={`button-move-${pair.whiteIndex}`}
                  >
                    {pair.white}
                  </button>
                  {pair.black && pair.blackIndex !== undefined && (
                    <button
                      onClick={() => onMoveClick(pair.blackIndex!)}
                      className={`px-1.5 py-0.5 rounded-sm flex-1 text-left transition-colors ${
                        currentMoveIndex === pair.blackIndex
                          ? "bg-primary text-primary-foreground"
                          : "hover-elevate"
                      }`}
                      data-testid={`button-move-${pair.blackIndex}`}
                    >
                      {pair.black}
                    </button>
                  )}
                  {!pair.black && <span className="flex-1" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
