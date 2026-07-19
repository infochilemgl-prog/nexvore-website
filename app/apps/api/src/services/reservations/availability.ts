import { prisma } from "../../utils/prisma";

export interface AvailabilityCheckInput {
  unitId: string;
  checkIn: Date;
  checkOut: Date;
  excludeReservationId?: string;
}

export interface AvailabilityCheckResult {
  available: boolean;
  reason?: string;
  conflicts: Array<{ type: "reservation" | "block"; id: string; checkIn?: string; checkOut?: string; reason?: string }>;
}

const ACTIVE_RESERVATION_STATUSES = ["PENDING", "AWAITING_PAYMENT", "CONFIRMED", "CHECKED_IN"] as const;

/**
 * Deterministic overlap rule (never delegated to the model):
 *   existing.checkIn < requestedCheckOut AND existing.checkOut > requestedCheckIn
 */
export function datesOverlap(existingCheckIn: Date, existingCheckOut: Date, requestedCheckIn: Date, requestedCheckOut: Date): boolean {
  return existingCheckIn < requestedCheckOut && existingCheckOut > requestedCheckIn;
}

export function validateDateRange(checkIn: Date, checkOut: Date, now: Date = new Date()): string | null {
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) return "Fechas invalidas.";
  if (checkOut.getTime() <= checkIn.getTime()) return "La fecha de salida debe ser posterior a la fecha de entrada.";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (checkIn.getTime() < today.getTime()) return "La fecha de entrada no puede ser en el pasado.";
  return null;
}

export async function checkAvailability(input: AvailabilityCheckInput): Promise<AvailabilityCheckResult> {
  const dateError = validateDateRange(input.checkIn, input.checkOut);
  if (dateError) {
    return { available: false, reason: dateError, conflicts: [] };
  }

  const [reservations, blocks] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        unitId: input.unitId,
        status: { in: ACTIVE_RESERVATION_STATUSES as any },
        ...(input.excludeReservationId ? { id: { not: input.excludeReservationId } } : {}),
      },
      select: { id: true, checkIn: true, checkOut: true },
    }),
    prisma.availabilityBlock.findMany({
      where: { unitId: input.unitId },
      select: { id: true, startAt: true, endAt: true, reason: true },
    }),
  ]);

  const conflicts: AvailabilityCheckResult["conflicts"] = [];

  for (const r of reservations) {
    if (datesOverlap(r.checkIn, r.checkOut, input.checkIn, input.checkOut)) {
      conflicts.push({ type: "reservation", id: r.id, checkIn: r.checkIn.toISOString(), checkOut: r.checkOut.toISOString() });
    }
  }
  for (const b of blocks) {
    if (datesOverlap(b.startAt, b.endAt, input.checkIn, input.checkOut)) {
      conflicts.push({ type: "block", id: b.id, reason: b.reason });
    }
  }

  return {
    available: conflicts.length === 0,
    reason: conflicts.length > 0 ? "La unidad tiene reservas o bloqueos que se superponen con esas fechas." : undefined,
    conflicts,
  };
}

/** Finds the first available unit of a given category in a property for a date range. */
export async function findAvailableUnit(propertyId: string, category: string | undefined, checkIn: Date, checkOut: Date, minGuests: number) {
  const units = await prisma.unit.findMany({
    where: {
      propertyId,
      active: true,
      ...(category ? { category: category as any } : {}),
      maximumGuests: { gte: minGuests },
    },
    orderBy: { basePrice: "asc" },
  });

  for (const unit of units) {
    const result = await checkAvailability({ unitId: unit.id, checkIn, checkOut });
    if (result.available) return { unit, availability: result };
  }
  return null;
}
