import { z } from "zod";
import { defineTool } from "./types";
import { prisma } from "../utils/prisma";
import { triageMaintenanceIssue, getSafeTroubleshootingGuide, containsDangerousInstruction } from "../services/maintenance/triage";

const CATEGORIES = ["PLUMBING", "ELECTRICAL", "HVAC", "WIFI", "APPLIANCE", "LOCK", "CLEANING", "SAFETY", "AESTHETIC", "OTHER"] as const;

export const maintenanceTools = [
  defineTool({
    name: "classify_maintenance_issue",
    description: "Clasifica un problema de mantenimiento en categoria y urgencia usando reglas deterministicas (estas reglas ganan siempre sobre cualquier clasificacion del modelo).",
    actionType: "classify_conversation",
    schema: z.object({ description: z.string() }),
    handler: async (input) => {
      const result = triageMaintenanceIssue(input.description);
      return result;
    },
  }),

  defineTool({
    name: "get_troubleshooting_guide",
    description: "Devuelve instrucciones seguras de auto-ayuda para una categoria. Nunca incluye instrucciones sobre tableros electricos, gas o equipos contra incendio.",
    actionType: "read_manual",
    schema: z.object({ category: z.enum(CATEGORIES) }),
    handler: async (input) => {
      const instructions = getSafeTroubleshootingGuide(input.category);
      if (containsDangerousInstruction(instructions)) {
        return { instructions: "Por seguridad, este tema requiere atencion de nuestro equipo tecnico. No intentes resolverlo tu mismo." };
      }
      return { instructions };
    },
  }),

  defineTool({
    name: "create_maintenance_ticket",
    description: "Crea un ticket de mantenimiento en la propiedad/unidad actual.",
    actionType: "create_internal_ticket",
    schema: z.object({
      title: z.string().min(3),
      description: z.string().min(3),
      category: z.enum(CATEGORIES),
      urgency: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
    }),
    handler: async (input, ctx) => {
      if (!ctx.propertyId) return { ok: false, error: "No hay propiedad resuelta en este contexto." };
      // Deterministic triage always has final say over urgency, even if the
      // caller (model) suggests a different one.
      const reTriage = triageMaintenanceIssue(input.description);
      const property = await prisma.property.findFirst({ where: { id: ctx.propertyId, organizationId: ctx.organizationId } });
      if (!property) return { ok: false, error: "Propiedad no encontrada." };

      // Pick a default unit for the property when the conversation isn't tied
      // to one explicitly (kept simple: first active unit).
      const unit = await prisma.unit.findFirst({ where: { propertyId: property.id, active: true } });
      if (!unit) return { ok: false, error: "La propiedad no tiene unidades activas." };

      const ticket = await prisma.maintenanceTicket.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: property.id,
          unitId: unit.id,
          guestId: ctx.guestId ?? null,
          title: input.title,
          description: input.description,
          category: reTriage.category,
          urgency: reTriage.urgency,
          status: "OPEN",
          source: ctx.actorType === "AGENT" ? "GUEST_REPORT" : "STAFF_REPORT",
        },
      });
      return { ok: true, ticketId: ticket.id, urgency: ticket.urgency, category: ticket.category };
    },
  }),

  defineTool({
    name: "find_contractors",
    description: "Busca contratistas activos por especialidad/region para una organizacion.",
    actionType: "read_tickets",
    schema: z.object({ specialty: z.string().optional() }),
    handler: async (input, ctx) => {
      const contractors = await prisma.contractor.findMany({
        where: { organizationId: ctx.organizationId, active: true },
        take: 20,
      });
      const filtered = input.specialty
        ? contractors.filter((c) => JSON.stringify(c.specialties).toLowerCase().includes(input.specialty!.toLowerCase()))
        : contractors;
      return { contractors: filtered };
    },
  }),

  defineTool({
    name: "request_contractor_quote",
    description: "Solicita una cotizacion a un contratista para un ticket de mantenimiento. Nivel 2: siempre requiere aprobacion humana, nunca contacta directamente al contratista.",
    actionType: "request_contractor_quote",
    schema: z.object({ maintenanceTicketId: z.string(), contractorId: z.string(), notes: z.string().optional() }),
    summarize: (input) => `Solicitar cotizacion al contratista ${input.contractorId} para el ticket ${input.maintenanceTicketId}.`,
    handler: async (input, ctx) => {
      const ticket = await prisma.maintenanceTicket.findFirst({ where: { id: input.maintenanceTicketId, organizationId: ctx.organizationId } });
      if (!ticket) return { ok: false, error: "Ticket no encontrado." };
      const contractor = await prisma.contractor.findFirst({ where: { id: input.contractorId, organizationId: ctx.organizationId } });
      if (!contractor) return { ok: false, error: "Contratista no encontrado." };
      const quote = await prisma.contractorQuote.create({
        data: { maintenanceTicketId: ticket.id, contractorId: contractor.id, amount: 0, status: "REQUESTED", notes: input.notes ?? null },
      });
      await prisma.maintenanceTicket.update({ where: { id: ticket.id }, data: { status: "QUOTE_REQUESTED", assignedContractorId: contractor.id } });
      return { ok: true, quoteId: quote.id, status: quote.status };
    },
  }),
];
