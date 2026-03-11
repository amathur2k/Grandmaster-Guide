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
}

export type MessageSegment = TextSegment | MoveSegment;

export interface MoveSequence {
  id: number;
  moves: MoveInfo[];
}

const SAN_RE =
  /\*{0,2}(?:\d+[.…]{1,3}\s*)?(O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?[!?]{0,2}|[a-h]x[a-h][1-8](?:=[QRBN])?[+#]?[!?]{0,2}|[a-h][1-8](?:=[QRBN])?[+#]?[!?]{0,2})\*{0,2}/g;

export function parseMovesInText(
  text: string,
  fen: string
): { segments: MessageSegment[]; sequences: MoveSequence[] } {
  const candidates: { san: string; start: number; end: number; raw: string }[] = [];
  SAN_RE.lastIndex = 0;
  let m;
  while ((m = SAN_RE.exec(text)) !== null) {
    const before = m.index > 0 ? text[m.index - 1] : "";
    const after =
      m.index + m[0].length < text.length ? text[m.index + m[0].length] : "";
    if (before && /[a-zA-Z]/.test(before)) continue;
    if (after && /[a-zA-Z]/.test(after)) continue;
    const cleanSan = m[1].replace(/[!?]+$/, "");
    candidates.push({
      san: cleanSan,
      start: m.index,
      end: m.index + m[0].length,
      raw: m[0],
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
    }
  > = [];

  let curMoves: MoveInfo[] = [];
  let curGame = new Chess(fen);
  let sid = 0;
  let lastEnd = 0;

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
          });
          curGame = copy;
          added = true;
        }
      } catch {}
    }

    if (!added) {
      if (curMoves.length > 0) {
        sequences.push({ id: sid, moves: [...curMoves] });
        sid++;
      }
      try {
        const fresh = new Chess(fen);
        const r = fresh.move(c.san);
        if (r) {
          curMoves = [{ san: c.san, from: r.from, to: r.to }];
          valid.push({
            san: c.san,
            from: r.from,
            to: r.to,
            start: c.start,
            end: c.end,
            raw: c.raw,
            seqId: sid,
            orderInSeq: 0,
          });
          curGame = fresh;
        } else {
          curMoves = [];
        }
      } catch {
        curMoves = [];
      }
    }
    lastEnd = c.end;
  }

  if (curMoves.length > 0) sequences.push({ id: sid, moves: [...curMoves] });

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
    });
    pos = v.end;
  }
  if (pos < text.length)
    segments.push({ type: "text", content: text.slice(pos) });

  return { segments, sequences };
}
