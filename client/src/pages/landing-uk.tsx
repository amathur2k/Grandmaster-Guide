import { useEffect } from "react";
import ChessCoach from "./chess-coach";
import CountrySection, { type CountryConfig } from "./country-landing";

const config: CountryConfig = {
  country: "the United Kingdom",
  flag: "🇬🇧",
  currencySymbol: "£",
  currencyCode: "GBP",
  federation: "English Chess Federation (ECF)",
  federationUrl: "https://www.englishchess.org.uk",
  supportEmail: "uk@chessanalysis.co",
  dateExample: "DD/MM/YYYY",
  cities: ["London", "Manchester", "Edinburgh"],
  names: ["Oliver T.", "Aisha B.", "Callum W."],
};

export default function LandingUK() {
  useEffect(() => {
    document.title = "Chess Analysis | Personal Chess Coach for UK Players";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Chess Analysis is your personal chess coach for players in the United Kingdom. Import games from Chess.com or Lichess, get AI-powered coaching and Stockfish computer analysis. Free for your first 5 games. Trusted by ECF players across Britain.");
  }, []);

  return (
    <div>
      <div className="h-screen overflow-hidden">
        <ChessCoach />
      </div>
      <CountrySection config={config} />
    </div>
  );
}
