import CountryLandingPage, { type CountryConfig } from "./country-landing";

const config: CountryConfig = {
  hreflang: "en-AU",
  slug: "au",
  country: "Australia",
  flag: "🇦🇺",
  currencySymbol: "A$",
  currencyCode: "AUD",
  federation: "Australian Chess Federation (ACF)",
  federationUrl: "https://www.auschess.org.au",
  supportEmail: "au@chessanalysis.co",
  dateExample: "DD/MM/YYYY",
  cities: ["Sydney, NSW", "Melbourne, VIC", "Brisbane, QLD"],
  names: ["Jack H.", "Charlotte N.", "Noah F."],
  pageTitle: "Chess Analysis | Personal Chess Coach for Australian Players",
  metaDescription:
    "Chess Analysis is your personal chess coach for players in Australia. Import games from Chess.com or Lichess, get AI-powered coaching and Stockfish computer analysis. Free for your first 5 games. Trusted by ACF players across Australia.",
};

export default function LandingAU() {
  return <CountryLandingPage config={config} />;
}
