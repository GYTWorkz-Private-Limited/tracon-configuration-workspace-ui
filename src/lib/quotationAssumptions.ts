/**
 * The commercial assumptions a quotation is priced under.
 *
 * The Price Working Sheet states its assumptions once, across the top, and
 * every line below is priced under them. This module is that band: the handful
 * of figures a commercial reviewer actually argues about — the exchange rate,
 * the credit window, and the headline provision rates — named the way the
 * sheet names them.
 *
 * It holds no arithmetic. Each card points at a real `ProvisionId`, so editing
 * one writes into the same `ProvisionRates` `computeCommercials` already reads
 * and the whole quotation re-prices from the existing engine. There is no
 * second set of percentages here to fall out of step with the costing.
 */

import { PROVISIONS, type ProvisionId, type ProvisionRates } from "./commercialProvisions";

/* ------------------------------------------------------------------ *
 * Payment terms
 * ------------------------------------------------------------------ */

export type PaymentTermsDays = 60 | 90;

export const PAYMENT_TERMS: readonly PaymentTermsDays[] = [60, 90] as const;

/**
 * What the credit window costs, expressed as the `paymentTerms` provision rate.
 *
 * Carrying a receivable for ninety days costs more than sixty, and the sheet
 * prices it as a provision like any other. Routing the toggle through the rate
 * — rather than upliftng the finished price — means the change lands in the
 * cost build-up where a reviewer can see it, and every downstream figure
 * (final cost, margin, order value) moves with it.
 */
export const PAYMENT_TERMS_RATE: Record<PaymentTermsDays, number> = {
  60: 1.2,
  90: 3.0,
};

/* ------------------------------------------------------------------ *
 * The headline band
 * ------------------------------------------------------------------ */

export type AssumptionKind = "fx" | "terms" | "provision" | "total";

export type AssumptionDef = {
  key: string;
  /** the sheet's own wording, so the two documents read alike */
  label: string;
  /** the fuller name the sheet spells out in its column header */
  note?: string;
  kind: AssumptionKind;
  /** the rate this card edits — absent for the derived and non-rate cards */
  provision?: ProvisionId;
};

/**
 * The assumptions shown across the top. Deliberately short: these are the ones
 * a reviewer changes during a commercial argument. Every other provision line
 * is still editable, one panel down, from the same list.
 */
export const HEADLINE_ASSUMPTIONS: AssumptionDef[] = [
  { key: "fx", label: "Exchange Rate", note: "₹ per USD", kind: "fx" },
  { key: "terms", label: "Payment Terms", note: "Credit window offered", kind: "terms" },
  {
    key: "safeguard",
    label: "Safe Guard",
    note: "Held against rejections and rework",
    kind: "provision",
    provision: "safeguard",
  },
  {
    key: "commission",
    label: "Commission / PLI",
    note: "Buying-house commission",
    kind: "provision",
    provision: "commission",
  },
  {
    key: "certification",
    label: "Certification",
    note: "GOTS, OCS, LAW label",
    kind: "provision",
    provision: "testingCost",
  },
  {
    key: "pkgAcc",
    label: "Packaging + Acc.",
    note: "Export packing and accessories",
    kind: "provision",
    provision: "pkgAcc",
  },
  {
    key: "inspectionFreight",
    label: "Insurance + Freight",
    note: "Inspection and inland freight",
    kind: "provision",
    provision: "inspectionFreight",
  },
  {
    key: "ecgcDocBc",
    label: "ECGC + Doc + BC",
    note: "Credit insurance and bank charges",
    kind: "provision",
    provision: "ecgcDocBc",
  },
  {
    key: "cnf",
    label: "C & F",
    note: "Clearing and forwarding",
    kind: "provision",
    provision: "cnf",
  },
  {
    key: "total",
    label: "Total Provision",
    note: "Purchase and sale side combined",
    kind: "total",
  },
];

/** Every provision line, grouped the way the sheet groups them. */
export const PROVISIONS_BY_SIDE = {
  purchase: PROVISIONS.filter((p) => p.side === "purchase"),
  sale: PROVISIONS.filter((p) => p.side === "sale"),
};

/** The combined provision load, % of direct cost. */
export function totalProvisionPct(rates: ProvisionRates): number {
  return Math.round(PROVISIONS.reduce((t, p) => t + (rates[p.id] ?? 0), 0) * 100) / 100;
}

/* ------------------------------------------------------------------ *
 * Special packing
 * ------------------------------------------------------------------ */

/**
 * The packing charged per unit, itemised.
 *
 * The sheet carries this as a free-text note beside the assumptions because it
 * is an absolute rupee figure rather than a percentage — the one commercial
 * input that does not scale with cost. Kept as data so the panel and the cost
 * build-up quote the same numbers.
 */
export type SplPackLine = {
  code: string;
  label: string;
  parts: { name: string; inr: number }[];
  totalInr: number;
};

export const SPL_PACK: SplPackLine[] = [
  {
    code: "PM (S/4)",
    label: "Placemat, set of four",
    parts: [
      { name: "Swingtag", inr: 7.5 },
      { name: "Barcode sticker", inr: 3.5 },
      { name: "Polybag", inr: 7.0 },
    ],
    totalInr: 18.0,
  },
  {
    code: "PM (Pce)",
    label: "Placemat, per piece",
    parts: [
      { name: "Swingtag", inr: 6.0 },
      { name: "Polybag", inr: 7.0 },
    ],
    totalInr: 13.0,
  },
  {
    code: "RNR",
    label: "Runner",
    parts: [
      { name: "Header card", inr: 24.0 },
      { name: "Barcode sticker", inr: 1.0 },
      { name: "Plastic hanger", inr: 6.0 },
      { name: "PP polybag", inr: 3.0 },
    ],
    totalInr: 34.0,
  },
];
