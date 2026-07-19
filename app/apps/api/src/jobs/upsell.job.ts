import { createQueue, createWorker } from "./queue";
import { prisma } from "../utils/prisma";
import { addDays } from "date-fns";

export interface UpsellJobData {
  propertyId: string;
}

export const upsellQueue = createQueue<UpsellJobData>("upsell");

/**
 * Real (if simple) logic: finds confirmed reservations checking in within the
 * next 3 days that have no service bookings yet, as upsell candidates. It
 * only DRAFTS a suggestion (does not book/charge anything).
 */
export async function runUpsellSuggestions(propertyId: string) {
  const upcoming = await prisma.reservation.findMany({
    where: { propertyId, status: "CONFIRMED", checkIn: { gte: new Date(), lte: addDays(new Date(), 3) } },
    include: { serviceBookings: true, guest: true },
  });
  const candidates = upcoming.filter((r) => r.serviceBookings.length === 0);
  return {
    propertyId,
    candidates: candidates.map((r) => ({ reservationId: r.id, guestName: `${r.guest.firstName} ${r.guest.lastName ?? ""}`.trim(), checkIn: r.checkIn })),
  };
}

export function startUpsellWorker() {
  return createWorker<UpsellJobData>("upsell", async (job) => runUpsellSuggestions(job.data.propertyId));
}
