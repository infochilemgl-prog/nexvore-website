import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { requestIdMiddleware } from "./middleware/request-id";
import { apiRateLimit } from "./middleware/rate-limit";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";

import { authRouter } from "./routes/auth.routes";
import { organizationsRouter } from "./routes/organizations.routes";
import { propertiesRouter } from "./routes/properties.routes";
import { guestsRouter } from "./routes/guests.routes";
import { reservationsRouter } from "./routes/reservations.routes";
import { conversationsRouter } from "./routes/conversations.routes";
import { maintenanceRouter } from "./routes/maintenance.routes";
import { housekeepingRouter } from "./routes/housekeeping.routes";
import { knowledgeRouter } from "./routes/knowledge.routes";
import { servicesRouter } from "./routes/services.routes";
import { competitorsRouter } from "./routes/competitors.routes";
import { analyticsRouter } from "./routes/analytics.routes";
import { approvalsRouter } from "./routes/approvals.routes";
import { integrationsRouter } from "./routes/integrations.routes";
import { reportsRouter } from "./routes/reports.routes";
import { webhooksRouter } from "./routes/webhooks.routes";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.WEB_URL, credentials: true }));
  app.use(requestIdMiddleware);
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === "/health" } }));

  // Twilio posts application/x-www-form-urlencoded.
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

  app.use("/api", apiRateLimit);

  app.use("/api/auth", authRouter);
  app.use("/api/organizations", organizationsRouter);
  app.use("/api/properties", propertiesRouter);
  app.use("/api/guests", guestsRouter);
  app.use("/api/reservations", reservationsRouter);
  app.use("/api/conversations", conversationsRouter);
  app.use("/api/maintenance", maintenanceRouter);
  app.use("/api/housekeeping", housekeepingRouter);
  app.use("/api/knowledge", knowledgeRouter);
  app.use("/api/services", servicesRouter);
  app.use("/api/competitors", competitorsRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/approvals", approvalsRouter);
  app.use("/api/integrations", integrationsRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/webhooks", webhooksRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
