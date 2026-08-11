// Quotation Workspace — UI-only demo state for the final workflow step.
// Holds the customer-facing quotation details (editable in the right panel),
// deterministic demo pricing and the "Sent for Quotation" status.

import { useSyncExternalStore } from "react";

export const QUOTE_COMPANY = {
  name: "Tracon Exports Pvt. Ltd.",
  logoLabel: "T",
  tagline: "Home textiles · Table linen · Bath",
  address: "Plot 42, SIDCO Industrial Estate, Karur 639002, Tamil Nadu, India",
  contact: "+91 4324 240 118 · exports@tracon.co · www.tracon.co",
  gst: "GSTIN 33AABCT1429P1ZQ · IEC 0488091234",
  signatory: { name: "Gautam Kitclu", role: "Head of Merchandising" },
} as const;

export type QuoteDetails = {
  deliveryTerms: string;
  paymentTerms: string;
  leadTime: string;
  validity: string;
  currency: string;
  notes: string;
  customerRemarks: string;
};

export const DEFAULT_QUOTE_DETAILS: QuoteDetails = {
  deliveryTerms: "FOB Nhava Sheva, India",
  paymentTerms: "TT 30% advance, 70% against BL copy",
  leadTime: "75–90 days from order confirmation & approved counter-sample",
  validity: "30 days from date of quotation",
  currency: "USD",
  notes:
    "Prices quoted per piece, packed in export-worthy cartons. Rates subject to yarn and FX variation beyond ±3%.",
  customerRemarks: "",
};

export type QuoteKit = {
  id: string;
  name: string;
  articleIds: string[];
};

type State = {
  details: QuoteDetails;
  /** article ids whose quotation has been sent (UI demo) */
  sent: string[];
  /** per-article unit price overrides (editable in the document) */
  priceOverrides: Record<string, number>;
  /** combined set / kit quotations assembled from multiple articles */
  kits: QuoteKit[];
};

let state: State = { details: DEFAULT_QUOTE_DETAILS, sent: [], priceOverrides: {}, kits: [] };

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useQuoteWorkspace() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export function setQuoteDetail<K extends keyof QuoteDetails>(key: K, value: QuoteDetails[K]) {
  state = { ...state, details: { ...state.details, [key]: value } };
  emit();
}

export function markQuotationSent(articleIds: string[]) {
  const next = new Set([...state.sent, ...articleIds]);
  state = { ...state, sent: Array.from(next) };
  emit();
}

/* ----------------------- editable prices ----------------------- */

export function setPriceOverride(articleId: string, price: number) {
  state = { ...state, priceOverrides: { ...state.priceOverrides, [articleId]: price } };
  emit();
}

export function clearPriceOverride(articleId: string) {
  const next = { ...state.priceOverrides };
  delete next[articleId];
  state = { ...state, priceOverrides: next };
  emit();
}

export function clearAllPriceOverrides() {
  state = { ...state, priceOverrides: {} };
  emit();
}

/* --------------------- set / kit quotations --------------------- */

export function createKit(name: string, articleIds: string[]): QuoteKit {
  const kit: QuoteKit = {
    id: `KIT-${state.kits.length + 1}-${Date.now().toString(36)}`,
    name,
    articleIds,
  };
  state = { ...state, kits: [...state.kits, kit] };
  emit();
  return kit;
}

export function removeKit(id: string) {
  state = { ...state, kits: state.kits.filter((k) => k.id !== id) };
  emit();
}

/* --------------------------- demo pricing --------------------------- */

const UNIT_PRICE: Record<string, number> = {
  placemat: 1.62,
  runner: 4.95,
  napkin: 0.98,
  "bath towel": 6.07,
  "hand towel": 3.24,
  "cushion cover": 4.4,
  "table runner": 4.95,
};

/** Stable customer-facing unit price (USD) for a product name. */
export function unitPriceFor(name: string): number {
  const key = name.trim().toLowerCase();
  if (UNIT_PRICE[key]) return UNIT_PRICE[key];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return Number((2 + (h % 500) / 100).toFixed(2));
}

export function quantityFor(moq: string): number {
  const n = Number(String(moq).replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 1000;
}

export const usd = (n: number, d = 2) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;

export function quotationNumber(podId: string) {
  return `QTN/${podId.replace(/[^A-Z0-9]/gi, "")}/26-27`;
}

export function todayLabel() {
  return new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
