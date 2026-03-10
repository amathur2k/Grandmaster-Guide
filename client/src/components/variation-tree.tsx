import { useMemo } from "react";
import type { VariationNode } from "@/pages/chess-coach";

interface VariationTreeProps {
  tree: VariationNode;
  currentPath: string[];
  onNodeClick: (nodeId: string) => void;
}

interface LayoutNode {
  id: string;
  move: string;
  x: number;
  y: number;
  parentX: number;
  parentY: number;
  isOnCurrentPath: boolean;
  isBranchPoint: boolean;
  isCurrentNode: boolean;
  moveNumber: string;
  depth: number;
  hasParent: boolean;
}

const NODE_WIDTH = 52;
const NODE_HEIGHT = 24;
const H_GAP = 8;
const V_GAP = 6;
const STEP_X = NODE_WIDTH + H_GAP;
const STEP_Y = NODE_HEIGHT + V_GAP;

function getMoveLabel(depth: number, move: string): string {
  const moveNum = Math.floor(depth / 2) + 1;
  const isWhite = depth % 2 === 0;
  if (isWhite) {
    return `${moveNum}.${move}`;
  }
  return `${moveNum}...${move}`;
}

function layoutTree(
  node: VariationNode,
  currentPath: string[],
  currentNodeId: string,
  depth: number,
  yOffset: { value: number },
  parentX: number,
  parentY: number,
  results: LayoutNode[]
): void {
  if (node.children.length === 0) return;

  const isNodeOnPath = currentPath.includes(node.id);

  for (let ci = 0; ci < node.children.length; ci++) {
    const child = node.children[ci];
    const isChildOnPath = currentPath.includes(child.id);
    const isBranch = node.children.length > 1;

    let x: number;
    let y: number;

    if (ci === 0) {
      x = depth * STEP_X;
      y = parentY;
    } else {
      yOffset.value += STEP_Y;
      x = depth * STEP_X;
      y = yOffset.value;
    }

    results.push({
      id: child.id,
      move: child.move,
      x,
      y,
      parentX,
      parentY,
      isOnCurrentPath: isChildOnPath,
      isBranchPoint: isBranch && ci > 0,
      isCurrentNode: child.id === currentNodeId,
      moveNumber: getMoveLabel(depth, child.move),
      depth,
      hasParent: true,
    });

    layoutTree(child, currentPath, currentNodeId, depth + 1, yOffset, x, y, results);
  }
}

export function VariationTree({ tree, currentPath, onNodeClick }: VariationTreeProps) {
  const currentNodeId = currentPath[currentPath.length - 1];

  const { nodes, totalWidth, totalHeight } = useMemo(() => {
    const results: LayoutNode[] = [];
    const yOffset = { value: 0 };
    layoutTree(tree, currentPath, currentNodeId, 0, yOffset, -STEP_X / 2, 0, results);

    let maxX = 0;
    let maxY = 0;
    for (const n of results) {
      if (n.x + NODE_WIDTH > maxX) maxX = n.x + NODE_WIDTH;
      if (n.y + NODE_HEIGHT > maxY) maxY = n.y + NODE_HEIGHT;
    }

    return {
      nodes: results,
      totalWidth: maxX + 16,
      totalHeight: maxY + 16,
    };
  }, [tree, currentPath, currentNodeId]);

  if (nodes.length === 0) {
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
        {nodes.map(node => {
          if (!node.hasParent) return null;
          const startX = node.parentX + NODE_WIDTH / 2;
          const startY = node.parentY + NODE_HEIGHT / 2;
          const endX = node.x + NODE_WIDTH / 2;
          const endY = node.y + NODE_HEIGHT / 2;

          const isActive = node.isOnCurrentPath;

          if (startY === endY) {
            return (
              <line
                key={`line-${node.id}`}
                x1={startX + NODE_WIDTH / 2}
                y1={startY}
                x2={endX - NODE_WIDTH / 2}
                y2={endY}
                stroke={isActive ? "#3b82f6" : "#cbd5e1"}
                strokeWidth={isActive ? 2 : 1}
              />
            );
          }

          const midX = startX + NODE_WIDTH / 2;
          return (
            <path
              key={`line-${node.id}`}
              d={`M ${startX + NODE_WIDTH / 2} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX - NODE_WIDTH / 2} ${endY}`}
              fill="none"
              stroke={isActive ? "#3b82f6" : "#cbd5e1"}
              strokeWidth={isActive ? 2 : 1}
            />
          );
        })}
      </svg>

      {nodes.map(node => (
        <button
          key={node.id}
          className={`absolute text-[10px] font-mono leading-none rounded px-1.5 py-1 border transition-colors truncate ${
            node.isCurrentNode
              ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
              : node.isOnCurrentPath
                ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700"
                : "bg-muted/60 text-muted-foreground border-border hover:bg-muted"
          }`}
          style={{
            left: node.x,
            top: node.y,
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
          }}
          onClick={() => onNodeClick(node.id)}
          title={node.moveNumber}
          data-testid={`tree-node-${node.id}`}
        >
          {node.moveNumber}
        </button>
      ))}
    </div>
  );
}
