import { createQueue, createWorker } from "./queue";
import { prisma } from "../utils/prisma";

export interface CompetitorAuditJobData {
  propertyId: string;
}

export const competitorAuditQueue = createQueue<CompetitorAuditJobData>("competitor-audit");

/**
 * Real (if simple) logic: computes each competitor's threatScore from its
 * latest snapshot vs. the property's own units, and persists the update.
 * A production version would scrape/refresh CompetitorSnapshot rows first
 * (no scraping credentials/provider were supplied for this build).
 */
export async function runCompetitorAudit(propertyId: string) {
  const [property, competitors] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId }, include: { units: true } }),
    prisma.competitor.findMany({ where: { propertyId, active: true }, include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1 } } }),
  ]);
  if (!property) return { updated: 0 };

  const avgOwnPrice = property.units.length ? property.units.reduce((s, u) => s + Number(u.basePrice), 0) / property.units.length : 0;

  let updated = 0;
  for (const competitor of competitors) {
    const latest = competitor.snapshots[0];
    if (!latest?.nightlyPrice) continue;
    const priceDelta = avgOwnPrice > 0 ? (avgOwnPrice - Number(latest.nightlyPrice)) / avgOwnPrice : 0;
    const ratingFactor = latest.rating ? latest.rating / 5 : 0.5;
    const threatScore = Math.max(0, Math.min(100, Math.round((priceDelta * 50 + ratingFactor * 50) * 100) / 100));
    await prisma.competitor.update({ where: { id: competitor.id }, data: { threatScore } });
    updated++;
  }
  return { updated };
}

export function startCompetitorAuditWorker() {
  return createWorker<CompetitorAuditJobData>("competitor-audit", async (job) => runCompetitorAudit(job.data.propertyId));
}

/**
 * Fans `runCompetitorAudit` out across every active property -- used by the
 * `/api/cron/competitor-audit` route (Vercel Cron).
 */
export async function runCompetitorAuditForAllProperties() {
  const properties = await prisma.property.findMany({ where: { active: true }, select: { id: true } });
  let totalUpdated = 0;
  for (const property of properties) {
    const { updated } = await runCompetitorAudit(property.id);
    totalUpdated += updated;
  }
  return { properties: properties.length, updated: totalUpdated };
}
