import { Link } from "wouter";
import logoPath from "@assets/logo_1773342065527.png";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src={logoPath} alt="Chess Analysis" className="w-8 h-8 object-contain" />
          <span className="font-bold text-base">Chess Analysis</span>
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: March 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">1. Overview</h2>
          <p className="text-muted-foreground leading-relaxed">
            Chess Analysis ("we", "our", or "us") is committed to protecting your privacy. This policy
            explains what data we collect, how we use it, and your rights regarding that data when you
            use our chess analysis service at chessanalysis.co.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">2. Data We Collect</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <div>
              <h3 className="font-medium text-foreground mb-1">Account Information</h3>
              <p>
                When you sign in with Google, we receive your name, email address, and profile picture
                from Google. We store this to identify your account and provide a personalised experience.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-1">Usage Data</h3>
              <p>
                We collect anonymised analytics events (via Google Analytics 4) about how you interact
                with the app — such as which features you use and how often. This data does not include
                the content of your chess games or coaching conversations.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-1">Chess Games and Positions</h3>
              <p>
                PGN data and board positions you submit are sent to our servers to generate AI coaching
                responses and engine evaluations. We do not permanently store the content of your games
                or coaching conversations. Data is processed in memory and discarded after the response
                is returned.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-1">Session Data</h3>
              <p>
                We use cookies to maintain your login session. A session token is stored in your browser
                and matched to a record in our database. Sessions expire after 30 days of inactivity.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">3. How We Use Your Data</h2>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground leading-relaxed">
            <li>To provide and operate the Chess Analysis service</li>
            <li>To authenticate you via Google Sign-In</li>
            <li>To enforce the free usage tier and recognise returning users</li>
            <li>To improve the service through aggregated, anonymised usage analytics</li>
            <li>To communicate service updates (we will not send marketing emails)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">4. Third-Party Services</h2>
          <div className="space-y-3 text-muted-foreground leading-relaxed">
            <p>We use the following third-party services, each governed by their own privacy policies:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong className="text-foreground">Google OAuth</strong> — for sign-in authentication</li>
              <li><strong className="text-foreground">Google Analytics 4</strong> — for anonymised usage analytics</li>
              <li><strong className="text-foreground">OpenAI</strong> — your chess positions and questions are sent to OpenAI's API to generate coaching responses</li>
              <li><strong className="text-foreground">Chess.com / Lichess APIs</strong> — if you import games, we fetch them from these platforms on your behalf</li>
            </ul>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">5. Data Retention</h2>
          <p className="text-muted-foreground leading-relaxed">
            We retain your account information (name, email, avatar) for as long as your account exists.
            You may request deletion at any time by contacting us. Session data is automatically deleted
            after 30 days. Game and coaching data is not stored beyond the duration of each request.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
          <p className="text-muted-foreground leading-relaxed">
            You have the right to access, correct, or delete your personal data at any time. To exercise
            these rights, please contact us at the address below. You may also revoke Google's access
            to your account at any time through your Google Account settings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">7. Security</h2>
          <p className="text-muted-foreground leading-relaxed">
            We use HTTPS for all data in transit, session secrets for cookie signing, and store only
            the minimum necessary account information. We do not store payment information.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">8. Changes to This Policy</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may update this policy from time to time. The date at the top of this page reflects the
            most recent revision. Continued use of the service after changes constitutes acceptance of
            the updated policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">9. Contact</h2>
          <p className="text-muted-foreground leading-relaxed">
            For any privacy-related questions or data requests, please contact us at{" "}
            <a href="mailto:privacy@chessanalysis.co" className="text-primary hover:underline">
              privacy@chessanalysis.co
            </a>.
          </p>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-1 text-center text-[10px] text-muted-foreground/40">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
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
