import CountryLandingPage, { type CountryConfig } from "./country-landing";

const config: CountryConfig = {
  hreflang: "en-GB",
  slug: "uk",
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
  pageTitle: "Chess Analysis | Personal Chess Coach for UK Players",
  metaDescription:
    "Chess Analysis is your personal chess coach for players in the United Kingdom. Import games from Chess.com or Lichess, get AI-powered coaching and Stockfish computer analysis. Free for your first 5 games. Trusted by ECF players across Britain.",
};

export default function LandingUK() {
  return <CountryLandingPage config={config} />;
}
