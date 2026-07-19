import type { PaymentAdapter } from "@nexvore/integrations-sdk";
import { env } from "../../config/env";
import { MockPaymentAdapter } from "./mock-payment.adapter";

let cached: PaymentAdapter | null = null;

export function getPaymentAdapter(): PaymentAdapter {
  if (cached) return cached;
  // No real Stripe/MercadoPago credentials were supplied for this app's own
  // payment adapter (separate from the existing root api/webhook.js). Real
  // adapters would be added here, gated by STRIPE_SECRET_KEY /
  // MERCADOPAGO_ACCESS_TOKEN, and would still route refund() through the
  // Level-3 approval gate in services/approvals.
  cached = new MockPaymentAdapter();
  return cached;
}

export function paymentConnectionState(): { provider: string; configured: boolean } {
  if (env.PAYMENT_PROVIDER === "stripe") return { provider: "stripe", configured: Boolean(env.STRIPE_SECRET_KEY) };
  if (env.PAYMENT_PROVIDER === "mercadopago") return { provider: "mercadopago", configured: Boolean(env.MERCADOPAGO_ACCESS_TOKEN) };
  return { provider: "mock", configured: true };
}
