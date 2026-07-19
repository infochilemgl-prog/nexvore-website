import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { tenantContext, currentOrgId } from "../middleware/tenant-context";
import { prisma } from "../utils/prisma";
import { assertPropertyInOrg } from "../utils/tenant-scope";

export const servicesRouter = Router();
servicesRouter.use(requireAuth, tenantContext);

servicesRouter.get("/", async (req, res, next) => {
  try {
    const { propertyId } = req.query as Record<string, string | undefined>;
    const services = await prisma.service.findMany({ where: { property: { organizationId: currentOrgId(req) }, ...(propertyId ? { propertyId } : {}) } });
    res.json(services);
  } catch (err) {
    next(err);
  }
});

const createServiceSchema = z.object({
  propertyId: z.string(),
  name: z.string().min(2),
  category: z.enum(["SPA", "TRANSPORT", "ROOM_SERVICE", "TOUR", "LATE_CHECKOUT", "EARLY_CHECKIN", "CLEANING", "FOOD", "OTHER"]),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  capacity: z.number().int().positive().optional(),
  durationMinutes: z.number().int().positive().optional(),
  requiresApproval: z.boolean().default(false),
});

servicesRouter.post("/", async (req, res, next) => {
  try {
    const data = createServiceSchema.parse(req.body);
    await assertPropertyInOrg(data.propertyId, currentOrgId(req));
    const service = await prisma.service.create({ data });
    res.status(201).json(service);
  } catch (err) {
    next(err);
  }
});

servicesRouter.get("/bookings", async (req, res, next) => {
  try {
    const { propertyId } = req.query as Record<string, string | undefined>;
    const bookings = await prisma.serviceBooking.findMany({
      where: { service: { property: { organizationId: currentOrgId(req), ...(propertyId ? { id: propertyId } : {}) } } },
      include: { service: true, guest: true },
      orderBy: { scheduledAt: "desc" },
      take: 200,
    });
    res.json(bookings);
  } catch (err) {
    next(err);
  }
});
