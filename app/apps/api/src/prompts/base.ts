import { GUEST_FACING_CORE_RULES_ES } from "@hospitality-ai/prompts";
import type { AgentPromptContext } from "../services/agents/types";

export function buildGuestFacingPreamble(ctx: AgentPromptContext): string {
  return [
    `Propiedad: ${ctx.propertyName ?? "N/D"} (organizacion: ${ctx.organizationName ?? "N/D"}).`,
    `Idioma del huesped detectado: ${ctx.guestLanguage}.`,
    ctx.checkInTime ? `Horario de check-in: ${ctx.checkInTime}. Horario de check-out: ${ctx.checkOutTime}.` : "",
    "",
    GUEST_FACING_CORE_RULES_ES,
  ]
    .filter(Boolean)
    .join("\n");
}
