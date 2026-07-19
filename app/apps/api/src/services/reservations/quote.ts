import { differenceInCalendarDays } from "date-fns";

export interface QuoteLineItem {
  label: string;
  amount: number;
}

export type PricingMode = "NIGHTLY" | "FLAT";

export interface QuoteInput {
  basePrice: number;
  cleaningFee: number;
  checkIn: Date;
  checkOut: Date;
  services?: QuoteLineItem[];
  discounts?: QuoteLineItem[];
  taxRate?: number; // e.g. 0.19 for Chilean IVA
  currency?: string;
  /**
   * "NIGHTLY" (default): hotel/vacation-rental math, total = nights * basePrice + cleaningFee + ...
   * "FLAT": short/same-day bookings (e.g. a restaurant table) where "nights" is meaningless.
   *   basePrice is charged once as a flat reservation fee (0 for a free reservation), nights is
   *   always reported as 0, and cleaningFee/lodging line items are omitted when they are 0 so
   *   the breakdown never shows a nonsensical "0 noche(s) x 0" or "Tarifa de aseo: 0" line.
   */
  pricingMode?: PricingMode;
}

export interface QuoteBreakdown {
  nights: number;
  nightlyRate: number;
  lodgingSubtotal: number;
  cleaningFee: number;
  services: QuoteLineItem[];
  discounts: QuoteLineItem[];
  subtotalBeforeTax: number;
  taxRate: number;
  taxes: number;
  total: number;
  currency: string;
  lineItems: QuoteLineItem[];
  pricingMode: PricingMode;
}

/**
 * Deterministic pricing engine. This is the ONLY place reservation totals are
 * computed -- the AI model never calculates a price, it only calls this
 * (via the quote_reservation tool) and relays the result.
 *
 * NIGHTLY: total = nights * nightlyRate + cleaningFee + sum(services) - sum(discounts), then + taxes
 * FLAT:    total = flatFee (basePrice, may be 0) + sum(services) - sum(discounts), then + taxes
 */
export function computeQuote(input: QuoteInput): QuoteBreakdown {
  const pricingMode: PricingMode = input.pricingMode ?? "NIGHTLY";
  const currency = input.currency ?? "CLP";
  const services = input.services ?? [];
  const discounts = input.discounts ?? [];
  const taxRate = input.taxRate ?? 0;
  const servicesTotal = round2(services.reduce((sum, s) => sum + s.amount, 0));
  const discountsTotal = round2(discounts.reduce((sum, d) => sum + d.amount, 0));

  if (pricingMode === "FLAT") {
    const flatFee = round2(input.basePrice);
    const subtotalBeforeTax = round2(flatFee + input.cleaningFee + servicesTotal - discountsTotal);
    const taxes = round2(subtotalBeforeTax * taxRate);
    const total = round2(subtotalBeforeTax + taxes);

    const lineItems: QuoteLineItem[] = [
      ...(flatFee > 0 ? [{ label: "Reserva de mesa", amount: flatFee }] : []),
      ...(input.cleaningFee > 0 ? [{ label: "Tarifa de servicio", amount: input.cleaningFee }] : []),
      ...services,
      ...discounts.map((d) => ({ label: d.label, amount: -Math.abs(d.amount) })),
      ...(taxes > 0 ? [{ label: `Impuestos (${(taxRate * 100).toFixed(0)}%)`, amount: taxes }] : []),
    ];

    return {
      nights: 0,
      nightlyRate: input.basePrice,
      lodgingSubtotal: flatFee,
      cleaningFee: input.cleaningFee,
      services,
      discounts,
      subtotalBeforeTax,
      taxRate,
      taxes,
      total,
      currency,
      lineItems,
      pricingMode,
    };
  }

  const nights = Math.max(0, differenceInCalendarDays(input.checkOut, input.checkIn));
  const lodgingSubtotal = round2(nights * input.basePrice);

  const subtotalBeforeTax = round2(lodgingSubtotal + input.cleaningFee + servicesTotal - discountsTotal);
  const taxes = round2(subtotalBeforeTax * taxRate);
  const total = round2(subtotalBeforeTax + taxes);

  const lineItems: QuoteLineItem[] = [
    { label: `${nights} noche(s) x ${input.basePrice}`, amount: lodgingSubtotal },
    { label: "Tarifa de aseo", amount: input.cleaningFee },
    ...services,
    ...discounts.map((d) => ({ label: d.label, amount: -Math.abs(d.amount) })),
    { label: `Impuestos (${(taxRate * 100).toFixed(0)}%)`, amount: taxes },
  ];

  return {
    nights,
    nightlyRate: input.basePrice,
    lodgingSubtotal,
    cleaningFee: input.cleaningFee,
    services,
    discounts,
    subtotalBeforeTax,
    taxRate,
    taxes,
    total,
    currency,
    lineItems,
    pricingMode,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
