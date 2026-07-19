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

/**
 * Date granularity for the "is this in the past" check:
 *  - "DATE": whole-day granularity (hotel/vacation-rental stays). checkIn is compared against
 *    the start of today only, so a same-day checkIn (regardless of clock time, since hotel
 *    dates carry no meaningful time-of-day) is never rejected as "past".
 *  - "DATETIME": exact-timestamp granularity (restaurant table bookings, or anything booked in
 *    hour/minute-sized windows). checkIn is compared against the exact current instant, so a
 *    same-day slot that already elapsed (e.g. booking today at 13:00 when it's already 15:00)
 *    is correctly rejected -- the coarse "DATE" check would have let it through, which is the
 *    hotel-oriented assumption this distinction exists to fix.
 */
export type DateGranularity = "DATE" | "DATETIME";

export function validateDateRange(
  checkIn: Date,
  checkOut: Date,
  now: Date = new Date(),
  granularity: DateGranularity = "DATE"
): string | null {
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) return "Fechas invalidas.";
  if (checkOut.getTime() <= checkIn.getTime()) return "La fecha de salida debe ser posterior a la fecha de entrada.";
  if (granularity === "DATETIME") {
    if (checkIn.getTime() < now.getTime()) return "Ese horario ya paso. Elegi un horario futuro.";
  } else {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (checkIn.getTime() < today.getTime()) return "La fecha de entrada no puede ser en el pasado.";
  }
  return null;
}

export interface RestaurantServiceWindowProperty {
  closedWeekdays?: unknown;
  lunchOpen?: string | null;
  lunchClose?: string | null;
  dinnerOpen?: string | null;
  dinnerClose?: string | null;
}

/**
 * Validates that a requested checkIn instant falls inside the restaurant's lunch or dinner
 * service window and isn't on a closed weekday. Mirrors `validarVentanaDeServicio` from the
 * original single-tenant restaurant build, generalized onto `Property`.
 *
 * NOTE (known simplification): compares using the server's local calendar day/time
 * (`Date#getDay`/`getHours`), not `property.timezone`. Fine for this single-region demo
 * (America/Santiago); a production multi-region deployment should convert `checkIn` into the
 * property's timezone first (e.g. via `date-fns-tz`) before extracting weekday/hour.
 */
export function validateRestaurantServiceWindow(property: RestaurantServiceWindowProperty, checkIn: Date): string | null {
  const closedWeekdays = Array.isArray(property.closedWeekdays) ? (property.closedWeekdays as unknown[]).map(Number) : [];
  const weekday = checkIn.getDay();
  if (closedWeekdays.includes(weekday)) {
    return "El restaurante esta cerrado ese dia. Proba con otra fecha.";
  }

  const hhmm = `${String(checkIn.getHours()).padStart(2, "0")}:${String(checkIn.getMinutes()).padStart(2, "0")}`;
  const hasLunchWindow = Boolean(property.lunchOpen && property.lunchClose);
  const hasDinnerWindow = Boolean(property.dinnerOpen && property.dinnerClose);
  if (!hasLunchWindow && !hasDinnerWindow) return null; // no windows configured -> don't block

  const inLunch = hasLunchWindow && hhmm >= property.lunchOpen! && hhmm < property.lunchClose!;
  const inDinner = hasDinnerWindow && hhmm >= property.dinnerOpen! && hhmm < property.dinnerClose!;
  if (!inLunch && !inDinner) {
    const lunchPart = hasLunchWindow ? `almuerzo ${property.lunchOpen}-${property.lunchClose}` : null;
    const dinnerPart = hasDinnerWindow ? `cena ${property.dinnerOpen}-${property.dinnerClose}` : null;
    return `Ese horario esta fuera del horario de atencion (${[lunchPart, dinnerPart].filter(Boolean).join(", ")}).`;
  }
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
