import { startOfDay, endOfDay } from "date-fns";
import { prisma } from "../../utils/prisma";
import { computeRoi } from "./roi";

const DEFAULT_HOURLY_RATE = 8000; // CLP, configurable in future via Settings
const DEFAULT_MINUTES_PER_INTERACTION = 6;
const DEFAULT_SOFTWARE_COST_PER_DAY = 5000; // CLP, amortized

export interface DailyReport {
  propertyId: string;
  date: string;
  operations: { arrivals: number; departures: number; occupiedUnits: number; totalUnits: number; occupancyRate: number };
  guests: { conversationsHandled: number; newConversations: number; escalations: number; avgResponseNote: string };
  maintenance: { ticketsCreated: number; openTickets: number; criticalOpen: number };
  upselling: { serviceBookings: number; upsellRevenue: number };
  approvals: { pending: number; approvedToday: number; rejectedToday: number };
  finance: { reservationsCreated: number; revenueBooked: number; aiCost: number };
  roi: ReturnType<typeof computeRoi>;
  generatedAt: string;
}

export async function buildDailyReport(organizationId: string, propertyId: string, date: Date): Promise<DailyReport> {
  const from = startOfDay(date);
  const to = endOfDay(date);

  const [units, arrivals, departures, occupiedReservations, conversationsToday, newConversations, escalations, maintenanceCreatedToday, openTickets, serviceBookingsToday, pendingApprovals, approvedToday, rejectedToday, reservationsCreatedToday, agentExecutionsToday] =
    await Promise.all([
      prisma.unit.count({ where: { propertyId, active: true } }),
      prisma.reservation.count({ where: { propertyId, checkIn: { gte: from, lte: to }, status: { in: ["CONFIRMED", "CHECKED_IN"] } } }),
      prisma.reservation.count({ where: { propertyId, checkOut: { gte: from, lte: to }, status: { in: ["CHECKED_IN", "CHECKED_OUT"] } } }),
      prisma.reservation.count({ where: { propertyId, status: { in: ["CONFIRMED", "CHECKED_IN"] }, checkIn: { lte: to }, checkOut: { gte: from } } }),
      prisma.conversation.count({ where: { propertyId, lastMessageAt: { gte: from, lte: to } } }),
      prisma.conversation.count({ where: { propertyId, createdAt: { gte: from, lte: to } } }),
      prisma.conversation.count({ where: { propertyId, status: "ESCALATED", updatedAt: { gte: from, lte: to } } }),
      prisma.maintenanceTicket.count({ where: { propertyId, createdAt: { gte: from, lte: to } } }),
      prisma.maintenanceTicket.count({ where: { propertyId, status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] } } }),
      prisma.serviceBooking.count({ where: { service: { propertyId }, createdAt: { gte: from, lte: to } } }),
      prisma.approvalRequest.count({ where: { organizationId, status: "PENDING" } }),
      prisma.approvalRequest.count({ where: { organizationId, status: "APPROVED", approvedAt: { gte: from, lte: to } } }),
      prisma.approvalRequest.count({ where: { organizationId, status: "REJECTED", rejectedAt: { gte: from, lte: to } } }),
      prisma.reservation.count({ where: { propertyId, createdAt: { gte: from, lte: to } } }),
      prisma.agentExecution.count({ where: { propertyId, createdAt: { gte: from, lte: to } } }),
    ]);

  const criticalOpen = await prisma.maintenanceTicket.count({ where: { propertyId, status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] }, urgency: "CRITICAL" } });
  const serviceBookingsAgg = await prisma.serviceBooking.aggregate({
    where: { service: { propertyId }, createdAt: { gte: from, lte: to } },
    _sum: { totalAmount: true },
  });
  const revenueAgg = await prisma.reservation.aggregate({
    where: { propertyId, createdAt: { gte: from, lte: to } },
    _sum: { totalAmount: true },
  });
  const aiCostAgg = await prisma.agentExecution.aggregate({
    where: { propertyId, createdAt: { gte: from, lte: to } },
    _sum: { estimatedCost: true },
  });

  const upsellRevenue = Number(serviceBookingsAgg._sum.totalAmount ?? 0);
  const aiCost = Number(aiCostAgg._sum.estimatedCost ?? 0);
  const interactionsAutomated = agentExecutionsToday;

  const roi = computeRoi({
    interactionsAutomated,
    averageMinutesPerInteraction: DEFAULT_MINUTES_PER_INTERACTION,
    configuredHourlyRate: DEFAULT_HOURLY_RATE,
    upsellRevenue,
    aiCost,
    softwareCost: DEFAULT_SOFTWARE_COST_PER_DAY,
  });

  return {
    propertyId,
    date: from.toISOString().slice(0, 10),
    operations: { arrivals, departures, occupiedUnits: occupiedReservations, totalUnits: units, occupancyRate: units > 0 ? Math.round((occupiedReservations / units) * 100) : 0 },
    guests: { conversationsHandled: conversationsToday, newConversations, escalations, avgResponseNote: "Calculado sobre mensajes con lastMessageAt del dia." },
    maintenance: { ticketsCreated: maintenanceCreatedToday, openTickets, criticalOpen },
    upselling: { serviceBookings: serviceBookingsToday, upsellRevenue },
    approvals: { pending: pendingApprovals, approvedToday, rejectedToday },
    finance: { reservationsCreated: reservationsCreatedToday, revenueBooked: Number(revenueAgg._sum.totalAmount ?? 0), aiCost },
    roi,
    generatedAt: new Date().toISOString(),
  };
}
