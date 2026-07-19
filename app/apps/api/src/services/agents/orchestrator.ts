import { prisma } from "../../utils/prisma";
import { wrapGuestMessage } from "../../utils/untrusted-content";
import { getAgentDefinition } from "./definitions";
import { runAgentToolLoop } from "./tool-loop";
import type { AIMessage } from "../ai/types";
import type { ToolContext } from "../../tools/types";

/**
 * operations_orchestrator: resolves org/property/guest/reservation context
 * (already done by the caller -- see webhooks.routes.ts) and classifies
 * intent to route to a specialized agent.
 *
 * Intent classification here is deliberately DETERMINISTIC keyword/context
 * matching rather than an extra LLM call: it's the routing layer, so keeping
 * it fast, free and 100% predictable is a feature, not a shortcut. The
 * specialized agent picked below is the one that actually holds the AI
 * conversation (real or mock) and calls tools.
 */
const INTENT_RULES: Array<{ agent: string; pattern: RegExp }> = [
  { agent: "maintenance", pattern: /\b(gas|incendio|fuego|humo|no funciona|se corto|se corta|fuga|inundaci|wifi|internet|aire acondicionado|calefaccion|cerradura|electricidad|luz|agua caliente|roto|rota|averiad)/i },
  { agent: "reservations", pattern: /\b(reservar|reserva|disponibilidad|habitacion|cabin|cuarto|cotizacion|precio|check-?in|check-?out|cancelar|reprogramar|fecha)/i },
  { agent: "concierge", pattern: /\b(recomendaci|restaurant|tour|paseo|actividad|spa|transporte)/i },
];

const STICKY_AGENTS = new Set(["reservations", "maintenance"]);

export function classifyIntent(messageText: string): string {
  for (const rule of INTENT_RULES) {
    if (rule.pattern.test(messageText)) return rule.agent;
  }
  return "guest_communications";
}

export interface OrchestratorInput {
  organizationId: string;
  propertyId: string;
  guestId: string;
  conversationId: string;
  guestMessageText: string;
  guestLanguage?: string;
}

export interface OrchestratorResult {
  agentUsed: string;
  finalText: string;
  toolsUsed: Array<{ name: string; input: unknown; output: unknown; requiresApproval: boolean }>;
  success: boolean;
}

export async function runOrchestrator(input: OrchestratorInput): Promise<OrchestratorResult> {
  const [property, priorMessages, conversation] = await Promise.all([
    prisma.property.findFirst({ where: { id: input.propertyId, organizationId: input.organizationId }, include: { organization: true } }),
    prisma.message.findMany({ where: { conversationId: input.conversationId }, orderBy: { createdAt: "asc" }, take: 30 }),
    prisma.conversation.findUnique({ where: { id: input.conversationId } }),
  ]);

  if (!property) {
    return { agentUsed: "none", finalText: "Propiedad no encontrada.", toolsUsed: [], success: false };
  }

  // Sticky routing: once a conversation is mid-flow with reservations or
  // maintenance (multi-turn, field-by-field flows), keep routing to the same
  // agent so "2 personas" or "el 10 de septiembre" (which don't themselves
  // contain reservation keywords) don't fall back to the generalist agent
  // and reset the flow. A fresh maintenance classification (safety keywords)
  // always overrides stickiness, since emergencies must never be missed
  // mid-conversation.
  const freshClassification = classifyIntent(input.guestMessageText);
  let agentName: string;
  if (freshClassification === "maintenance") {
    agentName = "maintenance";
  } else if (conversation?.assignedAgent && STICKY_AGENTS.has(conversation.assignedAgent)) {
    agentName = conversation.assignedAgent;
  } else {
    agentName = freshClassification;
  }
  const agent = getAgentDefinition(agentName) ?? getAgentDefinition("guest_communications")!;

  const history: AIMessage[] = priorMessages.map((m) => ({
    role: m.senderType === "GUEST" ? "user" : "assistant",
    content: m.content,
  }));
  history.push({ role: "user", content: wrapGuestMessage(input.guestMessageText) });

  const systemPrompt = agent.systemPromptBuilder({
    propertyName: property.name,
    organizationName: property.organization.name,
    guestLanguage: input.guestLanguage ?? "es",
    checkInTime: property.checkInTime,
    checkOutTime: property.checkOutTime,
  });

  const ctx: ToolContext = {
    organizationId: input.organizationId,
    propertyId: input.propertyId,
    guestId: input.guestId,
    conversationId: input.conversationId,
    agentName: agent.name,
    actorType: "AGENT",
    actorId: agent.name,
  };

  const result = await runAgentToolLoop({ agent, systemPrompt, history, ctx });

  await prisma.conversation.update({
    where: { id: input.conversationId },
    data: { assignedAgent: agent.name, lastMessageAt: new Date() },
  });

  return { agentUsed: agent.name, finalText: result.finalText, toolsUsed: result.toolsUsed, success: result.success };
}
