import { useMemo } from "react";
import type { VariationNode } from "@/pages/chess-coach";

interface VariationTreeProps {
  tree: VariationNode;
  currentPath: string[];
  onNodeClick: (nodeId: string) => void;
}

interface DisplayNode {
  id: string;
  move: string;
  label: string;
  x: number;
  y: number;
  isOnCurrentPath: boolean;
  isCurrentNode: boolean;
}

interface DisplayLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isActive: boolean;
  isDashed: boolean;
  key: string;
}

const NODE_WIDTH = 64;
const NODE_HEIGHT = 26;
const H_GAP = 16;
const V_GAP = 8;
const STEP_X = NODE_WIDTH + H_GAP;
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

function countStepsBetween(from: VariationNode, to: VariationNode): number {
  let count = 0;
  let node = from;
  while (node.children.length === 1) {
    node = node.children[0];
    count++;
    if (node.id === to.id) return count;
  }
  for (const child of node.children) {
    if (child.id === to.id) return count + 1;
  }
  return count + 1;
}

export function VariationTree({ tree, currentPath, onNodeClick }: VariationTreeProps) {
  const currentNodeId = currentPath[currentPath.length - 1];

  const { nodes, lines, totalWidth, totalHeight } = useMemo(() => {
    const nodes: DisplayNode[] = [];
    const lines: DisplayLine[] = [];
    const yOffset = { value: 0 };

    function walkBranch(
      startNode: VariationNode,
      col: number,
      baseY: number,
      fromX: number,
      fromY: number,
      isFirst: boolean,
      prevKeyNode: VariationNode | null
    ): void {
      let node = startNode;
      let currentCol = col;
      let currentY = baseY;
      let prevX = fromX;
      let prevY = fromY;
      let firstInBranch = true;
      let lastKeyNode = prevKeyNode;

      while (node) {
        const isKey = isBranchPoint(node) || isLeaf(node) || node.id === currentNodeId;
        const onPath = currentPath.includes(node.id);

        if (isKey || firstInBranch) {
          const nodeX = currentCol * STEP_X;
          const nodeY = currentY;

          let skipped = false;
          if (!firstInBranch && lastKeyNode) {
            const steps = countStepsBetween(lastKeyNode, node);
            skipped = steps > 1;
          }

          if (!(firstInBranch && isFirst)) {
            lines.push({
              x1: prevX + NODE_WIDTH,
              y1: prevY + NODE_HEIGHT / 2,
              x2: nodeX,
              y2: nodeY + NODE_HEIGHT / 2,
              isActive: onPath,
              isDashed: skipped,
              key: `line-${node.id}`,
            });
          }

          nodes.push({
            id: node.id,
            move: node.move,
            label: getMoveLabel(node, tree),
            x: nodeX,
            y: nodeY,
            isOnCurrentPath: onPath,
            isCurrentNode: node.id === currentNodeId,
          });

          prevX = nodeX;
          prevY = nodeY;
          currentCol++;
          firstInBranch = false;
          lastKeyNode = node;
        }

        if (isBranchPoint(node)) {
          for (let ci = 0; ci < node.children.length; ci++) {
            const child = node.children[ci];
            if (ci === 0) {
              walkBranch(child, currentCol, currentY, prevX, prevY, false, node);
            } else {
              yOffset.value += STEP_Y;
              walkBranch(child, currentCol, yOffset.value, prevX, prevY, false, node);
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

    if (tree.children.length > 0) {
      for (let ci = 0; ci < tree.children.length; ci++) {
        const child = tree.children[ci];
        if (ci === 0) {
          walkBranch(child, 0, 0, -NODE_WIDTH, 0, true, null);
        } else {
          yOffset.value += STEP_Y;
          walkBranch(child, 0, yOffset.value, -NODE_WIDTH, 0, true, null);
        }
      }
    }

    let maxX = 0;
    let maxY = 0;
    for (const n of nodes) {
      if (n.x + NODE_WIDTH > maxX) maxX = n.x + NODE_WIDTH;
      if (n.y + NODE_HEIGHT > maxY) maxY = n.y + NODE_HEIGHT;
    }

    return {
      nodes,
      lines,
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
        {lines.map(line => {
          const strokeColor = line.isActive ? "#3b82f6" : "#94a3b8";
          const strokeWidth = line.isActive ? 2 : 1.5;

          if (line.y1 === line.y2) {
            return (
              <line
                key={line.key}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeDasharray={line.isDashed ? "4,4" : "none"}
              />
            );
          }

          const midX = line.x1 + (line.x2 - line.x1) * 0.4;
          return (
            <path
              key={line.key}
              d={`M ${line.x1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${line.x2} ${line.y2}`}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={line.isDashed ? "4,4" : "none"}
            />
          );
        })}
      </svg>

      {nodes.map(node => (
        <button
          key={node.id}
          className={`absolute text-[11px] font-mono leading-none rounded px-1.5 py-1 border transition-colors truncate ${
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
          title={node.label}
          data-testid={`tree-node-${node.id}`}
        >
          {node.label}
        </button>
      ))}
    </div>
  );
}
