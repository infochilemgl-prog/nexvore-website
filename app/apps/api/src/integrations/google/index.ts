import { env } from "../../config/env";
import { logger } from "../../config/logger";

/**
 * Google OAuth (Calendar/Gmail/Drive scopes). This is entirely separate from
 * the existing root-level MercadoPago webhook (api/webhook.js) and from this
 * app's own MERCADOPAGO_ACCESS_TOKEN payment adapter.
 *
 * Only the OAuth URL builder + a mock calendar-event creator are implemented
 * for real; the token exchange / real Calendar API call is stubbed behind a
 * clear TODO because no Google OAuth credentials were supplied for this
 * build. The reservation flow tolerates this failing (see
 * tools/reservations.tools.ts create_reservation) and marks syncStatus
 * accordingly instead of losing the reservation.
 */
export function isGoogleConfigured(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function buildGoogleOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID || "not-configured",
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/drive.readonly",
    ].join(" "),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function createCalendarEvent(input: {
  summary: string;
  description: string;
  startDate: string;
  endDate: string;
}): Promise<{ eventId: string | null; synced: boolean; error?: string }> {
  if (!isGoogleConfigured()) {
    logger.info({ input }, "Google Calendar no configurado; se omite creacion de evento (no bloquea la reserva)");
    return { eventId: null, synced: false, error: "GOOGLE_CLIENT_ID/SECRET no configurados" };
  }
  try {
    // TODO: intercambiar el refresh token guardado y llamar a la API real de
    // Google Calendar (events.insert) una vez existan credenciales reales.
    const eventId = `mock-gcal-${Date.now()}`;
    return { eventId, synced: true };
  } catch (err) {
    logger.error({ err }, "Fallo al crear evento de Google Calendar");
    return { eventId: null, synced: false, error: (err as Error).message };
  }
}

export function googleConnectionState(): { provider: string; configured: boolean } {
  return { provider: "google", configured: isGoogleConfigured() };
}
