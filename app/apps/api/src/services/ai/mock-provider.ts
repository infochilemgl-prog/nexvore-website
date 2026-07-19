import type { AICompletionParams, AICompletionResult, AIProvider, AIToolCall } from "./types";

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
    const text = raw.replace(/<untrusted_external_content>[\s\S]*?source:[^\n]*\n/i, "").trim();

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
      const text = raw.replace(/<untrusted_external_content>[\s\S]*?source:[^\n]*\n/i, "").trim();
      const isStructured =
        /(?:me llamo|soy|mi nombre es)/i.test(text) ||
        /\d{4}-\d{2}-\d{2}/.test(text) ||
        CATEGORY_KEYWORDS.some(([re]) => re.test(text)) ||
        /^\d{1,2}$/.test(text) ||
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
