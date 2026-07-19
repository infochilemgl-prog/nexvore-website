import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { tenantContext, currentOrgId } from "../middleware/tenant-context";
import { prisma } from "../utils/prisma";
import { writeAuditLog } from "../utils/audit-log";

export const maintenanceRouter = Router();
maintenanceRouter.use(requireAuth, tenantContext);

maintenanceRouter.get("/tickets", async (req, res, next) => {
  try {
    const { status, urgency, propertyId } = req.query as Record<string, string | undefined>;
    const tickets = await prisma.maintenanceTicket.findMany({
      where: {
        organizationId: currentOrgId(req),
        ...(status ? { status: status as any } : {}),
        ...(urgency ? { urgency: urgency as any } : {}),
        ...(propertyId ? { propertyId } : {}),
      },
      include: { unit: true, property: true, contractor: true, quotes: true },
      orderBy: [{ urgency: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    res.json(tickets);
  } catch (err) {
    next(err);
  }
});

maintenanceRouter.get("/tickets/:id", async (req, res, next) => {
  try {
    const ticket = await prisma.maintenanceTicket.findFirst({
      where: { id: req.params.id, organizationId: currentOrgId(req) },
      include: { unit: true, property: true, contractor: true, quotes: { include: { contractor: true } } },
    });
    if (!ticket) return res.status(404).json({ error: "Ticket no encontrado." });
    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({ status: z.enum(["OPEN", "TRIAGED", "QUOTE_REQUESTED", "SCHEDULED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"]) });
maintenanceRouter.patch("/tickets/:id/status", async (req, res, next) => {
  try {
    const ticket = await prisma.maintenanceTicket.findFirst({ where: { id: req.params.id, organizationId: currentOrgId(req) } });
    if (!ticket) return res.status(404).json({ error: "Ticket no encontrado." });
    const { status } = statusSchema.parse(req.body);
    const updated = await prisma.maintenanceTicket.update({
      where: { id: ticket.id },
      data: { status, resolvedAt: status === "RESOLVED" || status === "CLOSED" ? new Date() : ticket.resolvedAt },
    });
    await writeAuditLog({
      actorId: req.user!.id,
      actorType: "HUMAN",
      action: "update_maintenance_status",
      entityType: "MaintenanceTicket",
      entityId: ticket.id,
      beforeData: { status: ticket.status } as any,
      afterData: { status } as any,
      riskLevel: "LEVEL_1",
      organizationId: currentOrgId(req),
      propertyId: ticket.propertyId,
      success: true,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

maintenanceRouter.get("/contractors", async (req, res, next) => {
  try {
    const contractors = await prisma.contractor.findMany({ where: { organizationId: currentOrgId(req) } });
    res.json(contractors);
  } catch (err) {
    next(err);
  }
});

const contractorSchema = z.object({
  name: z.string().min(2),
  company: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  regions: z.array(z.string()).default([]),
  specialties: z.array(z.string()).default([]),
  hourlyRate: z.number().optional(),
});
maintenanceRouter.post("/contractors", async (req, res, next) => {
  try {
    const data = contractorSchema.parse(req.body);
    const contractor = await prisma.contractor.create({ data: { ...data, organizationId: currentOrgId(req) } });
    res.status(201).json(contractor);
  } catch (err) {
    next(err);
  }
});

const quoteUpdateSchema = z.object({ amount: z.number().positive(), status: z.enum(["REQUESTED", "SUBMITTED", "APPROVED", "REJECTED", "EXPIRED"]).optional(), availableAt: z.string().optional() });
maintenanceRouter.patch("/quotes/:id", async (req, res, next) => {
  try {
    const quote = await prisma.contractorQuote.findFirst({ where: { id: req.params.id, ticket: { organizationId: currentOrgId(req) } } });
    if (!quote) return res.status(404).json({ error: "Cotizacion no encontrada." });
    const data = quoteUpdateSchema.parse(req.body);
    const updated = await prisma.contractorQuote.update({
      where: { id: quote.id },
      data: { amount: data.amount, status: data.status ?? "SUBMITTED", availableAt: data.availableAt ? new Date(data.availableAt) : undefined },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
