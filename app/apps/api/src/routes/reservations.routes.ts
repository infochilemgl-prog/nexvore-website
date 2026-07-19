import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { tenantContext, currentOrgId } from "../middleware/tenant-context";
import { prisma } from "../utils/prisma";
import { assertReservationInOrg } from "../utils/tenant-scope";
import { checkAvailability, validateDateRange } from "../services/reservations/availability";
import { computeQuote } from "../services/reservations/quote";
import { writeAuditLog } from "../utils/audit-log";

export const reservationsRouter = Router();
reservationsRouter.use(requireAuth, tenantContext);

reservationsRouter.get("/", async (req, res, next) => {
  try {
    const { propertyId, status, from, to } = req.query as Record<string, string | undefined>;
    const reservations = await prisma.reservation.findMany({
      where: {
        organizationId: currentOrgId(req),
        ...(propertyId ? { propertyId } : {}),
        ...(status ? { status: status as any } : {}),
        ...(from || to ? { checkIn: { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } } : {}),
      },
      include: { unit: true, guest: true, property: true },
      orderBy: { checkIn: "desc" },
      take: 200,
    });
    res.json(reservations);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.get("/:id", async (req, res, next) => {
  try {
    await assertReservationInOrg(req.params.id, currentOrgId(req));
    const reservation = await prisma.reservation.findUnique({ where: { id: req.params.id }, include: { unit: true, guest: true, property: true, serviceBookings: true } });
    res.json(reservation);
  } catch (err) {
    next(err);
  }
});

const availabilityQuerySchema = z.object({ unitId: z.string(), checkIn: z.string(), checkOut: z.string() });
reservationsRouter.get("/availability/check", async (req, res, next) => {
  try {
    const { unitId, checkIn, checkOut } = availabilityQuerySchema.parse(req.query);
    const result = await checkAvailability({ unitId, checkIn: new Date(checkIn), checkOut: new Date(checkOut) });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

const manualCreateSchema = z.object({
  propertyId: z.string(),
  unitId: z.string(),
  guestId: z.string(),
  checkIn: z.string(),
  checkOut: z.string(),
  adults: z.number().int().positive(),
  children: z.number().int().min(0).default(0),
  specialRequests: z.string().optional(),
  source: z.enum(["DIRECT", "AIRBNB", "BOOKING", "EXPEDIA", "WHATSAPP", "PHONE", "MANUAL", "OTHER"]).default("MANUAL"),
});

reservationsRouter.post("/", async (req, res, next) => {
  try {
    const data = manualCreateSchema.parse(req.body);
    const checkIn = new Date(data.checkIn);
    const checkOut = new Date(data.checkOut);
    const dateError = validateDateRange(checkIn, checkOut);
    if (dateError) return res.status(400).json({ error: dateError });

    const unit = await prisma.unit.findFirst({ where: { id: data.unitId, propertyId: data.propertyId, property: { organizationId: currentOrgId(req) } } });
    if (!unit) return res.status(404).json({ error: "Unidad no encontrada." });

    const availability = await checkAvailability({ unitId: unit.id, checkIn, checkOut });
    if (!availability.available) return res.status(409).json({ error: "No hay disponibilidad para esas fechas.", conflicts: availability.conflicts });

    const quote = computeQuote({ basePrice: Number(unit.basePrice), cleaningFee: Number(unit.cleaningFee), checkIn, checkOut, taxRate: 0 });

    const reservation = await prisma.reservation.create({
      data: {
        organizationId: currentOrgId(req),
        propertyId: data.propertyId,
        unitId: unit.id,
        guestId: data.guestId,
        source: data.source,
        status: "PENDING",
        checkIn,
        checkOut,
        adults: data.adults,
        children: data.children,
        totalGuests: data.adults + data.children,
        subtotal: quote.subtotalBeforeTax,
        taxes: quote.taxes,
        totalAmount: quote.total,
        specialRequests: data.specialRequests,
      },
    });

    await writeAuditLog({
      actorId: req.user!.id,
      actorType: "HUMAN",
      action: "create_reservation_manual",
      entityType: "Reservation",
      entityId: reservation.id,
      afterData: reservation as any,
      riskLevel: "LEVEL_1",
      organizationId: currentOrgId(req),
      propertyId: data.propertyId,
      success: true,
    });

    res.status(201).json(reservation);
  } catch (err) {
    next(err);
  }
});

const statusUpdateSchema = z.object({ status: z.enum(["INQUIRY", "PENDING", "AWAITING_PAYMENT", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"]) });

reservationsRouter.patch("/:id/status", async (req, res, next) => {
  try {
    const reservation = await assertReservationInOrg(req.params.id, currentOrgId(req));
    const { status } = statusUpdateSchema.parse(req.body);
    const updated = await prisma.reservation.update({ where: { id: reservation.id }, data: { status } });
    await writeAuditLog({
      actorId: req.user!.id,
      actorType: "HUMAN",
      action: "update_reservation_status",
      entityType: "Reservation",
      entityId: reservation.id,
      beforeData: { status: reservation.status } as any,
      afterData: { status } as any,
      riskLevel: "LEVEL_1",
      organizationId: currentOrgId(req),
      propertyId: reservation.propertyId,
      success: true,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
