import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { tenantContext, currentOrgId } from "../middleware/tenant-context";
import { prisma } from "../utils/prisma";
import { assertPropertyInOrg } from "../utils/tenant-scope";
import { HttpError } from "../middleware/error-handler";

export const propertiesRouter = Router();
propertiesRouter.use(requireAuth, tenantContext);

propertiesRouter.get("/", async (req, res, next) => {
  try {
    const properties = await prisma.property.findMany({ where: { organizationId: currentOrgId(req) }, include: { units: true } });
    res.json(properties);
  } catch (err) {
    next(err);
  }
});

propertiesRouter.get("/:id", async (req, res, next) => {
  try {
    await assertPropertyInOrg(req.params.id, currentOrgId(req));
    const property = await prisma.property.findUnique({ where: { id: req.params.id }, include: { units: true } });
    res.json(property);
  } catch (err) {
    next(err);
  }
});

const createPropertySchema = z.object({
  name: z.string().min(2),
  internalCode: z.string().min(1),
  propertyType: z.string().default("HOTEL"),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  checkInTime: z.string().default("15:00"),
  checkOutTime: z.string().default("11:00"),
  maximumGuests: z.number().int().positive().default(2),
  bedrooms: z.number().int().min(0).default(1),
  bathrooms: z.number().int().min(0).default(1),
  whatsappNumber: z.string().optional(),
});

propertiesRouter.post("/", async (req, res, next) => {
  try {
    if (!["OWNER", "MANAGER"].includes(req.user!.role)) throw new HttpError(403, "Rol insuficiente.");
    const data = createPropertySchema.parse(req.body);
    const property = await prisma.property.create({ data: { ...data, organizationId: currentOrgId(req) } });
    res.status(201).json(property);
  } catch (err) {
    next(err);
  }
});

propertiesRouter.get("/:id/units", async (req, res, next) => {
  try {
    await assertPropertyInOrg(req.params.id, currentOrgId(req));
    const units = await prisma.unit.findMany({ where: { propertyId: req.params.id } });
    res.json(units);
  } catch (err) {
    next(err);
  }
});
