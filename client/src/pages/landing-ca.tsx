import { useEffect } from "react";
import ChessCoach from "./chess-coach";
import CountrySection, { type CountryConfig } from "./country-landing";

const config: CountryConfig = {
  country: "Canada",
  flag: "🇨🇦",
  currencySymbol: "C$",
  currencyCode: "CAD",
  proPrice: "7",
  federation: "Chess Federation of Canada (CFC)",
  federationUrl: "https://www.chess.ca",
  supportEmail: "ca@chessanalysis.co",
  dateExample: "YYYY-MM-DD",
  cities: ["Toronto, ON", "Vancouver, BC", "Montreal, QC"],
  names: ["Liam C.", "Sophie L.", "Ethan P."],
};

export default function LandingCA() {
  useEffect(() => {
    document.title = "Chess Analysis | Personal Chess Coach for Canadian Players";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Chess Analysis is your personal chess coach for players in Canada. Import games from Chess.com or Lichess, get AI-powered coaching and Stockfish computer analysis. Free for your first 5 games. Trusted by CFC players across Canada.");
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
