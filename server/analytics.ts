const MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID;
const API_SECRET = process.env.GA4_API_SECRET;
const GA4_ENDPOINT = "https://www.google-analytics.com/mp/collect";

export async function sendGA4Event(
  clientId: string,
  eventName: string,
  params: Record<string, string | number | boolean> = {},
): Promise<void> {
  if (!MEASUREMENT_ID || !API_SECRET) return;
  try {
    await fetch(
      `${GA4_ENDPOINT}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          events: [{ name: eventName, params }],
        }),
      },
    );
  } catch {
  }
}
