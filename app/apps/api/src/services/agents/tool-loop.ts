import { prisma } from "../../utils/prisma";
import { logger } from "../../config/logger";
import { getAIProvider } from "../ai/provider-factory";
import { getAIToolDefinitions } from "../../tools/registry";
import { getTool } from "../../tools/registry";
import { evaluatePermission, type ActionType } from "../../config/permissions";
import { writeAuditLog } from "../../utils/audit-log";
import { createApprovalRequest } from "../approvals/create-approval";
import type { ToolContext } from "../../tools/types";
import type { AIMessage, AIToolCall } from "../ai/types";
import type { AgentDefinition } from "./types";

export const MAX_TOOL_ITERATIONS = 8;

export interface RunAgentInput {
  agent: AgentDefinition;
  systemPrompt: string;
  history: AIMessage[]; // prior dialogue (user/assistant text turns only)
  ctx: ToolContext;
}

export interface RunAgentResult {
  finalText: string;
  toolsUsed: Array<{ name: string; input: unknown; output: unknown; requiresApproval: boolean }>;
  success: boolean;
  error?: string;
}

/**
 * The generic tool-calling loop used by every agent. Implements:
 *  - MAX_TOOL_ITERATIONS cap
 *  - an AgentExecution record per run
 *  - Zod validation of tool input (via each tool's own schema, enforced in
 *    the handler's call site through getTool)
 *  - four-tier permission evaluation before every tool call
 *  - ApprovalRequest creation instead of execution when required
 *  - AuditLog on every executed tool call
 *  - a guard against calling the same tool with identical args repeatedly
 */
export async function runAgentToolLoop(input: RunAgentInput): Promise<RunAgentResult> {
  const { agent, ctx } = input;
  const provider = getAIProvider();
  const tools = getAIToolDefinitions(agent.allowedTools);
  const startedAt = Date.now();

  const messages: AIMessage[] = [...input.history];
  const toolsUsed: RunAgentResult["toolsUsed"] = [];
  const seenCalls = new Set<string>();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalText = "";
  let success = true;
  let error: string | undefined;

  const mockHint = JSON.stringify({
    agentName: agent.name,
    organizationId: ctx.organizationId,
    propertyId: ctx.propertyId,
    guestId: ctx.guestId,
    conversationId: ctx.conversationId,
    propertyType: ctx.propertyType,
  });

  try {
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const completion = await provider.complete({ system: input.systemPrompt, messages, tools, mockHint });
      totalInputTokens += completion.usage.inputTokens;
      totalOutputTokens += completion.usage.outputTokens;

      if (completion.toolCalls.length === 0) {
        finalText = completion.content;
        break;
      }

      messages.push({ role: "assistant", content: completion.content, toolCalls: completion.toolCalls });

      for (const call of completion.toolCalls) {
        const signature = `${call.name}:${JSON.stringify(call.input)}`;
        if (seenCalls.has(signature)) {
          messages.push({
            role: "tool",
            toolCallId: call.id,
            toolName: call.name,
            content: JSON.stringify({ error: "Esta herramienta ya fue llamada con los mismos argumentos en este turno. Usa el resultado anterior en vez de repetir la llamada." }),
          });
          continue;
        }
        seenCalls.add(signature);

        const result = await executeToolCall(call, agent, ctx);
        toolsUsed.push({ name: call.name, input: call.input, output: result.output, requiresApproval: result.requiresApproval });
        messages.push({ role: "tool", toolCallId: call.id, toolName: call.name, content: JSON.stringify(result.output) });
      }

      if (iteration === MAX_TOOL_ITERATIONS - 1) {
        throw new Error(`Se alcanzo MAX_TOOL_ITERATIONS (${MAX_TOOL_ITERATIONS}) sin llegar a una respuesta final.`);
      }
    }
  } catch (err) {
    success = false;
    error = (err as Error).message;
    finalText = "Tuve un problema procesando tu mensaje. Ya notifique a nuestro equipo para que te ayude directamente.";
    logger.error({ err, agent: agent.name, conversationId: ctx.conversationId }, "Fallo en tool-loop del agente");
  }

  await prisma.agentExecution.create({
    data: {
      agentName: agent.name,
      propertyId: ctx.propertyId ?? null,
      conversationId: ctx.conversationId ?? null,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      estimatedCost: estimateCost(totalInputTokens, totalOutputTokens),
      durationMs: Date.now() - startedAt,
      toolsUsed: toolsUsed.map((t) => ({ name: t.name, requiresApproval: t.requiresApproval })) as any,
      success,
      error: error ?? null,
    },
  });

  return { finalText, toolsUsed, success, error };
}

async function executeToolCall(
  call: AIToolCall,
  agent: AgentDefinition,
  ctx: ToolContext
): Promise<{ output: unknown; requiresApproval: boolean }> {
  const tool = getTool(call.name);
  if (!tool || !agent.allowedTools.includes(call.name)) {
    return { output: { error: `Herramienta no permitida para el agente ${agent.name}: ${call.name}` }, requiresApproval: false };
  }

  const parsed = tool.schema.safeParse(call.input);
  if (!parsed.success) {
    return { output: { error: "Argumentos invalidos", details: parsed.error.flatten() }, requiresApproval: false };
  }

  const decision = evaluatePermission(tool.actionType as ActionType, { actorType: ctx.actorType });

  if (!decision.allowed) {
    await writeAuditLog({
      actorId: ctx.actorId ?? agent.name,
      actorType: ctx.actorType,
      action: call.name,
      entityType: "tool_call",
      beforeData: parsed.data as any,
      reason: decision.reason,
      riskLevel: decision.riskLevel,
      organizationId: ctx.organizationId,
      propertyId: ctx.propertyId ?? null,
      success: false,
      error: decision.reason,
    });
    return { output: { error: decision.reason }, requiresApproval: false };
  }

  if (decision.requiresApproval) {
    const summary = tool.summarize ? tool.summarize(parsed.data) : `${call.name} solicitado por ${agent.name}`;
    const approval = await createApprovalRequest({
      organizationId: ctx.organizationId,
      requestedByAgent: agent.name,
      actionType: tool.actionType,
      riskLevel: decision.riskLevel,
      entityType: call.name,
      summary,
      payload: { toolName: call.name, toolInput: parsed.data },
      expiresInHours: 48,
    });
    await writeAuditLog({
      actorId: ctx.actorId ?? agent.name,
      actorType: ctx.actorType,
      action: call.name,
      entityType: "approval_request",
      entityId: approval.id,
      beforeData: parsed.data as any,
      reason: decision.reason,
      riskLevel: decision.riskLevel,
      approvalStatus: "PENDING",
      organizationId: ctx.organizationId,
      propertyId: ctx.propertyId ?? null,
      success: true,
    });
    return {
      output: { pendingApproval: true, approvalRequestId: approval.id, message: "Esta accion fue enviada a revision humana (no se ejecuto todavia)." },
      requiresApproval: true,
    };
  }

  try {
    const output = await tool.handler(parsed.data, ctx);
    await writeAuditLog({
      actorId: ctx.actorId ?? agent.name,
      actorType: ctx.actorType,
      action: call.name,
      entityType: call.name,
      afterData: output as any,
      beforeData: parsed.data as any,
      riskLevel: decision.riskLevel,
      organizationId: ctx.organizationId,
      propertyId: ctx.propertyId ?? null,
      success: true,
    });
    return { output, requiresApproval: false };
  } catch (err) {
    await writeAuditLog({
      actorId: ctx.actorId ?? agent.name,
      actorType: ctx.actorType,
      action: call.name,
      entityType: call.name,
      beforeData: parsed.data as any,
      riskLevel: decision.riskLevel,
      organizationId: ctx.organizationId,
      propertyId: ctx.propertyId ?? null,
      success: false,
      error: (err as Error).message,
    });
    return { output: { error: (err as Error).message }, requiresApproval: false };
  }
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  // Rough Claude Sonnet-class pricing estimate: $3/1M in, $15/1M out.
  return Number(((inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15).toFixed(6));
}
