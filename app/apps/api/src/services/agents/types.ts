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
  /** "HOTEL" | "CABIN" | "RESTAURANT" | ... -- drives restaurant-specific prompt branches. */
  propertyType?: string;
  /**
   * Per-organization AI persona name shown to the guest (e.g. "Valentina"). This is the
   * feature-level, per-tenant-configurable name -- never the platform brand ("Nexvore"), which
   * only ever appears in the dashboard, not in guest-facing conversation.
   */
  assistantName?: string;
  extra?: string;
}
