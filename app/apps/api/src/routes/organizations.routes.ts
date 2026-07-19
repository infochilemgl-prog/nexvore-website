import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { tenantContext, currentOrgId } from "../middleware/tenant-context";
import { prisma } from "../utils/prisma";

export const organizationsRouter = Router();
organizationsRouter.use(requireAuth, tenantContext);

organizationsRouter.get("/me", async (req, res, next) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: currentOrgId(req) } });
    res.json(org);
  } catch (err) {
    next(err);
  }
});
