import type { ZodTypeAny, z } from "zod";
import type { ActionType } from "../config/permissions";

export interface ToolContext {
  organizationId: string;
  propertyId?: string;
  guestId?: string;
  conversationId?: string;
  agentName: string;
  actorType: "AGENT" | "HUMAN" | "SYSTEM";
  actorId?: string;
}

export interface ToolDefinition<TSchema extends ZodTypeAny = ZodTypeAny> {
  name: string;
  description: string;
  actionType: ActionType;
  schema: TSchema;
  /** Human-readable summary builder, used when the action requires an ApprovalRequest. */
  summarize?: (input: z.infer<TSchema>) => string;
  handler: (input: z.infer<TSchema>, ctx: ToolContext) => Promise<unknown>;
}

export function defineTool<TSchema extends ZodTypeAny>(def: ToolDefinition<TSchema>): ToolDefinition<TSchema> {
  return def;
}
