import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { tenantContext, currentOrgId } from "../middleware/tenant-context";
import { prisma } from "../utils/prisma";
import { assertConversationInOrg } from "../utils/tenant-scope";
import { writeAuditLog } from "../utils/audit-log";
import { sendWhatsAppMessage } from "../integrations/twilio";
import { triageMaintenanceIssue } from "../services/maintenance/triage";

export const conversationsRouter = Router();
conversationsRouter.use(requireAuth, tenantContext);

conversationsRouter.get("/", async (req, res, next) => {
  try {
    const { status, propertyId } = req.query as Record<string, string | undefined>;
    const conversations = await prisma.conversation.findMany({
      where: { organizationId: currentOrgId(req), ...(status ? { status: status as any } : {}), ...(propertyId ? { propertyId } : {}) },
      include: { guest: true, property: true, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
    });
    res.json(conversations);
  } catch (err) {
    next(err);
  }
});

conversationsRouter.get("/:id", async (req, res, next) => {
  try {
    await assertConversationInOrg(req.params.id, currentOrgId(req));
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: { guest: true, property: true, reservation: true, messages: { orderBy: { createdAt: "asc" } } },
    });
    res.json(conversation);
  } catch (err) {
    next(err);
  }
});

const replySchema = z.object({ content: z.string().min(1).max(2000) });
conversationsRouter.post("/:id/reply", async (req, res, next) => {
  try {
    const conversation = await assertConversationInOrg(req.params.id, currentOrgId(req));
    const { content } = replySchema.parse(req.body);
    const message = await prisma.message.create({
      data: { conversationId: conversation.id, senderType: "USER", senderId: req.user!.id, content, messageType: "TEXT" },
    });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date(), status: "OPEN" } });

    if (conversation.channel === "WHATSAPP" && conversation.externalThreadId) {
      await sendWhatsAppMessage(conversation.externalThreadId, content);
    }

    await writeAuditLog({
      actorId: req.user!.id,
      actorType: "HUMAN",
      action: "conversation_reply",
      entityType: "Conversation",
      entityId: conversation.id,
      afterData: { content } as any,
      riskLevel: "LEVEL_1",
      organizationId: currentOrgId(req),
      propertyId: conversation.propertyId,
      success: true,
    });

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

const assignSchema = z.object({ userId: z.string().nullable() });
conversationsRouter.post("/:id/assign", async (req, res, next) => {
  try {
    const conversation = await assertConversationInOrg(req.params.id, currentOrgId(req));
    const { userId } = assignSchema.parse(req.body);
    const updated = await prisma.conversation.update({ where: { id: conversation.id }, data: { assignedUserId: userId } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

conversationsRouter.post("/:id/close", async (req, res, next) => {
  try {
    const conversation = await assertConversationInOrg(req.params.id, currentOrgId(req));
    const updated = await prisma.conversation.update({ where: { id: conversation.id }, data: { status: "CLOSED" } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

const noteSchema = z.object({ content: z.string().min(1).max(2000) });
conversationsRouter.post("/:id/note", async (req, res, next) => {
  try {
    const conversation = await assertConversationInOrg(req.params.id, currentOrgId(req));
    const { content } = noteSchema.parse(req.body);
    const message = await prisma.message.create({
      data: { conversationId: conversation.id, senderType: "SYSTEM", senderId: req.user!.id, content, messageType: "SYSTEM_EVENT" },
    });
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

const ticketFromConvoSchema = z.object({ title: z.string().min(3), description: z.string().min(3) });
conversationsRouter.post("/:id/create-ticket", async (req, res, next) => {
  try {
    const conversation = await assertConversationInOrg(req.params.id, currentOrgId(req));
    const { title, description } = ticketFromConvoSchema.parse(req.body);
    const triage = triageMaintenanceIssue(description);
    const unit = await prisma.unit.findFirst({ where: { propertyId: conversation.propertyId, active: true } });
    if (!unit) return res.status(400).json({ error: "La propiedad no tiene unidades activas." });
    const ticket = await prisma.maintenanceTicket.create({
      data: {
        organizationId: currentOrgId(req),
        propertyId: conversation.propertyId,
        unitId: unit.id,
        guestId: conversation.guestId,
        title,
        description,
        category: triage.category,
        urgency: triage.urgency,
        status: "OPEN",
        source: "STAFF_REPORT",
      },
    });
    await writeAuditLog({
      actorId: req.user!.id,
      actorType: "HUMAN",
      action: "create_ticket_from_conversation",
      entityType: "MaintenanceTicket",
      entityId: ticket.id,
      afterData: ticket as any,
      riskLevel: "LEVEL_1",
      organizationId: currentOrgId(req),
      propertyId: conversation.propertyId,
      success: true,
    });
    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
});
