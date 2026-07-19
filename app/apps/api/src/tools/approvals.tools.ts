import { z } from "zod";
import { defineTool } from "./types";
import { prisma } from "../utils/prisma";
import { writeAuditLog } from "../utils/audit-log";

export const approvalsTools = [
  defineTool({
    name: "create_approval_request",
    description: "Crea explicitamente una solicitud de aprobacion para una accion que el agente no puede ejecutar directamente.",
    actionType: "create_internal_ticket",
    schema: z.object({
      actionType: z.string(),
      entityType: z.string(),
      entityId: z.string().optional(),
      summary: z.string(),
      payload: z.record(z.unknown()).default({}),
    }),
    handler: async (input, ctx) => {
      const approval = await prisma.approvalRequest.create({
        data: {
          organizationId: ctx.organizationId,
          requestedByAgent: ctx.agentName,
          actionType: input.actionType,
          riskLevel: "LEVEL_2",
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          summary: input.summary,
          payload: input.payload as any,
          status: "PENDING",
        },
      });
      return { ok: true, approvalRequestId: approval.id };
    },
  }),

  defineTool({
    name: "create_audit_log",
    description: "Registra manualmente una entrada de auditoria (uso interno para eventos que no vienen de otra herramienta).",
    actionType: "create_note",
    schema: z.object({ action: z.string(), entityType: z.string(), entityId: z.string().optional(), reason: z.string().optional() }),
    handler: async (input, ctx) => {
      await writeAuditLog({
        actorId: ctx.actorId ?? ctx.agentName,
        actorType: ctx.actorType,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        reason: input.reason ?? null,
        riskLevel: "LEVEL_1",
        organizationId: ctx.organizationId,
        propertyId: ctx.propertyId ?? null,
        success: true,
      });
      return { ok: true };
    },
  }),
];
