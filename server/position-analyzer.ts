import { Chess, SQUARES, type Square, type Color, type PieceSymbol } from "chess.js";

interface PieceMobility {
  square: string;
  piece: string;
  color: Color;
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
  color: Color;
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

interface OpenFileInfo {
  open: string[];
  semiOpenWhite: string[];
  semiOpenBlack: string[];
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
  openFiles: OpenFileInfo;
  summary: string;
}

const KAUFMAN_WEIGHTS: Record<PieceSymbol, number> = {
  p: 1,
  n: 3.25,
  b: 3.33,
  r: 5.1,
  q: 9.4,
  k: 0,
};

const FILE_LETTERS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const RANK_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function makeSquare(file: string, rank: number): Square {
  return `${file}${rank}` as Square;
}

function squareFile(sq: string): number {
  return sq.charCodeAt(0) - 97;
}

function squareRank(sq: string): number {
  return parseInt(sq[1]);
}

const PIECE_LABELS: Record<PieceSymbol, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

function getMaterial(board: Chess): MaterialInfo {
  let whiteScore = 0;
  let blackScore = 0;
  let whiteBishops = 0;
  let blackBishops = 0;

  for (const sq of SQUARES) {
    const piece = board.get(sq);
    if (!piece) continue;
    const w = KAUFMAN_WEIGHTS[piece.type];
    if (piece.color === "w") {
      whiteScore += w;
      if (piece.type === "b") whiteBishops++;
    } else {
      blackScore += w;
      if (piece.type === "b") blackBishops++;
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
      for (const sq of SQUARES) {
        const piece = board.get(sq);
        if (!piece || piece.color !== color || piece.type === "k") continue;

        const moves = board.moves({ square: sq, verbose: true });
        mobilityList.push({
          square: sq,
          piece: PIECE_LABELS[piece.type],
          color,
          mobility: moves.length,
        });
      }
    } catch {
      continue;
    }
  }

  const sorted = [...mobilityList].sort((a, b) => a.mobility - b.mobility);
  const leastActive = sorted.slice(0, 3);
  const mostActive = sorted.slice(-3).reverse();

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

function getKingSafety(board: Chess): { white: KingSafety; black: KingSafety; description: string } {
  function analyzeKing(color: Color): KingSafety {
    let kingSquare: Square | null = null;
    for (const sq of SQUARES) {
      const piece = board.get(sq);
      if (piece && piece.type === "k" && piece.color === color) {
        kingSquare = sq;
        break;
      }
    }

    if (!kingSquare) {
      return { color, kingSquare: "?", pawnShieldIntact: false, shieldPawnsMissing: [], openFilesNearKing: 0, description: "King not found." };
    }

    const kFile = squareFile(kingSquare);
    const pawnRank = color === "w" ? 2 : 7;
    const advancedPawnRank = color === "w" ? 3 : 6;

    const isKingsideCastled = kFile >= 5;
    const isQueensideCastled = kFile <= 2;

    const kingsideShieldFiles = [5, 6, 7]; // f, g, h
    const queensideShieldFiles = [0, 1, 2]; // a, b, c

    const shieldFiles = isKingsideCastled
      ? kingsideShieldFiles
      : isQueensideCastled
      ? queensideShieldFiles
      : [kFile - 1, kFile, kFile + 1].filter((f) => f >= 0 && f <= 7);

    const missingPawns: string[] = [];

    if (isKingsideCastled || isQueensideCastled) {
      for (const f of shieldFiles) {
        const origSq = makeSquare(FILE_LETTERS[f], pawnRank);
        const advSq = makeSquare(FILE_LETTERS[f], advancedPawnRank);
        const pieceOrig = board.get(origSq);
        const pieceAdv = board.get(advSq);

        const hasPawnOnOriginal = pieceOrig && pieceOrig.type === "p" && pieceOrig.color === color;
        const hasPawnOnAdvanced = pieceAdv && pieceAdv.type === "p" && pieceAdv.color === color;

        if (!hasPawnOnOriginal && !hasPawnOnAdvanced) {
          missingPawns.push(FILE_LETTERS[f]);
        }
      }
    }

    let openFilesNearKing = 0;
    for (const f of shieldFiles) {
      let hasWhitePawn = false;
      let hasBlackPawn = false;
      for (const r of RANK_NUMBERS) {
        const sq = makeSquare(FILE_LETTERS[f], r);
        const piece = board.get(sq);
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

function getPawnStructure(board: Chess): PawnStructure {
  function analyzePawns(color: Color): { doubled: number; isolated: number; passed: number; passedSquares: string[] } {
    const pawnsByFile: Map<number, number[]> = new Map();
    const enemyPawnsByFile: Map<number, number[]> = new Map();

    for (const sq of SQUARES) {
      const piece = board.get(sq);
      if (!piece || piece.type !== "p") continue;
      const f = squareFile(sq);
      const r = squareRank(sq);
      if (piece.color === color) {
        if (!pawnsByFile.has(f)) pawnsByFile.set(f, []);
        pawnsByFile.get(f)!.push(r);
      } else {
        if (!enemyPawnsByFile.has(f)) enemyPawnsByFile.set(f, []);
        enemyPawnsByFile.get(f)!.push(r);
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
          passedSquares.push(`${FILE_LETTERS[file]}${rank}`);
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

function getOpenFiles(board: Chess): OpenFileInfo {
  const open: string[] = [];
  const semiOpenWhite: string[] = [];
  const semiOpenBlack: string[] = [];

  for (const file of FILE_LETTERS) {
    let hasWhitePawn = false;
    let hasBlackPawn = false;
    for (const rank of RANK_NUMBERS) {
      const sq = makeSquare(file, rank);
      const piece = board.get(sq);
      if (piece && piece.type === "p") {
        if (piece.color === "w") hasWhitePawn = true;
        else hasBlackPawn = true;
      }
    }
    if (!hasWhitePawn && !hasBlackPawn) {
      open.push(file);
    } else if (!hasWhitePawn && hasBlackPawn) {
      semiOpenWhite.push(file);
    } else if (hasWhitePawn && !hasBlackPawn) {
      semiOpenBlack.push(file);
    }
  }

  const descParts: string[] = [];
  if (open.length > 0) descParts.push(`Open file(s): ${open.join(", ")}.`);
  if (semiOpenWhite.length > 0) descParts.push(`Semi-open for White: ${semiOpenWhite.join(", ")}-file(s).`);
  if (semiOpenBlack.length > 0) descParts.push(`Semi-open for Black: ${semiOpenBlack.join(", ")}-file(s).`);

  return {
    open,
    semiOpenWhite,
    semiOpenBlack,
    description: descParts.length > 0 ? descParts.join(" ") : "No open or semi-open files.",
  };
}

export function analyzePosition(fen: string): PositionFeatures {
  const board = new Chess(fen);
  const material = getMaterial(board);
  const mobility = getMobility(fen);
  const kingSafety = getKingSafety(board);
  const pawnStructure = getPawnStructure(board);
  const openFiles = getOpenFiles(board);

  const summaryParts: string[] = [];
  if (material.description !== "Material is equal.") summaryParts.push(material.description);
  if (mobility.description !== "Piece activity is balanced.") summaryParts.push(mobility.description);
  if (kingSafety.description) summaryParts.push(kingSafety.description);
  if (pawnStructure.description !== "Pawn structure is symmetrical.") summaryParts.push(pawnStructure.description);
  if (openFiles.description !== "No open or semi-open files.") summaryParts.push(openFiles.description);

  return {
    material,
    mobility,
    kingSafety,
    pawnStructure,
    openFiles,
    summary: summaryParts.length > 0 ? summaryParts.join(" ") : "Position is balanced with no notable imbalances.",
  };
}

export function formatFeaturesForPrompt(features: PositionFeatures): string {
  const lines: string[] = [
    `[Position Features — computed facts about the current position]`,
    `Summary: ${features.summary}`,
    ``,
    `Material: ${features.material.description} (balance: ${features.material.balance > 0 ? "+" : ""}${features.material.balance.toFixed(1)})`,
    `Piece Activity: ${features.mobility.description}`,
  ];

  if (features.mobility.leastActive.length > 0) {
    const trapped = features.mobility.leastActive
      .map((p) => `${p.color === "w" ? "W" : "B"} ${p.piece}/${p.square} (${p.mobility} moves)`)
      .join(", ");
    lines.push(`  Least mobile: ${trapped}`);
  }
  if (features.mobility.mostActive.length > 0) {
    const active = features.mobility.mostActive
      .map((p) => `${p.color === "w" ? "W" : "B"} ${p.piece}/${p.square} (${p.mobility} moves)`)
      .join(", ");
    lines.push(`  Most mobile: ${active}`);
  }

  lines.push(`King Safety: ${features.kingSafety.description}`);
  if (features.kingSafety.white.shieldPawnsMissing.length > 0 || features.kingSafety.white.openFilesNearKing > 0) {
    lines.push(`  White king warning: shield pawns missing on ${features.kingSafety.white.shieldPawnsMissing.join(",") || "none"}, ${features.kingSafety.white.openFilesNearKing} open file(s) nearby`);
  }
  if (features.kingSafety.black.shieldPawnsMissing.length > 0 || features.kingSafety.black.openFilesNearKing > 0) {
    lines.push(`  Black king warning: shield pawns missing on ${features.kingSafety.black.shieldPawnsMissing.join(",") || "none"}, ${features.kingSafety.black.openFilesNearKing} open file(s) nearby`);
  }

  lines.push(`Pawn Structure: ${features.pawnStructure.description}`);
  lines.push(`Open Files: ${features.openFiles.description}`);

  return lines.join("\n");
}
