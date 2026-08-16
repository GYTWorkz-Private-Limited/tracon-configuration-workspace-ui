/**
 * What Configuration & Costing has decided about an article.
 *
 * Quotation is the commercial layer — it must not invent costing values, and
 * it must not hold its own copy of them. So the Configuration workspace
 * PUBLISHES its decisions here (which scenarios are open, which variants and
 * options exist, what parameters each one selects) and Quotation READS them,
 * then re-runs the same costing engine to get the numbers.
 *
 * Only DEFINITIONS live here, never computed costs. That is what keeps the two
 * screens honest: change a scenario in Configuration and the quotation moves,
 * because the quote is re-costed from the definition rather than from a
 * snapshot somebody took earlier.
 *
 *   Article
 *     └── Scenario (a whole costing position)
 *           └── Variant (a way of building it)
 *                 └── Option (one parameter changed inside a variant)
 */

import { useSyncExternalStore } from "react";
import type { ParameterId, ParameterOption } from "./costingModel";
import { SCENARIO_PRESETS, type Scenario } from "./scenarios";

/**
 * One parameter this build pins. The whole option travels, not just its id, so
 * a value the costing team typed by hand ("MOQ 7,500") rebuilds exactly the
 * same way a preset tier does.
 */
export type ParameterPin = { parameterId: ParameterId; option: ParameterOption };

/**
 * A build inside a scenario. `kind` is the distinction the quotation has to
 * make visible: a VARIANT is a different way of building the product, an
 * OPTION is one parameter changed inside a variant.
 */
export type BuildRef = {
  id: string;
  name: string;
  kind: "variant" | "option";
  /** an option always names the variant it branched off */
  parentId?: string;
  /** what this build pins, applied on top of the scenario */
  pins: ParameterPin[];
  /** free-text note captured when the build was created */
  description?: string;
};

export type ArticleSelection = {
  podId: string;
  articleId: string;
  srfRef: string;
  /** scenarios currently open for this article, base first */
  scenarios: Scenario[];
  activeScenarioId: string;
  /** variants and options currently open, base variant first */
  builds: BuildRef[];
  activeBuildId: string;
  updatedAt: string;
};

export type State = Record<string, ArticleSelection>;

const STORAGE_KEY = "tracon.costingSelection.v1";

export const selectionKey = (podId: string, articleId: string) => `${podId}::${articleId}`;

let state: State = {};
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw) as State;
  } catch {
    // A corrupt entry must not take the workspace down — start clean.
    state = {};
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

/** Stable empty snapshot so SSR and the first client render agree. */
const serverState: State = {};

export function useCostingSelections(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

export const BASE_BUILD: BuildRef = {
  id: "BASE",
  name: "Base Build",
  kind: "variant",
  pins: [],
};

/**
 * The scenarios an article offers the quotation: whatever Configuration has
 * open, falling back to the standard preset list for an article nobody has
 * opened yet. A quotation should never show an empty scenario picker just
 * because the costing workspace has not been visited in this browser.
 *
 * Takes the store snapshot rather than reading module state, so every caller
 * has to hold a subscription to it — a lookup that read `state` directly would
 * silently stop updating when a scenario is added while the screen is open.
 */
export function scenariosIn(snapshot: State, podId: string, articleId: string): Scenario[] {
  const sel = snapshot[selectionKey(podId, articleId)];
  return sel && sel.scenarios.length > 0 ? sel.scenarios : SCENARIO_PRESETS;
}

/** The variants and options an article offers, with a base build guaranteed. */
export function buildsIn(snapshot: State, podId: string, articleId: string): BuildRef[] {
  const sel = snapshot[selectionKey(podId, articleId)];
  return sel && sel.builds.length > 0 ? sel.builds : [BASE_BUILD];
}

/**
 * Unsubscribed reads — for stores and event handlers, never for render.
 * A component that called these would silently stop updating.
 */
export const buildsFor = (podId: string, articleId: string): BuildRef[] =>
  buildsIn(state, podId, articleId);

export const scenariosFor = (podId: string, articleId: string): Scenario[] =>
  scenariosIn(state, podId, articleId);

/** Subscribed read for one article — what components should use. */
export function useArticleSelection(podId: string, articleId: string) {
  const snapshot = useCostingSelections();
  return {
    scenarios: scenariosIn(snapshot, podId, articleId),
    builds: buildsIn(snapshot, podId, articleId),
  };
}

/**
 * Configuration publishes its current state. Called on every meaningful change
 * so Quotation always reflects what the costing team has actually opened.
 */
export function publishSelection(input: {
  podId: string;
  articleId: string;
  srfRef: string;
  scenarios: Scenario[];
  activeScenarioId: string;
  builds: BuildRef[];
  activeBuildId: string;
}) {
  const key = selectionKey(input.podId, input.articleId);
  const prev = state[key];
  const next: ArticleSelection = { ...input, updatedAt: new Date().toISOString() };

  // Publishing runs inside render-adjacent effects, so an unchanged payload
  // must not emit — otherwise the workspace re-renders itself forever.
  if (prev && sameSelection(prev, next)) return;

  state = { ...state, [key]: next };
  emit();
}

function sameSelection(a: ArticleSelection, b: ArticleSelection): boolean {
  return (
    a.srfRef === b.srfRef &&
    a.activeScenarioId === b.activeScenarioId &&
    a.activeBuildId === b.activeBuildId &&
    JSON.stringify(a.scenarios) === JSON.stringify(b.scenarios) &&
    JSON.stringify(a.builds) === JSON.stringify(b.builds)
  );
}

/**
 * A scenario created from inside Quotation. It lands in the same place
 * Configuration's scenarios live, so the two screens keep one list rather than
 * growing a second, quotation-only notion of "scenario".
 */
export function addScenario(podId: string, articleId: string, scenario: Scenario) {
  const key = selectionKey(podId, articleId);
  const prev = state[key];
  const base: ArticleSelection = prev ?? {
    podId,
    articleId,
    srfRef: "",
    scenarios: SCENARIO_PRESETS.slice(0, 1),
    activeScenarioId: SCENARIO_PRESETS[0].id,
    builds: [BASE_BUILD],
    activeBuildId: BASE_BUILD.id,
    updatedAt: new Date().toISOString(),
  };
  if (base.scenarios.some((s) => s.id === scenario.id)) return;

  state = {
    ...state,
    [key]: {
      ...base,
      scenarios: [...base.scenarios, scenario],
      updatedAt: new Date().toISOString(),
    },
  };
  emit();
}
