import { Chess } from "chess.js";

interface PieceMobility {
  square: string;
  piece: string;
  color: "w" | "b";
  mobility: number;
}

interface MaterialInfo {
  whiteScore: number;
  blackScore: number;
  balance: number;
  whiteBishopPair: boolean;
  blackBishopPair: boolean;
  description: string;
}

interface KingSafety {
  color: "w" | "b";
  kingSquare: string;
  pawnShieldIntact: boolean;
  shieldPawnsMissing: string[];
  openFilesNearKing: number;
  description: string;
}

interface PawnStructure {
  white: { doubled: number; isolated: number; passed: number; passedSquares: string[] };
  black: { doubled: number; isolated: number; passed: number; passedSquares: string[] };
  description: string;
}

export interface PositionFeatures {
  material: MaterialInfo;
  mobility: {
    leastActive: PieceMobility[];
    mostActive: PieceMobility[];
    description: string;
  };
  kingSafety: {
    white: KingSafety;
    black: KingSafety;
    description: string;
  };
  pawnStructure: PawnStructure;
  summary: string;
}

const KAUFMAN_WEIGHTS: Record<string, number> = {
  p: 1,
  n: 3.25,
  b: 3.33,
  r: 5.1,
  q: 9.4,
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8];
type Square = string;

function squareToFileRank(sq: string): { file: number; rank: number } {
  return { file: sq.charCodeAt(0) - 97, rank: parseInt(sq[1]) };
}

function getMaterial(fen: string): MaterialInfo {
  const board = new Chess(fen);
  let whiteScore = 0;
  let blackScore = 0;
  let whiteBishops = 0;
  let blackBishops = 0;

  for (const file of FILES) {
    for (const rank of RANKS) {
      const sq = `${file}${rank}` as Square;
      const piece = board.get(sq as any);
      if (!piece) continue;
      const w = KAUFMAN_WEIGHTS[piece.type] || 0;
      if (piece.color === "w") {
        whiteScore += w;
        if (piece.type === "b") whiteBishops++;
      } else {
        blackScore += w;
        if (piece.type === "b") blackBishops++;
      }
    }
  }

  const whiteBishopPair = whiteBishops >= 2;
  const blackBishopPair = blackBishops >= 2;
  if (whiteBishopPair) whiteScore += 0.5;
  if (blackBishopPair) blackScore += 0.5;

  const balance = whiteScore - blackScore;
  let description: string;
  const diff = Math.abs(balance);
  if (diff < 0.3) {
    description = "Material is equal.";
  } else if (balance > 0) {
    description = `White is up ${diff.toFixed(1)} in material value.`;
  } else {
    description = `Black is up ${diff.toFixed(1)} in material value.`;
  }

  if (whiteBishopPair && !blackBishopPair) description += " White has the bishop pair.";
  else if (blackBishopPair && !whiteBishopPair) description += " Black has the bishop pair.";

  return { whiteScore, blackScore, balance, whiteBishopPair, blackBishopPair, description };
}

function getMobility(fen: string): { leastActive: PieceMobility[]; mostActive: PieceMobility[]; description: string } {
  const parts = fen.split(" ");
  const originalTurn = parts[1];

  const mobilityList: PieceMobility[] = [];

  for (const color of ["w", "b"] as const) {
    let modifiedFen = fen;
    if (parts[1] !== color) {
      const newParts = [...parts];
      newParts[1] = color;
      modifiedFen = newParts.join(" ");
    }

    try {
      const board = new Chess(modifiedFen);
      for (const file of FILES) {
        for (const rank of RANKS) {
          const sq = `${file}${rank}`;
          const piece = board.get(sq as any);
          if (!piece || piece.color !== color || piece.type === "k") continue;

          const moves = board.moves({ square: sq as any, verbose: true });
          const pieceLabel =
            piece.type === "p" ? "Pawn" :
            piece.type === "n" ? "Knight" :
            piece.type === "b" ? "Bishop" :
            piece.type === "r" ? "Rook" :
            piece.type === "q" ? "Queen" : piece.type;

          mobilityList.push({
            square: sq,
            piece: pieceLabel,
            color,
            mobility: moves.length,
          });
        }
      }
    } catch {
      continue;
    }
  }

  const nonPawns = mobilityList.filter((m) => m.piece !== "Pawn");
  const sorted = [...nonPawns].sort((a, b) => a.mobility - b.mobility);
  const leastActive = sorted.slice(0, 3).filter((m) => m.mobility <= 3);
  const mostActive = sorted.slice(-3).reverse().filter((m) => m.mobility >= 5);

  const descParts: string[] = [];
  for (const p of leastActive) {
    const side = p.color === "w" ? "White" : "Black";
    if (p.mobility === 0) {
      descParts.push(`${side}'s ${p.piece} on ${p.square} is trapped (0 moves).`);
    } else {
      descParts.push(`${side}'s ${p.piece} on ${p.square} is restricted (${p.mobility} moves).`);
    }
  }
  for (const p of mostActive) {
    const side = p.color === "w" ? "White" : "Black";
    descParts.push(`${side}'s ${p.piece} on ${p.square} is highly active (${p.mobility} moves).`);
  }

  return {
    leastActive,
    mostActive,
    description: descParts.length > 0 ? descParts.join(" ") : "Piece activity is balanced.",
  };
}

function getKingSafety(fen: string): { white: KingSafety; black: KingSafety; description: string } {
  const board = new Chess(fen);

  function analyzeKing(color: "w" | "b"): KingSafety {
    let kingSquare = "";
    for (const file of FILES) {
      for (const rank of RANKS) {
        const sq = `${file}${rank}`;
        const piece = board.get(sq as any);
        if (piece && piece.type === "k" && piece.color === color) {
          kingSquare = sq;
        }
      }
    }

    if (!kingSquare) {
      return { color, kingSquare: "?", pawnShieldIntact: false, shieldPawnsMissing: [], openFilesNearKing: 0, description: "King not found." };
    }

    const { file: kFile, rank: kRank } = squareToFileRank(kingSquare);
    const pawnRank = color === "w" ? 2 : 7;
    const shieldRank = color === "w" ? kRank + 1 : kRank - 1;

    const shieldFiles = [kFile - 1, kFile, kFile + 1].filter((f) => f >= 0 && f <= 7);
    const missingPawns: string[] = [];

    const isKingsideCastled = color === "w" ? kFile >= 5 : kFile >= 5;
    const isQueensideCastled = color === "w" ? kFile <= 2 : kFile <= 2;

    if (isKingsideCastled || isQueensideCastled) {
      for (const f of shieldFiles) {
        const sq2 = `${FILES[f]}${pawnRank}`;
        const sq3 = `${FILES[f]}${shieldRank}`;
        const piece2 = board.get(sq2 as any);
        const piece3 = board.get(sq3 as any);

        const hasPawnOnOriginal = piece2 && piece2.type === "p" && piece2.color === color;
        const hasPawnOnShield = piece3 && piece3.type === "p" && piece3.color === color;

        if (!hasPawnOnOriginal && !hasPawnOnShield) {
          missingPawns.push(FILES[f]);
        }
      }
    }

    let openFilesNearKing = 0;
    for (const f of shieldFiles) {
      let hasWhitePawn = false;
      let hasBlackPawn = false;
      for (const r of RANKS) {
        const sq = `${FILES[f]}${r}`;
        const piece = board.get(sq as any);
        if (piece && piece.type === "p") {
          if (piece.color === "w") hasWhitePawn = true;
          else hasBlackPawn = true;
        }
      }
      if (!hasWhitePawn && !hasBlackPawn) openFilesNearKing++;
    }

    const pawnShieldIntact = missingPawns.length === 0;
    const side = color === "w" ? "White" : "Black";
    let description = "";

    if (!isKingsideCastled && !isQueensideCastled) {
      description = `${side}'s king is in the center (${kingSquare}).`;
    } else if (!pawnShieldIntact) {
      description = `${side}'s pawn shield is weakened — missing pawns on ${missingPawns.join(", ")}-file(s).`;
    } else {
      description = `${side}'s king is well-sheltered on ${kingSquare}.`;
    }

    if (openFilesNearKing > 0) {
      description += ` ${openFilesNearKing} open file(s) near the king.`;
    }

    return { color, kingSquare, pawnShieldIntact, shieldPawnsMissing: missingPawns, openFilesNearKing, description };
  }

  const white = analyzeKing("w");
  const black = analyzeKing("b");

  const descParts: string[] = [];
  if (white.description) descParts.push(white.description);
  if (black.description) descParts.push(black.description);

  return { white, black, description: descParts.join(" ") };
}

function getPawnStructure(fen: string): PawnStructure {
  const board = new Chess(fen);

  function analyzePawns(color: "w" | "b"): { doubled: number; isolated: number; passed: number; passedSquares: string[] } {
    const pawnsByFile: Map<number, number[]> = new Map();
    const enemyPawnsByFile: Map<number, number[]> = new Map();
    const enemyColor = color === "w" ? "b" : "w";

    for (const file of FILES) {
      for (const rank of RANKS) {
        const sq = `${file}${rank}`;
        const piece = board.get(sq as any);
        if (piece && piece.type === "p") {
          const f = file.charCodeAt(0) - 97;
          if (piece.color === color) {
            if (!pawnsByFile.has(f)) pawnsByFile.set(f, []);
            pawnsByFile.get(f)!.push(rank);
          } else {
            if (!enemyPawnsByFile.has(f)) enemyPawnsByFile.set(f, []);
            enemyPawnsByFile.get(f)!.push(rank);
          }
        }
      }
    }

    let doubled = 0;
    let isolated = 0;
    let passed = 0;
    const passedSquares: string[] = [];

    for (const [file, ranks] of pawnsByFile) {
      if (ranks.length > 1) doubled += ranks.length - 1;

      const hasAdjacentFriendly =
        (file > 0 && pawnsByFile.has(file - 1)) ||
        (file < 7 && pawnsByFile.has(file + 1));
      if (!hasAdjacentFriendly) isolated += ranks.length;

      for (const rank of ranks) {
        let isPassed = true;
        const filesToCheck = [file - 1, file, file + 1].filter((f) => f >= 0 && f <= 7);
        for (const f of filesToCheck) {
          const enemyRanks = enemyPawnsByFile.get(f) || [];
          for (const eRank of enemyRanks) {
            if (color === "w" && eRank > rank) { isPassed = false; break; }
            if (color === "b" && eRank < rank) { isPassed = false; break; }
          }
          if (!isPassed) break;
        }
        if (isPassed) {
          passed++;
          passedSquares.push(`${FILES[file]}${rank}`);
        }
      }
    }

    return { doubled, isolated, passed, passedSquares };
  }

  const white = analyzePawns("w");
  const black = analyzePawns("b");

  const descParts: string[] = [];
  if (white.doubled > 0) descParts.push(`White has ${white.doubled} doubled pawn(s).`);
  if (black.doubled > 0) descParts.push(`Black has ${black.doubled} doubled pawn(s).`);
  if (white.isolated > 0) descParts.push(`White has ${white.isolated} isolated pawn(s).`);
  if (black.isolated > 0) descParts.push(`Black has ${black.isolated} isolated pawn(s).`);
  if (white.passed > 0) descParts.push(`White has passed pawn(s) on ${white.passedSquares.join(", ")}.`);
  if (black.passed > 0) descParts.push(`Black has passed pawn(s) on ${black.passedSquares.join(", ")}.`);

  return {
    white,
    black,
    description: descParts.length > 0 ? descParts.join(" ") : "Pawn structure is symmetrical.",
  };
}

export function analyzePosition(fen: string): PositionFeatures {
  const material = getMaterial(fen);
  const mobility = getMobility(fen);
  const kingSafety = getKingSafety(fen);
  const pawnStructure = getPawnStructure(fen);

  const summaryParts: string[] = [];
  if (material.description !== "Material is equal.") summaryParts.push(material.description);
  if (mobility.description !== "Piece activity is balanced.") summaryParts.push(mobility.description);
  if (kingSafety.description) summaryParts.push(kingSafety.description);
  if (pawnStructure.description !== "Pawn structure is symmetrical.") summaryParts.push(pawnStructure.description);

  return {
    material,
    mobility,
    kingSafety,
    pawnStructure,
    summary: summaryParts.length > 0 ? summaryParts.join(" ") : "Position is balanced with no notable imbalances.",
  };
}

export function formatFeaturesForPrompt(features: PositionFeatures): string {
  const lines: string[] = [
    `[Position Features — computed facts about the current position]`,
    `Material: ${features.material.description}`,
    `Piece Activity: ${features.mobility.description}`,
    `King Safety: ${features.kingSafety.description}`,
    `Pawn Structure: ${features.pawnStructure.description}`,
  ];
  return lines.join("\n");
}
