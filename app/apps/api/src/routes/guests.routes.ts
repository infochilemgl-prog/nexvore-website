import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { tenantContext, currentOrgId } from "../middleware/tenant-context";
import { prisma } from "../utils/prisma";
import { assertGuestInOrg } from "../utils/tenant-scope";

export const guestsRouter = Router();
guestsRouter.use(requireAuth, tenantContext);

guestsRouter.get("/", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const guests = await prisma.guest.findMany({
      where: {
        organizationId: currentOrgId(req),
        ...(q ? { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(guests);
  } catch (err) {
    next(err);
  }
});

guestsRouter.get("/:id", async (req, res, next) => {
  try {
    await assertGuestInOrg(req.params.id, currentOrgId(req));
    const guest = await prisma.guest.findUnique({
      where: { id: req.params.id },
      include: { reservations: true, conversations: true },
    });
    res.json(guest);
  } catch (err) {
    next(err);
  }
});

const upsertSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  preferredLanguage: z.string().default("es"),
  notes: z.string().optional(),
});

guestsRouter.post("/", async (req, res, next) => {
  try {
    const data = upsertSchema.parse(req.body);
    const guest = await prisma.guest.create({ data: { ...data, organizationId: currentOrgId(req) } });
    res.status(201).json(guest);
  } catch (err) {
    next(err);
  }
});

guestsRouter.patch("/:id", async (req, res, next) => {
  try {
    await assertGuestInOrg(req.params.id, currentOrgId(req));
    const data = upsertSchema.partial().parse(req.body);
    const guest = await prisma.guest.update({ where: { id: req.params.id }, data });
    res.json(guest);
  } catch (err) {
    next(err);
  }
});
