import { zodToJsonSchema } from "zod-to-json-schema";
import type { AIToolDefinition } from "../services/ai/types";
import type { ToolDefinition } from "./types";

import { reservationsTools } from "./reservations.tools";
import { maintenanceTools } from "./maintenance.tools";
import { knowledgeTools } from "./knowledge.tools";
import { approvalsTools } from "./approvals.tools";
import { servicesTools } from "./services.tools";
import { housekeepingTools } from "./housekeeping.tools";
import { marketingTools } from "./marketing.tools";
import { reportingTools } from "./reporting.tools";

// Tool definitions are declared with their own concrete Zod schema per file
// (for handler input-type safety at the call site); once registered here we
// deliberately widen to ToolDefinition<any> since the registry only needs to
// dispatch by name + validate at runtime via each tool's own `.schema`.
type AnyToolDefinition = ToolDefinition<any>;

const allTools: AnyToolDefinition[] = [
  ...(reservationsTools as AnyToolDefinition[]),
  ...(maintenanceTools as AnyToolDefinition[]),
  ...(knowledgeTools as AnyToolDefinition[]),
  ...(approvalsTools as AnyToolDefinition[]),
  ...(servicesTools as AnyToolDefinition[]),
  ...(housekeepingTools as AnyToolDefinition[]),
  ...(marketingTools as AnyToolDefinition[]),
  ...(reportingTools as AnyToolDefinition[]),
];

export const toolRegistry = new Map<string, AnyToolDefinition>(allTools.map((t) => [t.name, t]));

export function getTool(name: string): AnyToolDefinition | undefined {
  return toolRegistry.get(name);
}

export function getAIToolDefinitions(names: string[]): AIToolDefinition[] {
  return names
    .map((name) => toolRegistry.get(name))
    .filter((t): t is AnyToolDefinition => Boolean(t))
    .map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: zodToJsonSchema(t.schema, { target: "openApi3" }) as Record<string, unknown>,
    }));
}
