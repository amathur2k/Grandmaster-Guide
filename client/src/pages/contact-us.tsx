import { Link } from "wouter";
import logoPath from "@assets/logo_1773342065527.png";

export default function ContactUs() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src={logoPath} alt="Chess Analysis" className="w-8 h-8 object-contain" />
          <span className="font-bold text-base">Chess Analysis</span>
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Contact Us</h1>
        <p className="text-sm text-muted-foreground mb-10">We'd love to hear from you</p>

        <section className="mb-10">
          <p className="text-muted-foreground leading-relaxed">
            Whether you have a question, found a bug, have a feature suggestion, or just want to say
            hello — reach out and we'll get back to you as soon as we can.
          </p>
        </section>

        <div className="grid gap-6 sm:grid-cols-2 mb-12">
          <div className="rounded-xl border border-border p-6">
            <h2 className="font-semibold mb-1">General Enquiries</h2>
            <p className="text-sm text-muted-foreground mb-3">Questions about the app, features, or your account</p>
            <a
              href="mailto:hello@chessanalysis.co"
              className="text-sm font-medium text-primary hover:underline"
            >
              hello@chessanalysis.co
            </a>
          </div>

          <div className="rounded-xl border border-border p-6">
            <h2 className="font-semibold mb-1">Bug Reports</h2>
            <p className="text-sm text-muted-foreground mb-3">Found something broken? Let us know</p>
            <a
              href="mailto:bugs@chessanalysis.co"
              className="text-sm font-medium text-primary hover:underline"
            >
              bugs@chessanalysis.co
            </a>
          </div>

          <div className="rounded-xl border border-border p-6">
            <h2 className="font-semibold mb-1">Privacy &amp; Data</h2>
            <p className="text-sm text-muted-foreground mb-3">Data deletion requests, privacy concerns</p>
            <a
              href="mailto:privacy@chessanalysis.co"
              className="text-sm font-medium text-primary hover:underline"
            >
              privacy@chessanalysis.co
            </a>
          </div>

          <div className="rounded-xl border border-border p-6">
            <h2 className="font-semibold mb-1">Legal</h2>
            <p className="text-sm text-muted-foreground mb-3">Legal enquiries and terms questions</p>
            <a
              href="mailto:legal@chessanalysis.co"
              className="text-sm font-medium text-primary hover:underline"
            >
              legal@chessanalysis.co
            </a>
          </div>
        </div>

        <section className="rounded-xl border border-border p-6 bg-muted/30">
          <h2 className="font-semibold mb-2">Response Times</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            We aim to respond to all enquiries within 2–3 business days. For urgent matters,
            please include "URGENT" in your subject line. We do not offer phone support at this time.
          </p>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-1 text-center text-[10px] text-muted-foreground/40">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Use</Link>
          <Link href="/about" className="hover:text-foreground transition-colors">About Us</Link>
        </div>
      </footer>
    </div>
  );
}
