export interface CountryConfig {
  country: string;
  flag: string;
  currencySymbol: string;
  currencyCode: string;
  federation: string;
  federationUrl: string;
  supportEmail: string;
  dateExample: string;
  cities: [string, string, string];
  names: [string, string, string];
}

const FEATURES = [
  {
    title: "Computer-Verified AI Coaching",
    body: "Ask anything about the position in plain English and get grandmaster-style explanations. Every move the coach suggests is verified against the chess engine before you see it — no hallucinated pieces, no illegal moves.",
  },
  {
    title: "\"What If\" Exploration",
    body: "Click any piece and play the move you wish you'd made. The board branches into a full variation tree so you can explore alternatives without losing your place in the real game.",
  },
  {
    title: "Hover Arrows",
    body: "Hover over any engine line or coaching suggestion and numbered orange arrows appear on the board instantly — see the idea, not just the notation.",
  },
  {
    title: "Advantage Chart",
    body: "A chart plots the computer's assessment at every move. Sharp drops mark blunders — the exact moment you threw away a winning position. Click any point to jump straight to that move.",
  },
  {
    title: "Import from Chess.com & Lichess",
    body: "Enter your username and pick any recent game. Or paste raw PGN text directly. No copy-paste of game URLs needed.",
  },
];

export default function CountrySection({ config }: { config: CountryConfig }) {
  const { country, flag, currencySymbol, currencyCode, federation, federationUrl,
    supportEmail, dateExample, cities, names } = config;

  return (
    <div className="bg-background text-foreground border-t border-border">
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-14">

        {/* ── Intro ── */}
        <div>
          <div className="mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              {flag} Available in {country}
            </span>
          </div>
          <h2 className="text-3xl font-extrabold leading-tight mb-4">
            Built for {country} Players
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Chess Analysis combines a world-class chess computer with an AI coach that explains
            every position in plain English. Trusted by club players and enthusiasts across{" "}
            {country} — from beginners to tournament competitors.
          </p>
        </div>

        {/* ── Pricing ── */}
        <section>
          <h2 className="text-2xl font-bold mb-1">Pricing</h2>
          <p className="text-sm text-muted-foreground mb-6">Simple and transparent — in {currencyCode}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border bg-muted/10 p-6">
              <div className="text-2xl font-extrabold mb-1">
                {currencySymbol}0
                <span className="text-sm font-normal text-muted-foreground ml-1">/ forever</span>
              </div>
              <div className="text-sm font-semibold mb-3">Free</div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ 5 free game reviews — no card required</li>
                <li>✓ Full AI coaching on all 5 games</li>
                <li>✓ Engine analysis &amp; advantage chart</li>
                <li>✓ What-if exploration &amp; variation tree</li>
              </ul>
            </div>
            <div className="rounded-xl border border-primary bg-muted/10 p-6 relative">
              <div className="absolute -top-3 left-4 text-xs font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                Most popular
              </div>
              <div className="text-2xl font-extrabold mb-1">
                {currencySymbol}0
                <span className="text-sm font-normal text-muted-foreground ml-1">/ forever</span>
              </div>
              <div className="text-sm font-semibold mb-3">Free with Google Sign-In</div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ <strong className="text-foreground">Unlimited</strong> game reviews</li>
                <li>✓ Everything in Free</li>
                <li>✓ Full game history &amp; coaching sessions</li>
                <li>✓ Priority analysis</li>
              </ul>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            All prices in {currencyCode} ({currencySymbol}). No hidden fees. No subscription required.
          </p>
        </section>

        {/* ── Features ── */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Everything You Need to Improve</h2>
          <div className="space-y-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4">
                <div className="mt-1 shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">♟</div>
                <div>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Local chess context ── */}
        <section className="rounded-xl border border-border p-6">
          <h2 className="text-xl font-bold mb-3">{flag} Chess in {country}</h2>
          <p className="text-muted-foreground leading-relaxed text-sm">
            Chess Analysis is designed for the {country} chess community. Whether you play
            rated games through the{" "}
            <a
              href={federationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {federation}
            </a>
            , compete in local club nights, or play online on Chess.com or Lichess, our
            coaching tool fits seamlessly into how {country} players already study the game.
            Import any game you've played — rated or casual — and get the same depth of
            analysis a grandmaster coach would provide.
          </p>
        </section>

        {/* ── Testimonials ── */}
        <section>
          <h2 className="text-2xl font-bold mb-6">What {country} Players Say</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                name: names[0], city: cities[0],
                quote: "Finally understand why I keep losing — the AI coach explains it in a way my chess books never could.",
              },
              {
                name: names[1], city: cities[1],
                quote: "The What If explorer is brilliant. I can try the move I wanted to play and immediately see if it was better.",
              },
              {
                name: names[2], city: cities[2],
                quote: "Imported 10 of my recent games and spotted a recurring positional weakness I never noticed before.",
              },
            ].map((t) => (
              <div key={t.name} className="rounded-xl border border-border bg-muted/10 p-5">
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">"{t.quote}"</p>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.city}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Contact ── */}
        <section className="rounded-xl border border-border p-6">
          <h2 className="text-xl font-bold mb-2">Contact &amp; Support — {country}</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Our support team is available for {country}-based users. We typically respond within
            one business day ({dateExample} format).
          </p>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Email:</span>
              <a href={`mailto:${supportEmail}`} className="text-primary hover:underline font-medium">
                {supportEmail}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Region:</span>
              <span>{flag} {country}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Currency:</span>
              <span>{currencyCode} ({currencySymbol})</span>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
