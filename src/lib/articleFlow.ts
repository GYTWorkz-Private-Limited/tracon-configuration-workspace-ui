// Per-article workflow stage.
//
// Each article moves through the workflow on its own: one can be approved
// while another is still being configured, and quoting two of them together
// does not drag the third forward. The stage is therefore held PER ARTICLE —
// a single shared "how far have we got" would force every article in a costing
// workspace into the same status, which is exactly what must not happen.

import { useSyncExternalStore } from "react";

export type FlowStage = "Product" | "Configuration" | "Costing" | "Approval" | "Quotation";

const ORDER: FlowStage[] = ["Product", "Configuration", "Costing", "Approval", "Quotation"];

/** Stage reached, keyed by article name — the identity every caller has. */
type State = Record<string, FlowStage>;

let state: State = {};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const serverState: State = {};

export function useArticleFlow(): { reached: FlowStage; stages: State } {
  const stages = useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
  // `reached` is the furthest ANY article has got. Kept for the few callers
  // that ask about the workspace as a whole (e.g. "can a kit be quoted yet");
  // anything about one article must use `stageOf`.
  const reached = Object.values(stages).reduce<FlowStage>(
    (far, s) => (ORDER.indexOf(s) > ORDER.indexOf(far) ? s : far),
    "Product",
  );
  return { reached, stages };
}

/** Napkin is parked in approval for the demo. */
export function isPendingApproval(name: string) {
  return name.trim().toLowerCase() === "napkin";
}

/** Advance one article's progress (monotonic — an article never goes back). */
export function recordStage(stage: FlowStage, articleName?: string) {
  if (!articleName) return;
  const current = state[articleName] ?? "Product";
  if (ORDER.indexOf(stage) <= ORDER.indexOf(current)) return;
  state = { ...state, [articleName]: stage };
  emit();
}

/** Stage an article currently sits in — its own, never the workspace's. */
export function stageOf(
  article: { name: string },
  _reached?: FlowStage,
  stages?: State,
): FlowStage {
  if (isPendingApproval(article.name)) return "Approval";
  return stages?.[article.name] ?? state[article.name] ?? "Product";
}

/** True once any article has landed on Quotation (unlocks set/kit quoting). */
export function quotationReached(reached: FlowStage) {
  return reached === "Quotation";
}
