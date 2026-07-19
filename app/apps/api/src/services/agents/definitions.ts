import type { AgentDefinition } from "./types";
import { buildReservationsPrompt } from "../../prompts/reservations.prompt";
import { buildMaintenancePrompt } from "../../prompts/maintenance.prompt";
import { buildGuestCommunicationsPrompt } from "../../prompts/guest-communications.prompt";
import {
  buildConciergePrompt,
  buildRoomServicePrompt,
  buildHousekeepingPrompt,
  buildFinancePrompt,
  buildMarketingPrompt,
  buildCompetitiveIntelligencePrompt,
  buildKnowledgeAuditorPrompt,
} from "../../prompts/other-agents.prompt";

const SHARED_READ_TOOLS = ["get_property_information", "search_knowledge_base", "find_guest", "find_reservation"];

export const AGENT_DEFINITIONS: Record<string, AgentDefinition> = {
  reservations: {
    name: "reservations",
    displayName: "Reservas",
    scope: "Gestiona el flujo completo de reservas: disponibilidad, cotizacion, creacion, reprogramacion, cancelacion, pagos y acceso.",
    allowedTools: [
      ...SHARED_READ_TOOLS,
      "check_availability",
      "quote_reservation",
      "create_reservation",
      "request_reschedule",
      "request_cancellation",
      "issue_refund",
      "send_payment_link",
      "verify_payment_status",
      "get_access_instructions",
      "escalate_to_human",
    ],
    maxRiskLevel: "LEVEL_3",
    systemPromptBuilder: buildReservationsPrompt,
  },

  maintenance: {
    name: "maintenance",
    displayName: "Mantenimiento",
    scope: "Triage de problemas reportados, tickets, guias de auto-ayuda seguras y cotizaciones de contratistas.",
    allowedTools: [
      ...SHARED_READ_TOOLS,
      "classify_maintenance_issue",
      "get_troubleshooting_guide",
      "create_maintenance_ticket",
      "find_contractors",
      "request_contractor_quote",
      "escalate_to_human",
    ],
    maxRiskLevel: "LEVEL_2",
    systemPromptBuilder: buildMaintenancePrompt,
  },

  guest_communications: {
    name: "guest_communications",
    displayName: "Comunicacion con huespedes",
    scope: "Punto de entrada generalista: responde preguntas generales y deriva a agentes especializados.",
    allowedTools: [...SHARED_READ_TOOLS, "list_services", "escalate_to_human", "create_audit_log"],
    maxRiskLevel: "LEVEL_1",
    systemPromptBuilder: buildGuestCommunicationsPrompt,
  },

  concierge: {
    name: "concierge",
    displayName: "Concierge",
    scope: "Recomendaciones locales y servicios adicionales.",
    allowedTools: [...SHARED_READ_TOOLS, "list_services", "book_service", "escalate_to_human"],
    maxRiskLevel: "LEVEL_1",
    systemPromptBuilder: buildConciergePrompt,
  },

  room_service: {
    name: "room_service",
    displayName: "Room service",
    scope: "Pedidos de servicios en habitacion.",
    allowedTools: [...SHARED_READ_TOOLS, "list_services", "book_service"],
    maxRiskLevel: "LEVEL_1",
    systemPromptBuilder: buildRoomServicePrompt,
  },

  housekeeping: {
    name: "housekeeping",
    displayName: "Housekeeping",
    scope: "Programacion de tareas de limpieza.",
    allowedTools: ["create_housekeeping_task", "list_housekeeping_tasks", "find_reservation"],
    maxRiskLevel: "LEVEL_1",
    systemPromptBuilder: buildHousekeepingPrompt,
  },

  finance: {
    name: "finance",
    displayName: "Finanzas",
    scope: "Solo lectura/analisis financiero. Sin herramientas de cobro, reembolso o transferencia.",
    allowedTools: ["generate_daily_report", "find_reservation", "verify_payment_status"],
    maxRiskLevel: "LEVEL_0",
    systemPromptBuilder: buildFinancePrompt,
  },

  marketing: {
    name: "marketing",
    displayName: "Marketing",
    scope: "Ideas de contenido a partir de inteligencia competitiva. Todo queda en borrador.",
    allowedTools: ["list_competitors", "create_content_idea"],
    maxRiskLevel: "LEVEL_1",
    systemPromptBuilder: buildMarketingPrompt,
  },

  competitive_intelligence: {
    name: "competitive_intelligence",
    displayName: "Inteligencia competitiva",
    scope: "Analisis de competidores; nunca cambia precios directamente.",
    allowedTools: ["list_competitors"],
    maxRiskLevel: "LEVEL_0",
    systemPromptBuilder: buildCompetitiveIntelligencePrompt,
  },

  knowledge_auditor: {
    name: "knowledge_auditor",
    displayName: "Auditor de conocimiento",
    scope: "Revisa brechas de conocimiento y propone contenido para aprobacion humana.",
    allowedTools: ["search_knowledge_base"],
    maxRiskLevel: "LEVEL_1",
    systemPromptBuilder: buildKnowledgeAuditorPrompt,
  },
};

export function getAgentDefinition(name: string): AgentDefinition | undefined {
  return AGENT_DEFINITIONS[name];
}
