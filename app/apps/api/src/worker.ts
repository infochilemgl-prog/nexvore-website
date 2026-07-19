import "dotenv/config";
import { logger } from "./config/logger";
import { startDailyReportWorker } from "./jobs/daily-report.job";
import { startKnowledgeAuditWorker } from "./jobs/knowledge-audit.job";
import { startCompetitorAuditWorker } from "./jobs/competitor-audit.job";
import { startUpsellWorker } from "./jobs/upsell.job";
import { startFollowUpWorker } from "./jobs/follow-up.job";

/**
 * Optional separate process that runs the BullMQ workers. The API itself
 * does not need this running -- reports/etc. are also reachable directly via
 * their service functions (see routes/reports.routes.ts) -- but this is how
 * you'd run scheduled/queued jobs in a real deployment (`npm run worker`).
 */
function main() {
  startDailyReportWorker();
  startKnowledgeAuditWorker();
  startCompetitorAuditWorker();
  startUpsellWorker();
  startFollowUpWorker();
  logger.info("Workers de BullMQ iniciados (daily-report, knowledge-audit, competitor-audit, upsell, follow-up)");
}

main();
