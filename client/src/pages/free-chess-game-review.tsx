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
];

export default function FreeChessGameReview() {
  useEffect(() => {
    document.title = "Free Chess Game Review — Analyse Any Game with AI + Stockfish | Chess Analysis";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "Get a free chess game review powered by Stockfish engine evaluations and AI coaching. Import from Chess.com or Lichess, step through every move, and understand your mistakes with grandmaster-style explanations."
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
        <h1 className="text-4xl font-extrabold leading-tight mb-4">
          Free Chess Game Review
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed mb-10">
          Chess Analysis gives you a completely free chess game review — import any game from Chess.com,
          Lichess, or PGN, and instantly get Stockfish engine evaluations alongside AI coaching
          explanations written in plain English. No sign-up needed for your first 5 games.
        </p>

        {/* Video */}
        <div className="mb-14">
          <div className="rounded-xl overflow-hidden border border-border aspect-video w-full bg-black">
            <iframe
              src="https://www.youtube.com/embed/OCSbzArwB10"
              title="Free Chess Game Review — Chess Analysis walkthrough"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Watch a full walkthrough of the Chess Analysis tool
          </p>
        </div>

        {/* ── Feature 1: Import Games ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">1. Import Your Game</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Start by clicking <strong className="text-foreground">Import Games</strong> in the top bar. You can
            paste your <strong className="text-foreground">username</strong> from{" "}
            <strong className="text-foreground">Chess.com</strong> or{" "}
            <strong className="text-foreground">Lichess</strong> to fetch your recent games automatically,
            or paste raw <strong className="text-foreground">PGN</strong> text directly.
            The importer shows the date, event, result, and time control for each game so you can
            pick the right one to review.
          </p>
          <ScreenshotPlaceholder label="Screenshot: Import Games dialog — Chess.com / Lichess / PGN tabs" tall />
          <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            <li>Fetch up to 10 recent games per import</li>
            <li>Supports standard PGN including variations and annotations</li>
            <li>No account needed for your first 5 imports</li>
          </ul>
        </section>

        {/* ── Feature 2: Eval Bar ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">2. Evaluation Bar</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            The tall vertical bar on the left of the board is the{" "}
            <strong className="text-foreground">Evaluation Bar</strong>. It shows Stockfish's assessment
            of the current position — white at the top means White is better, black means Black is
            better. The number displayed is the{" "}
            <strong className="text-foreground">centipawn score</strong>: 100 centipawns equals roughly
            one pawn of advantage. A score of +3.2 means White is up about three pawns' worth of material
            or positional advantage.
          </p>
          <ScreenshotPlaceholder label="Screenshot: Vertical eval bar with score display" />
          <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            <li>Updates in real time as you step through moves</li>
            <li>Shows mate countdowns (e.g. M4 = forced mate in 4)</li>
            <li>Colour shifts from white to black as advantage changes sides</li>
          </ul>
        </section>

        {/* ── Feature 3: Eval Graph ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">3. Evaluation Graph</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Below the board sits the <strong className="text-foreground">Evaluation Graph</strong> — a
            chart of the engine score at every move of the game. Peaks above the centre line are moments
            where White was better; dips below show Black's advantage. Sharp drops in the graph pinpoint{" "}
            <strong className="text-foreground">blunders</strong> — moves where one side threw away a
            big advantage. Click any point on the graph to jump directly to that position on the board.
          </p>
          <ScreenshotPlaceholder label="Screenshot: Eval graph with a visible blunder drop" />
          <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            <li>Click any point on the graph to jump to that move</li>
            <li>Useful for quickly spotting where the game turned</li>
            <li>Smooth curve across all moves of the game</li>
          </ul>
        </section>

        {/* ── Feature 4: Engine Lines ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">4. Engine Lines (Stockfish)</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            On the right panel, the <strong className="text-foreground">Engine Lines</strong> section
            shows Stockfish's top candidate moves for the current position. Each line includes:
          </p>
          <ul className="mb-4 space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            <li>The <strong className="text-foreground">score</strong> (centipawns or mate count)</li>
            <li>The <strong className="text-foreground">best move</strong> and the continuation the engine expects</li>
            <li>The <strong className="text-foreground">depth</strong> the engine has searched to</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Hover over any engine line to see the suggested moves drawn as{" "}
            <strong className="text-foreground">arrows</strong> on the board. This makes it easy to
            visualise what the engine is proposing without memorising move notation.
          </p>
          <ScreenshotPlaceholder label="Screenshot: Engine Lines panel with score and moves, hover arrows on board" tall />
        </section>

        {/* ── Feature 5: Hover Arrows ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">5. Hover Arrows</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Hover over any move in the <strong className="text-foreground">Move History</strong> panel or
            the <strong className="text-foreground">Engine Lines</strong> to see orange arrows appear on
            the board, highlighting exactly which piece moves where. Each arrow is numbered to show the
            move order in a multi-move continuation. This lets you preview a line without clicking into it.
          </p>
          <ScreenshotPlaceholder label="Screenshot: Orange numbered arrows drawn on the board on hover" />
        </section>

        {/* ── Feature 6: Click to Play ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">6. Click to Play — Explore Variations</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            You're not limited to the moves in the imported game. Click any piece on the board and click
            a destination square to <strong className="text-foreground">play a move yourself</strong>.
            This is great for testing "what if I had played this instead?" The position updates
            instantly with a fresh Stockfish evaluation, and the AI Coach can explain whether your
            move was good or bad.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Any moves you play are added to the{" "}
            <strong className="text-foreground">Gameline Tree</strong> as a new branch, so you can
            always navigate back to the main game line.
          </p>
          <ScreenshotPlaceholder label="Screenshot: Board with user-clicked variation highlighted in the gameline tree" />
        </section>

        {/* ── Feature 7: Gameline / Variation Tree ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">7. Gameline Tree</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            The <strong className="text-foreground">Gameline Tree</strong> in the bottom-left panel
            shows every move played — both the main game line and any alternative variations you've
            explored. It works like a branching diagram:
          </p>
          <ul className="mb-4 space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            <li>The <strong className="text-foreground">main line</strong> runs from left to right</li>
            <li>Branches drop down when you explore alternative moves</li>
            <li>Click any node to jump instantly to that position</li>
            <li>The <strong className="text-foreground">current position</strong> is highlighted</li>
          </ul>
          <ScreenshotPlaceholder label="Screenshot: Gameline tree with main line and a visible branching variation" tall />
        </section>

        {/* ── Feature 8: AI Chess Coach ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">8. AI Chess Coach</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            The <strong className="text-foreground">AI Coach</strong> panel on the right gives you
            natural language explanations of any position. Type a question like{" "}
            <em>"Why was my last move a mistake?"</em> or{" "}
            <em>"What's the plan for White here?"</em> and the coach responds with a grandmaster-style
            explanation — discussing piece activity, pawn structure, king safety, and tactical threats.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Unlike a standalone ChatGPT, the AI Coach is{" "}
            <strong className="text-foreground">fact-checked by Stockfish</strong>. Every move the
            coach mentions is verified for legality and cross-checked against engine evaluations before
            being shown to you, preventing hallucinated or illegal moves.
          </p>
          <ScreenshotPlaceholder label="Screenshot: AI Coach chat panel with a question and a detailed coaching response" tall />
          <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            <li>Ask anything about the current position</li>
            <li>Understands the full game context</li>
            <li>Responses grounded in Stockfish evaluations</li>
            <li>Streaming responses — answers appear as they are generated</li>
          </ul>
        </section>

        {/* ── Feature 9: Move History ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">9. Move History</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            The <strong className="text-foreground">Move History</strong> panel lists every move in
            standard algebraic notation. Click any move to jump to that position. The current move is
            highlighted so you always know where you are in the game. Use the{" "}
            <strong className="text-foreground">← →</strong> keyboard arrow keys or the navigation
            buttons to step backwards and forwards one move at a time.
          </p>
          <ScreenshotPlaceholder label="Screenshot: Move history panel with moves listed and current move highlighted" />
        </section>

        {/* ── Feature 10: Player Bands ── */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-2">10. Player Information Bands</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            When you import a game, the{" "}
            <strong className="text-foreground">player information bands</strong> appear above and below
            the board, showing each player's name, rating, and captured material. The captured pieces
            are shown as icons so you can quickly see who has the material advantage at any point in
            the game.
          </p>
          <ScreenshotPlaceholder label="Screenshot: Player bands above and below the board showing names, ratings, and captured pieces" />
        </section>

        {/* CTA */}
        <div className="rounded-2xl border border-border bg-muted/20 p-8 text-center mb-4">
          <h2 className="text-2xl font-bold mb-3">Ready for your free chess game review?</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            No account needed. Import your first game from Chess.com, Lichess, or PGN and get
            instant Stockfish + AI coaching analysis.
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
