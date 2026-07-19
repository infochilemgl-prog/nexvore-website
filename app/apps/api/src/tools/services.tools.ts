import { z } from "zod";
import { defineTool } from "./types";
import { prisma } from "../utils/prisma";

export const servicesTools = [
  defineTool({
    name: "list_services",
    description: "Lista los servicios adicionales disponibles en la propiedad (spa, transporte, tours, etc.).",
    actionType: "read_services",
    schema: z.object({ category: z.string().optional() }),
    handler: async (input, ctx) => {
      if (!ctx.propertyId) return { services: [] };
      const services = await prisma.service.findMany({
        where: { propertyId: ctx.propertyId, active: true, ...(input.category ? { category: input.category as any } : {}) },
      });
      return { services: services.map((s) => ({ id: s.id, name: s.name, category: s.category, price: Number(s.price), currency: s.currency, requiresApproval: s.requiresApproval })) };
    },
  }),

  defineTool({
    name: "book_service",
    description: "Reserva un servicio adicional para un huesped. Si el servicio requiere aprobacion, se genera una ApprovalRequest en vez de confirmarlo directamente.",
    actionType: "create_unpaid_reservation",
    schema: z.object({ serviceId: z.string(), scheduledAt: z.string(), quantity: z.number().int().positive().default(1), reservationId: z.string().optional(), notes: z.string().optional() }),
    handler: async (input, ctx) => {
      if (!ctx.guestId) return { ok: false, error: "No hay huesped resuelto en este contexto." };
      const service = await prisma.service.findFirst({ where: { id: input.serviceId, property: { organizationId: ctx.organizationId } } });
      if (!service) return { ok: false, error: "Servicio no encontrado." };
      const totalAmount = Number(service.price) * input.quantity;
      const booking = await prisma.serviceBooking.create({
        data: {
          serviceId: service.id,
          reservationId: input.reservationId ?? null,
          guestId: ctx.guestId,
          scheduledAt: new Date(input.scheduledAt),
          quantity: input.quantity,
          totalAmount,
          status: service.requiresApproval ? "PENDING_APPROVAL" : "REQUESTED",
          notes: input.notes ?? null,
        },
      });
      return { ok: true, bookingId: booking.id, status: booking.status, totalAmount };
    },
  }),
];
