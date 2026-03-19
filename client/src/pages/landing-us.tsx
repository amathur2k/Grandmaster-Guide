import CountryLandingPage, { type CountryConfig } from "./country-landing";

const config: CountryConfig = {
  hreflang: "en-US",
  slug: "us",
  country: "the United States",
  flag: "🇺🇸",
  currencySymbol: "$",
  currencyCode: "USD",
  federation: "United States Chess Federation (USCF)",
  federationUrl: "https://new.uschess.org",
  supportEmail: "us@chessanalysis.co",
  dateExample: "MM/DD/YYYY",
  cities: ["New York, NY", "Chicago, IL", "San Francisco, CA"],
  names: ["James R.", "Priya M.", "David K."],
  pageTitle: "Chess Analysis | Personal Chess Coach for US Players",
  metaDescription:
    "Chess Analysis is your personal chess coach for United States players. Import games from Chess.com or Lichess, get AI-powered coaching and Stockfish computer analysis. Free for your first 5 games. Trusted by USCF players across the US.",
};

export default function LandingUS() {
  return <CountryLandingPage config={config} />;
}
