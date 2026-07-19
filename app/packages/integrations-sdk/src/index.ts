// Vendor-agnostic integration interfaces. Concrete adapters (mock + real)
// live in apps/api/src/integrations/**; nothing outside that folder should
// import a vendor SDK directly.

export interface PMSAvailabilityQuery {
  externalPropertyId: string;
  externalUnitId: string;
  checkIn: string; // ISO date
  checkOut: string; // ISO date
}

export interface PMSReservationPayload {
  externalPropertyId: string;
  externalUnitId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  currency: string;
}

export interface PMSAdapter {
  readonly name: string;
  isConfigured(): boolean;
  checkAvailability(query: PMSAvailabilityQuery): Promise<{ available: boolean; reason?: string }>;
  pushReservation(payload: PMSReservationPayload): Promise<{ externalId: string; syncedAt: string }>;
  cancelReservation(externalId: string): Promise<{ cancelled: boolean }>;
}

export interface PaymentLinkRequest {
  amount: number;
  currency: string;
  description: string;
  referenceId: string;
  payerEmail?: string;
}

export interface PaymentLinkResult {
  url: string;
  externalId: string;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
}

export interface PaymentStatusResult {
  externalId: string;
  status: "PENDING" | "PAID" | "FAILED" | "EXPIRED";
  paidAmount?: number;
  paidAt?: string;
}

export interface RefundResult {
  externalId: string;
  refunded: boolean;
  amount: number;
}

export interface PaymentAdapter {
  readonly name: string;
  isConfigured(): boolean;
  createPaymentLink(request: PaymentLinkRequest): Promise<PaymentLinkResult>;
  verifyPaymentStatus(externalId: string): Promise<PaymentStatusResult>;
  /**
   * MUST be called only after Level-3 approval has been granted by the calling
   * code (services/approvals). The adapter itself does not check approval
   * state — the caller is responsible. See apps/api/src/tools/reservations.tools.ts.
   */
  refund(externalId: string, amount: number): Promise<RefundResult>;
}

export interface VoiceCallEvent {
  callId: string;
  from: string;
  to: string;
}

export interface VoiceProvider {
  readonly name: string;
  isConfigured(): boolean;
  startCall(to: string, context: Record<string, unknown>): Promise<{ callId: string }>;
  endCall(callId: string): Promise<{ ended: boolean }>;
}
