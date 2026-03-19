import { useEffect } from "react";
import ChessCoach from "./chess-coach";
import CountrySection, { type CountryConfig } from "./country-landing";

const config: CountryConfig = {
  country: "Australia",
  flag: "🇦🇺",
  currencySymbol: "A$",
  currencyCode: "AUD",
  proPrice: "8",
  federation: "Australian Chess Federation (ACF)",
  federationUrl: "https://www.auschess.org.au",
  supportEmail: "admin@chessanalysis.co",
  address: "Level 22, 101 Collins Street, Melbourne VIC 3000",
  phone: "+61 3 9555 0124",
  cities: ["Sydney, NSW", "Melbourne, VIC", "Brisbane, QLD"],
  names: ["Jack H.", "Charlotte N.", "Noah F."],
};

export default function LandingAU() {
  useEffect(() => {
    document.title = "Chess Analysis | Personal Chess Coach for Australian Players";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Chess Analysis is your personal chess coach for players in Australia. Import games from Chess.com or Lichess, get AI-powered coaching and Stockfish computer analysis. Free for your first 5 games. Trusted by ACF players across Australia.");
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
