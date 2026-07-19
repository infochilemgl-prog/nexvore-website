import { prisma } from "./prisma";
import { logger } from "../config/logger";
import type { RiskLevel } from "../config/permissions";

export interface WriteAuditLogInput {
  actorId?: string | null;
  actorType: "HUMAN" | "AGENT" | "SYSTEM";
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  reason?: string | null;
  riskLevel: RiskLevel;
  approvalStatus?: string | null;
  organizationId?: string | null;
  propertyId?: string | null;
  success: boolean;
  error?: string | null;
}

/**
 * The single write path for AuditLog rows. Every state-changing action in the
 * system (tool execution, approval execution, manual dashboard edits) MUST
 * call this. Never write to the AuditLog table directly elsewhere.
 */
export async function writeAuditLog(input: WriteAuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorType: input.actorType,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        beforeData: input.beforeData === undefined ? undefined : (input.beforeData as any),
        afterData: input.afterData === undefined ? undefined : (input.afterData as any),
        reason: input.reason ?? null,
        riskLevel: input.riskLevel,
        approvalStatus: input.approvalStatus ?? null,
        organizationId: input.organizationId ?? null,
        propertyId: input.propertyId ?? null,
        success: input.success,
        error: input.error ?? null,
      },
    });
  } catch (err) {
    // Audit logging must never crash the caller, but it must be loud in logs.
    logger.error({ err, input }, "FALLO al escribir AuditLog");
  }
}
