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
import { BASE_BUILD, buildsFor } from "./costingSelectionStore";
import type { ProvisionRates } from "./commercialProvisions";
import { isReadyForQuotation } from "./quotationReadiness";
import { logQuotationEvent } from "./quotationHistory";

/** One configured, quotable line: a scenario/variant/option at a quantity. */
export type QuoteLine = {
  id: string;
  scenarioId: string;
  buildId: string;
  /** quantity being quoted, when it differs from the build's own MOQ */
  moqOverride?: number;
  /** margin held on this line, when it differs from the quote default */
  targetMarginPct?: number;
  /**
   * Total cost the commercial team fixed by hand on this line, ₹ / pc.
   *
   * A saved decision like every other field here — the costing is still read
   * live from Configuration, and selling price and margin are still derived by
   * `commercialProvisions`. Only the total cost they run from is pinned.
   */
  finalCostOverrideInr?: number;
  /**
   * Selling price fixed by hand on this line, $ / pc.
   *
   * The commercial counterpart of the total-cost override: when the buyer
   * names a price, the price is the input and the margin is the answer.
   */
  sellingPriceOverrideUsd?: number;
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
  /** a kit's hand-fixed total cost, ₹ / set — the set is priced as one position */
  finalCostOverrideInr?: number;
  /** a kit's hand-fixed selling price, $ / set */
  sellingPriceOverrideUsd?: number;
};

/**
 * What the user said they were quoting when they left the Costing Report.
 *
 * "single" is one article quoted on its own — the quotation that has always
 * been generated for that article. "multiple" is the same quotation carrying
 * several selected articles and/or a kit. It changes what is ON the quote and
 * how it is navigated, never how anything is priced.
 */
export type QuoteMode = "single" | "multiple";

export type QuoteDraft = {
  podId: string;
  mode?: QuoteMode;
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

/** Every quotation in the workspace — what the Quotations list reads. */
export function useAllQuoteDrafts(): QuoteDraft[] {
  const all = useQuoteDrafts();
  return Object.values(all).filter((d) => d.items.length > 0);
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

/**
 * Turn a POD article into a quote item — kits keep their member structure.
 *
 * A product arrives with EVERY variant Configuration has published as its own
 * quotable row, not just the base build: the commercial team's job is to pick
 * between the ways the product can be built, and they cannot pick from a list
 * they have to assemble by hand first. Options are not rows — an option is one
 * parameter changed inside a variant, so it belongs on that variant's row.
 */
function itemFromArticle(article: Article, podId: string): QuoteItem {
  const isKit = article.type === "kit";
  const variants = buildsFor(podId, article.id).filter((b) => b.kind === "variant");
  const lines = isKit
    ? []
    : variants.length > 0
      ? variants.map((v) => ({ ...baseLine(), buildId: v.id }))
      : [baseLine()];
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
    for (const a of add) logQuotationEvent(podId, "item_added", `${a.name} added to the quotation`);
    return { ...d, items: [...d.items, ...add.map((a) => itemFromArticle(a, podId))] };
  });
}

/**
 * Open a quotation for exactly these articles.
 *
 * The entry flow — Single Product or Multiple Products / Kit — is where the
 * composition of the quote is decided, so this SETS the item list rather than
 * appending to it ("Add Product" inside the workspace is what appends). An
 * article already on the draft keeps its existing item, so the lines, margins,
 * MOQs and edited total cost someone worked on survive coming back through the
 * selection.
 */
export function startQuotation(podId: string, articleIds: string[], mode: QuoteMode) {
  const pod = getPod(podId);
  if (!pod) return;
  write(podId, (d) => {
    const items = articleIds
      .map((id) => pod.articles.find((a) => a.id === id))
      .filter((a): a is Article => Boolean(a))
      .filter((a) => isReadyForQuotation(podId, a.id))
      .map((a) => d.items.find((i) => i.articleId === a.id) ?? itemFromArticle(a, podId));
    if (items.length === 0) return { ...d, mode };
    logQuotationEvent(
      podId,
      "quotation_started",
      `Quotation opened for ${items.map((i) => i.name).join(", ")} (${mode === "single" ? "single product" : "multiple products / kit"})`,
    );
    return { ...d, mode, items };
  });
}

export function removeItem(podId: string, itemId: string) {
  const name = itemOf(podId, itemId)?.name;
  if (name) logQuotationEvent(podId, "item_removed", `${name} removed from the quotation`);
  write(podId, (d) => ({ ...d, items: d.items.filter((i) => i.id !== itemId) }));
}

/** Unsubscribed lookup, so an action can name what it just changed. */
function itemOf(podId: string, itemId: string): QuoteItem | undefined {
  return state[podId]?.items.find((i) => i.id === itemId);
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
  logQuotationEvent(
    podId,
    "line_added",
    `Configuration row added to ${itemOf(podId, itemId)?.name ?? "an item"}`,
  );
}

export function updateLine(
  podId: string,
  itemId: string,
  lineId: string,
  patch: Partial<Omit<QuoteLine, "id">>,
) {
  logLinePatch(podId, itemId, patch);
  updateLineQuietly(podId, itemId, lineId, patch);
}

/**
 * The same write without the audit line — for callers that log a richer
 * message of their own, so one change never appears in the audit twice.
 */
function updateLineQuietly(
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

/**
 * Turn a line patch into one readable audit line.
 *
 * Lives beside the mutation rather than in the components that call it, so a
 * change made from a screen written next year is logged without that screen
 * having to know the audit exists.
 */
function logLinePatch(podId: string, itemId: string, patch: Partial<Omit<QuoteLine, "id">>) {
  const name = itemOf(podId, itemId)?.name ?? "an item";
  if (patch.moqOverride !== undefined) {
    logQuotationEvent(
      podId,
      "moq_override",
      `${name} — quoted MOQ overridden to ${patch.moqOverride.toLocaleString("en-IN")}`,
    );
  }
  if (patch.targetMarginPct !== undefined) {
    logQuotationEvent(podId, "margin_changed", `${name} — margin set to ${patch.targetMarginPct}%`);
  }
  if ("buildId" in patch && patch.buildId) {
    logQuotationEvent(podId, "option_changed", `${name} — configuration changed on a quoted row`);
  }
}

export function removeLine(podId: string, itemId: string, lineId: string) {
  logQuotationEvent(
    podId,
    "line_removed",
    `Configuration row removed from ${itemOf(podId, itemId)?.name ?? "an item"}`,
  );
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

/* ------------------------------------------------------------------ *
 * Overrides — edited by hand, saved explicitly, always reversible
 * ------------------------------------------------------------------ */

const positive = (n: number | undefined) => (n !== undefined && n > 0 ? n : undefined);

/**
 * Fix (or release) the total cost of a product's quoted line, ₹ / pc.
 *
 * Passing `undefined` hands the line back to the calculated figure, so an edit
 * is always reversible and the costing underneath is never overwritten.
 */
export function setLineFinalCost(
  podId: string,
  itemId: string,
  lineId: string,
  finalCostInr: number | undefined,
) {
  const value = positive(finalCostInr);
  const name = itemOf(podId, itemId)?.name ?? "an item";
  logQuotationEvent(
    podId,
    value === undefined ? "total_cost_reset" : "total_cost_edited",
    value === undefined
      ? `${name} — total cost returned to the calculated figure`
      : `${name} — total cost set to ₹${value.toLocaleString("en-IN")} / pc`,
  );
  updateLineQuietly(podId, itemId, lineId, { finalCostOverrideInr: value });
}

/** Fix (or release) a product line's selling price, $ / pc. */
export function setLineSellingPrice(
  podId: string,
  itemId: string,
  lineId: string,
  sellingUsd: number | undefined,
) {
  const value = positive(sellingUsd);
  const name = itemOf(podId, itemId)?.name ?? "an item";
  logQuotationEvent(
    podId,
    value === undefined ? "selling_price_reset" : "selling_price_edited",
    value === undefined
      ? `${name} — selling price returned to the margin-derived figure`
      : `${name} — selling price set to $${value.toFixed(2)} / pc`,
  );
  updateLineQuietly(podId, itemId, lineId, { sellingPriceOverrideUsd: value });
}

/** Fix (or release) a kit's total cost, ₹ / set. */
export function setItemFinalCost(podId: string, itemId: string, finalCostInr: number | undefined) {
  const value = positive(finalCostInr);
  const name = itemOf(podId, itemId)?.name ?? "a kit";
  logQuotationEvent(
    podId,
    value === undefined ? "total_cost_reset" : "total_cost_edited",
    value === undefined
      ? `${name} — total cost per set returned to the calculated figure`
      : `${name} — total cost set to ₹${value.toLocaleString("en-IN")} / set`,
  );
  write(podId, (d) => ({
    ...d,
    items: d.items.map((i) => (i.id === itemId ? { ...i, finalCostOverrideInr: value } : i)),
  }));
}

/** Fix (or release) a kit's selling price, $ / set. */
export function setItemSellingPrice(podId: string, itemId: string, sellingUsd: number | undefined) {
  const value = positive(sellingUsd);
  const name = itemOf(podId, itemId)?.name ?? "a kit";
  logQuotationEvent(
    podId,
    value === undefined ? "selling_price_reset" : "selling_price_edited",
    value === undefined
      ? `${name} — selling price per set returned to the margin-derived figure`
      : `${name} — selling price set to $${value.toFixed(2)} / set`,
  );
  write(podId, (d) => ({
    ...d,
    items: d.items.map((i) => (i.id === itemId ? { ...i, sellingPriceOverrideUsd: value } : i)),
  }));
}

/**
 * Switch a row between its variant and one of that variant's options.
 *
 * An option is not a row of its own: it is one parameter changed inside a
 * variant, so it moves the row it belongs to. Passing the variant's own id is
 * how the row is cleared back to "no option".
 */
export function setLineBuild(podId: string, itemId: string, lineId: string, buildId: string) {
  updateLine(podId, itemId, lineId, { buildId });
}

/** Choose which configured position is the price that goes to the buyer. */
export function setQuotedLine(podId: string, itemId: string, lineId: string) {
  const item = itemOf(podId, itemId);
  logQuotationEvent(
    podId,
    "quoted_line_changed",
    `${item?.name ?? "An item"} — quoted position changed`,
  );
  write(podId, (d) => ({
    ...d,
    items: d.items.map((i) => (i.id === itemId ? { ...i, quotedLineId: lineId } : i)),
  }));
}
