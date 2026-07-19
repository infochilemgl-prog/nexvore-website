import type { AICompletionParams, AICompletionResult, AIProvider, AIToolCall } from "./types";

/**
 * Undoes `wrapGuestMessage`/`wrapUntrustedContent` (utils/untrusted-content.ts) so the field
 * extractors below see the guest's actual words. Only ever applied to the raw text used for
 * FIELD EXTRACTION -- the wrapper itself must still reach the (real) model unmodified, since it
 * is the app's actual prompt-injection defense, not just a display artifact. Extracts exactly
 * the content between the two "---" delimiters; falls back to the original string if the text
 * isn't wrapped (i.e. every prior-turn message, which is stored/read back unwrapped).
 */
function stripUntrustedWrapper(raw: string): string {
  const match = raw.match(/<untrusted_external_content>[\s\S]*?\n---\n([\s\S]*?)\n---\n<\/untrusted_external_content>/);
  return match ? match[1] : raw;
}

/**
 * MockAIProvider — a scripted, deterministic stand-in for a real LLM.
 *
 * IMPORTANT / HONEST SCOPE NOTE: this is NOT a general NLU engine. It is a
 * rule-based simulator that recognizes a handful of regex/keyword patterns
 * well enough to drive the reservations, maintenance and guest-communications
 * flows end to end without any API key, so the whole pipeline (webhook ->
 * orchestrator -> agent -> tool -> DB -> audit log -> dashboard) can be
 * demonstrated and tested deterministically. It will NOT hold an open-ended
 * natural conversation the way Claude/GPT would. Swap AI_PROVIDER=anthropic
 * or =openai (with the matching API key) for real conversational behaviour;
 * the rest of the system (tools, permissions, audit log, DB) is identical
 * either way because business logic never talks to the mock directly either.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  isConfigured(): boolean {
    return true;
  }

  async complete(params: AICompletionParams): Promise<AICompletionResult> {
    const context = params.mockHint ? safeParseJson(params.mockHint) : {};
    const agent = String(context.agentName ?? "");

    const userTexts = params.messages.filter((m): m is Extract<typeof m, { role: "user" }> => m.role === "user").map((m) => m.content);
    const latestUserText = userTexts[userTexts.length - 1] ?? "";
    const toolResultsThisTurn = params.messages.filter((m): m is Extract<typeof m, { role: "tool" }> => m.role === "tool");
    const calledToolNames = new Set(toolResultsThisTurn.map((m) => m.toolName));

    if (agent === "reservations" && context.propertyType === "RESTAURANT") {
      return this.restaurantReservationsFlow({ params, userTexts, latestUserText, toolResultsThisTurn, calledToolNames });
    }
    if (agent === "reservations") return this.reservationsFlow({ params, userTexts, latestUserText, toolResultsThisTurn, calledToolNames, context });
    if (agent === "maintenance") return this.maintenanceFlow({ params, latestUserText, toolResultsThisTurn, calledToolNames });
    if (agent === "guest_communications" || agent === "concierge") return this.knowledgeFlow({ params, latestUserText, toolResultsThisTurn, calledToolNames });

    // Generic fallback: no tool calls, acknowledge and hand off.
    return textResult("Gracias por tu mensaje. Un miembro de nuestro equipo lo revisara en breve.");
  }

  private reservationsFlow(args: {
    params: AICompletionParams;
    userTexts: string[];
    latestUserText: string;
    toolResultsThisTurn: Extract<AICompletionParams["messages"][number], { role: "tool" }>[];
    calledToolNames: Set<string>;
    context: Record<string, any>;
  }): AICompletionResult {
    const { userTexts, latestUserText, toolResultsThisTurn, calledToolNames } = args;

    // Cancellation branch: Level 3, always goes through request_cancellation
    // (which the tool-loop intercepts into an ApprovalRequest -- it never
    // executes directly here).
    if (/\bcancelar\b/i.test(latestUserText)) {
      if (!calledToolNames.has("find_reservation")) {
        return toolCallResult("find_reservation", {});
      }
      const findResult = toolResultsThisTurn.find((t) => t.toolName === "find_reservation");
      const found = findResult ? safeParseJson(findResult.content) : {};
      if (!found?.found) {
        return textResult("No encuentro una reserva activa asociada a tu numero. ¿Podrias confirmarme el folio de la reserva?");
      }
      if (!calledToolNames.has("request_cancellation")) {
        return toolCallResult("request_cancellation", { reservationId: found.reservation.id, reason: "Solicitud del huesped por WhatsApp" });
      }
      const cancelResult = toolResultsThisTurn.find((t) => t.toolName === "request_cancellation");
      const cancelOutput = cancelResult ? safeParseJson(cancelResult.content) : {};
      if (cancelOutput?.pendingApproval) {
        return textResult("Tu solicitud de cancelacion fue enviada a revision de nuestro equipo (no se ha cancelado todavia). Te avisaremos apenas se resuelva.");
      }
      return textResult(`No pude procesar la cancelacion: ${cancelOutput?.error ?? "intenta nuevamente"}.`);
    }

    const fields = extractReservationFields(userTexts);
    const confirmed = /\b(confirmo|confirmar|s[ií],?\s*confirmo|confirm|yes,?\s*confirm)\b/i.test(latestUserText);

    const missing = nextMissingReservationField(fields);
    if (missing) {
      return textResult(ASK_TEXT[missing]);
    }

    if (confirmed) {
      if (!calledToolNames.has("create_reservation")) {
        return toolCallResult("create_reservation", {
          guestName: fields.name,
          adults: fields.adults,
          checkIn: fields.checkIn,
          checkOut: fields.checkOut,
          unitCategory: fields.category,
          specialRequests: fields.specialRequests ?? "",
        });
      }
      const result = toolResultsThisTurn.find((t) => t.toolName === "create_reservation");
      const parsed = result ? safeParseJson(result.content) : {};
      if (parsed?.ok) {
        return textResult(
          `Tu reserva quedo creada (folio ${parsed.reservationId ?? ""}) para ${fields.adults} persona(s), del ${fields.checkIn} al ${fields.checkOut}. Te enviare el link de pago para confirmarla. 🙌`
        );
      }
      return textResult(`No pude crear la reserva automaticamente: ${parsed?.error ?? "motivo desconocido"}. La deje en revision con el equipo.`);
    }

    // Not confirmed yet -> availability + quote, then recap.
    if (!calledToolNames.has("check_availability")) {
      return toolCallResult("check_availability", {
        unitCategory: fields.category,
        checkIn: fields.checkIn,
        checkOut: fields.checkOut,
        adults: fields.adults,
      });
    }
    const availabilityResult = toolResultsThisTurn.find((t) => t.toolName === "check_availability");
    const availability = availabilityResult ? safeParseJson(availabilityResult.content) : {};
    if (!availability?.available) {
      return textResult(`Lo siento, no tengo disponibilidad en esa categoria para esas fechas. ¿Quieres que revise otra categoria u otras fechas?`);
    }

    if (!calledToolNames.has("quote_reservation")) {
      return toolCallResult("quote_reservation", {
        unitId: availability.unitId,
        checkIn: fields.checkIn,
        checkOut: fields.checkOut,
      });
    }
    const quoteResultMsg = toolResultsThisTurn.find((t) => t.toolName === "quote_reservation");
    const quote = quoteResultMsg ? safeParseJson(quoteResultMsg.content) : {};
    return textResult(
      `Perfecto ${fields.name}, tengo disponibilidad. Resumen: ${fields.adults} persona(s), del ${fields.checkIn} al ${fields.checkOut}, categoria ${fields.category}. ` +
        `Total estimado: ${quote?.total ?? "?"} ${quote?.currency ?? ""} (incluye aseo e impuestos). ¿Confirmas la reserva? Responde "confirmo" para continuar.`
    );
  }

  /**
   * Restaurant-property variant of reservationsFlow -- same one-field-at-a-time /
   * check-availability-first / recap-then-confirm shape, generalized from the standalone
   * "Valentina" restaurant build's conversation rules, but driving the SAME generic
   * check_availability/quote_reservation/create_reservation tools with unitCategory "TABLE"
   * (party size + a same-day date+time slot) instead of the hotel path's two full dates.
   */
  private restaurantReservationsFlow(args: {
    params: AICompletionParams;
    userTexts: string[];
    latestUserText: string;
    toolResultsThisTurn: Extract<AICompletionParams["messages"][number], { role: "tool" }>[];
    calledToolNames: Set<string>;
  }): AICompletionResult {
    const { userTexts, latestUserText, toolResultsThisTurn, calledToolNames } = args;

    if (/\bcancelar\b/i.test(latestUserText)) {
      if (!calledToolNames.has("find_reservation")) {
        return toolCallResult("find_reservation", {});
      }
      const findResult = toolResultsThisTurn.find((t) => t.toolName === "find_reservation");
      const found = findResult ? safeParseJson(findResult.content) : {};
      if (!found?.found) {
        return textResult("No encuentro una reserva activa asociada a tu numero. ¿Me confirmas el nombre con el que reservaste?");
      }
      if (!calledToolNames.has("request_cancellation")) {
        return toolCallResult("request_cancellation", { reservationId: found.reservation.id, reason: "Solicitud del comensal por WhatsApp" });
      }
      const cancelResult = toolResultsThisTurn.find((t) => t.toolName === "request_cancellation");
      const cancelOutput = cancelResult ? safeParseJson(cancelResult.content) : {};
      if (cancelOutput?.pendingApproval) {
        return textResult("Tu solicitud de cancelacion fue enviada a revision de nuestro equipo (no se ha cancelado todavia). Te avisamos apenas se resuelva.");
      }
      return textResult(`No pude procesar la cancelacion: ${cancelOutput?.error ?? "intenta nuevamente"}.`);
    }

    const fields = extractRestaurantFields(userTexts);
    const confirmed = /\b(confirmo|confirmar|s[ií],?\s*confirmo|confirm|yes,?\s*confirm)\b/i.test(latestUserText);

    const missing = nextMissingRestaurantField(fields);
    if (missing) {
      return textResult(ASK_TEXT_RESTAURANT[missing]);
    }

    const checkIn = `${fields.date}T${fields.time}:00`;
    const checkOut = addMinutesToIsoLocal(checkIn, DEFAULT_TABLE_RESERVATION_MINUTES);

    if (confirmed) {
      if (!calledToolNames.has("create_reservation")) {
        return toolCallResult("create_reservation", {
          guestName: fields.name,
          adults: fields.partySize,
          checkIn,
          checkOut,
          unitCategory: "TABLE",
          specialRequests: fields.notes ?? "",
        });
      }
      const result = toolResultsThisTurn.find((t) => t.toolName === "create_reservation");
      const parsed = result ? safeParseJson(result.content) : {};
      if (parsed?.ok) {
        return textResult(
          `Tu mesa quedo reservada (folio ${parsed.reservationId ?? ""}) para ${fields.name}, ${fields.partySize} persona(s), el ${fields.date} a las ${fields.time}. ¡Te esperamos! 🍽️✅`
        );
      }
      return textResult(`No pude crear la reserva automaticamente: ${parsed?.error ?? "motivo desconocido"}. La deje en revision con el equipo.`);
    }

    // Not confirmed yet -> availability + quote (flat/free fee, never "noches x tarifa"), then recap.
    if (!calledToolNames.has("check_availability")) {
      return toolCallResult("check_availability", {
        unitCategory: "TABLE",
        checkIn,
        checkOut,
        adults: fields.partySize,
      });
    }
    const availabilityResult = toolResultsThisTurn.find((t) => t.toolName === "check_availability");
    const availability = availabilityResult ? safeParseJson(availabilityResult.content) : {};
    if (!availability?.available) {
      return textResult(`${availability?.reason ?? "No tengo disponibilidad para ese horario."} ¿Probamos con otro dia u horario?`);
    }

    if (!calledToolNames.has("quote_reservation")) {
      return toolCallResult("quote_reservation", { unitId: availability.unitId, checkIn, checkOut });
    }
    const quoteResultMsg = toolResultsThisTurn.find((t) => t.toolName === "quote_reservation");
    const quote = quoteResultMsg ? safeParseJson(quoteResultMsg.content) : {};
    const priceLine = quote?.total > 0 ? `Costo de la reserva: ${quote.total} ${quote.currency ?? ""}.` : "La reserva de mesa no tiene costo.";
    return textResult(
      `Perfecto ${fields.name}, tengo mesa disponible. Resumen: ${fields.partySize} persona(s), el ${fields.date} a las ${fields.time}, ` +
        `alergias/pedidos: ${fields.notes}. ${priceLine} ¿Confirmas la reserva? Responde "confirmo" para continuar.`
    );
  }

  private maintenanceFlow(args: {
    params: AICompletionParams;
    latestUserText: string;
    toolResultsThisTurn: Extract<AICompletionParams["messages"][number], { role: "tool" }>[];
    calledToolNames: Set<string>;
  }): AICompletionResult {
    const { latestUserText, toolResultsThisTurn, calledToolNames } = args;

    if (!calledToolNames.has("classify_maintenance_issue")) {
      return toolCallResult("classify_maintenance_issue", { description: latestUserText });
    }
    const classifyMsg = toolResultsThisTurn.find((t) => t.toolName === "classify_maintenance_issue");
    const classification = classifyMsg ? safeParseJson(classifyMsg.content) : {};

    if (classification?.urgency === "CRITICAL") {
      // Emergencies still get a tracked ticket (for audit/dashboard
      // visibility) in addition to the immediate human escalation -- the two
      // are complementary, not exclusive.
      if (!calledToolNames.has("create_maintenance_ticket")) {
        return toolCallResult("create_maintenance_ticket", {
          title: latestUserText.slice(0, 80),
          description: latestUserText,
          category: classification?.category ?? "SAFETY",
          urgency: "CRITICAL",
        });
      }
      if (!calledToolNames.has("escalate_to_human")) {
        return toolCallResult("escalate_to_human", { reason: "Emergencia de riesgo vital detectada", urgency: "CRITICAL" });
      }
      return textResult(
        "Esto suena a una emergencia. Por favor contacta de inmediato a los servicios de emergencia locales (bomberos/ambulancia/policia) y sal del lugar si es necesario. Ya notifique a nuestro equipo humano para que te contacte de inmediato."
      );
    }

    if (!calledToolNames.has("get_troubleshooting_guide")) {
      return toolCallResult("get_troubleshooting_guide", { category: classification?.category ?? "OTHER" });
    }
    if (!calledToolNames.has("create_maintenance_ticket")) {
      return toolCallResult("create_maintenance_ticket", {
        title: latestUserText.slice(0, 80),
        description: latestUserText,
        category: classification?.category ?? "OTHER",
        urgency: classification?.urgency ?? "MEDIUM",
      });
    }
    const guideMsg = toolResultsThisTurn.find((t) => t.toolName === "get_troubleshooting_guide");
    const guide = guideMsg ? safeParseJson(guideMsg.content) : {};
    const ticketMsg = toolResultsThisTurn.find((t) => t.toolName === "create_maintenance_ticket");
    const ticket = ticketMsg ? safeParseJson(ticketMsg.content) : {};
    return textResult(
      `Gracias por avisar. ${guide?.instructions ?? "Nuestro equipo revisara el detalle."} Ya cree el ticket ${ticket?.ticketId ?? ""} (urgencia ${classification?.urgency ?? "MEDIA"}) para darle seguimiento.`
    );
  }

  private knowledgeFlow(args: {
    params: AICompletionParams;
    latestUserText: string;
    toolResultsThisTurn: Extract<AICompletionParams["messages"][number], { role: "tool" }>[];
    calledToolNames: Set<string>;
  }): AICompletionResult {
    const { latestUserText, toolResultsThisTurn, calledToolNames } = args;
    if (!calledToolNames.has("search_knowledge_base")) {
      return toolCallResult("search_knowledge_base", { query: latestUserText.slice(0, 200) });
    }
    const kbMsg = toolResultsThisTurn.find((t) => t.toolName === "search_knowledge_base");
    const kb = kbMsg ? safeParseJson(kbMsg.content) : {};
    if (kb?.results?.length) {
      const top = kb.results[0];
      return textResult(`${top.content}`.slice(0, 500));
    }
    if (!calledToolNames.has("escalate_to_human")) {
      return toolCallResult("escalate_to_human", { reason: "No hay informacion en la base de conocimiento", question: latestUserText });
    }
    return textResult("No tengo esa informacion a mano en este momento, ya lo derive con el equipo para que te responda a la brevedad.");
  }
}

function textResult(content: string): AICompletionResult {
  return { content, toolCalls: [], stopReason: "end_turn", usage: { inputTokens: 0, outputTokens: 0 } };
}

function toolCallResult(name: string, input: Record<string, unknown>): AICompletionResult {
  const call: AIToolCall = { id: `mock_${name}_${Math.random().toString(36).slice(2, 10)}`, name, input };
  return { content: "", toolCalls: [call], stopReason: "tool_use", usage: { inputTokens: 0, outputTokens: 0 } };
}

function safeParseJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

interface ReservationFields {
  name?: string;
  adults?: number;
  checkIn?: string;
  checkOut?: string;
  category?: string;
  specialRequests?: string;
}

const ASK_TEXT: Record<keyof ReservationFields, string> = {
  name: "¡Hola! Con gusto te ayudo a reservar 😊 ¿Cual es tu nombre completo?",
  adults: "¿Para cuantas personas seria la reserva?",
  checkIn: "¿Cual seria tu fecha de entrada? (formato AAAA-MM-DD)",
  checkOut: "¿Y tu fecha de salida? (formato AAAA-MM-DD)",
  category: "¿Que categoria de unidad prefieres: Grand Suite, Deluxe, Standard, Apartment o House?",
  specialRequests: "¿Tienes algun pedido especial? Si no, responde 'ninguno'.",
};

const CATEGORY_KEYWORDS: Array<[RegExp, string]> = [
  [/grand\s*suite/i, "GRAND_SUITE"],
  [/deluxe/i, "DELUXE"],
  [/standard|est[aá]ndar|estandar/i, "STANDARD"],
  [/apartamento|apartment|depto/i, "APARTMENT"],
  [/caba[ñn]a|house|casa/i, "HOUSE"],
];

function extractReservationFields(userTexts: string[]): ReservationFields {
  const fields: ReservationFields = {};
  const dateRegex = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  const foundDates: string[] = [];

  for (const raw of userTexts) {
    const text = stripUntrustedWrapper(raw).trim();

    if (!fields.name) {
      const m = text.match(/(?:me llamo|soy|mi nombre es)\s+([a-zA-ZÀ-ÿ'\s]{2,40})/i);
      if (m) fields.name = m[1].trim().replace(/[.,!?].*$/, "");
    }
    if (fields.adults === undefined) {
      const m = text.match(/(\d{1,2})\s*(?:personas|adultos|huespedes|hu[eé]spedes|guests|pax)/i);
      if (m) fields.adults = parseInt(m[1], 10);
      else if (/^\d{1,2}$/.test(text.trim())) fields.adults = parseInt(text.trim(), 10);
    }
    let dm: RegExpExecArray | null;
    dateRegex.lastIndex = 0;
    while ((dm = dateRegex.exec(text))) {
      foundDates.push(dm[0]);
    }
    if (!fields.category) {
      for (const [re, cat] of CATEGORY_KEYWORDS) {
        if (re.test(text)) {
          fields.category = cat;
          break;
        }
      }
    }
  }

  if (foundDates.length >= 1) fields.checkIn = foundDates[0];
  if (foundDates.length >= 2) fields.checkOut = foundDates[1];

  // Special requests: once name/adults/dates/category are known, the next
  // plain-text message that isn't itself one of the other fields is treated
  // as the special-requests answer.
  if (fields.name && fields.adults !== undefined && fields.checkIn && fields.checkOut && fields.category) {
    for (const raw of userTexts) {
      const text = stripUntrustedWrapper(raw).trim();
      const isStructured =
        /(?:me llamo|soy|mi nombre es)/i.test(text) ||
        /\d{4}-\d{2}-\d{2}/.test(text) ||
        CATEGORY_KEYWORDS.some(([re]) => re.test(text)) ||
        /^\d{1,2}$/.test(text) ||
        /\d{1,2}\s*(?:personas|adultos|huespedes|hu[eé]spedes|guests|pax)/i.test(text) ||
        /confirmo|confirmar/i.test(text);
      if (!isStructured && text.length > 0) {
        fields.specialRequests = /^(ninguno|ninguna|no)$/i.test(text) ? "Ninguno" : text.slice(0, 300);
      }
    }
  }

  return fields;
}

function nextMissingReservationField(fields: ReservationFields): keyof ReservationFields | null {
  const order: (keyof ReservationFields)[] = ["name", "adults", "checkIn", "checkOut", "category", "specialRequests"];
  for (const key of order) {
    if (fields[key] === undefined || fields[key] === null || fields[key] === "") return key;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Restaurant table-reservation flow helpers                            */
/* ------------------------------------------------------------------ */

// Falls back to Property.reservationDurationMinutes's own default (see prisma/schema.prisma).
// A real LLM provider would call get_property_information to learn the actual per-property
// value; this scripted simulator hardcodes the same default instead, which is an accepted
// simplification consistent with the rest of MockAIProvider (see class-level doc comment).
const DEFAULT_TABLE_RESERVATION_MINUTES = 120;

interface RestaurantReservationFields {
  name?: string;
  partySize?: number;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM (24h)
  notes?: string;
}

const ASK_TEXT_RESTAURANT: Record<keyof RestaurantReservationFields, string> = {
  name: "¡Hola! Con gusto te ayudo a reservar una mesa 😊 ¿Cual es tu nombre completo?",
  partySize: "¿Para cuantas personas seria la mesa?",
  date: "¿Que dia te gustaria venir? (formato AAAA-MM-DD)",
  time: "¿A que hora? (formato HH:MM, almuerzo o cena)",
  notes: "¿Alguna alergia, restriccion o pedido especial que tengamos que tener en cuenta? Si no, responde 'ninguna'.",
};

function extractRestaurantFields(userTexts: string[]): RestaurantReservationFields {
  const fields: RestaurantReservationFields = {};
  const dateRegex = /\b(\d{4})-(\d{2})-(\d{2})\b/;
  const timeRegex = /\b([01]\d|2[0-3]):([0-5]\d)\b/;

  for (const raw of userTexts) {
    const text = stripUntrustedWrapper(raw).trim();

    if (!fields.name) {
      const m = text.match(/(?:me llamo|soy|mi nombre es)\s+([a-zA-ZÀ-ÿ'\s]{2,40})/i);
      if (m) fields.name = m[1].trim().replace(/[.,!?].*$/, "");
    }
    if (fields.partySize === undefined) {
      const m = text.match(/(\d{1,2})\s*(?:personas|comensales|pax)/i);
      if (m) fields.partySize = parseInt(m[1], 10);
      else if (/^\d{1,2}$/.test(text.trim())) fields.partySize = parseInt(text.trim(), 10);
    }
    if (!fields.date) {
      const m = text.match(dateRegex);
      if (m) fields.date = m[0];
    }
    if (!fields.time) {
      const m = text.match(timeRegex);
      if (m) fields.time = m[0];
    }
  }

  // Notes/allergies: once name/partySize/date/time are known, the next plain-text message that
  // isn't itself one of the other fields is treated as the notes answer (mirrors
  // extractReservationFields' special-requests handling for the hotel flow).
  if (fields.name && fields.partySize !== undefined && fields.date && fields.time) {
    for (const raw of userTexts) {
      const text = stripUntrustedWrapper(raw).trim();
      const isStructured =
        /(?:me llamo|soy|mi nombre es)/i.test(text) ||
        dateRegex.test(text) ||
        timeRegex.test(text) ||
        /^\d{1,2}$/.test(text) ||
        /\d{1,2}\s*(?:personas|comensales|pax)/i.test(text) ||
        /confirmo|confirmar/i.test(text);
      if (!isStructured && text.length > 0) {
        fields.notes = /^(ninguno|ninguna|no)$/i.test(text) ? "Ninguna" : text.slice(0, 300);
      }
    }
  }

  return fields;
}

function nextMissingRestaurantField(fields: RestaurantReservationFields): keyof RestaurantReservationFields | null {
  const order: (keyof RestaurantReservationFields)[] = ["name", "partySize", "date", "time", "notes"];
  for (const key of order) {
    if (fields[key] === undefined || fields[key] === null || fields[key] === "") return key;
  }
  return null;
}

/** Adds minutes to a local (no-timezone-suffix) ISO string like "2026-08-10T20:00:00". */
function addMinutesToIsoLocal(isoLocal: string, minutes: number): string {
  const [datePart, timePart] = isoLocal.split("T");
  const [y, mo, d] = datePart.split("-").map(Number);
  const [h, mi, s] = timePart.split(":").map(Number);
  const dt = new Date(y, mo - 1, d, h, mi, s || 0);
  dt.setMinutes(dt.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;
}
