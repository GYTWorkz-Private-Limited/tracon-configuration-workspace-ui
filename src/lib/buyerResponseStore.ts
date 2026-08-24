/**
 * What the buyer said, and when.
 *
 * The internal lifecycle ends at "approved — sent to buyer"; everything after
 * that is the buyer's move: accept, counter, ask for a revision, reject, or go
 * quiet. This store records those moves as a TIMELINE, never overwriting — a
 * buyer who countered in June and accepted in July is a negotiation, and
 * flattening it to the last word loses the story the next quotation needs.
 *
 * It also carries two one-way flags that belong to the same conversation:
 * `riskAcceptedAt` (the commercial team saw the input-cost drift and chose to
 * honour the price anyway) and `convertedAt` (the acceptance became an order).
 *
 * Same store pattern as the rest of the app: useSyncExternalStore over
 * localStorage, shape-checked load, server snapshot for SSR.
 */

import { useSyncExternalStore } from "react";

export type BuyerOutcome =
  | "accepted"
  | "counter"
  | "revision"
  | "rejected_price"
  | "rejected_moq"
  | "no_response";

export const BUYER_OUTCOME_LABEL: Record<BuyerOutcome, string> = {
  accepted: "Accepted as quoted",
  counter: "Accepted with counter price",
  revision: "Revision requested",
  rejected_price: "Rejected — Price",
  rejected_moq: "Rejected — MOQ",
  no_response: "No response — follow-up required",
};

export type BuyerResponse = {
  id: string;
  outcome: BuyerOutcome;
  /** the buyer's number, when the outcome is a counter */
  counterPriceUsd?: number;
  /** the buyer's asked MOQ, when the rejection was about quantity */
  requestedMoq?: string;
  comments?: string;
  /** when to chase, when the outcome is silence */
  followUpDate?: string;
  recordedBy: string;
  recordedAt: string;
};

export type BuyerRecord = {
  quotationId: string;
  /** newest first — the latest entry is the quotation's current position */
  responses: BuyerResponse[];
  /** input-cost drift acknowledged — the price stands despite the risk */
  riskAcceptedAt?: string;
  riskAcceptedBy?: string;
  /** the acceptance became an order */
  convertedAt?: string;
  /** order value at conversion, USD — pinned so a later re-price cannot move it */
  orderValueUsd?: number;
};

type State = Record<string, BuyerRecord>;

const STORAGE_KEY = "tracon.buyerResponses.v1";

let state: State = {};
const listeners = new Set<() => void>();

function isRecord(v: unknown): v is BuyerRecord {
  if (!v || typeof v !== "object") return false;
  const r = v as BuyerRecord;
  return (
    typeof r.quotationId === "string" &&
    Array.isArray(r.responses) &&
    r.responses.every(
      (x) => x && typeof x.id === "string" && typeof x.outcome === "string",
    )
  );
}

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: State = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (isRecord(v)) next[k] = v;
    }
    state = next;
  } catch {
    state = {};
  }
}

function emit() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }
  listeners.forEach((l) => l());
}

load();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const serverState: State = {};

const blank = (quotationId: string): BuyerRecord => ({ quotationId, responses: [] });

export function useAllBuyerRecords(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

export function useBuyerRecord(quotationId: string): BuyerRecord {
  return useAllBuyerRecords()[quotationId] ?? blank(quotationId);
}

/** The quotation's current position — the newest response, if any. */
export const latestResponse = (r: BuyerRecord | undefined): BuyerResponse | undefined =>
  r?.responses[0];

function write(quotationId: string, fn: (r: BuyerRecord) => BuyerRecord) {
  const current = state[quotationId] ?? blank(quotationId);
  state = { ...state, [quotationId]: fn(current) };
  emit();
}

export function recordBuyerResponse(
  quotationId: string,
  response: Omit<BuyerResponse, "id" | "recordedAt" | "recordedBy"> & { recordedBy?: string },
) {
  write(quotationId, (r) => ({
    ...r,
    // Prepended, never replaced: a changed mind is a second entry, and the
    // timeline keeps both.
    responses: [
      {
        ...response,
        id: `BR-${Date.now()}`,
        recordedBy: response.recordedBy ?? "Gautam Kitclu",
        recordedAt: new Date().toISOString(),
      },
      ...r.responses,
    ],
  }));
}

export function acceptQuotationRisk(quotationId: string, by = "Gautam Kitclu") {
  write(quotationId, (r) => ({
    ...r,
    riskAcceptedAt: new Date().toISOString(),
    riskAcceptedBy: by,
  }));
}

export function markConvertedToOrder(quotationId: string, orderValueUsd: number) {
  write(quotationId, (r) => ({
    ...r,
    convertedAt: new Date().toISOString(),
    orderValueUsd,
  }));
}
