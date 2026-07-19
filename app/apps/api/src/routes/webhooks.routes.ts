import { Router } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { logger } from "../config/logger";
import { whatsappPerNumberRateLimit, whatsappPerPropertyRateLimit } from "../middleware/rate-limit";
import { resolvePropertyByWhatsAppNumber, findOrCreateGuestByPhone, findOrCreateConversation } from "../services/concierge/resolve-context";
import { runOrchestrator } from "../services/agents/orchestrator";
import { sendWhatsAppMessage } from "../integrations/twilio";
import { getVoiceProvider } from "../integrations/voice";

export const webhooksRouter = Router();

const MAX_MESSAGE_LENGTH = 2000;

const twilioWhatsAppBodySchema = z.object({
  From: z.string().min(3), // e.g. "whatsapp:+56912345678"
  To: z.string().min(3),
  Body: z.string().max(MAX_MESSAGE_LENGTH),
  MessageSid: z.string().optional(),
});

// TODO: validar X-Twilio-Signature obligatoriamente en produccion.
webhooksRouter.post("/twilio/whatsapp", whatsappPerNumberRateLimit, whatsappPerPropertyRateLimit, async (req, res) => {
  try {
    const parsed = twilioWhatsAppBodySchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn({ errors: parsed.error.flatten() }, "Payload de webhook WhatsApp invalido");
      return res.status(200).send("<Response></Response>"); // always 200 to avoid Twilio retry storms
    }
    const { From, To, Body, MessageSid } = parsed.data;
    const fromNumber = From.replace(/^whatsapp:/, "");
    const toNumber = To.replace(/^whatsapp:/, "");
    const trimmedBody = Body.slice(0, MAX_MESSAGE_LENGTH);

    const property = await resolvePropertyByWhatsAppNumber(toNumber);
    if (!property) {
      logger.warn({ toNumber }, "Numero de WhatsApp no asociado a ninguna propiedad activa");
      return res.status(200).send("<Response></Response>");
    }

    const guest = await findOrCreateGuestByPhone(property.organizationId, fromNumber);
    const conversation = await findOrCreateConversation({
      organizationId: property.organizationId,
      propertyId: property.id,
      guestId: guest.id,
      channel: "WHATSAPP",
      externalThreadId: fromNumber,
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: "GUEST",
        senderId: guest.id,
        content: trimmedBody,
        messageType: "TEXT",
        metadata: { twilioSid: MessageSid ?? null },
      },
    });

    const result = await runOrchestrator({
      organizationId: property.organizationId,
      propertyId: property.id,
      guestId: guest.id,
      conversationId: conversation.id,
      guestMessageText: trimmedBody,
      guestLanguage: guest.preferredLanguage,
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: "AGENT",
        senderId: result.agentUsed,
        content: result.finalText,
        messageType: "TEXT",
        aiGenerated: true,
        metadata: { toolsUsed: result.toolsUsed.map((t) => t.name) },
      },
    });

    const sendResult = await sendWhatsAppMessage(fromNumber, result.finalText);
    if (!sendResult.sent) {
      logger.info({ reason: sendResult.error }, "Respuesta no enviada por Twilio (modo mock/no configurado); persistida igual en la conversacion");
    }

    return res.status(200).send("<Response></Response>");
  } catch (err) {
    logger.error({ err }, "Error no controlado en webhook de WhatsApp");
    // Always respond 200 even on handled errors, to avoid Twilio retry loops.
    return res.status(200).send("<Response></Response>");
  }
});

// ---------------------------------------------------------------------------
// Voice webhooks (MockVoiceProvider-backed). Real Vapi/Bland integration
// would replace the mock provider behind integrations/voice/index.ts.
// ---------------------------------------------------------------------------

webhooksRouter.post("/voice/incoming", async (req, res) => {
  const voice = getVoiceProvider();
  const { From, To } = req.body ?? {};
  logger.info({ From, To, provider: voice.name }, "Llamada de voz entrante (mock)");
  res.status(200).json({ status: "received", provider: voice.name });
});

webhooksRouter.post("/voice/transcript", async (req, res) => {
  const { callId, text } = req.body ?? {};
  if (!callId || !text) return res.status(200).json({ status: "ignored" });

  const property = await prisma.property.findFirst({ where: { active: true } });
  if (!property) return res.status(200).json({ status: "no_property" });

  const guest = await findOrCreateGuestByPhone(property.organizationId, `voice-${callId}`);
  const conversation = await findOrCreateConversation({
    organizationId: property.organizationId,
    propertyId: property.id,
    guestId: guest.id,
    channel: "VOICE",
    externalThreadId: callId,
  });

  await prisma.message.create({ data: { conversationId: conversation.id, senderType: "GUEST", content: String(text).slice(0, MAX_MESSAGE_LENGTH), messageType: "TEXT" } });

  const result = await runOrchestrator({
    organizationId: property.organizationId,
    propertyId: property.id,
    guestId: guest.id,
    conversationId: conversation.id,
    guestMessageText: String(text).slice(0, MAX_MESSAGE_LENGTH),
  });

  await prisma.message.create({ data: { conversationId: conversation.id, senderType: "AGENT", content: result.finalText, messageType: "TEXT", aiGenerated: true } });

  res.status(200).json({ status: "processed", reply: result.finalText });
});

webhooksRouter.post("/voice/function", async (req, res) => {
  // Placeholder for a Vapi/Bland "function call" webhook -- would map
  // directly onto the same tool registry used by the chat agents.
  res.status(200).json({ status: "not_implemented_mock" });
});

webhooksRouter.post("/voice/end", async (req, res) => {
  const { callId } = req.body ?? {};
  logger.info({ callId }, "Llamada de voz finalizada (mock)");
  res.status(200).json({ status: "ended" });
});
