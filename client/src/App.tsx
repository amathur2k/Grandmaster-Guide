import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ChessCoach from "@/pages/chess-coach";
import PrivacyPolicy from "@/pages/privacy-policy";
import TermsOfUse from "@/pages/terms-of-use";
import AboutUs from "@/pages/about-us";
import ContactUs from "@/pages/contact-us";
import FreeChessGameReview from "@/pages/free-chess-game-review";
import Credits from "@/pages/credits";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ChessCoach} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfUse} />
      <Route path="/about" component={AboutUs} />
      <Route path="/contact" component={ContactUs} />
      <Route path="/free-chess-game-review" component={FreeChessGameReview} />
      <Route path="/credits" component={Credits} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
