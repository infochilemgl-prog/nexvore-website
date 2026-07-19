import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { tenantContext, currentOrgId } from "../middleware/tenant-context";
import { prisma } from "../utils/prisma";
import { buildDailyReport } from "../services/reporting/daily-report";
import { HttpError } from "../middleware/error-handler";

export const reportsRouter = Router();
reportsRouter.use(requireAuth, tenantContext);

reportsRouter.get("/daily", async (req, res, next) => {
  try {
    const { propertyId, date } = req.query as Record<string, string | undefined>;
    if (!propertyId) throw new HttpError(400, "propertyId es requerido.");
    const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId: currentOrgId(req) } });
    if (!property) throw new HttpError(404, "Propiedad no encontrada.");
    const report = await buildDailyReport(currentOrgId(req), propertyId, date ? new Date(date) : new Date());
    res.json(report);
  } catch (err) {
    next(err);
  }
});

reportsRouter.get("/audit-log", async (req, res, next) => {
  try {
    const { entityType, entityId } = req.query as Record<string, string | undefined>;
    const logs = await prisma.auditLog.findMany({
      where: { organizationId: currentOrgId(req), ...(entityType ? { entityType } : {}), ...(entityId ? { entityId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});
