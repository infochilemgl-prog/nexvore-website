import { GUEST_FACING_CORE_RULES_ES } from "@nexvore/prompts";
import type { AgentPromptContext } from "../services/agents/types";

export function buildGuestFacingPreamble(ctx: AgentPromptContext): string {
  // "Valentina" is the code-level fallback persona name when an organization hasn't
  // configured BrandProfile.assistantName -- see orchestrator.ts for the resolution order.
  const assistantName = ctx.assistantName?.trim() || "Valentina";
  return [
    `Te llamas ${assistantName}. Este es tu nombre de pila para el huesped/comensal -- usalo si te preguntan como te llamas.`,
    `Propiedad: ${ctx.propertyName ?? "N/D"} (organizacion: ${ctx.organizationName ?? "N/D"}).`,
    `Idioma del huesped detectado: ${ctx.guestLanguage}.`,
    ctx.checkInTime ? `Horario de check-in: ${ctx.checkInTime}. Horario de check-out: ${ctx.checkOutTime}.` : "",
    "",
    GUEST_FACING_CORE_RULES_ES,
  ]
    .filter(Boolean)
    .join("\n");
}
