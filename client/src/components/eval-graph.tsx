import { useCallback, useMemo, useRef } from "react";

interface EvalScore {
  score: number;
  mate: number | null;
}

interface EvalGraphProps {
  scores: EvalScore[];
  currentMoveIndex: number;
  onMoveClick: (index: number) => void;
}

const CLAMP = 5;
const HEIGHT = 64;
const PADDING_X = 4;
const PADDING_Y = 2;

function clampScore(score: number, mate: number | null): number {
  if (mate !== null) {
    return mate > 0 ? CLAMP : -CLAMP;
  }
  return Math.max(-CLAMP, Math.min(CLAMP, score));
}

export function EvalGraph({ scores, currentMoveIndex, onMoveClick }: EvalGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (scores.length === 0) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      const index = Math.round(ratio * (scores.length - 1));
      const clamped = Math.max(0, Math.min(scores.length - 1, index));
      onMoveClick(clamped);
    },
    [scores, onMoveClick]
  );

  const { areaPath, linePath, dots, currentX, midY, width } = useMemo(() => {
    const w = 600;
    const usableW = w - PADDING_X * 2;
    const usableH = HEIGHT - PADDING_Y * 2;
    const mid = PADDING_Y + usableH / 2;

    if (scores.length === 0) {
      return { areaPath: "", linePath: "", dots: [], currentX: 0, midY: mid, width: w };
    }

    const points = scores.map((s, i) => {
      const x = scores.length === 1
        ? PADDING_X + usableW / 2
        : PADDING_X + (i / (scores.length - 1)) * usableW;
      const entry = s || { score: 0, mate: null };
      const normalized = clampScore(entry.score, entry.mate);
      const y = mid - (normalized / CLAMP) * (usableH / 2);
      return { x, y };
    });

    let area = `M ${PADDING_X},${mid}`;
    for (const p of points) {
      area += ` L ${p.x},${p.y}`;
    }
    area += ` L ${points[points.length - 1].x},${mid} Z`;

    let line = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      line += ` L ${points[i].x},${points[i].y}`;
    }

    const dotData = scores.map((s, i) => {
      const entry = s || { score: 0, mate: null };
      const prevEntry = i > 0 ? (scores[i - 1] || { score: 0, mate: null }) : { score: 0, mate: null };
      const prevScore = clampScore(prevEntry.score, prevEntry.mate);
      const curScore = clampScore(entry.score, entry.mate);
      const swing = Math.abs(curScore - prevScore);

      let color = "#94a3b8";
      if (i > 0) {
        if (swing >= 2) color = "#ef4444";
        else if (swing >= 1) color = "#f97316";
        else if (swing >= 0.5) color = "#eab308";
        else color = "#22c55e";
      }

      return {
        x: points[i].x,
        y: points[i].y,
        color,
        index: i,
      };
    });

    const curIdx = Math.max(0, Math.min(currentMoveIndex, scores.length - 1));
    const cx = points[curIdx]?.x ?? PADDING_X;

    return { areaPath: area, linePath: line, dots: dotData, currentX: cx, midY: mid, width: w };
  }, [scores, currentMoveIndex]);

  if (scores.length === 0) {
    return (
      <div
        className="w-full bg-muted/30 border border-border rounded-md flex items-center justify-center"
        style={{ height: HEIGHT }}
        data-testid="eval-graph-empty"
      >
        <p className="text-xs text-muted-foreground italic">Play moves or load a PGN to see the evaluation graph</p>
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      className="w-full border border-border rounded-md cursor-pointer bg-white dark:bg-zinc-900"
      style={{ height: HEIGHT }}
      onClick={handleClick}
      preserveAspectRatio="none"
      data-testid="eval-graph"
    >
      <rect x="0" y="0" width={width} height={midY} fill="#f8fafc" className="dark:fill-zinc-800" />
      <rect x="0" y={midY} width={width} height={HEIGHT - midY} fill="#e2e8f0" className="dark:fill-zinc-950" />

      <line
        x1={PADDING_X} y1={midY} x2={width - PADDING_X} y2={midY}
        stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="4,3"
      />

      <defs>
        <clipPath id="white-area">
          <rect x="0" y="0" width={width} height={midY} />
        </clipPath>
        <clipPath id="black-area">
          <rect x="0" y={midY} width={width} height={HEIGHT - midY} />
        </clipPath>
      </defs>

      <path d={areaPath} fill="#ffffff" opacity="0.9" clipPath="url(#white-area)" className="dark:fill-zinc-200" />
      <path d={areaPath} fill="#1e293b" opacity="0.7" clipPath="url(#black-area)" className="dark:fill-zinc-600" />

      <path d={linePath} fill="none" stroke="#475569" strokeWidth="1.2" className="dark:stroke-zinc-400" />

      {currentMoveIndex >= 0 && currentMoveIndex < scores.length && (
        <line
          x1={currentX} y1={PADDING_Y} x2={currentX} y2={HEIGHT - PADDING_Y}
          stroke="#3b82f6" strokeWidth="1.5" opacity="0.8"
        />
      )}

      {dots.map((dot) => (
        <circle
          key={dot.index}
          cx={dot.x}
          cy={dot.y}
          r="2.5"
          fill={dot.color}
          stroke="#fff"
          strokeWidth="0.5"
          className="dark:stroke-zinc-800"
        />
      ))}
    </svg>
  );
}
