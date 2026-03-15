import { AlertTriangle, Shield, Crown, Loader2 } from "lucide-react";

interface Finding {
  type: string;
  side: string;
  description: string;
  squares: string[];
}

export interface RichPositionFeatures {
  tactical: Finding[];
  strategic: Finding[];
  endgame: Finding[];
  is_endgame: boolean;
  summary: string;
}

interface PositionFindingsProps {
  findings: RichPositionFeatures | null;
  loading: boolean;
  analyzerReady: boolean;
  useFeatures: boolean;
  onHoverSquares: (squares: string[]) => void;
}

const TACTICAL_TYPE_LABELS: Record<string, string> = {
  hanging_piece: "Hanging",
  fork: "Fork",
  pin_absolute: "Pin",
  pin_relative: "Pin",
  skewer: "Skewer",
  direct_material_loss: "Loose piece",
  overloaded_defender: "Overloaded",
  trapped_piece: "Trapped",
  mating_threat: "Mate threat",
  promotion_race: "Promotion",
  tactical_refutation: "Refutation",
  discovered_attack: "Discovery",
};

const STRATEGIC_TYPE_LABELS: Record<string, string> = {
  development_lead: "Development",
  rook_placement: "Rook",
  piece_activity: "Activity",
  outpost: "Outpost",
  weak_square: "Weak sq.",
  bad_bishop: "Bad bishop",
  backward_pawn: "Backward ♙",
  piece_coordination: "Coord.",
};

function trimDescription(desc: string): string {
  return desc.length > 68 ? desc.slice(0, 66) + "…" : desc;
}

function categoryLabel(type: string): string {
  return TACTICAL_TYPE_LABELS[type] ?? STRATEGIC_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

interface FindingRowProps {
  item: Finding;
  category: "tactical" | "strategic" | "endgame";
  onMouseEnter: (squares: string[]) => void;
  onMouseLeave: () => void;
}

function FindingRow({ item, category, onMouseEnter, onMouseLeave }: FindingRowProps) {
  const colorClasses = {
    tactical: "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10",
    strategic: "border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10",
    endgame: "border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10",
  }[category];

  const labelColorClasses = {
    tactical: "text-amber-600 dark:text-amber-400",
    strategic: "text-blue-600 dark:text-blue-400",
    endgame: "text-purple-600 dark:text-purple-400",
  }[category];

  return (
    <div
      className={`px-2 py-1.5 rounded border cursor-default transition-colors ${colorClasses}`}
      onMouseEnter={() => onMouseEnter(item.squares ?? [])}
      onMouseLeave={onMouseLeave}
      data-testid={`finding-${item.type}`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={`text-xs font-bold leading-none ${labelColorClasses}`}>
          {categoryLabel(item.type)}
        </span>
        <span className="text-xs text-muted-foreground ml-auto shrink-0 leading-none">
          {item.side === "White" ? "W" : "B"}
        </span>
      </div>
      <p className="text-xs text-foreground leading-tight">
        {trimDescription(item.description)}
      </p>
    </div>
  );
}

export function PositionFindings({
  findings,
  loading,
  analyzerReady,
  useFeatures,
  onHoverSquares,
}: PositionFindingsProps) {
  if (!useFeatures) return null;

  const allFindings = findings
    ? [
        ...findings.tactical.map(f => ({ ...f, category: "tactical" as const })),
        ...findings.strategic.slice(0, 4).map(f => ({ ...f, category: "strategic" as const })),
        ...findings.endgame.slice(0, 3).map(f => ({ ...f, category: "endgame" as const })),
      ]
    : [];

  return (
    <div
      className="flex flex-col h-full min-h-0 border border-border rounded-md overflow-hidden bg-muted/10"
      style={{ width: 264 }}
      data-testid="position-findings-panel"
    >
      <div className="px-2 py-1.5 border-b border-border bg-muted/30 shrink-0 flex items-center gap-1.5">
        <Shield className="w-3 h-3 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-muted-foreground leading-none">
          Hints
        </h3>
        {loading && (
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />
        )}
      </div>

      <div className="overflow-y-auto p-1.5 flex flex-col gap-1" style={{ maxHeight: "calc(100% - 32px)" }}>
        {!analyzerReady && (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-6">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground text-center leading-tight">
              Analyzer starting…
            </p>
          </div>
        )}

        {analyzerReady && loading && allFindings.length === 0 && (
          <div className="space-y-1">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 rounded bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}

        {analyzerReady && !loading && allFindings.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-1.5 py-6">
            <Crown className="w-4 h-4 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground text-center leading-tight">
              No notable findings
            </p>
          </div>
        )}

        {analyzerReady && allFindings.length > 0 && (
          <>
            {allFindings.filter(f => f.category === "tactical").length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 px-1">
                  <AlertTriangle className="w-2.5 h-2.5 text-amber-500/70" />
                  <span className="text-xs font-semibold text-muted-foreground">
                    Tactical
                  </span>
                </div>
                {allFindings.filter(f => f.category === "tactical").map((f, i) => (
                  <FindingRow
                    key={`t-${i}`}
                    item={f}
                    category="tactical"
                    onMouseEnter={onHoverSquares}
                    onMouseLeave={() => onHoverSquares([])}
                  />
                ))}
              </div>
            )}

            {allFindings.filter(f => f.category === "strategic").length > 0 && (
              <div className="space-y-1 mt-1">
                <div className="flex items-center gap-1 px-1">
                  <Shield className="w-2.5 h-2.5 text-blue-500/70" />
                  <span className="text-xs font-semibold text-muted-foreground">
                    Strategic
                  </span>
                </div>
                {allFindings.filter(f => f.category === "strategic").map((f, i) => (
                  <FindingRow
                    key={`s-${i}`}
                    item={f}
                    category="strategic"
                    onMouseEnter={onHoverSquares}
                    onMouseLeave={() => onHoverSquares([])}
                  />
                ))}
              </div>
            )}

            {allFindings.filter(f => f.category === "endgame").length > 0 && (
              <div className="space-y-1 mt-1">
                <div className="flex items-center gap-1 px-1">
                  <Crown className="w-2.5 h-2.5 text-purple-500/70" />
                  <span className="text-xs font-semibold text-muted-foreground">
                    Endgame
                  </span>
                </div>
                {allFindings.filter(f => f.category === "endgame").map((f, i) => (
                  <FindingRow
                    key={`e-${i}`}
                    item={f}
                    category="endgame"
                    onMouseEnter={onHoverSquares}
                    onMouseLeave={() => onHoverSquares([])}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
