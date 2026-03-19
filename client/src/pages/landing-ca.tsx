import CountryLandingPage, { type CountryConfig } from "./country-landing";

const config: CountryConfig = {
  hreflang: "en-CA",
  slug: "ca",
  country: "Canada",
  flag: "🇨🇦",
  currencySymbol: "C$",
  currencyCode: "CAD",
  federation: "Chess Federation of Canada (CFC)",
  federationUrl: "https://www.chess.ca",
  supportEmail: "ca@chessanalysis.co",
  dateExample: "YYYY-MM-DD",
  cities: ["Toronto, ON", "Vancouver, BC", "Montreal, QC"],
  names: ["Liam C.", "Sophie L.", "Ethan P."],
  pageTitle: "Chess Analysis | Personal Chess Coach for Canadian Players",
  metaDescription:
    "Chess Analysis is your personal chess coach for players in Canada. Import games from Chess.com or Lichess, get AI-powered coaching and Stockfish computer analysis. Free for your first 5 games. Trusted by CFC players across Canada.",
};

export default function LandingCA() {
  return <CountryLandingPage config={config} />;
}
