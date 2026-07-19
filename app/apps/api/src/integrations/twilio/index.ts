import { env } from "../../config/env";

export function isTwilioConfigured(): boolean {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_NUMBER);
}

/**
 * Sends an outbound WhatsApp reply via Twilio. If Twilio is not configured
 * (no credentials -- the default in this build), the reply is just logged;
 * the conversation and Message rows are still persisted by the webhook
 * handler regardless, so the dashboard always reflects the real state.
 */
export async function sendWhatsAppMessage(to: string, body: string): Promise<{ sent: boolean; sid?: string; error?: string }> {
  if (!isTwilioConfigured()) {
    return { sent: false, error: "Twilio no configurado (faltan TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_NUMBER)." };
  }
  try {
    const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: `whatsapp:${env.TWILIO_WHATSAPP_NUMBER}`,
        To: `whatsapp:${to}`,
        Body: body,
      }),
    });
    const json = (await res.json()) as { sid?: string; message?: string };
    if (!res.ok) return { sent: false, error: json.message ?? `HTTP ${res.status}` };
    return { sent: true, sid: json.sid };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}

export function twilioConnectionState(): { provider: string; configured: boolean } {
  return { provider: "twilio", configured: isTwilioConfigured() };
}
