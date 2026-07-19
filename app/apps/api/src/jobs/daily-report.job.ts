import { createQueue, createWorker } from "./queue";
import { prisma } from "../utils/prisma";
import { buildDailyReport } from "../services/reporting/daily-report";
import { postSlackMessage } from "../integrations/slack";
import { logger } from "../config/logger";

export interface DailyReportJobData {
  organizationId: string;
  propertyId: string;
  date?: string;
}

export const dailyReportQueue = createQueue<DailyReportJobData>("daily-report");

/**
 * Directly-callable version (used by the seed/demo path and by
 * apps/api/src/routes/reports.routes.ts) so the report works even without
 * Redis/BullMQ running -- the queue is the "real" scheduling mechanism when
 * Redis is available, this function is the actual logic either way.
 */
export async function runDailyReportForAllProperties(date: Date = new Date()) {
  const properties = await prisma.property.findMany({ where: { active: true } });
  const reports = [];
  for (const property of properties) {
    const report = await buildDailyReport(property.organizationId, property.id, date);
    reports.push(report);
    const summary = `Reporte diario ${property.name} (${report.date}): ${report.operations.arrivals} llegadas, ${report.operations.departures} salidas, ocupacion ${report.operations.occupancyRate}%, ${report.approvals.pending} aprobaciones pendientes, ROI ${report.roi.roiPercentage}%.`;
    await postSlackMessage(summary);
    logger.info({ propertyId: property.id }, "Reporte diario generado");
  }
  return reports;
}

export function startDailyReportWorker() {
  return createWorker<DailyReportJobData>("daily-report", async (job) => {
    const date = job.data.date ? new Date(job.data.date) : new Date();
    return buildDailyReport(job.data.organizationId, job.data.propertyId, date);
  });
}
