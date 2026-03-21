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

        <section className="mb-8">
          <p className="text-muted-foreground leading-relaxed">
            Whether you have a question, found a bug, have a feature suggestion, or just want to say
            hello — reach out and we'll get back to you as soon as we can.
          </p>
        </section>

        <div className="rounded-xl border border-border p-8 text-center mb-8">
          <p className="text-sm text-muted-foreground mb-3">Send us an email at</p>
          <a
            href="mailto:us@chessanalysis.co"
            className="text-xl font-semibold text-primary hover:underline"
          >
            us@chessanalysis.co
          </a>
        </div>
      </main>

      <footer className="border-t border-border px-4 py-1 text-center text-[10px] text-muted-foreground/40">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Use</Link>
          <Link href="/about" className="hover:text-foreground transition-colors">About Us</Link>
          <Link href="/credits" className="hover:text-foreground transition-colors">Credits</Link>
        </div>
      </footer>
    </div>
  );
}
