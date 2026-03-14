import { Link } from "wouter";
import logoPath from "@assets/logo_1773342065527.png";

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src={logoPath} alt="Chess Analysis" className="w-8 h-8 object-contain" />
          <span className="font-bold text-base">Chess Analysis</span>
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">About Us</h1>
        <p className="text-sm text-muted-foreground mb-10">The story behind Chess Analysis</p>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">What is Chess Analysis?</h2>
          <p className="text-muted-foreground leading-relaxed">
            Chess Analysis is an AI-powered chess coaching tool that combines the raw calculation power
            of the Stockfish engine with the explanatory ability of large language models. Our tagline
            — "LLMs fact checked by Stockfish" — captures exactly what we do: every AI coaching
            suggestion is grounded in and verified against engine evaluations, so you get explanations
            that are both understandable and accurate.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">The Problem We Solve</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Traditional chess engines tell you the best move but rarely explain <em>why</em> it is best.
            Pure language models can explain strategy fluently but sometimes suggest illegal or
            suboptimal moves. Chess Analysis bridges that gap.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            When you import a game or explore a position, our AI coach gives you grandmaster-style
            explanations — the plans, the ideas, the mistakes — while Stockfish keeps the AI honest
            by validating every move and evaluation in real time.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Key Features</h2>
          <ul className="space-y-3 text-muted-foreground leading-relaxed">
            <li className="flex gap-2">
              <span className="text-foreground font-medium shrink-0">Interactive board</span>
              <span>— step through any game move by move, or explore your own variations</span>
            </li>
            <li className="flex gap-2">
              <span className="text-foreground font-medium shrink-0">Engine evaluation</span>
              <span>— real-time Stockfish depth analysis with a visual eval graph</span>
            </li>
            <li className="flex gap-2">
              <span className="text-foreground font-medium shrink-0">AI coaching</span>
              <span>— natural language explanations of why moves are good or bad</span>
            </li>
            <li className="flex gap-2">
              <span className="text-foreground font-medium shrink-0">Variation tree</span>
              <span>— explore multiple move lines without losing your place</span>
            </li>
            <li className="flex gap-2">
              <span className="text-foreground font-medium shrink-0">Game import</span>
              <span>— import games directly from Chess.com, Lichess, or PGN text</span>
            </li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Our Approach</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            We built Chess Analysis because we believe improvement at chess comes from understanding,
            not just memorisation. Knowing that a move is a mistake matters less than understanding
            the principle it violates — weak squares, open files, king safety, pawn structure.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            By combining engine precision with AI explanation, we aim to give every player — from
            beginner to advanced — the kind of coaching insight that was previously only available
            from expensive human coaches or years of study.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Technology</h2>
          <p className="text-muted-foreground leading-relaxed">
            Chess Analysis is built on the open-source Stockfish engine (one of the strongest chess
            engines in the world), OpenAI's language models for coaching explanations, and
            chess.js for move validation. The interactive board uses react-chessboard. Our backend
            validates all AI-suggested moves for legality before presenting them to you.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3">Pricing</h2>
          <p className="text-muted-foreground leading-relaxed">
            Chess Analysis is free to use for your first 5 game imports. After that, a free Google
            account sign-in is required to continue. We plan to keep core analysis features free
            for all signed-in users.
          </p>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-1 text-center text-[10px] text-muted-foreground/40">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Use</Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact Us</Link>
          <Link href="/free-chess-game-review" className="hover:text-foreground transition-colors">Free Chess Review</Link>
          <Link href="/credits" className="hover:text-foreground transition-colors">Credits</Link>
        </div>
      </footer>
    </div>
  );
}
