import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { tenantContext, currentOrgId } from "../middleware/tenant-context";
import { prisma } from "../utils/prisma";

export const competitorsRouter = Router();
competitorsRouter.use(requireAuth, tenantContext);

competitorsRouter.get("/", async (req, res, next) => {
  try {
    const { propertyId } = req.query as Record<string, string | undefined>;
    const competitors = await prisma.competitor.findMany({
      where: { organizationId: currentOrgId(req), ...(propertyId ? { propertyId } : {}) },
      include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1 }, reviews: { take: 5, orderBy: { createdAt: "desc" } } },
    });
    res.json(competitors);
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  propertyId: z.string(),
  name: z.string().min(2),
  listingUrl: z.string().optional(),
  platform: z.string().optional(),
  location: z.string().optional(),
  targetGuestProfile: z.string().optional(),
});

competitorsRouter.post("/", async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const competitor = await prisma.competitor.create({ data: { ...data, organizationId: currentOrgId(req) } });
    res.status(201).json(competitor);
  } catch (err) {
    next(err);
  }
});

competitorsRouter.get("/:id/reviews", async (req, res, next) => {
  try {
    const competitor = await prisma.competitor.findFirst({ where: { id: req.params.id, organizationId: currentOrgId(req) } });
    if (!competitor) return res.status(404).json({ error: "Competidor no encontrado." });
    const reviews = await prisma.competitorReview.findMany({ where: { competitorId: competitor.id }, orderBy: { createdAt: "desc" } });
    res.json(reviews);
  } catch (err) {
    next(err);
  }
});

competitorsRouter.get("/content-ideas", async (req, res, next) => {
  try {
    const { propertyId } = req.query as Record<string, string | undefined>;
    const ideas = await prisma.contentIdea.findMany({
      where: { property: { organizationId: currentOrgId(req) }, ...(propertyId ? { propertyId } : {}) },
      orderBy: { createdAt: "desc" },
    });
    res.json(ideas);
  } catch (err) {
    next(err);
  }
});
