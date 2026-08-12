/**
 * The quotation draft for a POD.
 *
 * This store holds SELECTIONS, never costs. A quote line records which
 * scenario, which variant/option and which quantity the commercial team chose;
 * the numbers are produced on read by `quotationPricing`, from the same engine
 * Configuration uses. That is what makes Quotation "the commercially selected
 * version of the costing" rather than a second costing system.
 *
 *   Quote (POD)
 *     ├── Item — a single product
 *     │     └── Line: scenario → variant → option → MOQ
 *     └── Item — a kit
 *           ├── Member: article + units per set + its own line
 *           └── Member: …
 */

import { useSyncExternalStore } from "react";
import { getPod, type Article } from "./podsStore";
import { SCENARIO_PRESETS } from "./scenarios";
import { BASE_BUILD } from "./costingSelectionStore";
import type { ProvisionRates } from "./commercialProvisions";
import { isReadyForQuotation } from "./quotationReadiness";

/** One configured, quotable line: a scenario/variant/option at a quantity. */
export type QuoteLine = {
  id: string;
  scenarioId: string;
  buildId: string;
  /** quantity being quoted, when it differs from the build's own MOQ */
  moqOverride?: number;
  /** margin held on this line, when it differs from the quote default */
  targetMarginPct?: number;
};

/** One article inside a kit — keeps its own scenario, variant, option and MOQ. */
export type QuoteKitMember = {
  id: string;
  /** the underlying article this member is costed from */
  articleId: string;
  srfRef: string;
  name: string;
  image?: string;
  size?: string;
  moq?: string;
  /** how many of this article make up one set */
  unitsPerSet: number;
  line: QuoteLine;
};

export type QuoteItem = {
  id: string;
  kind: "product" | "kit";
  /** the POD article this item quotes (the kit article itself, for a kit) */
  articleId: string;
  srfRef: string;
  name: string;
  image?: string;
  size?: string;
  moq?: string;
  /** a product's configured lines — one per scenario/variant/option added */
  lines: QuoteLine[];
  /**
   * Which line is the position actually being quoted. Several scenarios can
   * sit on a product for comparison, but exactly one is the price that goes to
   * the buyer — otherwise the summary below would be ambiguous.
   */
  quotedLineId?: string;
  /** a kit's member articles */
  members: QuoteKitMember[];
  /** kits default to expanded; the user can fold one down to its set price */
  collapsed: boolean;
  /** commercial overrides held at item level */
  rates: Partial<ProvisionRates>;
  targetMarginPct?: number;
  /** sets being quoted, for a kit */
  sets?: number;
};

export type QuoteDraft = {
  podId: string;
  items: QuoteItem[];
  /** quote-wide commercial defaults, inherited by every item that has none */
  rates: Partial<ProvisionRates>;
  updatedAt: string;
};

type State = Record<string, QuoteDraft>;

const STORAGE_KEY = "tracon.quoteDraft.v2";

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

const serverState: State = {};

function useQuoteDrafts(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

export function useQuoteDraft(podId: string): QuoteDraft | undefined {
  return useQuoteDrafts()[podId];
}

let seq = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const stamp = () => new Date().toISOString();

const baseLine = (): QuoteLine => ({
  id: uid("QL"),
  scenarioId: SCENARIO_PRESETS[0].id,
  buildId: BASE_BUILD.id,
});

function write(podId: string, fn: (d: QuoteDraft) => QuoteDraft) {
  const current: QuoteDraft = state[podId] ?? {
    podId,
    items: [],
    rates: {},
    updatedAt: stamp(),
  };
  state = { ...state, [podId]: { ...fn(current), updatedAt: stamp() } };
  emit();
}

/* ------------------------------------------------------------------ *
 * Building the draft
 * ------------------------------------------------------------------ */

/** Turn a POD article into a quote item — kits keep their member structure. */
function itemFromArticle(article: Article): QuoteItem {
  const isKit = article.type === "kit";
  const lines = isKit ? [] : [baseLine()];
  return {
    id: uid("QI"),
    kind: isKit ? "kit" : "product",
    articleId: article.id,
    srfRef: article.srfRef,
    name: article.name,
    image: article.image,
    size: article.size,
    moq: article.moq,
    lines,
    quotedLineId: lines[0]?.id,
    members: isKit
      ? (article.kitItems ?? []).map((k) => ({
          id: uid("QM"),
          articleId: k.id,
          srfRef: k.srfRef ?? article.srfRef,
          name: k.name,
          image: k.image,
          size: k.size,
          moq: k.moq,
          unitsPerSet: k.qty > 0 ? k.qty : 1,
          line: baseLine(),
        }))
      : [],
    // A kit opens expanded — the whole point is that the buyer and the
    // approver can see what is in the set before they read its price.
    collapsed: false,
    rates: {},
  };
}

/**
 * Ensure the POD has a draft, and return it.
 *
 * Creates the shell only — it never puts an article on the quote. What gets
 * quoted is an explicit choice made in the selection modal, so landing on the
 * Quotation step can't silently add whatever article the route happened to
 * point at (least of all one nobody has marked ready).
 */
export function ensureQuoteFor(podId: string): QuoteDraft {
  write(podId, (d) => d);
  return state[podId];
}

/**
 * Put articles on the quote.
 *
 * Readiness is re-checked here rather than trusted from the caller: it is the
 * rule that separates costing from quotation, and a rule enforced only in the
 * UI is a rule that holds until the next caller.
 */
export function addProducts(podId: string, articleIds: string[]) {
  const pod = getPod(podId);
  if (!pod) return;
  write(podId, (d) => {
    const add = pod.articles
      .filter((a) => articleIds.includes(a.id))
      .filter((a) => isReadyForQuotation(podId, a.id))
      .filter((a) => !d.items.some((i) => i.articleId === a.id));
    if (add.length === 0) return d;
    return { ...d, items: [...d.items, ...add.map(itemFromArticle)] };
  });
}

export function removeItem(podId: string, itemId: string) {
  write(podId, (d) => ({ ...d, items: d.items.filter((i) => i.id !== itemId) }));
}

export function toggleCollapsed(podId: string, itemId: string) {
  write(podId, (d) => ({
    ...d,
    items: d.items.map((i) => (i.id === itemId ? { ...i, collapsed: !i.collapsed } : i)),
  }));
}

/* ------------------------------------------------------------------ *
 * Lines — a product's scenario / variant / option selections
 * ------------------------------------------------------------------ */

/** Add an existing costing scenario to a product as a new quotable line. */
export function addLine(
  podId: string,
  itemId: string,
  input: { scenarioId: string; buildId?: string; moqOverride?: number },
) {
  write(podId, (d) => ({
    ...d,
    items: d.items.map((i) =>
      i.id === itemId
        ? {
            ...i,
            lines: [
              ...i.lines,
              {
                id: uid("QL"),
                scenarioId: input.scenarioId,
                buildId: input.buildId ?? BASE_BUILD.id,
                moqOverride: input.moqOverride,
              },
            ],
          }
        : i,
    ),
  }));
}

export function updateLine(
  podId: string,
  itemId: string,
  lineId: string,
  patch: Partial<Omit<QuoteLine, "id">>,
) {
  const apply = (l: QuoteLine) => (l.id === lineId ? { ...l, ...patch } : l);
  write(podId, (d) => ({
    ...d,
    items: d.items.map((i) =>
      i.id !== itemId
        ? i
        : {
            ...i,
            lines: i.lines.map(apply),
            members: i.members.map((m) => ({ ...m, line: apply(m.line) })),
          },
    ),
  }));
}

export function removeLine(podId: string, itemId: string, lineId: string) {
  write(podId, (d) => ({
    ...d,
    items: d.items.map((i) => {
      // The last line is what identifies the product on the quote — removing
      // it would leave a nameless row, so it is kept.
      if (i.id !== itemId || i.lines.length <= 1) return i;
      const lines = i.lines.filter((l) => l.id !== lineId);
      return {
        ...i,
        lines,
        // Never leave the summary pointing at a line that no longer exists.
        quotedLineId: i.quotedLineId === lineId ? lines[0]?.id : i.quotedLineId,
      };
    }),
  }));
}

/** Choose which configured position is the price that goes to the buyer. */
export function setQuotedLine(podId: string, itemId: string, lineId: string) {
  write(podId, (d) => ({
    ...d,
    items: d.items.map((i) => (i.id === itemId ? { ...i, quotedLineId: lineId } : i)),
  }));
}
