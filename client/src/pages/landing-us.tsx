import { useEffect } from "react";
import ChessCoach from "./chess-coach";
import CountrySection, { type CountryConfig } from "./country-landing";

const config: CountryConfig = {
  country: "the United States",
  flag: "🇺🇸",
  currencySymbol: "$",
  currencyCode: "USD",
  proPrice: "5",
  federation: "United States Chess Federation (USCF)",
  federationUrl: "https://new.uschess.org",
  supportEmail: "us@chessanalysis.co",
  dateExample: "MM/DD/YYYY",
  cities: ["New York, NY", "Chicago, IL", "San Francisco, CA"],
  names: ["James R.", "Priya M.", "David K."],
};

export default function LandingUS() {
  useEffect(() => {
    document.title = "Chess Analysis | Personal Chess Coach for US Players";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Chess Analysis is your personal chess coach for United States players. Import games from Chess.com or Lichess, get AI-powered coaching and Stockfish computer analysis. Free for your first 5 games. Trusted by USCF players across the US.");
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
