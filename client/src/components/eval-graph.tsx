import { useCallback, useMemo, useRef } from "react";

interface EvalScore {
  score: number;
  mate: number | null;
}

interface EvalGraphProps {
  scores: (EvalScore | null)[];
  currentMoveIndex: number;
  onMoveClick: (index: number) => void;
}

const CLAMP = 5;
const PADDING_LEFT = 28;
const PADDING_RIGHT = 4;
const PADDING_TOP = 4;
const PADDING_BOTTOM = 14;
const GRAPH_HEIGHT = 72;
const HEIGHT = GRAPH_HEIGHT + PADDING_BOTTOM;
const VIEW_WIDTH = 620;

function clampScore(score: number, mate: number | null): number {
  if (mate !== null) {
    return mate > 0 ? CLAMP : -CLAMP;
  }
  return Math.max(-CLAMP, Math.min(CLAMP, score));
}

const AXIS_TICKS = [5, 2.5, 0, -2.5, -5];

export function EvalGraph({ scores, currentMoveIndex, onMoveClick }: EvalGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (scores.length === 0) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pxLeft = (PADDING_LEFT / VIEW_WIDTH) * rect.width;
      const pxRight = (PADDING_RIGHT / VIEW_WIDTH) * rect.width;
      const usableWidth = rect.width - pxLeft - pxRight;
      const ratio = (x - pxLeft) / usableWidth;
      const index = Math.round(ratio * (scores.length - 1));
      const clamped = Math.max(0, Math.min(scores.length - 1, index));
      onMoveClick(clamped);
    },
    [scores, onMoveClick]
  );

  const { areaPath, linePath, dots, currentX, midY, moveTicks } = useMemo(() => {
    const usableW = VIEW_WIDTH - PADDING_LEFT - PADDING_RIGHT;
    const usableH = GRAPH_HEIGHT - PADDING_TOP * 2;
    const mid = PADDING_TOP + usableH / 2;

    let firstGap = scores.findIndex(s => !s);
    if (firstGap === -1) firstGap = scores.length;
    const denseScores = scores.slice(0, firstGap);

    if (denseScores.length === 0) {
      return { areaPath: "", linePath: "", dots: [], currentX: 0, midY: mid, moveTicks: [] };
    }

    const points = denseScores.map((s, i) => {
      const x = denseScores.length === 1
        ? PADDING_LEFT + usableW / 2
        : PADDING_LEFT + (i / (denseScores.length - 1)) * usableW;
      const entry = s || { score: 0, mate: null };
      const normalized = clampScore(entry.score, entry.mate);
      const y = mid - (normalized / CLAMP) * (usableH / 2);
      return { x, y };
    });

    let area = `M ${PADDING_LEFT},${mid}`;
    for (const p of points) {
      area += ` L ${p.x},${p.y}`;
    }
    area += ` L ${points[points.length - 1].x},${mid} Z`;

    let line = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      line += ` L ${points[i].x},${points[i].y}`;
    }

    const dotData = denseScores.map((s, i) => {
      const entry = s || { score: 0, mate: null };
      const prevEntry = i > 0 ? (denseScores[i - 1] || { score: 0, mate: null }) : { score: 0, mate: null };
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

    const curIdx = Math.max(0, Math.min(currentMoveIndex, denseScores.length - 1));
    const cx = points[curIdx]?.x ?? PADDING_LEFT;

    const totalMoves = denseScores.length;
    const maxMoveNum = Math.ceil(totalMoves / 2);
    let step = 1;
    if (maxMoveNum > 40) step = 10;
    else if (maxMoveNum > 20) step = 5;
    else if (maxMoveNum > 10) step = 2;
    const ticks: { x: number; label: string }[] = [];
    for (let moveNum = 1; moveNum <= maxMoveNum; moveNum += step) {
      const idx = (moveNum - 1) * 2;
      if (idx < totalMoves) {
        ticks.push({ x: points[idx].x, label: String(moveNum) });
      }
    }

    return { areaPath: area, linePath: line, dots: dotData, currentX: cx, midY: mid, moveTicks: ticks };
  }, [scores, currentMoveIndex]);

  const hasDenseScores = scores.some(s => !!s);

  if (!hasDenseScores) {
    return (
      <div
        className="w-full bg-muted/30 border border-border rounded-md flex items-center justify-center"
        style={{ height: HEIGHT }}
        data-testid="eval-graph-empty"
      >
        <p className="text-xs text-muted-foreground italic">Play moves or import a game to see the advantage chart</p>
      </div>
    );
  }

  const usableH = GRAPH_HEIGHT - PADDING_TOP * 2;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW_WIDTH} ${HEIGHT}`}
      className="w-full border border-border rounded-md cursor-pointer bg-white dark:bg-zinc-900"
      style={{ height: HEIGHT }}
      onClick={handleClick}
      preserveAspectRatio="none"
      data-testid="eval-graph"
    >
      <rect x={PADDING_LEFT} y="0" width={VIEW_WIDTH - PADDING_LEFT} height={midY} fill="#f8fafc" className="dark:fill-zinc-800" />
      <rect x={PADDING_LEFT} y={midY} width={VIEW_WIDTH - PADDING_LEFT} height={GRAPH_HEIGHT - midY} fill="#e2e8f0" className="dark:fill-zinc-950" />
      <rect x="0" y="0" width={PADDING_LEFT} height={HEIGHT} fill="#ffffff" className="dark:fill-zinc-900" />
      <rect x={PADDING_LEFT} y={GRAPH_HEIGHT} width={VIEW_WIDTH - PADDING_LEFT} height={PADDING_BOTTOM} fill="#ffffff" className="dark:fill-zinc-900" />

      {AXIS_TICKS.map(tick => {
        const y = PADDING_TOP + usableH / 2 - (tick / CLAMP) * (usableH / 2);
        const label = tick === 0 ? "0" : tick > 0 ? `+${tick}` : `${tick}`;
        return (
          <g key={tick}>
            <line
              x1={PADDING_LEFT}
              y1={y}
              x2={VIEW_WIDTH - PADDING_RIGHT}
              y2={y}
              stroke={tick === 0 ? "#94a3b8" : "#cbd5e1"}
              strokeWidth={tick === 0 ? "0.6" : "0.3"}
              strokeDasharray={tick === 0 ? "4,3" : "2,3"}
              className={tick === 0 ? "" : "dark:stroke-zinc-700"}
            />
            <text
              x={PADDING_LEFT - 3}
              y={y}
              textAnchor="end"
              dominantBaseline="central"
              fontSize="7"
              fill="#94a3b8"
              className="dark:fill-zinc-500"
            >
              {label}
            </text>
          </g>
        );
      })}

      {moveTicks.map(tick => (
        <g key={`move-${tick.label}`}>
          <line
            x1={tick.x} y1={GRAPH_HEIGHT}
            x2={tick.x} y2={GRAPH_HEIGHT + 3}
            stroke="#94a3b8" strokeWidth="0.5"
          />
          <text
            x={tick.x}
            y={GRAPH_HEIGHT + 10}
            textAnchor="middle"
            fontSize="7"
            fill="#94a3b8"
            className="dark:fill-zinc-500"
          >
            {tick.label}
          </text>
        </g>
      ))}

      <defs>
        <clipPath id="white-area">
          <rect x={PADDING_LEFT} y="0" width={VIEW_WIDTH - PADDING_LEFT} height={midY} />
        </clipPath>
        <clipPath id="black-area">
          <rect x={PADDING_LEFT} y={midY} width={VIEW_WIDTH - PADDING_LEFT} height={GRAPH_HEIGHT - midY} />
        </clipPath>
      </defs>

      <path d={areaPath} fill="#ffffff" opacity="0.9" clipPath="url(#white-area)" className="dark:fill-zinc-200" />
      <path d={areaPath} fill="#1e293b" opacity="0.7" clipPath="url(#black-area)" className="dark:fill-zinc-600" />

      <path d={linePath} fill="none" stroke="#475569" strokeWidth="1.2" className="dark:stroke-zinc-400" />

      {currentMoveIndex >= 0 && currentMoveIndex < scores.length && (
        <line
          x1={currentX} y1={PADDING_TOP} x2={currentX} y2={GRAPH_HEIGHT}
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
