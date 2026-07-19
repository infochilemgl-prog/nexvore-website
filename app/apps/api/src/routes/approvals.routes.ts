import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { tenantContext, currentOrgId } from "../middleware/tenant-context";
import { prisma } from "../utils/prisma";
import { approveAndExecute, rejectApproval, ApprovalExecutionError } from "../services/approvals/execute-approval";
import { HttpError } from "../middleware/error-handler";

export const approvalsRouter = Router();
approvalsRouter.use(requireAuth, tenantContext);

approvalsRouter.get("/", async (req, res, next) => {
  try {
    const { status } = req.query as Record<string, string | undefined>;
    const approvals = await prisma.approvalRequest.findMany({
      where: { organizationId: currentOrgId(req), ...(status ? { status: status as any } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(approvals);
  } catch (err) {
    next(err);
  }
});

approvalsRouter.get("/:id", async (req, res, next) => {
  try {
    const approval = await prisma.approvalRequest.findFirst({ where: { id: req.params.id, organizationId: currentOrgId(req) } });
    if (!approval) throw new HttpError(404, "Solicitud no encontrada.");
    res.json(approval);
  } catch (err) {
    next(err);
  }
});

approvalsRouter.post("/:id/approve", async (req, res, next) => {
  try {
    if (!["OWNER", "MANAGER"].includes(req.user!.role)) throw new HttpError(403, "Solo OWNER/MANAGER pueden aprobar.");
    const approval = await prisma.approvalRequest.findFirst({ where: { id: req.params.id, organizationId: currentOrgId(req) } });
    if (!approval) throw new HttpError(404, "Solicitud no encontrada.");
    const result = await approveAndExecute(approval.id, req.user!.id, req.user!.role);
    res.json(result);
  } catch (err) {
    if (err instanceof ApprovalExecutionError) return next(new HttpError(400, err.message));
    next(err);
  }
});

const rejectSchema = z.object({ reason: z.string().optional() });
approvalsRouter.post("/:id/reject", async (req, res, next) => {
  try {
    const approval = await prisma.approvalRequest.findFirst({ where: { id: req.params.id, organizationId: currentOrgId(req) } });
    if (!approval) throw new HttpError(404, "Solicitud no encontrada.");
    const { reason } = rejectSchema.parse(req.body);
    const updated = await rejectApproval(approval.id, req.user!.id, reason);
    res.json(updated);
  } catch (err) {
    if (err instanceof ApprovalExecutionError) return next(new HttpError(400, err.message));
    next(err);
  }
});
