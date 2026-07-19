import type { RiskLevel } from "../../config/permissions";

export interface AgentDefinition {
  name: string;
  displayName: string;
  scope: string;
  allowedTools: string[];
  forbiddenTools?: string[];
  maxRiskLevel: RiskLevel;
  systemPromptBuilder: (context: AgentPromptContext) => string;
}

export interface AgentPromptContext {
  propertyName?: string;
  organizationName?: string;
  guestLanguage: string;
  checkInTime?: string;
  checkOutTime?: string;
  extra?: string;
}
