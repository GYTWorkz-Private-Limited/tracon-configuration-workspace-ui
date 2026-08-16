/**
 * What did this quotation actually price against?
 *
 * A quotation is built from master rates that keep moving after it is sent —
 * mills revise fabric prices, process rates get renegotiated. The quote itself
 * re-costs live, but the COMMITMENT the buyer holds was made at a moment in
 * time. This store pins that moment: every master a costing referenced, the
 * rate it used, and the date it used it — so a later refresh of the masters
 * can be compared against what was promised, and a price that has since risen
 * can flag the quotation as at risk before anyone honours it at a loss.
 *
 * Same store pattern as `recostingStore`: useSyncExternalStore + localStorage,
 * a server snapshot for SSR, and a shape-checked load so a stale or foreign
 * payload degrades to "no snapshots" instead of crashing the quotation screen.
 */

import { useSyncExternalStore } from "react";
import { finalOf } from "./costingModel";

export type MasterRef = {
  masterId: string;
  code: string;
  name: string;
  kind: "fabric" | "process" | "accessory";
  rateUsed: number;
  rateUnit: string;
  /** ISO date — the day this rate was read off the master */
  asOf: string;
};

export type CostingSnapshot = {
  quotationId: string;
  takenAt: string;
  refs: MasterRef[];
};

type State = Record<string, CostingSnapshot>;

const STORAGE_KEY = "tracon.masterSnapshots.v1";

/** Rates recorded longer ago than this are stale — refresh before sending. */
export const STALE_AFTER_DAYS = 30;

/** Drift below this is rounding noise, not a commercial risk. */
export const RISEN_THRESHOLD_PCT = 2;

let state: State = {};
const listeners = new Set<() => void>();

/**
 * Anything in localStorage could have been written by an older build — only
 * entries that still look like snapshots survive the load.
 */
function isSnapshot(v: unknown): v is CostingSnapshot {
  if (!v || typeof v !== "object") return false;
  const s = v as CostingSnapshot;
  return (
    typeof s.quotationId === "string" &&
    typeof s.takenAt === "string" &&
    Array.isArray(s.refs) &&
    s.refs.every(
      (r) =>
        r &&
        typeof r.masterId === "string" &&
        typeof r.rateUsed === "number" &&
        typeof r.asOf === "string",
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
      if (isSnapshot(v)) next[k] = v;
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

function useSnapshots(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

/** Subscribed read for one quotation. */
export function useSnapshot(quotationId?: string): CostingSnapshot | undefined {
  const all = useSnapshots();
  return quotationId ? all[quotationId] : undefined;
}

/** Unsubscribed read, for event handlers and non-React callers. */
export function snapshotFor(quotationId: string): CostingSnapshot | undefined {
  return state[quotationId];
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Pin what a quotation referenced.
 *
 * Idempotent per day: the quotation screen re-prices on every render, so this
 * gets called far more often than rates actually change. Re-recording the same
 * quotation on the same day with the same refs is a no-op — otherwise the
 * snapshot is replaced, because the latest pricing pass IS the reference set.
 */
export function recordSnapshot(quotationId: string, refs: MasterRef[]) {
  const existing = state[quotationId];
  if (
    existing &&
    existing.takenAt.slice(0, 10) === todayIso() &&
    JSON.stringify(existing.refs) === JSON.stringify(refs)
  ) {
    return;
  }
  state = {
    ...state,
    [quotationId]: { quotationId, takenAt: new Date().toISOString(), refs },
  };
  emit();
}

/**
 * Pull every material master reference out of a quotation's priced views.
 *
 * Views are typed loosely as `any[]` on purpose: their shape lives on the
 * quotation side, and importing it here would close an import cycle — the
 * quotation already imports this store to record its snapshots.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function snapshotFromViews(views: any[]): MasterRef[] {
  const asOf = todayIso();
  const refs: MasterRef[] = [];
  const seen = new Set<string>();

  for (const view of views ?? []) {
    const components = view?.priced?.rollup?.components ?? [];
    for (const c of components) {
      const master = c?.material?.master;
      if (!master || seen.has(master.id)) continue;
      seen.add(master.id);
      refs.push({
        masterId: master.id,
        code: master.code,
        name: master.name,
        kind: "fabric",
        // The FINAL rate — an override on the component is the rate the
        // quotation actually promised, not the master's list price.
        rateUsed: finalOf(c.material.rate),
        rateUnit: c.material.rateUnit,
        asOf,
      });
    }
  }

  return refs;
}

/**
 * SIMULATED master-refresh feed.
 *
 * In production this would read the master's rate as it stands TODAY from the
 * rate service. The demo has no feed and no elapsed time, so drift is derived
 * deterministically from the master id instead: the same master always moves
 * the same way, which lets the at-risk banner be demonstrated (and tested)
 * without waiting for a real refresh. Roughly a third of masters rise, a
 * third hold, a third soften — the mix a periodic refresh actually produces.
 */
export function currentRateOf(masterId: string, recordedRate: number): number {
  let hash = 0;
  for (let i = 0; i < masterId.length; i++) hash += masterId.charCodeAt(i);
  // Two of three masters drift upward (at different magnitudes) so a
  // quotation touching even one or two fabrics reliably has something for
  // the at-risk banner to say — a cotton market that only ever fell would
  // make the warning undemonstrable.
  if (hash % 3 === 0) return recordedRate * 1.08;
  if (hash % 3 === 2) return recordedRate * 1.05;
  return recordedRate * 0.97;
}

export type RiskAssessment = {
  /** oldest recorded rate is more than STALE_AFTER_DAYS old */
  stale: boolean;
  risen: { ref: MasterRef; currentRate: number; pctUp: number }[];
};

/**
 * Is this quotation still safe to honour?
 *
 * "Risen" only counts moves above RISEN_THRESHOLD_PCT — a fraction of a
 * percent is rounding, not a reason to alarm the commercial team. Softened
 * rates are deliberately ignored: a price that FELL makes the quote more
 * profitable, and the banner exists to catch losses, not windfalls.
 */
export function riskAssessment(snapshot: CostingSnapshot): RiskAssessment {
  const now = Date.now();
  const staleMs = STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const stale = snapshot.refs.some((r) => {
    const at = new Date(r.asOf).getTime();
    return Number.isFinite(at) && now - at > staleMs;
  });

  const risen: RiskAssessment["risen"] = [];
  for (const ref of snapshot.refs) {
    const currentRate = currentRateOf(ref.masterId, ref.rateUsed);
    if (ref.rateUsed <= 0) continue;
    const pctUp = ((currentRate - ref.rateUsed) / ref.rateUsed) * 100;
    if (pctUp > RISEN_THRESHOLD_PCT) risen.push({ ref, currentRate, pctUp });
  }

  return { stale, risen };
}
