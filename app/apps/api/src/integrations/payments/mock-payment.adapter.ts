import type { PaymentAdapter, PaymentLinkRequest, RefundResult } from "@hospitality-ai/integrations-sdk";
import { logger } from "../../config/logger";

const paidStore = new Map<string, { status: "PENDING" | "PAID" | "FAILED" | "EXPIRED"; amount: number }>();

export class MockPaymentAdapter implements PaymentAdapter {
  readonly name = "mock-payments";

  isConfigured(): boolean {
    return true;
  }

  async createPaymentLink(request: PaymentLinkRequest) {
    const externalId = `mock-pay-${Date.now()}`;
    paidStore.set(externalId, { status: "PENDING", amount: request.amount });
    logger.debug({ request, externalId }, "MockPaymentAdapter.createPaymentLink");
    return { url: `https://pay.mock.local/${externalId}`, externalId, status: "PENDING" as const };
  }

  async verifyPaymentStatus(externalId: string) {
    const record = paidStore.get(externalId);
    if (!record) return { externalId, status: "FAILED" as const };
    // Mock behaviour: mark as PAID the first time it's checked, to keep the
    // demo flow moving without needing a real webhook callback.
    if (record.status === "PENDING") {
      record.status = "PAID";
      paidStore.set(externalId, record);
    }
    return { externalId, status: record.status, paidAmount: record.status === "PAID" ? record.amount : undefined, paidAt: record.status === "PAID" ? new Date().toISOString() : undefined };
  }

  /**
   * MUST only be invoked by calling code AFTER a Level-3 ApprovalRequest has
   * been approved (see services/approvals/execute-approval.ts). This adapter
   * does not itself check approval state.
   */
  async refund(externalId: string, amount: number): Promise<RefundResult> {
    logger.warn({ externalId, amount }, "MockPaymentAdapter.refund ejecutado (debe venir de una aprobacion Nivel 3)");
    return { externalId, refunded: true, amount };
  }
}
