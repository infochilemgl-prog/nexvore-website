import { prisma } from "../../utils/prisma";
import type { RiskLevel } from "../../config/permissions";

export interface CreateApprovalInput {
  organizationId: string;
  requestedByAgent?: string;
  requestedByUserId?: string;
  actionType: string;
  riskLevel: RiskLevel;
  entityType: string;
  entityId?: string;
  summary: string;
  payload: Record<string, unknown>;
  expiresInHours?: number;
}

export async function createApprovalRequest(input: CreateApprovalInput) {
  const expiresAt = input.expiresInHours ? new Date(Date.now() + input.expiresInHours * 3600 * 1000) : null;
  return prisma.approvalRequest.create({
    data: {
      organizationId: input.organizationId,
      requestedByAgent: input.requestedByAgent ?? null,
      requestedByUserId: input.requestedByUserId ?? null,
      actionType: input.actionType,
      riskLevel: input.riskLevel,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      payload: input.payload as any,
      status: "PENDING",
      expiresAt,
    },
  });
}
