import { Router } from "express";
import { startOfDay, endOfDay } from "date-fns";
import { requireAuth } from "../middleware/auth";
import { tenantContext, currentOrgId } from "../middleware/tenant-context";
import { prisma } from "../utils/prisma";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth, tenantContext);

analyticsRouter.get("/overview", async (req, res, next) => {
  try {
    const organizationId = currentOrgId(req);
    const { propertyId } = req.query as Record<string, string | undefined>;
    const today = new Date();
    const from = startOfDay(today);
    const to = endOfDay(today);

    const propertyScope = propertyId ? { propertyId } : {};

    const orgPropertyIds = propertyId ? [propertyId] : (await prisma.property.findMany({ where: { organizationId }, select: { id: true } })).map((p) => p.id);

    const [arrivals, departures, occupiedNow, totalUnits, pendingMessages, urgentTickets, cleaningTasksToday, pendingApprovals, upsellAgg, aiCostAgg] = await Promise.all([
      prisma.reservation.count({ where: { organizationId, ...propertyScope, checkIn: { gte: from, lte: to }, status: { in: ["CONFIRMED", "CHECKED_IN"] } } }),
      prisma.reservation.count({ where: { organizationId, ...propertyScope, checkOut: { gte: from, lte: to }, status: { in: ["CHECKED_IN", "CHECKED_OUT"] } } }),
      prisma.reservation.count({ where: { organizationId, ...propertyScope, status: { in: ["CONFIRMED", "CHECKED_IN"] }, checkIn: { lte: to }, checkOut: { gte: from } } }),
      prisma.unit.count({ where: { property: { organizationId, ...propertyScope }, active: true } }),
      prisma.conversation.count({ where: { organizationId, ...propertyScope, status: { in: ["OPEN", "PENDING_HUMAN"] } } }),
      prisma.maintenanceTicket.count({ where: { organizationId, ...propertyScope, urgency: { in: ["CRITICAL", "HIGH"] }, status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] } } }),
      prisma.housekeepingTask.count({ where: { property: { organizationId, ...propertyScope }, scheduledAt: { gte: from, lte: to } } }),
      prisma.approvalRequest.count({ where: { organizationId, status: "PENDING" } }),
      prisma.serviceBooking.aggregate({ where: { service: { property: { organizationId, ...propertyScope } }, createdAt: { gte: from, lte: to } }, _sum: { totalAmount: true } }),
      prisma.agentExecution.aggregate({ where: { propertyId: { in: orgPropertyIds }, createdAt: { gte: from, lte: to } }, _sum: { estimatedCost: true } }),
    ]);

    res.json({
      arrivals,
      departures,
      occupancy: totalUnits > 0 ? Math.round((occupiedNow / totalUnits) * 100) : 0,
      occupiedUnits: occupiedNow,
      totalUnits,
      pendingMessages,
      urgentTickets,
      cleaningTasksToday,
      pendingApprovals,
      upsellRevenueToday: Number(upsellAgg._sum.totalAmount ?? 0),
      aiCostToday: Number(aiCostAgg._sum?.estimatedCost ?? 0),
    });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get("/daily-metrics", async (req, res, next) => {
  try {
    const { propertyId, days } = req.query as Record<string, string | undefined>;
    const take = days ? parseInt(days, 10) : 14;
    const metrics = await prisma.dailyMetric.findMany({
      where: { organizationId: currentOrgId(req), ...(propertyId ? { propertyId } : {}) },
      orderBy: { date: "desc" },
      take,
    });
    res.json(metrics.reverse());
  } catch (err) {
    next(err);
  }
});
