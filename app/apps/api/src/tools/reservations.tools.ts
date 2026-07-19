import { z } from "zod";
import { defineTool } from "./types";
import { prisma } from "../utils/prisma";
import { redis, withRedisLock } from "../utils/redis";
import { checkAvailability, datesOverlap, findAvailableUnit, validateDateRange } from "../services/reservations/availability";
import { computeQuote } from "../services/reservations/quote";
import { createCalendarEvent } from "../integrations/google";
import { getPMSAdapter } from "../integrations/pms";
import { getPaymentAdapter } from "../integrations/payments";
import { encryptSecret, decryptSecret } from "../utils/crypto";
import { env } from "../config/env";

const UNIT_CATEGORIES = ["GRAND_SUITE", "DELUXE", "STANDARD", "APARTMENT", "HOUSE", "CUSTOM"] as const;
const ACTIVE_STATUSES = ["PENDING", "AWAITING_PAYMENT", "CONFIRMED", "CHECKED_IN"];

export const reservationsTools = [
  defineTool({
    name: "get_property_information",
    description: "Obtiene informacion general de la propiedad (horarios, direccion, politicas basicas, unidades).",
    actionType: "read_manual",
    schema: z.object({}),
    handler: async (_input, ctx) => {
      if (!ctx.propertyId) return { error: "No hay propiedad resuelta en este contexto." };
      const property = await prisma.property.findFirst({
        where: { id: ctx.propertyId, organizationId: ctx.organizationId },
        include: { units: { where: { active: true } } },
      });
      if (!property) return { error: "Propiedad no encontrada." };
      return {
        name: property.name,
        address: property.address,
        city: property.city,
        country: property.country,
        checkInTime: property.checkInTime,
        checkOutTime: property.checkOutTime,
        timezone: property.timezone,
        currency: property.currency,
        units: property.units.map((u) => ({ id: u.id, name: u.name, category: u.category, maximumGuests: u.maximumGuests, basePrice: Number(u.basePrice) })),
      };
    },
  }),

  defineTool({
    name: "find_guest",
    description: "Busca un huesped por telefono o email dentro de la organizacion actual.",
    actionType: "read_reservation",
    schema: z.object({ phone: z.string().optional(), email: z.string().optional() }),
    handler: async (input, ctx) => {
      const guest = await prisma.guest.findFirst({
        where: {
          organizationId: ctx.organizationId,
          OR: [input.phone ? { phone: input.phone } : undefined, input.email ? { email: input.email } : undefined].filter(Boolean) as any,
        },
      });
      return guest ? { found: true, guest } : { found: false };
    },
  }),

  defineTool({
    name: "find_reservation",
    description: "Busca una reserva por id o por huesped+fechas, dentro de la organizacion/propiedad actual.",
    actionType: "read_reservation",
    schema: z.object({ reservationId: z.string().optional(), guestId: z.string().optional() }),
    handler: async (input, ctx) => {
      const reservation = await prisma.reservation.findFirst({
        where: {
          organizationId: ctx.organizationId,
          ...(ctx.propertyId ? { propertyId: ctx.propertyId } : {}),
          ...(input.reservationId ? { id: input.reservationId } : {}),
          ...(input.guestId ? { guestId: input.guestId } : {}),
        },
        include: { unit: true, guest: true },
        orderBy: { createdAt: "desc" },
      });
      return reservation ? { found: true, reservation } : { found: false };
    },
  }),

  defineTool({
    name: "check_availability",
    description: "Verifica disponibilidad real de una unidad o categoria de unidad para un rango de fechas. Siempre llamar antes de ofrecer una unidad.",
    actionType: "read_availability",
    schema: z.object({
      unitId: z.string().optional(),
      unitCategory: z.enum(UNIT_CATEGORIES).optional(),
      checkIn: z.string(),
      checkOut: z.string(),
      adults: z.number().int().positive().default(1),
    }),
    handler: async (input, ctx) => {
      if (!ctx.propertyId) return { available: false, reason: "No hay propiedad resuelta en este contexto." };
      const checkIn = new Date(input.checkIn);
      const checkOut = new Date(input.checkOut);
      const dateError = validateDateRange(checkIn, checkOut);
      if (dateError) return { available: false, reason: dateError };

      if (input.unitId) {
        const result = await checkAvailability({ unitId: input.unitId, checkIn, checkOut });
        return { ...result, unitId: input.unitId };
      }

      const match = await findAvailableUnit(ctx.propertyId, input.unitCategory, checkIn, checkOut, input.adults);
      if (!match) return { available: false, reason: "No hay unidades disponibles para esa categoria/fechas/capacidad." };
      return {
        available: true,
        unitId: match.unit.id,
        unitName: match.unit.name,
        category: match.unit.category,
        basePrice: Number(match.unit.basePrice),
        cleaningFee: Number(match.unit.cleaningFee),
        currency: "CLP",
      };
    },
  }),

  defineTool({
    name: "quote_reservation",
    description: "Calcula el precio total de una reserva (deterministico, nunca lo calcules tu mismo). Devuelve el desglose completo.",
    actionType: "read_availability",
    schema: z.object({
      unitId: z.string(),
      checkIn: z.string(),
      checkOut: z.string(),
      serviceIds: z.array(z.string()).default([]),
      taxRate: z.number().min(0).max(1).default(0),
    }),
    handler: async (input, ctx) => {
      const unit = await prisma.unit.findFirst({ where: { id: input.unitId, property: { organizationId: ctx.organizationId } } });
      if (!unit) return { error: "Unidad no encontrada." };

      const services = input.serviceIds.length
        ? await prisma.service.findMany({ where: { id: { in: input.serviceIds }, propertyId: unit.propertyId } })
        : [];

      const quote = computeQuote({
        basePrice: Number(unit.basePrice),
        cleaningFee: Number(unit.cleaningFee),
        checkIn: new Date(input.checkIn),
        checkOut: new Date(input.checkOut),
        services: services.map((s) => ({ label: s.name, amount: Number(s.price) })),
        taxRate: input.taxRate,
        currency: "CLP",
      });
      return quote;
    },
  }),

  defineTool({
    name: "create_reservation",
    description:
      "Crea una reserva SIN PAGO tras confirmacion explicita del huesped. Revalida disponibilidad dentro de una transaccion con lock. Nunca digas 'confirmada' hasta que esta herramienta responda ok:true.",
    actionType: "create_unpaid_reservation",
    schema: z.object({
      guestName: z.string().min(2),
      adults: z.number().int().positive(),
      children: z.number().int().min(0).default(0),
      checkIn: z.string(),
      checkOut: z.string(),
      unitCategory: z.enum(UNIT_CATEGORIES),
      specialRequests: z.string().optional(),
    }),
    summarize: (input) => `Crear reserva sin pago para ${input.guestName}, ${input.checkIn} a ${input.checkOut}, categoria ${input.unitCategory}.`,
    handler: async (input, ctx) => {
      if (!ctx.propertyId) return { ok: false, error: "No hay propiedad resuelta en este contexto." };
      if (!ctx.guestId) return { ok: false, error: "No hay huesped resuelto en este contexto." };

      const checkIn = new Date(input.checkIn);
      const checkOut = new Date(input.checkOut);
      const dateError = validateDateRange(checkIn, checkOut);
      if (dateError) return { ok: false, error: dateError };

      const propertyId = ctx.propertyId;
      const lockKey = `reservation:${propertyId}:${input.unitCategory}:${input.checkIn}:${input.checkOut}`;

      try {
        const result = await withRedisLock(lockKey, 15000, async () => {
          return prisma.$transaction(async (tx) => {
            const totalGuests = input.adults + input.children;
            const candidateUnits = await tx.unit.findMany({
              where: { propertyId, active: true, category: input.unitCategory as any, maximumGuests: { gte: totalGuests } },
              orderBy: { basePrice: "asc" },
            });

            let chosenUnit: (typeof candidateUnits)[number] | null = null;
            for (const unit of candidateUnits) {
              const [reservations, blocks] = await Promise.all([
                tx.reservation.findMany({ where: { unitId: unit.id, status: { in: ACTIVE_STATUSES as any } }, select: { checkIn: true, checkOut: true } }),
                tx.availabilityBlock.findMany({ where: { unitId: unit.id }, select: { startAt: true, endAt: true } }),
              ]);
              const conflict =
                reservations.some((r) => datesOverlap(r.checkIn, r.checkOut, checkIn, checkOut)) ||
                blocks.some((b) => datesOverlap(b.startAt, b.endAt, checkIn, checkOut));
              if (!conflict) {
                chosenUnit = unit;
                break;
              }
            }

            if (!chosenUnit) {
              return { ok: false as const, error: "Ya no hay disponibilidad real para esa categoria/fechas (revalidado en transaccion)." };
            }

            const existingGuest = await tx.guest.findUniqueOrThrow({ where: { id: ctx.guestId! } });
            const guest = await tx.guest.update({
              where: { id: ctx.guestId! },
              data: guestIsPlaceholder(existingGuest)
                ? { firstName: input.guestName.split(" ")[0], lastName: input.guestName.split(" ").slice(1).join(" ") || undefined }
                : {},
            });

            const quote = computeQuote({
              basePrice: Number(chosenUnit.basePrice),
              cleaningFee: Number(chosenUnit.cleaningFee),
              checkIn,
              checkOut,
              taxRate: 0,
            });

            const reservation = await tx.reservation.create({
              data: {
                organizationId: ctx.organizationId,
                propertyId,
                unitId: chosenUnit.id,
                guestId: guest.id,
                source: "WHATSAPP",
                status: "PENDING",
                checkIn,
                checkOut,
                adults: input.adults,
                children: input.children,
                totalGuests,
                subtotal: quote.subtotalBeforeTax,
                taxes: quote.taxes,
                fees: 0,
                totalAmount: quote.total,
                amountPaid: 0,
                currency: "CLP",
                specialRequests: input.specialRequests ?? null,
                syncStatus: "PENDING",
              },
            });

            return { ok: true as const, reservation, quote };
          });
        });

        if (!result.ok) return result;

        // Best-effort side effects that must NOT lose the reservation if they fail.
        const calendar = await createCalendarEvent({
          summary: `Reserva ${result.reservation.id}`,
          description: `Huesped: ${input.guestName}`,
          startDate: input.checkIn,
          endDate: input.checkOut,
        }).catch((err) => ({ eventId: null, synced: false, error: (err as Error).message }));

        let pmsSyncOk = true;
        try {
          const pms = getPMSAdapter();
          await pms.pushReservation({
            externalPropertyId: propertyId,
            externalUnitId: result.reservation.unitId,
            guestName: input.guestName,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            totalAmount: Number(result.reservation.totalAmount),
            currency: result.reservation.currency,
          });
        } catch {
          pmsSyncOk = false;
        }

        const finalReservation = await prisma.reservation.update({
          where: { id: result.reservation.id },
          data: {
            calendarEventId: calendar.eventId ?? undefined,
            syncStatus: pmsSyncOk ? "SYNCED" : "FAILED",
          },
        });

        return {
          ok: true,
          reservationId: finalReservation.id,
          status: finalReservation.status,
          totalAmount: Number(finalReservation.totalAmount),
          currency: finalReservation.currency,
          calendarSynced: calendar.synced,
          pmsSynced: pmsSyncOk,
        };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
  }),

  // NOTE on request_reschedule / request_cancellation / issue_refund: their
  // actionType is LEVEL_2/LEVEL_3, so the tool-execution loop (tool-loop.ts)
  // intercepts the call BEFORE reaching this handler and creates an
  // ApprovalRequest instead. These handler bodies are the REAL execution
  // logic and only run once via services/approvals/execute-approval.ts,
  // after a human has approved -- and that path re-validates the entity's
  // current state first (see execute-approval.ts).
  defineTool({
    name: "request_reschedule",
    description: "Cambia las fechas de una reserva existente. Nivel 2: solo se ejecuta tras aprobacion humana (hay diferencia de tarifa).",
    actionType: "reschedule_with_fare_delta",
    schema: z.object({ reservationId: z.string(), newCheckIn: z.string(), newCheckOut: z.string(), reason: z.string().optional() }),
    summarize: (input) => `Reprogramar reserva ${input.reservationId} a ${input.newCheckIn} - ${input.newCheckOut}.`,
    handler: async (input, ctx) => {
      const reservation = await prisma.reservation.findFirst({ where: { id: input.reservationId, organizationId: ctx.organizationId }, include: { unit: true } });
      if (!reservation) return { ok: false, error: "Reserva no encontrada." };
      const newCheckIn = new Date(input.newCheckIn);
      const newCheckOut = new Date(input.newCheckOut);
      const dateError = validateDateRange(newCheckIn, newCheckOut);
      if (dateError) return { ok: false, error: dateError };
      const availability = await checkAvailability({ unitId: reservation.unitId, checkIn: newCheckIn, checkOut: newCheckOut, excludeReservationId: reservation.id });
      if (!availability.available) return { ok: false, error: "Ya no hay disponibilidad real para las nuevas fechas." };
      const newQuote = computeQuote({ basePrice: Number(reservation.unit.basePrice), cleaningFee: Number(reservation.unit.cleaningFee), checkIn: newCheckIn, checkOut: newCheckOut, taxRate: 0 });
      const updated = await prisma.reservation.update({
        where: { id: reservation.id },
        data: { checkIn: newCheckIn, checkOut: newCheckOut, subtotal: newQuote.subtotalBeforeTax, taxes: newQuote.taxes, totalAmount: newQuote.total },
      });
      return { ok: true, reservationId: updated.id, newTotal: newQuote.total, fareDelta: newQuote.total - Number(reservation.totalAmount) };
    },
  }),

  defineTool({
    name: "request_cancellation",
    description: "Cancela una reserva. Nivel 3: solo se ejecuta tras aprobacion humana + segunda confirmacion.",
    actionType: "cancel_paid_reservation",
    schema: z.object({ reservationId: z.string(), reason: z.string() }),
    summarize: (input) => `Cancelar reserva ${input.reservationId}. Motivo: ${input.reason}`,
    handler: async (input, ctx) => {
      const reservation = await prisma.reservation.findFirst({ where: { id: input.reservationId, organizationId: ctx.organizationId } });
      if (!reservation) return { ok: false, error: "Reserva no encontrada." };
      const updated = await prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: "CANCELLED", internalNotes: `${reservation.internalNotes ?? ""}\nCancelada: ${input.reason}`.trim() },
      });
      return { ok: true, reservationId: updated.id, amountPaid: Number(reservation.amountPaid), refundNeeded: Number(reservation.amountPaid) > 0 };
    },
  }),

  defineTool({
    name: "issue_refund",
    description: "Reembolsa un monto pagado de una reserva. Nivel 3: solo se ejecuta tras aprobacion humana y con ENABLE_FINANCIAL_ACTIONS=true.",
    actionType: "issue_refund",
    schema: z.object({ reservationId: z.string(), amount: z.number().positive(), reason: z.string() }),
    summarize: (input) => `Reembolsar ${input.amount} de la reserva ${input.reservationId}. Motivo: ${input.reason}`,
    handler: async (input, ctx) => {
      const reservation = await prisma.reservation.findFirst({ where: { id: input.reservationId, organizationId: ctx.organizationId } });
      if (!reservation) return { ok: false, error: "Reserva no encontrada." };
      if (!reservation.paymentUrl) return { ok: false, error: "La reserva no tiene un pago asociado para reembolsar." };
      const payments = getPaymentAdapter();
      const externalId = reservation.paymentUrl.split("/").pop()!;
      const result = await payments.refund(externalId, input.amount);
      await prisma.reservation.update({ where: { id: reservation.id }, data: { amountPaid: { decrement: input.amount } } });
      return { ok: true, ...result };
    },
  }),

  defineTool({
    name: "send_payment_link",
    description: "Genera y envia un link de pago para una reserva pendiente.",
    actionType: "create_note",
    schema: z.object({ reservationId: z.string() }),
    handler: async (input, ctx) => {
      const reservation = await prisma.reservation.findFirst({ where: { id: input.reservationId, organizationId: ctx.organizationId } });
      if (!reservation) return { ok: false, error: "Reserva no encontrada." };
      const payments = getPaymentAdapter();
      const link = await payments.createPaymentLink({
        amount: Number(reservation.totalAmount) - Number(reservation.amountPaid),
        currency: reservation.currency,
        description: `Pago reserva ${reservation.id}`,
        referenceId: reservation.id,
      });
      await prisma.reservation.update({ where: { id: reservation.id }, data: { paymentUrl: link.url, status: "AWAITING_PAYMENT" } });
      return { ok: true, url: link.url, externalId: link.externalId };
    },
  }),

  defineTool({
    name: "verify_payment_status",
    description: "Verifica con el proveedor de pagos si una reserva ya fue pagada. Nunca digas que un pago esta confirmado sin llamar esto.",
    actionType: "read_reservation",
    schema: z.object({ reservationId: z.string() }),
    handler: async (input, ctx) => {
      const reservation = await prisma.reservation.findFirst({ where: { id: input.reservationId, organizationId: ctx.organizationId } });
      if (!reservation) return { ok: false, error: "Reserva no encontrada." };
      if (!reservation.paymentUrl) return { ok: false, error: "Esta reserva no tiene un link de pago generado aun." };
      const payments = getPaymentAdapter();
      const externalId = reservation.paymentUrl.split("/").pop()!;
      const status = await payments.verifyPaymentStatus(externalId);
      if (status.status === "PAID") {
        await prisma.reservation.update({
          where: { id: reservation.id },
          data: { status: "CONFIRMED", amountPaid: status.paidAmount ?? Number(reservation.totalAmount) },
        });
      }
      return status;
    },
  }),

  defineTool({
    name: "get_access_instructions",
    description:
      "Entrega instrucciones/codigo de acceso a la unidad. SOLO si la reserva esta CONFIRMED, la identidad coincide, estamos en la ventana autorizada y la politica lo permite (ENABLE_DOOR_CODE_SHARING).",
    actionType: "share_access_code",
    schema: z.object({ reservationId: z.string() }),
    summarize: (input) => `Compartir codigo de acceso para reserva ${input.reservationId}.`,
    handler: async (input, ctx) => {
      const reservation = await prisma.reservation.findFirst({
        where: { id: input.reservationId, organizationId: ctx.organizationId, ...(ctx.guestId ? { guestId: ctx.guestId } : {}) },
        include: { unit: { include: { secrets: true } } },
      });
      if (!reservation) return { ok: false, error: "Reserva no encontrada o no pertenece a este huesped." };
      if (reservation.status !== "CONFIRMED" && reservation.status !== "CHECKED_IN") {
        return { ok: false, error: "La reserva aun no esta confirmada; no se puede compartir el codigo de acceso." };
      }
      const now = new Date();
      const secret = reservation.unit.secrets.find((s) => s.secretType === "DOOR_CODE" && (!s.visibleFrom || s.visibleFrom <= now) && (!s.visibleUntil || s.visibleUntil >= now));
      if (!secret) return { ok: false, error: "No hay un codigo de acceso vigente para esta ventana de fechas." };
      if (!env.ENABLE_DOOR_CODE_SHARING) {
        return { ok: false, error: "Compartir codigos de acceso esta deshabilitado por politica (ENABLE_DOOR_CODE_SHARING=false)." };
      }
      return { ok: true, code: decryptSecret(secret.encryptedValue) };
    },
  }),

  defineTool({
    name: "escalate_to_human",
    description: "Escala la conversacion a un humano (emergencias, informacion faltante, o cuando el huesped lo pide).",
    actionType: "create_internal_ticket",
    schema: z.object({ reason: z.string(), urgency: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"), question: z.string().optional() }),
    handler: async (input, ctx) => {
      if (!ctx.conversationId) return { ok: false, error: "No hay conversacion en este contexto." };
      await prisma.conversation.update({
        where: { id: ctx.conversationId },
        data: { status: "ESCALATED", urgency: input.urgency },
      });
      return { ok: true, escalated: true, reason: input.reason };
    },
  }),
];

function guestIsPlaceholder(guest: { firstName: string }): boolean {
  return !guest.firstName || guest.firstName === "Huesped" || guest.firstName === "Guest";
}

// Re-export for tests / seed scripts that want to store an access code correctly.
export { encryptSecret };
