import * as amplitude from "@amplitude/analytics-node";

const AMPLITUDE_API_KEY = process.env.AMPLITUDE_API_KEY;

let initialized = false;

function ensureInit() {
  if (initialized || !AMPLITUDE_API_KEY) return;
  amplitude.init(AMPLITUDE_API_KEY, { flushIntervalMillis: 10_000, flushQueueSize: 20 });
  initialized = true;
}

export function identifyServerUser(
  userId: string,
  properties: Record<string, string | number | boolean>,
) {
  if (!AMPLITUDE_API_KEY) return;
  ensureInit();
  const identifyObj = new amplitude.Identify();
  for (const [key, val] of Object.entries(properties)) {
    identifyObj.set(key, val);
  }
  amplitude.identify(identifyObj, { user_id: userId });
}

export function trackServerEvent(
  eventName: string,
  properties: Record<string, string | number | boolean> = {},
  userId?: string,
) {
  if (!AMPLITUDE_API_KEY) return;
  ensureInit();
  amplitude.track(eventName, properties, { user_id: userId ?? "anonymous" });
}
