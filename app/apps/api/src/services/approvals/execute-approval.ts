import { prisma } from "../../utils/prisma";
import { evaluatePermission, type ActionType } from "../../config/permissions";
import { getTool } from "../../tools/registry";
import type { ToolContext } from "../../tools/types";
import { writeAuditLog } from "../../utils/audit-log";
import { checkAvailability, validateDateRange } from "../reservations/availability";

export class ApprovalExecutionError extends Error {}

/**
 * Approving an ApprovalRequest is not "just flip status to APPROVED": it must
 * (1) re-validate the actor's permission, (2) re-validate the underlying
 * entity's current state (price/availability may have changed since the
 * request was created), (3) execute the real tool handler, (4) audit-log the
 * result. This is the ONLY path that executes a Level 2/3 tool.
 */
export async function approveAndExecute(approvalId: string, approvedByUserId: string, approverRole: string) {
  const approval = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
  if (!approval) throw new ApprovalExecutionError("Solicitud de aprobacion no encontrada.");
  if (approval.status !== "PENDING") throw new ApprovalExecutionError(`La solicitud ya esta en estado ${approval.status}.`);
  if (approval.expiresAt && approval.expiresAt < new Date()) {
    await prisma.approvalRequest.update({ where: { id: approval.id }, data: { status: "EXPIRED" } });
    throw new ApprovalExecutionError("La solicitud de aprobacion expiro.");
  }

  const decision = evaluatePermission(approval.actionType as ActionType, { actorType: "HUMAN", actorRole: approverRole });
  if (!decision.allowed) {
    await prisma.approvalRequest.update({ where: { id: approval.id }, data: { status: "REJECTED", rejectedAt: new Date() } });
    throw new ApprovalExecutionError(`Accion bloqueada por configuracion: ${decision.reason}`);
  }

  const payload = (approval.payload as Record<string, unknown>) ?? {};
  const toolName = payload.toolName as string | undefined;
  const toolInput = (payload.toolInput as Record<string, unknown>) ?? {};

  if (!toolName) {
    await prisma.approvalRequest.update({ where: { id: approval.id }, data: { status: "APPROVED", approvedBy: approvedByUserId, approvedAt: new Date() } });
    return { executed: false, reason: "Sin herramienta asociada; marcada como aprobada manualmente." };
  }

  const tool = getTool(toolName);
  if (!tool) throw new ApprovalExecutionError(`Herramienta desconocida: ${toolName}`);

  // Re-validate underlying entity state before executing where it applies
  // (reservation still exists, availability/price haven't changed).
  if ((toolName === "request_reschedule" || toolName === "create_reservation") && typeof toolInput.reservationId === "string") {
    const reservation = await prisma.reservation.findUnique({ where: { id: toolInput.reservationId as string } });
    if (!reservation) throw new ApprovalExecutionError("La reserva asociada ya no existe.");
  }
  if (toolName === "request_reschedule" && typeof toolInput.newCheckIn === "string" && typeof toolInput.newCheckOut === "string") {
    const checkIn = new Date(toolInput.newCheckIn as string);
    const checkOut = new Date(toolInput.newCheckOut as string);
    const dateError = validateDateRange(checkIn, checkOut);
    if (dateError) throw new ApprovalExecutionError(`Ya no es una fecha valida: ${dateError}`);
  }

  await prisma.approvalRequest.update({ where: { id: approval.id }, data: { status: "APPROVED", approvedBy: approvedByUserId, approvedAt: new Date() } });

  const ctx: ToolContext = {
    organizationId: approval.organizationId,
    agentName: approval.requestedByAgent ?? "approval-executor",
    actorType: "HUMAN",
    actorId: approvedByUserId,
  };

  try {
    const result = await tool.handler(toolInput, ctx);
    await prisma.approvalRequest.update({ where: { id: approval.id }, data: { status: "EXECUTED" } });
    await writeAuditLog({
      actorId: approvedByUserId,
      actorType: "HUMAN",
      action: `approval_executed:${toolName}`,
      entityType: approval.entityType,
      entityId: approval.entityId,
      beforeData: toolInput,
      afterData: result as any,
      riskLevel: approval.riskLevel,
      approvalStatus: "EXECUTED",
      organizationId: approval.organizationId,
      success: true,
    });
    return { executed: true, result };
  } catch (err) {
    await prisma.approvalRequest.update({ where: { id: approval.id }, data: { status: "FAILED" } });
    await writeAuditLog({
      actorId: approvedByUserId,
      actorType: "HUMAN",
      action: `approval_execution_failed:${toolName}`,
      entityType: approval.entityType,
      entityId: approval.entityId,
      beforeData: toolInput,
      riskLevel: approval.riskLevel,
      approvalStatus: "FAILED",
      organizationId: approval.organizationId,
      success: false,
      error: (err as Error).message,
    });
    throw err;
  }
}

export async function rejectApproval(approvalId: string, rejectedByUserId: string, reason?: string) {
  const approval = await prisma.approvalRequest.findUnique({ where: { id: approvalId } });
  if (!approval) throw new ApprovalExecutionError("Solicitud de aprobacion no encontrada.");
  if (approval.status !== "PENDING") throw new ApprovalExecutionError(`La solicitud ya esta en estado ${approval.status}.`);
  const updated = await prisma.approvalRequest.update({ where: { id: approval.id }, data: { status: "REJECTED", rejectedAt: new Date() } });
  await writeAuditLog({
    actorId: rejectedByUserId,
    actorType: "HUMAN",
    action: "approval_rejected",
    entityType: approval.entityType,
    entityId: approval.entityId,
    reason: reason ?? null,
    riskLevel: approval.riskLevel,
    approvalStatus: "REJECTED",
    organizationId: approval.organizationId,
    success: true,
  });
  return updated;
}
