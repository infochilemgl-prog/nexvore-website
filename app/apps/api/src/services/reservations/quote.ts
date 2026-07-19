import { differenceInCalendarDays } from "date-fns";

export interface QuoteLineItem {
  label: string;
  amount: number;
}

export interface QuoteInput {
  basePrice: number;
  cleaningFee: number;
  checkIn: Date;
  checkOut: Date;
  services?: QuoteLineItem[];
  discounts?: QuoteLineItem[];
  taxRate?: number; // e.g. 0.19 for Chilean IVA
  currency?: string;
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
}

/**
 * Deterministic pricing engine. This is the ONLY place reservation totals are
 * computed -- the AI model never calculates a price, it only calls this
 * (via the quote_reservation tool) and relays the result.
 *
 * total = nights * nightlyRate + cleaningFee + sum(services) - sum(discounts), then + taxes
 */
export function computeQuote(input: QuoteInput): QuoteBreakdown {
  const nights = Math.max(0, differenceInCalendarDays(input.checkOut, input.checkIn));
  const currency = input.currency ?? "CLP";
  const services = input.services ?? [];
  const discounts = input.discounts ?? [];
  const taxRate = input.taxRate ?? 0;

  const lodgingSubtotal = round2(nights * input.basePrice);
  const servicesTotal = round2(services.reduce((sum, s) => sum + s.amount, 0));
  const discountsTotal = round2(discounts.reduce((sum, d) => sum + d.amount, 0));

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
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
