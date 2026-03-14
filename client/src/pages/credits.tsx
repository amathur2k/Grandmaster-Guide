import { Link } from "wouter";
import logoPath from "@assets/logo_1773342065527.png";

interface CreditEntry {
  name: string;
  purpose: string;
  license: string;
  url: string;
}

const ENGINE_CREDITS: CreditEntry[] = [
  {
    name: "Stockfish",
    purpose: "The world's strongest open-source chess engine, used for position evaluation, best-move analysis, and LLM tool verification.",
    license: "GNU GPL v3",
    url: "https://stockfishchess.org",
  },
  {
    name: "Stockfish.js (Chess.com)",
    purpose: "WebAssembly port of Stockfish 18, enabling in-browser engine evaluation without server round-trips.",
    license: "GNU GPL v3",
    url: "https://github.com/nmrugg/stockfish.js",
  },
  {
    name: "Theoria 0.2",
    purpose: "A Stockfish 16.1 fork with NNUE weights trained on Leela Chess Zero data, providing strategically coherent positional assessments for the AI coach.",
    license: "GNU GPL v3",
    url: "https://www.theoriachess.org",
  },
];

const CHESS_LIBRARY_CREDITS: CreditEntry[] = [
  {
    name: "chess.js",
    purpose: "JavaScript chess library for move generation, validation, PGN parsing, and game state management.",
    license: "BSD 2-Clause",
    url: "https://github.com/jhlywa/chess.js",
  },
  {
    name: "react-chessboard",
    purpose: "React component for rendering the interactive chessboard, drag-and-drop piece movement, and custom arrow/highlight overlays.",
    license: "BSD 3-Clause",
    url: "https://github.com/Clariity/react-chessboard",
  },
];

const AI_CREDITS: CreditEntry[] = [
  {
    name: "OpenAI GPT",
    purpose: "Large language model powering the AI chess coach, providing natural-language positional explanations and move suggestions.",
    license: "Commercial API",
    url: "https://openai.com",
  },
];

const DATA_CREDITS: CreditEntry[] = [
  {
    name: "Chess.com API",
    purpose: "Public API used to import games and player data from Chess.com accounts.",
    license: "Public API",
    url: "https://www.chess.com/news/view/published-data-api",
  },
  {
    name: "Lichess API",
    purpose: "Open API used to import games and player data from Lichess accounts.",
    license: "AGPL v3",
    url: "https://lichess.org/api",
  },
];

const FRONTEND_CREDITS: CreditEntry[] = [
  {
    name: "React",
    purpose: "UI component library.",
    license: "MIT",
    url: "https://react.dev",
  },
  {
    name: "Vite",
    purpose: "Frontend build tool and development server.",
    license: "MIT",
    url: "https://vitejs.dev",
  },
  {
    name: "TanStack Query",
    purpose: "Data fetching and server-state management.",
    license: "MIT",
    url: "https://tanstack.com/query",
  },
  {
    name: "wouter",
    purpose: "Lightweight client-side routing.",
    license: "MIT",
    url: "https://github.com/molefrog/wouter",
  },
  {
    name: "Tailwind CSS",
    purpose: "Utility-first CSS framework.",
    license: "MIT",
    url: "https://tailwindcss.com",
  },
  {
    name: "shadcn/ui",
    purpose: "Accessible UI component primitives built on Radix UI.",
    license: "MIT",
    url: "https://ui.shadcn.com",
  },
  {
    name: "Radix UI",
    purpose: "Unstyled, accessible component primitives.",
    license: "MIT",
    url: "https://www.radix-ui.com",
  },
  {
    name: "Lucide React",
    purpose: "Icon library.",
    license: "ISC",
    url: "https://lucide.dev",
  },
  {
    name: "Recharts",
    purpose: "Chart library used for the evaluation graph.",
    license: "MIT",
    url: "https://recharts.org",
  },
];

const BACKEND_CREDITS: CreditEntry[] = [
  {
    name: "Express",
    purpose: "Node.js web framework for the API server.",
    license: "MIT",
    url: "https://expressjs.com",
  },
  {
    name: "Drizzle ORM",
    purpose: "TypeScript ORM for PostgreSQL database access.",
    license: "Apache 2.0",
    url: "https://orm.drizzle.team",
  },
  {
    name: "PostgreSQL",
    purpose: "Relational database for user accounts and game storage.",
    license: "PostgreSQL License",
    url: "https://www.postgresql.org",
  },
  {
    name: "Passport.js",
    purpose: "Authentication middleware for Google OAuth sign-in.",
    license: "MIT",
    url: "https://www.passportjs.org",
  },
  {
    name: "Zod",
    purpose: "TypeScript-first schema validation.",
    license: "MIT",
    url: "https://zod.dev",
  },
];

function CreditTable({ entries }: { entries: CreditEntry[] }) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
      {entries.map((e) => (
        <div key={e.name} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-6 px-4 py-3 bg-card">
          <div className="sm:w-48 shrink-0">
            <a
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-sm text-primary hover:underline"
            >
              {e.name}
            </a>
            <div className="text-[11px] text-muted-foreground mt-0.5">{e.license}</div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{e.purpose}</p>
        </div>
      ))}
    </div>
  );
}

export default function Credits() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src={logoPath} alt="Chess Analysis" className="w-8 h-8 object-contain" />
          <span className="font-bold text-base">Chess Analysis</span>
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 flex-1">
        <h1 className="text-3xl font-bold mb-2">Credits &amp; Attributions</h1>
        <p className="text-sm text-muted-foreground mb-10">
          Chess Analysis is built on the shoulders of exceptional open-source projects and public APIs.
          We are grateful to every team and contributor listed below.
        </p>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Chess Engines</h2>
          <CreditTable entries={ENGINE_CREDITS} />
          <p className="text-xs text-muted-foreground mt-3">
            Stockfish and Theoria are licensed under the{" "}
            <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              GNU General Public License v3
            </a>
            . Their source code is available at their respective repositories above.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Chess Libraries</h2>
          <CreditTable entries={CHESS_LIBRARY_CREDITS} />
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">AI</h2>
          <CreditTable entries={AI_CREDITS} />
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Chess Data</h2>
          <CreditTable entries={DATA_CREDITS} />
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Frontend</h2>
          <CreditTable entries={FRONTEND_CREDITS} />
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-4">Backend &amp; Infrastructure</h2>
          <CreditTable entries={BACKEND_CREDITS} />
        </section>
      </main>

      <footer className="border-t border-border px-4 py-1 text-center text-[10px] text-muted-foreground/40">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Use</Link>
          <Link href="/about" className="hover:text-foreground transition-colors">About Us</Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact Us</Link>
          <Link href="/free-chess-game-review" className="hover:text-foreground transition-colors">Free Chess Review</Link>
          <Link href="/credits" className="hover:text-foreground transition-colors">Credits</Link>
        </div>
      </footer>
    </div>
  );
}
