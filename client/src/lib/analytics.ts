import * as amplitude from "@amplitude/analytics-browser";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const AMP_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY as string | undefined;
let ampInitialized = false;

function ensureAmplitude() {
  if (ampInitialized || !AMP_KEY) return;
  amplitude.init(AMP_KEY, { autocapture: false });
  ampInitialized = true;
}

function gtag(...args: unknown[]) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag(...args);
  }
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>,
) {
  try {
    gtag("event", eventName, params ?? {});
  } catch {}
  try {
    ensureAmplitude();
    if (ampInitialized) {
      amplitude.track(eventName, params ?? {});
    }
  } catch {}
}

export function identifyUser(userId: string, properties?: Record<string, string | number | boolean>) {
  try {
    ensureAmplitude();
    if (ampInitialized) {
      amplitude.setUserId(userId);
      if (properties) {
        const identifyObj = new amplitude.Identify();
        for (const [key, val] of Object.entries(properties)) {
          identifyObj.set(key, val);
        }
        amplitude.identify(identifyObj);
      }
    }
  } catch {}
}

export function resetAmplitudeUser() {
  try {
    if (ampInitialized) {
      amplitude.reset();
    }
  } catch {}
}

export const analytics = {
  pageView() {
    trackEvent("page_view");
  },

  importGamesClicked() {
    trackEvent("import_games_button_clicked");
  },

  gameImported(source: "chesscom" | "lichess" | "pgn", moveCount: number) {
    trackEvent("game_imported", { source, move_count: moveCount });
  },

  paywallShown(gameCount: number) {
    trackEvent("paywall_shown", { game_count: gameCount });
  },

  paywallSignInClicked() {
    trackEvent("paywall_sign_in_clicked");
  },

  signInStarted() {
    trackEvent("sign_in_started");
  },

  signInCompleted(method: string = "google") {
    trackEvent("sign_in_completed", { method });
  },

  signedOut() {
    trackEvent("sign_out");
  },

  chatMessageSent(isAuthenticated: boolean, toggles: { positionDetails: boolean; deepInsights: boolean; accuracyCheck: boolean }) {
    trackEvent("chat_message_sent", {
      authenticated: isAuthenticated,
      position_details: toggles.positionDetails,
      deep_insights: toggles.deepInsights,
      accuracy_check: toggles.accuracyCheck,
    });
  },

  chesscoachInvoked() {
    trackEvent("chesscoach_invoked");
  },

  chesscoachSuccess(latencyMs: number) {
    trackEvent("chesscoach_success", { latency_ms: latencyMs });
  },

  chesscoachFailed(latencyMs: number) {
    trackEvent("chesscoach_failed", { latency_ms: latencyMs });
  },

  positionAnalyzed() {
    trackEvent("position_analyzed");
  },

  engineLineLoaded() {
    trackEvent("engine_line_loaded");
  },

  moveExplained() {
    trackEvent("move_explained");
  },

  alternateLineExplored(moveCount: number) {
    trackEvent("alternate_line_explored", { move_count: moveCount });
  },

  boardControlUsed(action: "first" | "back" | "forward" | "last" | "flip" | "reset") {
    trackEvent("board_control_used", { action });
  },

  evalGraphClicked(moveIndex: number) {
    trackEvent("eval_graph_clicked", { move_index: moveIndex });
  },

  moveHistoryClicked(moveIndex: number) {
    trackEvent("move_history_clicked", { move_index: moveIndex });
  },

  positionDetailsToggled(enabled: boolean) {
    trackEvent("position_details_toggled", { value: enabled ? "On" : "Off" });
  },

  deepInsightsToggled(enabled: boolean) {
    trackEvent("deep_insights_toggled", { value: enabled ? "On" : "Off" });
  },

  accuracyCheckToggled(enabled: boolean) {
    trackEvent("accuracy_check_toggled", { value: enabled ? "On" : "Off" });
  },

  theoriaToggled(enabled: boolean) {
    trackEvent("theoria_toggled", { enabled });
  },

  theoriaContextLoaded() {
    trackEvent("theoria_context_loaded");
  },

  theoriaToolCalled() {
    trackEvent("theoria_tool_called");
  },

  theoriaBinaryDownloaded() {
    trackEvent("theoria_binary_downloaded");
  },

  coachFeedback(type: "Positive" | "Negative") {
    trackEvent("coach_feedback", { type });
  },

  faqClicked(question: string) {
    trackEvent("faq_clicked", { question });
  },

  moveTokenClicked(san: string) {
    trackEvent("move_token_clicked", { san });
  },
};
