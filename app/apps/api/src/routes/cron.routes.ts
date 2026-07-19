import { Router, type NextFunction, type Request, type Response } from "express";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { runDailyReportForAllProperties } from "../jobs/daily-report.job";
import { runKnowledgeAuditForAllOrganizations } from "../jobs/knowledge-audit.job";
import { runCompetitorAuditForAllProperties } from "../jobs/competitor-audit.job";
import { runUpsellSuggestionsForAllProperties } from "../jobs/upsell.job";
import { runFollowUpSweepForAllOrganizations } from "../jobs/follow-up.job";

/**
 * HTTP entrypoints for the five background jobs, meant to be invoked by
 * Vercel Cron (see the `crons` array in ../../../vercel.json) instead of by
 * a BullMQ worker.
 *
 * Why this exists: Vercel serverless functions are request-scoped and
 * cannot run a long-lived process polling Redis for queued jobs the way
 * `apps/api/src/worker.ts` (`npm run worker`) does. Vercel Cron Jobs solve
 * the "run this on a schedule" half of that by making an HTTP request to a
 * path at the configured cadence; these routes make that HTTP request
 * synchronously execute the exact same job logic function the BullMQ
 * worker calls (see jobs/*.job.ts -- the `run*` functions are shared,
 * only the trigger differs). This does NOT replace BullMQ as a general
 * "queue" mechanism -- see jobs/queue.ts and the README's
 * "Limitaciones en Vercel" section for what that means for any future
 * genuinely-async (not just scheduled) job.
 *
 * Vercel Cron specifics (see README "Desplegar en Vercel" for the exact
 * dashboard steps): Vercel Cron Jobs configured via vercel.json's `crons`
 * array send an HTTP GET request to `path` on schedule. When a `CRON_SECRET`
 * environment variable is set on the Vercel project, Vercel automatically
 * attaches `Authorization: Bearer <CRON_SECRET>` to that GET request -- so
 * setting CRON_SECRET in the project's env vars is both what generates the
 * header Vercel sends AND what this middleware checks against. We register
 * both GET (what Vercel Cron actually sends) and POST (for manual/local
 * testing with curl) on each path.
 */
export const cronRouter = Router();

function requireCronSecret(req: Request, res: Response, next: NextFunction) {
  if (!env.CRON_SECRET) {
    // Explicit, loud warning rather than silently accepting unauthenticated
    // requests to job-triggering endpoints -- see README "Limitaciones en
    // Vercel" / production risks. Still allows local dev without having to
    // set a secret.
    logger.warn("CRON_SECRET no esta configurado -- las rutas /api/cron/* estan sin proteccion. Configuralo antes de desplegar a Vercel.");
    return next();
  }
  const header = req.header("authorization");
  if (header !== `Bearer ${env.CRON_SECRET}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
}

cronRouter.use(requireCronSecret);

function registerCronJob(path: string, name: string, run: () => Promise<unknown>) {
  const handler = async (_req: Request, res: Response) => {
    const startedAt = Date.now();
    try {
      const result = await run();
      logger.info({ cron: name, ms: Date.now() - startedAt }, "Cron job ejecutado");
      res.status(200).json({ ok: true, job: name, result });
    } catch (err) {
      logger.error({ cron: name, err }, "Cron job fallo");
      res.status(500).json({ ok: false, job: name, error: err instanceof Error ? err.message : "Error desconocido" });
    }
  };
  cronRouter.get(path, handler);
  cronRouter.post(path, handler);
}

registerCronJob("/daily-report", "daily-report", () => runDailyReportForAllProperties());
registerCronJob("/knowledge-audit", "knowledge-audit", () => runKnowledgeAuditForAllOrganizations());
registerCronJob("/competitor-audit", "competitor-audit", () => runCompetitorAuditForAllProperties());
registerCronJob("/upsell", "upsell", () => runUpsellSuggestionsForAllProperties());
registerCronJob("/follow-up", "follow-up", () => runFollowUpSweepForAllOrganizations());
