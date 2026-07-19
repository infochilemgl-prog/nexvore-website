import { prisma } from "../../utils/prisma";

/**
 * Deterministic phone -> property/guest/conversation resolution for inbound
 * WhatsApp messages. This is plain code, not an LLM call: routing a message
 * to the wrong property/tenant would be a tenant-isolation breach, so it
 * must never depend on model output.
 */
export async function resolvePropertyByWhatsAppNumber(toNumber: string) {
  return prisma.property.findFirst({ where: { whatsappNumber: toNumber, active: true } });
}

export async function findOrCreateGuestByPhone(organizationId: string, phone: string) {
  const existing = await prisma.guest.findFirst({ where: { organizationId, phone } });
  if (existing) return existing;
  return prisma.guest.create({
    data: { organizationId, firstName: "Huesped", phone, preferredLanguage: "es" },
  });
}

export async function findOrCreateConversation(input: {
  organizationId: string;
  propertyId: string;
  guestId: string;
  channel: "WHATSAPP" | "VOICE" | "EMAIL" | "WEBCHAT" | "PMS" | "INTERNAL";
  externalThreadId: string;
}) {
  const existing = await prisma.conversation.findFirst({
    where: {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      guestId: input.guestId,
      channel: input.channel,
      status: { in: ["OPEN", "PENDING_HUMAN", "PENDING_APPROVAL"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  return prisma.conversation.create({
    data: {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      guestId: input.guestId,
      channel: input.channel,
      externalThreadId: input.externalThreadId,
      status: "OPEN",
    },
  });
}
