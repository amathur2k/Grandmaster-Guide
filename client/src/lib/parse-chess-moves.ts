import { Chess } from "chess.js";

export interface MoveInfo {
  san: string;
  from: string;
  to: string;
}

export interface TextSegment {
  type: "text";
  content: string;
}

export interface MoveSegment {
  type: "move";
  content: string;
  san: string;
  from: string;
  to: string;
  seqId: number;
  orderInSeq: number;
  sourceFen?: string;
  sourceNodeId?: string;
}

export type MessageSegment = TextSegment | MoveSegment;

export interface MoveSequence {
  id: number;
  moves: MoveInfo[];
  sourceFen?: string;
  sourceNodeId?: string;
}

export interface FallbackFen {
  fen: string;
  nodeId: string;
}

const SAN_RE =
  /\*{0,2}(?:\d+[.…]{1,3}\s*)?(O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?[!?]{0,2}|[a-h]x[a-h][1-8](?:=[QRBN])?[+#]?[!?]{0,2}|[a-h][1-8](?:=[QRBN])?[+#]?[!?]{0,2})\*{0,2}/g;

const MOVENUM_RE = /^(\d+)([.…]{1,3})/;

function extractMoveNum(raw: string): { num: number; isBlack: boolean } | null {
  const stripped = raw.replace(/^\*{0,2}/, "");
  const match = MOVENUM_RE.exec(stripped);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  const dots = match[2];
  const isBlack = dots.length >= 3 || dots === "…";
  return { num, isBlack };
}

function tryMove(fen: string, san: string): { from: string; to: string } | null {
  try {
    const g = new Chess(fen);
    const r = g.move(san);
    return r ? { from: r.from, to: r.to } : null;
  } catch {
    return null;
  }
}

export function parseMovesInText(
  text: string,
  fen: string,
  fallbackFens?: FallbackFen[]
): { segments: MessageSegment[]; sequences: MoveSequence[] } {
  const candidates: { san: string; start: number; end: number; raw: string; hasMoveNum: boolean }[] = [];
  SAN_RE.lastIndex = 0;
  let m;
  while ((m = SAN_RE.exec(text)) !== null) {
    const before = m.index > 0 ? text[m.index - 1] : "";
    const after =
      m.index + m[0].length < text.length ? text[m.index + m[0].length] : "";
    if (before && /[a-zA-Z]/.test(before)) continue;
    if (after && /[a-zA-Z]/.test(after)) continue;
    const cleanSan = m[1].replace(/[!?]+$/, "");
    const moveNumInfo = extractMoveNum(m[0]);
    candidates.push({
      san: cleanSan,
      start: m.index,
      end: m.index + m[0].length,
      raw: m[0],
      moveNumInfo,
    });
  }

  const sequences: MoveSequence[] = [];
  const valid: Array<
    MoveInfo & {
      start: number;
      end: number;
      raw: string;
      seqId: number;
      orderInSeq: number;
      sourceFen?: string;
      sourceNodeId?: string;
    }
  > = [];

  let curMoves: MoveInfo[] = [];
  let curGame = new Chess(fen);
  let curSourceFen: string | undefined;
  let curSourceNodeId: string | undefined;
  let sid = 0;
  let lastEnd = 0;

  function tryFallbacks(san: string, moveNumInfo: { num: number; isBlack: boolean } | null): { from: string; to: string; fen: string; nodeId: string } | null {
    if (!fallbackFens || !moveNumInfo) return null;
    const targetTurn = moveNumInfo.isBlack ? "b" : "w";
    for (const fb of fallbackFens) {
      try {
        const g = new Chess(fb.fen);
        if (g.moveNumber() !== moveNumInfo.num) continue;
        if (g.turn() !== targetTurn) continue;
        const r = g.move(san);
        if (r) return { from: r.from, to: r.to, fen: fb.fen, nodeId: fb.nodeId };
      } catch {}
    }
    return null;
  }

  for (const c of candidates) {
    const gap = text
      .slice(lastEnd, c.start)
      .replace(/[\s\d.,;:…*()—–\-/'"]+/g, "").length;
    let added = false;

    if (curMoves.length > 0 && gap < 30) {
      try {
        const copy = new Chess(curGame.fen());
        const r = copy.move(c.san);
        if (r) {
          curMoves.push({ san: c.san, from: r.from, to: r.to });
          valid.push({
            san: c.san,
            from: r.from,
            to: r.to,
            start: c.start,
            end: c.end,
            raw: c.raw,
            seqId: sid,
            orderInSeq: curMoves.length - 1,
            sourceFen: curSourceFen,
            sourceNodeId: curSourceNodeId,
          });
          curGame = copy;
          added = true;
        }
      } catch {}
    }

    if (!added) {
      if (curMoves.length > 0) {
        sequences.push({ id: sid, moves: [...curMoves], sourceFen: curSourceFen, sourceNodeId: curSourceNodeId });
        sid++;
      }

      const primary = tryMove(fen, c.san);
      if (primary) {
        curMoves = [{ san: c.san, from: primary.from, to: primary.to }];
        curSourceFen = undefined;
        curSourceNodeId = undefined;
        valid.push({
          san: c.san,
          from: primary.from,
          to: primary.to,
          start: c.start,
          end: c.end,
          raw: c.raw,
          seqId: sid,
          orderInSeq: 0,
        });
        curGame = new Chess(fen);
        curGame.move(c.san);
      } else {
        const fb = tryFallbacks(c.san, c.moveNumInfo);
        if (fb) {
          curMoves = [{ san: c.san, from: fb.from, to: fb.to }];
          curSourceFen = fb.fen;
          curSourceNodeId = fb.nodeId;
          valid.push({
            san: c.san,
            from: fb.from,
            to: fb.to,
            start: c.start,
            end: c.end,
            raw: c.raw,
            seqId: sid,
            orderInSeq: 0,
            sourceFen: fb.fen,
            sourceNodeId: fb.nodeId,
          });
          const g = new Chess(fb.fen);
          g.move(c.san);
          curGame = g;
        } else {
          curMoves = [];
          curSourceFen = undefined;
          curSourceNodeId = undefined;
        }
      }
    }
    lastEnd = c.end;
  }

  if (curMoves.length > 0) sequences.push({ id: sid, moves: [...curMoves], sourceFen: curSourceFen, sourceNodeId: curSourceNodeId });

  valid.sort((a, b) => a.start - b.start);
  const segments: MessageSegment[] = [];
  let pos = 0;
  for (const v of valid) {
    if (v.start > pos)
      segments.push({ type: "text", content: text.slice(pos, v.start) });
    segments.push({
      type: "move",
      content: v.raw,
      san: v.san,
      from: v.from,
      to: v.to,
      seqId: v.seqId,
      orderInSeq: v.orderInSeq,
      sourceFen: v.sourceFen,
      sourceNodeId: v.sourceNodeId,
    });
    pos = v.end;
  }
  if (pos < text.length)
    segments.push({ type: "text", content: text.slice(pos) });

  return { segments, sequences };
}
