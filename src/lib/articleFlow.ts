// Per-article workflow stage (UI demo).
// Demo rule: Placemat & Runner move through the flow together; Napkin stays in Approval.

import { useSyncExternalStore } from "react";

export type FlowStage = "Product" | "Configuration" | "Costing" | "Approval" | "Quotation";

const ORDER: FlowStage[] = ["Product", "Configuration", "Costing", "Approval", "Quotation"];

type State = { reached: FlowStage };
let state: State = { reached: "Product" };

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useArticleFlow() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

/** Napkin is parked in approval for the demo. */
export function isPendingApproval(name: string) {
  return name.trim().toLowerCase() === "napkin";
}

/** Advance the shared demo progress (monotonic). */
export function recordStage(stage: FlowStage) {
  if (ORDER.indexOf(stage) <= ORDER.indexOf(state.reached)) return;
  state = { reached: stage };
  emit();
}

/** Stage an article currently sits in. */
export function stageOf(article: { name: string }, reached: FlowStage): FlowStage {
  return isPendingApproval(article.name) ? "Approval" : reached;
}

/** True once the main flow has landed on Quotation (unlocks set/kit quoting). */
export function quotationReached(reached: FlowStage) {
  return reached === "Quotation";
}
