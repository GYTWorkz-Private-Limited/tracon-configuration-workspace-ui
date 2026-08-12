/**
 * "Is this costing ready to be quoted?"
 *
 * Readiness belongs to the ARTICLE, not to the quotation. It is set once, on
 * the Costing Report, when someone confirms the configuration and costing have
 * been reviewed — and it is the gate that decides whether an article can be
 * picked up by a quotation later.
 *
 * Deliberately separate from the quote draft: a quotation can contain one or
 * many ready articles, and an article stays ready whether or not anybody has
 * quoted it yet.
 *
 *   Costing Report  → is this ready?          (this module)
 *   Selection modal → which ready ones do I want?
 *   Quotation       → how do I price them?
 */

import { useSyncExternalStore } from "react";

export type Readiness = {
  podId: string;
  articleId: string;
  /** ISO timestamp of the moment it was marked */
  at: string;
  by: string;
};

type State = Record<string, Readiness>;

const STORAGE_KEY = "tracon.quotationReadiness.v1";

export const readinessKey = (podId: string, articleId: string) => `${podId}::${articleId}`;

/**
 * Demo seed — the state the workflow would be in after the team had signed
 * off part of each programme, so "Continue to Quotation" is reachable on more
 * than one POD without having to click "Mark as Ready" first. At least one
 * article per seeded POD is deliberately left unmarked so the not-ready case
 * stays visible without undoing anything.
 */
function seed(): State {
  const at = new Date().toISOString();
  const by = "Gautam Kitclu";
  const ready = (podId: string, articleId: string): [string, Readiness] => [
    readinessKey(podId, articleId),
    { podId, articleId, at, by },
  ];
  return Object.fromEntries([
    // POD-2046 (Zara Home, table-top programme) — Napkin left not ready.
    ready("POD-2046", "A-PLACEMAT"),
    ready("POD-2046", "A-RUNNER"),
    ready("POD-2046", "A-KIT-TABLETOP"),
    // POD-2041 (Zara Home, cushions) — the other two articles left not ready.
    ready("POD-2041", "A-SRF-1035"),
    // POD-2038 (IKEA) — the quilt stays not ready, still pending approval.
    ready("POD-2038", "A-SRF-1041"),
  ]);
}

let state: State = seed();
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw) as State;
    else persist();
  } catch {
    // A corrupt entry must not take the workflow down.
    state = seed();
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

load();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Stable snapshot so SSR and the first client render agree. */
const serverState: State = seed();

export function useReadiness(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

/** Subscribed read for one article. */
export function useIsReadyForQuotation(podId?: string, articleId?: string): boolean {
  const all = useReadiness();
  if (!podId || !articleId) return false;
  return Boolean(all[readinessKey(podId, articleId)]);
}

/** Unsubscribed read — for stores and event handlers, never for render. */
export function isReadyForQuotation(podId: string, articleId: string): boolean {
  return Boolean(state[readinessKey(podId, articleId)]);
}

export function isReadyIn(snapshot: State, podId: string, articleId: string): boolean {
  return Boolean(snapshot[readinessKey(podId, articleId)]);
}

export function readinessIn(
  snapshot: State,
  podId: string,
  articleId: string,
): Readiness | undefined {
  return snapshot[readinessKey(podId, articleId)];
}

/** The Costing Report's sign-off: this costing is ready to be quoted. */
export function markReadyForQuotation(podId: string, articleId: string, by = "Gautam Kitclu") {
  const key = readinessKey(podId, articleId);
  if (state[key]) return;
  state = { ...state, [key]: { podId, articleId, at: new Date().toISOString(), by } };
  emit();
}

/** Withdraw readiness — a costing that has changed is no longer signed off. */
export function clearReadyForQuotation(podId: string, articleId: string) {
  const key = readinessKey(podId, articleId);
  if (!state[key]) return;
  const next = { ...state };
  delete next[key];
  state = next;
  emit();
}

export const READY_LABEL = "Ready for Quotation";
export const NOT_READY_LABEL = "Not Ready for Quotation";
