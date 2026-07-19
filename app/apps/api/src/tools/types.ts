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
  /** "HOTEL" | "CABIN" | "RESTAURANT" | ... -- lets the mock AI provider branch its scripted
   * flow without re-fetching the Property row itself (real providers don't need this, tools
   * re-fetch propertyType from the DB directly for their own logic). */
  propertyType?: string;
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
