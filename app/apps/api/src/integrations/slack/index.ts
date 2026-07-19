import { env } from "../../config/env";
import { logger } from "../../config/logger";

export async function postSlackMessage(text: string): Promise<{ posted: boolean }> {
  if (!env.SLACK_WEBHOOK_URL) {
    logger.info({ text }, "Slack no configurado (SLACK_WEBHOOK_URL vacio); mensaje solo registrado en logs");
    return { posted: false };
  }
  try {
    const res = await fetch(env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return { posted: res.ok };
  } catch (err) {
    logger.error({ err }, "Fallo al enviar mensaje a Slack");
    return { posted: false };
  }
}

export function slackConnectionState(): { provider: string; configured: boolean } {
  return { provider: "slack", configured: Boolean(env.SLACK_WEBHOOK_URL) };
}
