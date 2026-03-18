import { useEffect } from "react";
import { Link } from "wouter";
import logoPath from "@assets/logo_1773342065527.png";

function ScreenshotPlaceholder({ label, tall }: { label: string; tall?: boolean }) {
  return (
    <div
      className={`w-full rounded-xl border-2 border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-2 text-muted-foreground/50 text-sm ${tall ? "min-h-[280px]" : "min-h-[200px]"}`}
    >
      <svg className="w-8 h-8 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
        <circle cx="8.5" cy="8.5" r="1.5" strokeWidth="1.5" />
        <path d="M21 15l-5-5L5 21" strokeWidth="1.5" />
      </svg>
      <span className="text-xs px-4 text-center opacity-50">{label}</span>
    </div>
  );
}

const FOOTER_LINKS = [
  { href: "/", label: "Home" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Use" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
  { href: "/credits", label: "Credits" },
];

export default function FreeChessGameReview() {
  useEffect(() => {
    document.title = "Free Chess Game Review — Analyse Any Game with Computer Analysis | Chess Analysis";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Get a free chess game review powered by computer analysis and chess coaching. Import from Chess.com or Lichess, step through every move, and understand your mistakes with grandmaster-style explanations."
      );
    }
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src={logoPath} alt="Chess Analysis" className="w-8 h-8 object-contain" />
          <span className="font-bold text-base">Chess Analysis</span>
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">

        {/* Hero */}
        <div className="mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">Feature Guide</span>
        </div>
        <h1 className="text-4xl font-extrabold leading-tight mb-6">
          Free Chess Game Review
        </h1>

        {/* YouTube demo video */}
        <div className="mb-8 rounded-xl overflow-hidden shadow-lg border border-border" style={{ position: "relative", paddingBottom: "56.25%" }}>
          <iframe
            src="https://www.youtube.com/embed/OeLquidyeN4"
            title="Chess Analysis — Free Chess Game Review Demo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
          />
        </div>

        {/* Rewritten curiosity-building intro */}
        <div className="space-y-4 text-lg text-muted-foreground leading-relaxed mb-6">
          <p>
            Most chess analysis tools hand you a list of blunders and a best-move arrow. That's where
            they stop. <strong className="text-foreground">Chess Analysis goes further</strong> — and
            three things set it apart from anything else you've used.
          </p>
          <p>
            First: <strong className="text-foreground">every engine line lights up the board</strong>.
            Hover over any Stockfish suggestion or AI coaching move and numbered orange arrows appear
            on the board instantly — so you see the idea, not just the notation. No more squinting
            at "Nf3-d4-e6" and trying to visualise it in your head.
          </p>
          <p>
            Second: <strong className="text-foreground">you can play "what if" on any move</strong>.
            Click a piece, try the move you wish you'd played, and the board responds with a live
            Stockfish evaluation. Every variation you explore branches off the{" "}
            <strong className="text-foreground">Gameline Tree</strong> — a visual diagram of your
            entire decision path — so you can jump between the real game and your alternatives at
            any point without losing your place.
          </p>
          <p>
            Third: <strong className="text-foreground">the Chess Coach is fact-checked in real time</strong>.
            Unlike a basic chatbot, every move the coach mentions is checked to make sure it's a
            real, legal move and cross-referenced against the chess computer before it reaches you.
            You get grandmaster-level explanations — pawn structure, king safety, tactical threats
            — that are guaranteed to be grounded in what the computer actually sees on the board.
          </p>
          <p className="text-base">
            Import your first game from Chess.com, Lichess, or PGN below — no account needed
            for your first 5 games.
          </p>
        </div>

        {/* ── Feature 1: Hover Arrows ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">1. Hover Arrows — See Ideas, Not Just Notation</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Hover over any move in the <strong className="text-foreground">Best Moves</strong> panel or
            the <strong className="text-foreground">Chess Coach</strong> response and numbered orange
            arrows appear on the board, showing exactly which piece goes where across a multi-move
            continuation. Move 1 is labelled <em>①</em>, move 2 is <em>②</em>, and so on — so you
            can follow a five-move combination at a glance without memorising a single letter of notation.
            Move the cursor away and the arrows disappear, leaving the board clean.
          </p>
          <ScreenshotPlaceholder label="Screenshot: Orange numbered arrows drawn on the board while hovering an engine line" tall />
          <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            <li>Works on both engine lines and AI coach suggestions</li>
            <li>Arrows are numbered in move order for multi-move continuations</li>
            <li>Zero clicks needed — just hover to preview, move away to reset</li>
          </ul>
        </section>

        {/* ── Feature 2: Click to Play + Gameline Tree ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">2. "What If" Explorations + Gameline Tree</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            This is the feature that turns a passive review into active learning. At any point in the
            game, click a piece and play the move you <em>wish</em> you had made. The board updates
            instantly with a live Stockfish evaluation and you can immediately ask the AI Coach
            whether your alternative was better — and why.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Every alternative you explore is saved as a branch in the{" "}
            <strong className="text-foreground">Gameline Tree</strong> — a visual diagram in the
            bottom-left panel. The main game runs left to right; your "what if" branches hang
            below it. Click any node in the tree to jump instantly between the real game and your
            explored variations. Nothing is ever lost — you can always navigate back to the main line.
          </p>
          <ScreenshotPlaceholder label="Screenshot: Gameline Tree with a branching variation and the board showing the alternative position" tall />
          <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            <li>Play any legal move directly on the board to start a variation</li>
            <li>Stockfish re-evaluates instantly for every new position</li>
            <li>Gameline Tree keeps every branch — main line and all alternatives</li>
            <li>Click any tree node to teleport to that exact position</li>
          </ul>
        </section>

        {/* ── Feature 3: AI Chess Coach ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">3. AI Chess Coach — Fact-Checked by Stockfish</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            The <strong className="text-foreground">AI Coach</strong> panel answers any question about
            the current position in plain English. Ask{" "}
            <em>"Why was my last move a mistake?"</em>,{" "}
            <em>"What's the long-term plan for Black here?"</em>, or{" "}
            <em>"How should I punish this pawn structure?"</em> and get a grandmaster-style
            explanation covering piece activity, open files, weak squares, king safety, and
            tactical patterns.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-4">
            What makes it different from just asking ChatGPT: the coach operates with full
            knowledge of the current position, and{" "}
            <strong className="text-foreground">every move it mentions is checked against
            Stockfish</strong> for legality and engine evaluation before you see it. No hallucinated
            pieces, no illegal moves, no made-up continuations — just honest, grounded chess advice
            that streams in as it's generated.
          </p>
          <ScreenshotPlaceholder label="Screenshot: AI Coach panel with a coaching question and a detailed multi-paragraph response" tall />
          <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            <li>Ask anything — positions, plans, mistakes, openings, endgames</li>
            <li>Coach understands the full game history, not just the current position</li>
            <li>All suggested moves verified for legality by the engine</li>
            <li>Hover the coach's suggested moves to see them as arrows on the board</li>
            <li>Streaming responses — answers appear word by word as they generate</li>
          </ul>
        </section>

        {/* ── Feature 4: Import Games ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">4. Import Your Game</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Start by clicking <strong className="text-foreground">Import Games</strong> in the top bar.
            Enter your <strong className="text-foreground">Chess.com</strong> or{" "}
            <strong className="text-foreground">Lichess</strong> username to fetch your recent games
            automatically, or paste raw <strong className="text-foreground">PGN</strong> text directly.
            The importer shows the date, opponent, result, and time control for each game so you can
            pick the exact one you want to review.
          </p>
          <ScreenshotPlaceholder label="Screenshot: Import Games dialog — Chess.com / Lichess / PGN tabs" tall />
          <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            <li>Fetch your most recent games by username — no copy-paste needed</li>
            <li>Supports standard PGN including existing variations and annotations</li>
            <li>No account needed for your first 5 imports</li>
          </ul>
        </section>

        {/* ── Feature 5: Engine Lines ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">5. Best Moves</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            The <strong className="text-foreground">Best Moves</strong> panel shows the chess computer's
            top choices for the current position — a score showing who is ahead, the best first move,
            and the full sequence the computer expects to follow. Higher scores mean White is better;
            lower scores mean Black is better.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Hover over any line to see the moves drawn as arrows on the board (see feature 1 above).
            Click a line to play it out on the board and explore it as a variation.
          </p>
          <ScreenshotPlaceholder label="Screenshot: Engine Lines panel showing top 3 Stockfish candidates with scores and continuations" tall />
        </section>

        {/* ── Feature 6: Eval Bar ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">6. Advantage Bar</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            The tall vertical bar on the left of the board shows the computer's assessment at a glance.
            White rising to the top means White is better; black filling upward means Black is better.
            The <strong className="text-foreground">score</strong> is measured in pawns — +1.0 means
            White is roughly one pawn ahead, +3.2 means roughly three pawns ahead in material or
            positional terms. Forced mates show as{" "}
            <strong className="text-foreground">M4</strong>, <strong className="text-foreground">M3</strong>, etc.
          </p>
          <ScreenshotPlaceholder label="Screenshot: Vertical eval bar showing White advantage with centipawn score" />
          <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            <li>Updates in real time as you step through every move</li>
            <li>Shows mate-in-N countdowns for forced mates</li>
            <li>Colour shifts fluidly as advantage changes sides</li>
          </ul>
        </section>

        {/* ── Feature 7: Eval Graph ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">7. Advantage Chart</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            The <strong className="text-foreground">Advantage Chart</strong> below the board plots
            the advantage score at every move of the game. Peaks above the centre line show White's
            advantage; dips below show Black's. A sudden sharp drop marks a{" "}
            <strong className="text-foreground">blunder</strong> — the exact moment where someone
            threw away a winning position. Click any point on the chart to jump straight to that
            move on the board.
          </p>
          <ScreenshotPlaceholder label="Screenshot: Evaluation graph spanning the full game with a visible blunder drop" />
          <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            <li>Spans the full game — spot turning points at a glance</li>
            <li>Click any point to jump to that position instantly</li>
            <li>Sharp drops = blunders; smooth lines = solid play</li>
          </ul>
        </section>

        {/* ── Feature 8: Move History ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">8. Move History</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            The <strong className="text-foreground">Move History</strong> panel lists every move in
            standard algebraic notation. Click any move to jump to that position. The current move is
            highlighted so you always know where you are in the game. Use the{" "}
            <strong className="text-foreground">← →</strong> keyboard arrow keys or the on-screen
            navigation buttons to step one move at a time.
          </p>
          <ScreenshotPlaceholder label="Screenshot: Move history panel with moves listed and current move highlighted" />
        </section>

        {/* ── Feature 9: Player Bands ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">9. Player Information Bands</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            When you import a game, <strong className="text-foreground">player bands</strong> appear
            above and below the board showing each player's name, rating, and captured material as
            piece icons. At any point in the game you can see exactly who has the material advantage
            and by how much.
          </p>
          <ScreenshotPlaceholder label="Screenshot: Player bands above and below the board with names, ratings, and captured pieces" />
        </section>

        {/* CTA */}
        <div className="rounded-2xl border border-border bg-muted/20 p-8 text-center mb-4">
          <h2 className="text-2xl font-bold mb-3">Ready for your free chess game review?</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            No account needed. Import your first game from Chess.com, Lichess, or PGN and get
            instant computer + chess coaching analysis.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground text-background px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Analyse a Game for Free →
          </Link>
        </div>

      </main>

      <footer className="border-t border-border px-4 py-1 text-center text-[10px] text-muted-foreground/40 mt-auto">
        <div className="flex flex-wrap items-center justify-center gap-4">
          {FOOTER_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-foreground transition-colors">
              {label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
