import { useMemo } from "react";
import type { VariationNode } from "@/pages/chess-coach";

interface VariationTreeProps {
  tree: VariationNode;
  currentPath: string[];
  onNodeClick: (nodeId: string) => void;
}

interface DisplayNode {
  type: "node";
  id: string;
  move: string;
  label: string;
  x: number;
  y: number;
  isOnCurrentPath: boolean;
  isCurrentNode: boolean;
}

interface DisplayEllipsis {
  type: "ellipsis";
  x: number;
  y: number;
  isOnCurrentPath: boolean;
  key: string;
}

interface DisplayLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isActive: boolean;
  key: string;
}

type DisplayItem = DisplayNode | DisplayEllipsis;

const NODE_WIDTH = 64;
const NODE_HEIGHT = 26;
const ELLIPSIS_WIDTH = 40;
const H_GAP = 24;
const V_GAP = 8;
const STEP_Y = NODE_HEIGHT + V_GAP;

function getMoveLabel(node: VariationNode, root: VariationNode): string {
  const depth = getDepth(node, root);
  if (depth < 0) return node.move;
  const moveNum = Math.floor(depth / 2) + 1;
  const isWhite = depth % 2 === 0;
  return isWhite ? `${moveNum}.${node.move}` : `${moveNum}…${node.move}`;
}

function getDepth(target: VariationNode, root: VariationNode, d: number = -1): number {
  if (root.id === target.id) return d;
  for (const child of root.children) {
    const found = getDepth(target, child, d + 1);
    if (found >= 0) return found;
  }
  return -1;
}

function isBranchPoint(node: VariationNode): boolean {
  return node.children.length > 1;
}

function isLeaf(node: VariationNode): boolean {
  return node.children.length === 0;
}

function collectKeyNodes(
  node: VariationNode,
  currentPath: string[],
  currentNodeId: string,
  root: VariationNode
): {
  items: DisplayItem[];
  lines: DisplayLine[];
  maxX: number;
  maxY: number;
} {
  const items: DisplayItem[] = [];
  const lines: DisplayLine[] = [];
  const yOffset = { value: 0 };

  function walkBranch(
    startNode: VariationNode,
    xOffset: number,
    baseY: number,
    fromX: number,
    fromY: number,
    isFirst: boolean
  ): void {
    let node = startNode;
    let currentX = xOffset;
    let currentY = baseY;
    let prevEndX = fromX;
    let prevEndY = fromY;
    let firstInBranch = true;

    while (node) {
      const isKey = isBranchPoint(node) || isLeaf(node) || node.id === currentNodeId;
      const onPath = currentPath.includes(node.id);

      if (isKey || firstInBranch) {
        if (!firstInBranch && !isKey) {
        } else {
          const skippedMoves = !firstInBranch;
          let gapBetween = false;

          if (firstInBranch && !isFirst) {
            gapBetween = false;
          } else if (!firstInBranch) {
            gapBetween = true;
          }

          if (gapBetween) {
            const ellX = prevEndX + H_GAP;
            items.push({
              type: "ellipsis",
              x: ellX,
              y: currentY,
              isOnCurrentPath: onPath,
              key: `ell-${node.id}`,
            });

            lines.push({
              x1: prevEndX + NODE_WIDTH / 2,
              y1: prevEndY + NODE_HEIGHT / 2,
              x2: ellX,
              y2: currentY + NODE_HEIGHT / 2,
              isActive: onPath,
              key: `line-ell-${node.id}`,
            });

            prevEndX = ellX + ELLIPSIS_WIDTH;
            prevEndY = currentY;
            currentX = prevEndX + H_GAP;
          }

          const nodeX = currentX;
          const nodeY = currentY;

          if (prevEndX >= 0 && !(firstInBranch && isFirst)) {
            const lx1 = firstInBranch ? fromX + NODE_WIDTH / 2 : prevEndX;
            const ly1 = firstInBranch ? fromY + NODE_HEIGHT / 2 : prevEndY + NODE_HEIGHT / 2;
            lines.push({
              x1: lx1,
              y1: ly1,
              x2: nodeX,
              y2: nodeY + NODE_HEIGHT / 2,
              isActive: onPath,
              key: `line-${node.id}`,
            });
          }

          items.push({
            type: "node",
            id: node.id,
            move: node.move,
            label: getMoveLabel(node, root),
            x: nodeX,
            y: nodeY,
            isOnCurrentPath: onPath,
            isCurrentNode: node.id === currentNodeId,
          });

          prevEndX = nodeX;
          prevEndY = nodeY;
          currentX = nodeX + NODE_WIDTH + H_GAP;
          firstInBranch = false;
        }
      }

      if (isBranchPoint(node)) {
        for (let ci = 0; ci < node.children.length; ci++) {
          const child = node.children[ci];
          if (ci === 0) {
            walkBranch(child, currentX, currentY, prevEndX, prevEndY, false);
          } else {
            yOffset.value += STEP_Y;
            walkBranch(child, currentX, yOffset.value, prevEndX, prevEndY, false);
          }
        }
        return;
      }

      if (node.children.length === 1) {
        node = node.children[0];
      } else {
        return;
      }
    }
  }

  if (tree_hasContent(root)) {
    for (let ci = 0; ci < root.children.length; ci++) {
      const child = root.children[ci];
      if (ci === 0) {
        walkBranch(child, 0, 0, -NODE_WIDTH / 2, 0, true);
      } else {
        yOffset.value += STEP_Y;
        walkBranch(child, 0, yOffset.value, -NODE_WIDTH / 2, 0, true);
      }
    }
  }

  let maxX = 0;
  let maxY = 0;
  for (const item of items) {
    const w = item.type === "node" ? NODE_WIDTH : ELLIPSIS_WIDTH;
    if (item.x + w > maxX) maxX = item.x + w;
    if (item.y + NODE_HEIGHT > maxY) maxY = item.y + NODE_HEIGHT;
  }

  return { items, lines, maxX, maxY };
}

function tree_hasContent(root: VariationNode): boolean {
  return root.children.length > 0;
}

export function VariationTree({ tree, currentPath, onNodeClick }: VariationTreeProps) {
  const currentNodeId = currentPath[currentPath.length - 1];

  const { items, lines, totalWidth, totalHeight } = useMemo(() => {
    const { items, lines, maxX, maxY } = collectKeyNodes(tree, currentPath, currentNodeId, tree);
    return {
      items,
      lines,
      totalWidth: maxX + 16,
      totalHeight: maxY + 16,
    };
  }, [tree, currentPath, currentNodeId]);

  if (items.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground italic text-center" data-testid="variation-tree-empty">
        Make different moves to create variations
      </div>
    );
  }

  return (
    <div
      className="p-2 relative"
      style={{ minWidth: totalWidth, minHeight: totalHeight }}
      data-testid="variation-tree"
    >
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ width: totalWidth, height: totalHeight }}
      >
        {lines.map(line => {
          if (line.y1 === line.y2) {
            return (
              <line
                key={line.key}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={line.isActive ? "#3b82f6" : "#cbd5e1"}
                strokeWidth={line.isActive ? 2 : 1}
              />
            );
          }
          const midX = line.x1 + (line.x2 - line.x1) * 0.3;
          return (
            <path
              key={line.key}
              d={`M ${line.x1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${line.x2} ${line.y2}`}
              fill="none"
              stroke={line.isActive ? "#3b82f6" : "#cbd5e1"}
              strokeWidth={line.isActive ? 2 : 1}
            />
          );
        })}
      </svg>

      {items.map(item => {
        if (item.type === "ellipsis") {
          return (
            <span
              key={item.key}
              className={`absolute text-xs font-bold leading-none flex items-center justify-center tracking-widest ${
                item.isOnCurrentPath
                  ? "text-blue-500 dark:text-blue-400"
                  : "text-muted-foreground"
              }`}
              style={{
                left: item.x,
                top: item.y,
                width: ELLIPSIS_WIDTH,
                height: NODE_HEIGHT,
              }}
            >
              ···
            </span>
          );
        }

        return (
          <button
            key={item.id}
            className={`absolute text-[11px] font-mono leading-none rounded px-1.5 py-1 border transition-colors truncate ${
              item.isCurrentNode
                ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
                : item.isOnCurrentPath
                  ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"
                  : "bg-muted/60 text-muted-foreground border-border hover:bg-muted"
            }`}
            style={{
              left: item.x,
              top: item.y,
              width: NODE_WIDTH,
              height: NODE_HEIGHT,
            }}
            onClick={() => onNodeClick(item.id)}
            title={item.label}
            data-testid={`tree-node-${item.id}`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
