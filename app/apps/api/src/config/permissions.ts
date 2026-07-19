import { env } from "./env";

/**
 * The four-tier action risk model (spec section on non-negotiable principles).
 *
 * LEVEL_0 - read only, always auto.
 * LEVEL_1 - low-risk write, auto ONLY if deterministic rules pass AND the
 *           ENABLE_AUTOMATIC_LOW_RISK_ACTIONS flag is on.
 * LEVEL_2 - always creates an ApprovalRequest, never executes directly.
 * LEVEL_3 - always creates an ApprovalRequest AND requires a second explicit
 *           confirmation step before executing; financial ones are additionally
 *           gated behind ENABLE_FINANCIAL_ACTIONS.
 */
export type RiskLevel = "LEVEL_0" | "LEVEL_1" | "LEVEL_2" | "LEVEL_3";

export type ActionType =
  // Level 0 - read
  | "read_manual"
  | "read_availability"
  | "read_reservation"
  | "read_services"
  | "read_conversation_history"
  | "read_tickets"
  | "read_calendar"
  | "read_analytics"
  // Level 1 - low risk write
  | "create_draft_message"
  | "create_internal_ticket"
  | "create_note"
  | "classify_conversation"
  | "schedule_internal_task"
  | "mark_message_processed"
  | "create_unpaid_reservation"
  | "create_housekeeping_task"
  // Level 2 - human approval required
  | "request_contractor_quote"
  | "change_price"
  | "apply_out_of_policy_discount"
  | "reschedule_with_fare_delta"
  | "issue_compensation"
  | "issue_invoice"
  | "change_paid_service_date"
  | "authorize_third_party_access"
  | "send_mass_campaign"
  | "change_public_listing_content"
  // Level 3 - never auto, needs approval + second confirmation
  | "issue_refund"
  | "cancel_paid_reservation"
  | "charge_card"
  | "delete_data"
  | "delete_property"
  | "share_access_code"
  | "change_bank_credentials"
  | "disconnect_critical_integration"
  | "charge_deposit_damage"
  | "pay_vendor";

export const ACTION_RISK_LEVEL: Record<ActionType, RiskLevel> = {
  read_manual: "LEVEL_0",
  read_availability: "LEVEL_0",
  read_reservation: "LEVEL_0",
  read_services: "LEVEL_0",
  read_conversation_history: "LEVEL_0",
  read_tickets: "LEVEL_0",
  read_calendar: "LEVEL_0",
  read_analytics: "LEVEL_0",

  create_draft_message: "LEVEL_1",
  create_internal_ticket: "LEVEL_1",
  create_note: "LEVEL_1",
  classify_conversation: "LEVEL_1",
  schedule_internal_task: "LEVEL_1",
  mark_message_processed: "LEVEL_1",
  create_unpaid_reservation: "LEVEL_1",
  create_housekeeping_task: "LEVEL_1",

  request_contractor_quote: "LEVEL_2",
  change_price: "LEVEL_2",
  apply_out_of_policy_discount: "LEVEL_2",
  reschedule_with_fare_delta: "LEVEL_2",
  issue_compensation: "LEVEL_2",
  issue_invoice: "LEVEL_2",
  change_paid_service_date: "LEVEL_2",
  authorize_third_party_access: "LEVEL_2",
  send_mass_campaign: "LEVEL_2",
  change_public_listing_content: "LEVEL_2",

  issue_refund: "LEVEL_3",
  cancel_paid_reservation: "LEVEL_3",
  charge_card: "LEVEL_3",
  delete_data: "LEVEL_3",
  delete_property: "LEVEL_3",
  share_access_code: "LEVEL_3",
  change_bank_credentials: "LEVEL_3",
  disconnect_critical_integration: "LEVEL_3",
  charge_deposit_damage: "LEVEL_3",
  pay_vendor: "LEVEL_3",
};

const FINANCIAL_ACTIONS = new Set<ActionType>([
  "issue_refund",
  "charge_card",
  "charge_deposit_damage",
  "pay_vendor",
  "issue_compensation",
  "issue_invoice",
  "apply_out_of_policy_discount",
  "change_price",
  "reschedule_with_fare_delta",
]);

export interface ActorContext {
  actorType: "HUMAN" | "AGENT" | "SYSTEM";
  actorRole?: string; // UserRole when actorType === HUMAN
}

export interface PermissionDecision {
  allowed: boolean;
  requiresApproval: boolean;
  riskLevel: RiskLevel;
  isFinancial: boolean;
  reason: string;
}

/**
 * Central permission-evaluation function. This is the single source of truth
 * for "can this actor do this action right now, and does it need approval".
 * Every tool execution path (apps/api/src/services/agents/tool-loop.ts) and
 * every approval-execution path (services/approvals) MUST call this.
 */
export function evaluatePermission(actionType: ActionType, actor: ActorContext): PermissionDecision {
  const riskLevel = ACTION_RISK_LEVEL[actionType];
  const isFinancial = FINANCIAL_ACTIONS.has(actionType);

  if (riskLevel === "LEVEL_0") {
    return { allowed: true, requiresApproval: false, riskLevel, isFinancial, reason: "Lectura, siempre permitida." };
  }

  if (riskLevel === "LEVEL_1") {
    if (actor.actorType === "HUMAN") {
      return { allowed: true, requiresApproval: false, riskLevel, isFinancial, reason: "Accion humana de bajo riesgo." };
    }
    if (!env.ENABLE_AUTOMATIC_LOW_RISK_ACTIONS) {
      return {
        allowed: true,
        requiresApproval: true,
        riskLevel,
        isFinancial,
        reason: "Acciones automaticas de bajo riesgo deshabilitadas por configuracion (ENABLE_AUTOMATIC_LOW_RISK_ACTIONS=false).",
      };
    }
    return { allowed: true, requiresApproval: false, riskLevel, isFinancial, reason: "Bajo riesgo, reglas deterministicas deben validarse en el tool handler." };
  }

  if (riskLevel === "LEVEL_2") {
    if (isFinancial && !env.ENABLE_FINANCIAL_ACTIONS) {
      return {
        allowed: false,
        requiresApproval: false,
        riskLevel,
        isFinancial,
        reason: "Acciones financieras deshabilitadas por configuracion (ENABLE_FINANCIAL_ACTIONS=false).",
      };
    }
    return {
      allowed: true,
      requiresApproval: true,
      riskLevel,
      isFinancial,
      reason: "Nivel 2: requiere ApprovalRequest y aprobacion humana antes de ejecutar.",
    };
  }

  // LEVEL_3
  if (isFinancial && !env.ENABLE_FINANCIAL_ACTIONS) {
    return {
      allowed: false,
      requiresApproval: false,
      riskLevel,
      isFinancial,
      reason: "Acciones financieras deshabilitadas por configuracion (ENABLE_FINANCIAL_ACTIONS=false).",
    };
  }
  if (actionType === "share_access_code" && !env.ENABLE_DOOR_CODE_SHARING) {
    return {
      allowed: false,
      requiresApproval: false,
      riskLevel,
      isFinancial,
      reason: "Compartir codigos de acceso deshabilitado por configuracion (ENABLE_DOOR_CODE_SHARING=false).",
    };
  }
  return {
    allowed: true,
    requiresApproval: true,
    riskLevel,
    isFinancial,
    reason: "Nivel 3: nunca se auto-ejecuta. Requiere ApprovalRequest + segunda confirmacion explicita.",
  };
}

export function riskLevelAtLeast(a: RiskLevel, b: RiskLevel): boolean {
  const order: RiskLevel[] = ["LEVEL_0", "LEVEL_1", "LEVEL_2", "LEVEL_3"];
  return order.indexOf(a) >= order.indexOf(b);
}
