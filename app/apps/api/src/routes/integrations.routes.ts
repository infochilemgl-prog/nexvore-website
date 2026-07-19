import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { tenantContext } from "../middleware/tenant-context";
import { env } from "../config/env";
import { twilioConnectionState } from "../integrations/twilio";
import { voiceConnectionState } from "../integrations/voice";
import { googleConnectionState, buildGoogleOAuthUrl } from "../integrations/google";
import { slackConnectionState } from "../integrations/slack";
import { pmsConnectionState } from "../integrations/pms";
import { paymentConnectionState } from "../integrations/payments";
import { storageConnectionState } from "../integrations/storage";

export const integrationsRouter = Router();
integrationsRouter.use(requireAuth, tenantContext);

integrationsRouter.get("/", async (_req, res) => {
  res.json({
    aiProvider: { provider: env.AI_PROVIDER, configured: env.AI_PROVIDER === "mock" || (env.AI_PROVIDER === "anthropic" && Boolean(env.ANTHROPIC_API_KEY)) || (env.AI_PROVIDER === "openai" && Boolean(env.OPENAI_API_KEY)) },
    whatsapp: twilioConnectionState(),
    voice: voiceConnectionState(),
    google: googleConnectionState(),
    slack: slackConnectionState(),
    pms: pmsConnectionState(),
    payments: paymentConnectionState(),
    storage: storageConnectionState(),
    flags: {
      ENABLE_AUTOMATIC_LOW_RISK_ACTIONS: env.ENABLE_AUTOMATIC_LOW_RISK_ACTIONS,
      ENABLE_FINANCIAL_ACTIONS: env.ENABLE_FINANCIAL_ACTIONS,
      ENABLE_DOOR_CODE_SHARING: env.ENABLE_DOOR_CODE_SHARING,
    },
  });
});

integrationsRouter.get("/google/oauth-url", async (_req, res) => {
  res.json({ url: buildGoogleOAuthUrl("state-placeholder") });
});

integrationsRouter.get("/google/callback", async (_req, res) => {
  // TODO: intercambiar el codigo de autorizacion por tokens reales una vez
  // existan credenciales de Google configuradas.
  res.status(501).json({ error: "Intercambio de OAuth de Google no implementado en este build (sin credenciales configuradas)." });
});
