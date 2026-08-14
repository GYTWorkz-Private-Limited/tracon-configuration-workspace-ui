/**
 * "Which cost structure does this order price against?"
 *
 * A cost template pins the COMMERCIAL provisions — overheads, freight and
 * finance, testing, special packing — before any article is costed. These are
 * the components that get silently missed: testing is 3% for one buyer and the
 * team applies 1% (or nothing) because nobody wrote the buyer's structure down.
 *
 * The template is chosen per POD, right after the POD exists and before styles
 * are configured, so every costing under that order inherits the same
 * provisions instead of each costing sheet re-deciding them.
 *
 *   POD  →  Template (this module)  →  Style  →  Costing
 */

import { useSyncExternalStore } from "react";

export type CostTemplate = {
  id: string;
  name: string;
  kind: "general" | "buyer";
  /** set only for kind "buyer" — matched against the POD's buyer */
  buyer?: string;
  description: string;
  /** commercial provisions the template pins */
  overheadPct: number;
  freightPct: number;
  financePct: number;
  testingPct: number;
  /** ₹/pc */
  specialPackInr: number;
  notes?: string[];
};

/**
 * Seed library. One general fallback plus the buyers whose structures differ
 * enough to have burned the team before — Zara Home's 3% testing is the
 * canonical example of a provision that gets under-applied without a template.
 */
export const TEMPLATES: CostTemplate[] = [
  {
    id: "TPL-STD-EXPORT",
    name: "Standard Export",
    kind: "general",
    description: "House default for buyers without an agreed structure.",
    overheadPct: 12,
    freightPct: 2.5,
    financePct: 1.5,
    testingPct: 1,
    specialPackInr: 0,
    notes: ["Final inspection only", "Standard poly + carton packing"],
  },
  {
    id: "TPL-ZARA-HOME",
    name: "Zara Home",
    kind: "buyer",
    buyer: "Zara Home",
    description: "Inditex protocol — heavier testing and mandated retail packing.",
    overheadPct: 14,
    freightPct: 3,
    financePct: 2,
    testingPct: 3,
    specialPackInr: 6.5,
    notes: [
      "Testing at 3% per Inditex protocol — never 1%",
      "Kraft-sleeve pack mandatory",
      "Inline + final inspection",
    ],
  },
  {
    id: "TPL-IKEA",
    name: "IKEA",
    kind: "buyer",
    buyer: "IKEA",
    description: "High-volume FOB terms — lean overheads, IWAY compliance built in.",
    overheadPct: 10.5,
    freightPct: 2,
    financePct: 1.25,
    testingPct: 2,
    specialPackInr: 3.75,
    notes: ["IWAY audit provision included", "Flat-pack, unit-load carton spec"],
  },
  {
    id: "TPL-WEST-ELM",
    name: "West Elm",
    kind: "buyer",
    buyer: "West Elm",
    description: "US retail — longer credit terms and branded packaging per style.",
    overheadPct: 13,
    freightPct: 3.5,
    financePct: 2.25,
    testingPct: 2.5,
    specialPackInr: 8.5,
    notes: [
      "Fair Trade premium carried in overheads",
      "Branded hang-tag + belly band per piece",
      "90-day payment terms drive finance provision",
    ],
  },
];

export function templateById(id: string): CostTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/** podId → templateId. The template body always comes from TEMPLATES by id. */
type State = Record<string, string>;

const STORAGE_KEY = "tracon.podTemplate.v1";

let state: State = {};
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return;
    // Stored state outlives the code that wrote it: keep only entries that
    // still point at a template this build knows, so a renamed or retired
    // template id degrades to "no template chosen" instead of a broken card.
    const next: State = {};
    for (const [podId, templateId] of Object.entries(parsed)) {
      if (typeof templateId === "string" && templateById(templateId)) next[podId] = templateId;
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

/** Stable snapshot so SSR and the first client render agree. */
const serverState: State = {};

export function useTemplateChoices(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

/** Subscribed read for one POD. */
export function useTemplateFor(podId: string): CostTemplate | undefined {
  const all = useTemplateChoices();
  const id = all[podId];
  return id ? templateById(id) : undefined;
}

/** Unsubscribed read — for stores and event handlers, never for render. */
export function templateFor(podId: string): CostTemplate | undefined {
  const id = state[podId];
  return id ? templateById(id) : undefined;
}

export function setTemplateFor(podId: string, templateId: string) {
  if (!templateById(templateId)) return;
  if (state[podId] === templateId) return;
  state = { ...state, [podId]: templateId };
  emit();
}

/** The mapping is withdrawn — chosen by mistake, or the buyer terms changed. */
export function clearTemplateFor(podId: string) {
  if (!state[podId]) return;
  const next = { ...state };
  delete next[podId];
  state = next;
  emit();
}
