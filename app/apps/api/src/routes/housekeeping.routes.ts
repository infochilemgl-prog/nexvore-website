import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { tenantContext, currentOrgId } from "../middleware/tenant-context";
import { prisma } from "../utils/prisma";
import { assertPropertyInOrg } from "../utils/tenant-scope";

export const housekeepingRouter = Router();
housekeepingRouter.use(requireAuth, tenantContext);

housekeepingRouter.get("/tasks", async (req, res, next) => {
  try {
    const { propertyId, status } = req.query as Record<string, string | undefined>;
    const tasks = await prisma.housekeepingTask.findMany({
      where: {
        property: { organizationId: currentOrgId(req) },
        ...(propertyId ? { propertyId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: { unit: true, assignedUser: true, reservation: true },
      orderBy: { scheduledAt: "asc" },
      take: 200,
    });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

const createTaskSchema = z.object({ propertyId: z.string(), unitId: z.string(), scheduledAt: z.string(), reservationId: z.string().optional(), assignedUserId: z.string().optional() });
housekeepingRouter.post("/tasks", async (req, res, next) => {
  try {
    const data = createTaskSchema.parse(req.body);
    await assertPropertyInOrg(data.propertyId, currentOrgId(req));
    const task = await prisma.housekeepingTask.create({
      data: { propertyId: data.propertyId, unitId: data.unitId, scheduledAt: new Date(data.scheduledAt), reservationId: data.reservationId, assignedUserId: data.assignedUserId, checklist: [], issues: [] },
    });
    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

const statusSchema = z.object({ status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "VERIFIED", "ISSUE_FOUND"]), issues: z.array(z.string()).optional() });
housekeepingRouter.patch("/tasks/:id/status", async (req, res, next) => {
  try {
    const task = await prisma.housekeepingTask.findFirst({ where: { id: req.params.id, property: { organizationId: currentOrgId(req) } } });
    if (!task) return res.status(404).json({ error: "Tarea no encontrada." });
    const { status, issues } = statusSchema.parse(req.body);
    const updated = await prisma.housekeepingTask.update({
      where: { id: task.id },
      data: { status, issues: (issues ?? (task.issues as any)) as any, completedAt: status === "COMPLETED" || status === "VERIFIED" ? new Date() : task.completedAt },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

housekeepingRouter.get("/inventory", async (req, res, next) => {
  try {
    const { propertyId } = req.query as Record<string, string | undefined>;
    const items = await prisma.inventoryItem.findMany({ where: { property: { organizationId: currentOrgId(req) }, ...(propertyId ? { propertyId } : {}) } });
    res.json(items);
  } catch (err) {
    next(err);
  }
});
