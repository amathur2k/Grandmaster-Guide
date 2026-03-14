import type { StockfishEvaluation } from "@shared/schema";

interface EvalBarProps {
  evaluation: StockfishEvaluation;
  isReady: boolean;
}

export function EvalBar({ evaluation, isReady }: EvalBarProps) {
  const { score, depth, mate } = evaluation;

  const clampedScore = Math.max(-10, Math.min(10, score));
  const whitePercentage = mate !== null
    ? (mate > 0 ? 95 : 5)
    : 50 + (clampedScore / 10) * 45;

  const displayScore = mate !== null
    ? `M${Math.abs(mate)}`
    : score >= 0
      ? `+${score.toFixed(1)}`
      : score.toFixed(1);

  const isWhiteAdvantage = mate !== null ? mate > 0 : score >= 0;

  return (
    <div className="flex flex-col items-center gap-2" data-testid="eval-bar">
      <div
        className="relative w-8 rounded-md overflow-hidden border border-border"
        style={{ height: "calc(100% - 5px)" }}
      >
        <div
          className="absolute bottom-0 left-0 right-0 bg-white transition-all duration-500 ease-out"
          style={{ height: `${whitePercentage}%` }}
        />
        <div
          className="absolute top-0 left-0 right-0 transition-all duration-500 ease-out"
          style={{
            height: `${100 - whitePercentage}%`,
            backgroundColor: "#1a1a2e",
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={`text-xs font-mono font-bold z-10 px-0.5 ${
              isWhiteAdvantage ? "text-[#1a1a2e]" : "text-white"
            }`}
            style={{
              transform: `translateY(${isWhiteAdvantage ? "8px" : "-8px"})`,
            }}
            data-testid="text-eval-score"
          >
            {isReady ? displayScore : "..."}
          </span>
        </div>
      </div>
    </div>
  );
}
