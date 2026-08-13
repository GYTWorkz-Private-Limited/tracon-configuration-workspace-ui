/**
 * "This article has to be costed again."
 *
 * When a quotation rejects a line, the costing team has to hear about it on
 * THEIR screens — an article sent back for recosting that still looks finished
 * in Costing is how a quotation sits blocked for a week.
 *
 * What travels back is a STATUS and a reason, never a number. Nothing here
 * writes into Configuration or Costing data: the quotation records that it
 * asked, and the costing team answers by re-costing and marking the article
 * ready again.
 *
 *   Quotation  → reject a line          → requestRecost()
 *   Costing    → sees it, re-costs      → Mark as Ready clears it
 */

import { useSyncExternalStore } from "react";
import { clearReadyForQuotation, readinessKey } from "./quotationReadiness";

export type RecostRequest = {
  podId: string;
  articleId: string;
  /** the quotation that asked, so Costing can see what is waiting on it */
  quotationId: string;
  reason: string;
  at: string;
  by: string;
};

type State = Record<string, RecostRequest>;

const STORAGE_KEY = "tracon.recosting.v1";

let state: State = {};
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw) as State;
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

export function useRecostRequests(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

/** Subscribed read for one article. */
export function useRecostRequest(podId?: string, articleId?: string): RecostRequest | undefined {
  const all = useRecostRequests();
  if (!podId || !articleId) return undefined;
  return all[readinessKey(podId, articleId)];
}

/**
 * Does any article of this POD have a live recosting ask?
 *
 * The POD dashboard's status column answers "what is this order waiting on",
 * and an article sent back from a quotation is exactly that kind of wait —
 * whatever the stored status says, the truthful answer is "recosting".
 */
export function podHasRecostIn(snapshot: State, podId: string): boolean {
  const prefix = `${podId}::`;
  return Object.keys(snapshot).some((k) => k.startsWith(prefix));
}

export function recostRequestIn(
  snapshot: State,
  podId: string,
  articleId: string,
): RecostRequest | undefined {
  return snapshot[readinessKey(podId, articleId)];
}

/**
 * Ask for a recost.
 *
 * Readiness is withdrawn at the same time, and that is the point: "ready to be
 * quoted" was a sign-off on a costing somebody has now questioned. It has to
 * be given again deliberately, which is exactly what Mark as Ready is for.
 */
export function requestRecost(input: {
  podId: string;
  articleId: string;
  quotationId: string;
  reason: string;
  by?: string;
}) {
  const key = readinessKey(input.podId, input.articleId);
  state = {
    ...state,
    [key]: {
      podId: input.podId,
      articleId: input.articleId,
      quotationId: input.quotationId,
      reason: input.reason,
      at: new Date().toISOString(),
      by: input.by ?? "Gautam Kitclu",
    },
  };
  emit();
  clearReadyForQuotation(input.podId, input.articleId);
}

/** The ask is withdrawn — either re-costed, or rejected by mistake. */
export function clearRecost(podId: string, articleId: string) {
  const key = readinessKey(podId, articleId);
  if (!state[key]) return;
  const next = { ...state };
  delete next[key];
  state = next;
  emit();
}

export const RECOSTING_LABEL = "Recosting requested";
