import { prisma } from "./prisma";

/**
 * Multi-tenant isolation helper. NEVER fetch an operational entity by raw id
 * without going through one of these -- they always filter by organizationId
 * (and propertyId where applicable) first, so a caller from Org A can never
 * read/write Org B's data even if it knows a valid id.
 */

export class TenantAccessError extends Error {
  constructor(entity: string) {
    super(`Acceso denegado: ${entity} no pertenece a la organizacion/propiedad del solicitante.`);
    this.name = "TenantAccessError";
  }
}

export async function assertPropertyInOrg(propertyId: string, organizationId: string) {
  const property = await prisma.property.findFirst({ where: { id: propertyId, organizationId } });
  if (!property) throw new TenantAccessError("Property");
  return property;
}

export async function assertUnitInProperty(unitId: string, propertyId: string) {
  const unit = await prisma.unit.findFirst({ where: { id: unitId, propertyId } });
  if (!unit) throw new TenantAccessError("Unit");
  return unit;
}

export async function assertGuestInOrg(guestId: string, organizationId: string) {
  const guest = await prisma.guest.findFirst({ where: { id: guestId, organizationId } });
  if (!guest) throw new TenantAccessError("Guest");
  return guest;
}

export async function assertReservationInOrg(reservationId: string, organizationId: string, propertyId?: string) {
  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, organizationId, ...(propertyId ? { propertyId } : {}) },
  });
  if (!reservation) throw new TenantAccessError("Reservation");
  return reservation;
}

export async function assertConversationInOrg(conversationId: string, organizationId: string) {
  const conversation = await prisma.conversation.findFirst({ where: { id: conversationId, organizationId } });
  if (!conversation) throw new TenantAccessError("Conversation");
  return conversation;
}

/** Standard where-clause fragment builder for org-scoped list queries. */
export function orgScope(organizationId: string) {
  return { organizationId };
}

export function orgPropertyScope(organizationId: string, propertyId?: string) {
  return propertyId ? { organizationId, propertyId } : { organizationId };
}
