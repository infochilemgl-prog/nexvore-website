// Shared types and constants used by both apps/api and apps/web.
// Kept dependency-free (no Prisma/Express imports) so it can be consumed by the web bundle too.

export type RiskLevel = "LEVEL_0" | "LEVEL_1" | "LEVEL_2" | "LEVEL_3";

export const RISK_LEVEL_LABEL_ES: Record<RiskLevel, string> = {
  LEVEL_0: "Lectura (automático)",
  LEVEL_1: "Bajo riesgo (automático si pasa reglas)",
  LEVEL_2: "Requiere aprobación humana",
  LEVEL_3: "Crítico (aprobación + doble confirmación)",
};

export type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "EXECUTED"
  | "FAILED";

export type ReservationStatus =
  | "INQUIRY"
  | "PENDING"
  | "AWAITING_PAYMENT"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED"
  | "NO_SHOW";

export type MaintenanceUrgency = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export const SUPPORTED_LANGUAGES = ["es", "en", "pt", "fr"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export interface QuoteLineItem {
  label: string;
  amount: number;
}

export interface QuoteBreakdown {
  nights: number;
  nightlyRate: number;
  lodgingSubtotal: number;
  cleaningFee: number;
  services: QuoteLineItem[];
  discounts: QuoteLineItem[];
  taxes: number;
  taxRate: number;
  total: number;
  currency: string;
  lineItems: QuoteLineItem[];
}

export function formatCurrency(amount: number, currency = "CLP", locale = "es-CL"): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "CLP" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
