/**
 * Quotations.
 *
 * A quotation is its OWN object with its own number — QT-2601 — that contains
 * one or more of a POD's articles. It is not a property of the article you
 * happened to start from: quoting a Placemat and a Runner together produces
 * one quotation containing both, not a Placemat quotation with a Runner buried
 * inside it. A POD can therefore hold several quotations at once, and each
 * article belongs to at most one of them.
 *
 * This store holds SELECTIONS, never costs. A quote line records which
 * scenario, which variant/option and which quantity the commercial team chose;
 * the numbers are produced on read by `quotationPricing`, from the same engine
 * Configuration uses. That is what makes Quotation "the commercially selected
 * version of the costing" rather than a second costing system.
 *
 *   Quotation QT-2601 (POD)
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
import { clearRecost, requestRecost } from "./recostingStore";
import { markReadyForQuotation } from "./quotationReadiness";

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
  /**
   * This configuration was sent back for recosting.
   *
   * Per LINE, not per article: a buyer can question one way of building the
   * product while the others stay quotable, and freezing all of them because
   * one was questioned claims more than anybody said.
   */
  rejected?: { at: string; by: string; reason: string };
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
  /**
   * Variants the user has taken OFF this quotation.
   *
   * Published variants flow onto the quote automatically, so without this a
   * removed row would come straight back on the next render — the remove
   * button would look broken. Removing is a decision, and it is remembered.
   */
  dismissedBuildIds?: string[];
  /**
   * Sent back to Costing.
   *
   * The line stays on the quotation — removing it would lose the price the
   * buyer was shown and the reason it was questioned. It is marked, frozen and
   * blocking instead, which is what "this one needs re-costing" actually
   * means.
   */
  rejected?: { at: string; by: string; reason: string };
  /** How much of this article is being redone on a requote. */
  requoteScope?: "full" | "override";
};

/**
 * What the user said they were quoting when they left the Costing Report.
 *
 * "single" is one article quoted on its own, shown in the article's own
 * Quotation step exactly as it always was. "multiple" is a parent quotation
 * carrying several articles, which gets its own workspace — because burying
 * three articles' quotations under the one you started from is not a
 * multi-product quotation, it is a display accident.
 *
 * It changes where the quotation is shown, never how anything is priced.
 */
export type QuoteMode = "single" | "multiple";

export type QuoteDraft = {
  /** the quotation number, e.g. QT-2601 */
  id: string;
  podId: string;
  mode: QuoteMode;
  /** the quotation this one was raised from, when it is a requote */
  requoteOf?: string;
  items: QuoteItem[];
  /** quote-wide commercial defaults, inherited by every item that has none */
  rates: Partial<ProvisionRates>;
  createdAt: string;
  updatedAt: string;
};

/** Keyed by quotation id — a POD can have several. */
type State = Record<string, QuoteDraft>;

const STORAGE_KEY = "tracon.quotations.v1";

let state: State = {};
const listeners = new Set<() => void>();

/**
 * Is this a quotation THIS build can read?
 *
 * Stored state outlives the code that wrote it. A draft saved before
 * quotations became first-class objects is keyed by POD and has items with no
 * `lines` — valid JSON, wrong shape — and reading it takes down every screen
 * that counts quotations, which includes the home page. So each draft is
 * checked on the way in.
 */
function isReadableDraft(value: unknown): value is QuoteDraft {
  if (!value || typeof value !== "object") return false;
  const d = value as QuoteDraft;
  return (
    typeof d.id === "string" &&
    typeof d.podId === "string" &&
    Array.isArray(d.items) &&
    d.items.every(
      (i) =>
        Boolean(i) &&
        typeof i === "object" &&
        typeof i.id === "string" &&
        Array.isArray(i.lines) &&
        Array.isArray(i.members),
    )
  );
}

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    state = {};
    if (parsed && typeof parsed === "object") {
      // Drop only what cannot be read — one unreadable draft is no reason to
      // throw away the quotations the user can still work on.
      for (const [id, draft] of Object.entries(parsed as Record<string, unknown>)) {
        if (isReadableDraft(draft) && draft.id === id) state[id] = draft;
      }
    }
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

/** One quotation by number. */
export function useQuotation(quotationId?: string): QuoteDraft | undefined {
  const all = useQuoteDrafts();
  return quotationId ? all[quotationId] : undefined;
}

/** Every quotation in the workspace — what the Quotations list reads. */
export function useAllQuoteDrafts(): QuoteDraft[] {
  const all = useQuoteDrafts();
  return Object.values(all).filter((d) => d.items.length > 0);
}

/** Every quotation raised against one POD, newest first. */
export function useQuotationsForPod(podId: string): QuoteDraft[] {
  const all = useQuoteDrafts();
  return Object.values(all)
    .filter((q) => q.podId === podId && q.items.length > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * The quotation an article is on.
 *
 * An article belongs to at most one quotation, so returning to it always shows
 * the same quotation — whether that quotation holds it alone or alongside
 * others.
 */
export function useQuotationForArticle(podId: string, articleId: string): QuoteDraft | undefined {
  const all = useQuoteDrafts();
  return Object.values(all).find(
    (q) => q.podId === podId && q.items.some((i) => i.articleId === articleId),
  );
}

/** Unsubscribed lookup — for event handlers, never for render. */
export function quotationForArticle(podId: string, articleId: string): QuoteDraft | undefined {
  return Object.values(state).find(
    (q) => q.podId === podId && q.items.some((i) => i.articleId === articleId),
  );
}

let seq = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const stamp = () => new Date().toISOString();

const baseLine = (): QuoteLine => ({
  id: uid("QL"),
  scenarioId: SCENARIO_PRESETS[0].id,
  buildId: BASE_BUILD.id,
});

function write(quotationId: string, fn: (d: QuoteDraft) => QuoteDraft) {
  const current = state[quotationId];
  if (!current) return;
  state = { ...state, [quotationId]: { ...fn(current), updatedAt: stamp() } };
  emit();
}

/**
 * The next quotation number.
 *
 * Sequential and human-quotable — a number somebody reads out on a call has to
 * be short and ordered, which a random id is not. Starts at 2601 so the demo
 * looks like a workspace that has been running for a while.
 */
function nextQuotationId(): string {
  const used = Object.keys(state)
    .map((id) => Number(id.replace(/\D/g, "")))
    .filter((n) => Number.isFinite(n));
  const next = used.length > 0 ? Math.max(...used) + 1 : 2601;
  return `QT-${next}`;
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
 * Open a new quotation over these articles, and return its number.
 *
 * Readiness is re-checked here rather than trusted from the caller: it is the
 * rule that separates costing from quotation, and a rule enforced only in the
 * UI is a rule that holds until the next caller.
 *
 * An article already on another quotation is moved onto this one, keeping the
 * lines, margins, MOQs and overrides someone worked on — an article belongs to
 * one quotation, and re-quoting it should not silently start from scratch.
 */
export function createQuotation(
  podId: string,
  articleIds: string[],
  mode: QuoteMode,
): string | undefined {
  const pod = getPod(podId);
  if (!pod) return undefined;

  const articles = articleIds
    .map((id) => pod.articles.find((a) => a.id === id))
    .filter((a): a is Article => Boolean(a))
    .filter((a) => isReadyForQuotation(podId, a.id));
  if (articles.length === 0) return undefined;

  const id = nextQuotationId();
  const items = articles.map((a) => takeItemFrom(podId, a.id) ?? itemFromArticle(a, podId));

  state = {
    ...state,
    [id]: { id, podId, mode, items, rates: {}, createdAt: stamp(), updatedAt: stamp() },
  };
  emit();

  logQuotationEvent(
    id,
    "quotation_started",
    `${id} opened for ${items.map((i) => i.name).join(", ")} (${mode === "single" ? "single product" : "multiple products / kit"})`,
  );
  return id;
}

/**
 * Lift an article's existing item off whatever quotation holds it.
 *
 * Returned so the new quotation can adopt it — the work done on a line is the
 * commercial team's, not the quotation's, and it should survive the article
 * being re-quoted.
 */
function takeItemFrom(podId: string, articleId: string): QuoteItem | undefined {
  const from = quotationForArticle(podId, articleId);
  const item = from?.items.find((i) => i.articleId === articleId);
  if (!from || !item) return undefined;
  state = {
    ...state,
    [from.id]: { ...from, items: from.items.filter((i) => i.id !== item.id), updatedAt: stamp() },
  };
  return item;
}

/**
 * Put more articles on an existing quotation.
 *
 * The "+ Add Product" path inside a quotation workspace — additive, unlike
 * `createQuotation`, which decides what a NEW quotation contains.
 */
export function addProducts(quotationId: string, articleIds: string[]) {
  const quote = state[quotationId];
  if (!quote) return;
  const pod = getPod(quote.podId);
  if (!pod) return;

  const add = pod.articles
    .filter((a) => articleIds.includes(a.id))
    .filter((a) => isReadyForQuotation(quote.podId, a.id))
    .filter((a) => !quote.items.some((i) => i.articleId === a.id));
  if (add.length === 0) return;

  const items = add.map((a) => takeItemFrom(quote.podId, a.id) ?? itemFromArticle(a, quote.podId));
  for (const a of add)
    logQuotationEvent(quotationId, "item_added", `${a.name} added to ${quotationId}`);
  write(quotationId, (d) => ({ ...d, items: [...d.items, ...items] }));
}

/** Take several articles off a quotation at once — the bulk remove. */
export function removeItems(quotationId: string, itemIds: string[]) {
  const quote = state[quotationId];
  if (!quote) return;
  const going = quote.items.filter((i) => itemIds.includes(i.id));
  if (going.length === 0) return;
  for (const i of going) {
    logQuotationEvent(quotationId, "item_removed", `${i.name} removed from ${quotationId}`);
  }
  write(quotationId, (d) => ({ ...d, items: d.items.filter((i) => !itemIds.includes(i.id)) }));
}

export function removeItem(quotationId: string, itemId: string) {
  const name = itemOf(quotationId, itemId)?.name;
  if (name) logQuotationEvent(quotationId, "item_removed", `${name} removed from the quotation`);
  write(quotationId, (d) => ({ ...d, items: d.items.filter((i) => i.id !== itemId) }));
}

/** Unsubscribed lookup, so an action can name what it just changed. */
function itemOf(quotationId: string, itemId: string): QuoteItem | undefined {
  return state[quotationId]?.items.find((i) => i.id === itemId);
}

export function toggleCollapsed(quotationId: string, itemId: string) {
  write(quotationId, (d) => ({
    ...d,
    items: d.items.map((i) => (i.id === itemId ? { ...i, collapsed: !i.collapsed } : i)),
  }));
}

/* ------------------------------------------------------------------ *
 * Lines — a product's scenario / variant / option selections
 * ------------------------------------------------------------------ */

/** Add an existing costing scenario to a product as a new quotable line. */
export function addLine(
  quotationId: string,
  itemId: string,
  input: { scenarioId: string; buildId?: string; moqOverride?: number },
) {
  write(quotationId, (d) => ({
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
    quotationId,
    "line_added",
    `Configuration row added to ${itemOf(quotationId, itemId)?.name ?? "an item"}`,
  );
}

/**
 * Put a row on the quote for each variant that has none.
 *
 * Configuration keeps publishing variants after a quotation has been opened,
 * and the commercial team cannot choose between ways of building the product
 * if the quote only shows the ones that happened to exist the day it was
 * created. So the rows follow what Configuration has published — except the
 * ones somebody deliberately removed.
 *
 * The caller passes the variants that are genuinely uncovered, because only it
 * knows which rows sit on an OPTION of a variant and therefore already cover
 * it.
 */
export function addVariantRows(quotationId: string, itemId: string, variantIds: string[]) {
  const quote = state[quotationId];
  const item = quote?.items.find((i) => i.id === itemId);
  if (!quote || !item || item.kind !== "product") return;

  const builds = buildsFor(quote.podId, item.articleId);
  const nameOf = (buildId: string) => builds.find((b) => b.id === buildId)?.name;

  const dismissed = new Set(item.dismissedBuildIds ?? []);
  // Already on the quote wins over "uncovered": the caller computes coverage
  // from a snapshot, so two calls can race before the first write is visible
  // to it — and a variant must never end up with two rows.
  const present = new Set(item.lines.map((l) => l.buildId));
  // Configuration re-publishes variants with fresh ids, so the same variant
  // can arrive under an id the quote has never seen. Matching on the NAME the
  // user actually reads is what stops one variant becoming seven identical
  // rows on every visit.
  const presentNames = new Set(
    item.lines.map((l) => nameOf(l.buildId)).filter((n): n is string => Boolean(n)),
  );

  const add = variantIds.filter(
    (id) => !dismissed.has(id) && !present.has(id) && !presentNames.has(nameOf(id) ?? `__${id}`),
  );
  if (add.length === 0) return;

  write(quotationId, (d) => ({
    ...d,
    items: d.items.map((i) =>
      i.id !== itemId
        ? i
        : {
            ...i,
            lines: [...i.lines, ...add.map((buildId) => ({ ...baseLine(), buildId }))],
          },
    ),
  }));
}

export function updateLine(
  quotationId: string,
  itemId: string,
  lineId: string,
  patch: Partial<Omit<QuoteLine, "id">>,
) {
  logLinePatch(quotationId, itemId, patch);
  updateLineQuietly(quotationId, itemId, lineId, patch);
}

/**
 * The same write without the audit line — for callers that log a richer
 * message of their own, so one change never appears in the audit twice.
 */
function updateLineQuietly(
  quotationId: string,
  itemId: string,
  lineId: string,
  patch: Partial<Omit<QuoteLine, "id">>,
) {
  const apply = (l: QuoteLine) => (l.id === lineId ? { ...l, ...patch } : l);
  write(quotationId, (d) => ({
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
function logLinePatch(quotationId: string, itemId: string, patch: Partial<Omit<QuoteLine, "id">>) {
  const name = itemOf(quotationId, itemId)?.name ?? "an item";
  if (patch.moqOverride !== undefined) {
    logQuotationEvent(
      quotationId,
      "moq_override",
      `${name} — quoted MOQ overridden to ${patch.moqOverride.toLocaleString("en-IN")}`,
    );
  }
  if (patch.targetMarginPct !== undefined) {
    logQuotationEvent(
      quotationId,
      "margin_changed",
      `${name} — margin set to ${patch.targetMarginPct}%`,
    );
  }
  if ("buildId" in patch && patch.buildId) {
    logQuotationEvent(
      quotationId,
      "option_changed",
      `${name} — configuration changed on a quoted row`,
    );
  }
}

export function removeLine(quotationId: string, itemId: string, lineId: string) {
  logQuotationEvent(
    quotationId,
    "line_removed",
    `Configuration row removed from ${itemOf(quotationId, itemId)?.name ?? "an item"}`,
  );
  const removedBuildId = itemOf(quotationId, itemId)?.lines.find((l) => l.id === lineId)?.buildId;
  write(quotationId, (d) => ({
    ...d,
    items: d.items.map((i) => {
      // The last line is what identifies the product on the quote — removing
      // it would leave a nameless row, so it is kept.
      if (i.id !== itemId || i.lines.length <= 1) return i;
      const lines = i.lines.filter((l) => l.id !== lineId);
      return {
        ...i,
        // Remembered so the automatic variant rows do not bring it back.
        dismissedBuildIds: removedBuildId
          ? Array.from(new Set([...(i.dismissedBuildIds ?? []), removedBuildId]))
          : i.dismissedBuildIds,
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
  quotationId: string,
  itemId: string,
  lineId: string,
  finalCostInr: number | undefined,
) {
  const value = positive(finalCostInr);
  const name = itemOf(quotationId, itemId)?.name ?? "an item";
  logQuotationEvent(
    quotationId,
    value === undefined ? "total_cost_reset" : "total_cost_edited",
    value === undefined
      ? `${name} — total cost returned to the calculated figure`
      : `${name} — total cost set to ₹${value.toLocaleString("en-IN")} / pc`,
  );
  updateLineQuietly(quotationId, itemId, lineId, { finalCostOverrideInr: value });
}

/** Fix (or release) a product line's selling price, $ / pc. */
export function setLineSellingPrice(
  quotationId: string,
  itemId: string,
  lineId: string,
  sellingUsd: number | undefined,
) {
  const value = positive(sellingUsd);
  const name = itemOf(quotationId, itemId)?.name ?? "an item";
  logQuotationEvent(
    quotationId,
    value === undefined ? "selling_price_reset" : "selling_price_edited",
    value === undefined
      ? `${name} — selling price returned to the margin-derived figure`
      : `${name} — selling price set to $${value.toFixed(2)} / pc`,
  );
  updateLineQuietly(quotationId, itemId, lineId, { sellingPriceOverrideUsd: value });
}

/** Fix (or release) a kit's total cost, ₹ / set. */
export function setItemFinalCost(
  quotationId: string,
  itemId: string,
  finalCostInr: number | undefined,
) {
  const value = positive(finalCostInr);
  const name = itemOf(quotationId, itemId)?.name ?? "a kit";
  logQuotationEvent(
    quotationId,
    value === undefined ? "total_cost_reset" : "total_cost_edited",
    value === undefined
      ? `${name} — total cost per set returned to the calculated figure`
      : `${name} — total cost set to ₹${value.toLocaleString("en-IN")} / set`,
  );
  write(quotationId, (d) => ({
    ...d,
    items: d.items.map((i) => (i.id === itemId ? { ...i, finalCostOverrideInr: value } : i)),
  }));
}

/** Fix (or release) a kit's selling price, $ / set. */
export function setItemSellingPrice(
  quotationId: string,
  itemId: string,
  sellingUsd: number | undefined,
) {
  const value = positive(sellingUsd);
  const name = itemOf(quotationId, itemId)?.name ?? "a kit";
  logQuotationEvent(
    quotationId,
    value === undefined ? "selling_price_reset" : "selling_price_edited",
    value === undefined
      ? `${name} — selling price per set returned to the margin-derived figure`
      : `${name} — selling price set to $${value.toFixed(2)} / set`,
  );
  write(quotationId, (d) => ({
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
export function setLineBuild(quotationId: string, itemId: string, lineId: string, buildId: string) {
  updateLine(quotationId, itemId, lineId, { buildId });
}

/**
 * Send a line back to Costing.
 *
 * Nothing is written back into Configuration or Costing from here — the
 * quotation records that it asked, and the costing team answers on their own
 * screens. That is the whole reason this is a flag and a reason, not an edit.
 */
export function rejectItems(quotationId: string, itemIds: string[], reason: string) {
  const quote = state[quotationId];
  if (!quote || itemIds.length === 0) return;
  const going = quote.items.filter((i) => itemIds.includes(i.id));
  if (going.length === 0) return;

  const trimmed = reason.trim();
  logQuotationEvent(
    quotationId,
    "line_rejected",
    `${going.map((i) => i.name).join(", ")} sent back for recosting — ${trimmed}`,
  );

  // The costing team has to see this on their own screens, so the status —
  // never a number — travels back with the reason. A kit asks for every
  // article in it, because a set cannot be re-costed in halves.
  for (const item of going) {
    const articleIds =
      item.kind === "kit" ? item.members.map((m) => m.articleId) : [item.articleId];
    for (const articleId of articleIds) {
      requestRecost({ podId: quote.podId, articleId, quotationId, reason: trimmed });
    }
  }

  write(quotationId, (d) => ({
    ...d,
    items: d.items.map((i) =>
      itemIds.includes(i.id)
        ? { ...i, rejected: { at: stamp(), by: "Gautam Kitclu", reason: trimmed } }
        : i,
    ),
  }));
}

/** One line — the card-level shortcut onto the same path. */
export function rejectItem(quotationId: string, itemId: string, reason: string) {
  rejectItems(quotationId, [itemId], reason);
}

/** What is going back: which configurations of which articles. */
export type RejectSelection = {
  itemId: string;
  lineIds: string[];
  /**
   * Kits only: which member ARTICLES are to be re-costed. The kit's own lines
   * always freeze whole — it is priced as one set — but the ask that reaches
   * Costing should name only the articles actually in question.
   */
  articleIds?: string[];
}[];

/**
 * Send specific configurations back for recosting.
 *
 * The granularity matters. A buyer questions "the 3,000-piece embroidered
 * version", not "the Placemat" — so a variant can go back while its siblings
 * stay quotable. The article-level flag is kept as the summary of that, because
 * whether the quotation is blocked is an article-level question.
 *
 * A kit's pricing goes back whole — its members are priced as one set — but the
 * recosting ask still names only the member articles that were selected.
 */
export function rejectSelection(quotationId: string, selection: RejectSelection, reason: string) {
  const quote = state[quotationId];
  if (!quote || selection.length === 0) return;

  const trimmed = reason.trim();
  const named: string[] = [];

  for (const { itemId, lineIds, articleIds: picked } of selection) {
    const item = quote.items.find((i) => i.id === itemId);
    if (!item) continue;

    const members = item.kind === "kit" ? item.members : [];
    const articleIds =
      item.kind === "kit"
        ? picked?.length
          ? picked
          : members.map((m) => m.articleId)
        : [item.articleId];

    named.push(
      item.kind === "kit"
        ? articleIds.length === members.length
          ? item.name
          : `${item.name} (${articleIds
              .map((id) => members.find((m) => m.articleId === id)?.name ?? id)
              .join(", ")})`
        : lineIds.length === item.lines.length
          ? item.name
          : `${item.name} (${lineIds.length} of ${item.lines.length} configurations)`,
    );

    for (const articleId of articleIds) {
      requestRecost({ podId: quote.podId, articleId, quotationId, reason: trimmed });
    }
  }
  if (named.length === 0) return;

  logQuotationEvent(
    quotationId,
    "line_rejected",
    `${named.join(", ")} sent back for recosting — ${trimmed}`,
  );

  const stampedAt = stamp();
  const mark = { at: stampedAt, by: "Gautam Kitclu", reason: trimmed };

  write(quotationId, (d) => ({
    ...d,
    items: d.items.map((i) => {
      const pick = selection.find((sx) => sx.itemId === i.id);
      if (!pick) return i;
      return {
        ...i,
        rejected: mark,
        lines: i.lines.map((l) =>
          i.kind === "kit" || pick.lineIds.includes(l.id) ? { ...l, rejected: mark } : l,
        ),
      };
    }),
  }));
}

/** Withdraw the request — the costing came back, or it was rejected by mistake. */
export function clearRejection(quotationId: string, itemId: string) {
  const quote = state[quotationId];
  const item = quote?.items.find((i) => i.id === itemId);
  if (!quote || !item?.rejected) return;
  logQuotationEvent(quotationId, "line_rejected", `${item.name} returned to the quotation`);

  // Undoing a rejection puts the article back where it was: no longer waiting
  // on Costing, and quotable again — otherwise "undo" would leave the article
  // stranded outside the quotation it is still on.
  const articleIds = item.kind === "kit" ? item.members.map((m) => m.articleId) : [item.articleId];
  for (const articleId of articleIds) {
    clearRecost(quote.podId, articleId);
    markReadyForQuotation(quote.podId, articleId);
  }

  write(quotationId, (d) => ({
    ...d,
    items: d.items.map((i) =>
      i.id === itemId
        ? { ...i, rejected: undefined, lines: i.lines.map((l) => ({ ...l, rejected: undefined })) }
        : i,
    ),
  }));
}

/**
 * The costing came back: put the article's line back on its quotation.
 *
 * The other half of `rejectItems`. Without it, re-costing an article and
 * marking it ready would clear the ask on the Costing side while the quotation
 * stayed blocked on a line nobody could unblock from there — the loop has to
 * close in both directions.
 */
export function resolveRejectionForArticle(podId: string, articleId: string) {
  for (const quote of Object.values(state)) {
    if (quote.podId !== podId) continue;
    const item = quote.items.find(
      (i) =>
        Boolean(i.rejected) &&
        (i.articleId === articleId || i.members.some((m) => m.articleId === articleId)),
    );
    if (!item) continue;
    logQuotationEvent(quote.id, "line_rejected", `${item.name} re-costed and back on ${quote.id}`);
    write(quote.id, (d) => ({
      ...d,
      items: d.items.map((i) =>
        i.id === item.id
          ? {
              ...i,
              rejected: undefined,
              lines: i.lines.map((l) => ({ ...l, rejected: undefined })),
            }
          : i,
      ),
    }));
  }
}

/**
 * Raise a new quotation from an approved one.
 *
 * The buyer has come back after the fact, so this is a NEW commercial cycle,
 * not an edit of the record they accepted: a fresh number, linked to the one
 * it came from, carrying copies of the chosen articles. The originals are left
 * exactly as they were sent.
 */
export function createRequote(
  fromQuotationId: string,
  picks: {
    itemId: string;
    scope: "full" | "override";
    /**
     * Products only: which configured lines (variants) carry forward. Omitted
     * or empty means all of them — a kit always travels whole, its members
     * are priced as one set.
     */
    lineIds?: string[];
  }[],
): string | undefined {
  const from = state[fromQuotationId];
  if (!from || picks.length === 0) return undefined;

  const items = picks
    .map(({ itemId, scope, lineIds }) => {
      const src = from.items.find((i) => i.id === itemId);
      if (!src) return undefined;
      // Only the chosen variants come forward; the ones the buyer accepted
      // stay behind on the sent version rather than being dragged into a new
      // round they were never part of.
      const keep =
        src.kind === "product" && lineIds?.length
          ? src.lines.filter((l) => lineIds.includes(l.id))
          : src.lines;
      const lines = keep.length > 0 ? keep : src.lines;
      // The variants left behind must STAY behind: the live sync that surfaces
      // published variants as rows would quietly re-add them otherwise, and a
      // choice that un-makes itself is worse than no choice.
      const dropped = src.lines.filter((l) => !lines.includes(l)).map((l) => l.buildId);
      return {
        ...src,
        id: uid("QI"),
        dismissedBuildIds: Array.from(new Set([...(src.dismissedBuildIds ?? []), ...dropped])),
        lines: lines.map((l) => ({ ...l, rejected: undefined })),
        quotedLineId:
          src.quotedLineId && lines.some((l) => l.id === src.quotedLineId)
            ? src.quotedLineId
            : lines[0]?.id,
        // A requote starts from a clean commercial position: what the buyer
        // pushed back on is exactly what should not be inherited silently.
        rejected: undefined,
        requoteScope: scope,
        ...(scope === "full"
          ? { finalCostOverrideInr: undefined, sellingPriceOverrideUsd: undefined }
          : {}),
      } as QuoteItem;
    })
    .filter((i): i is QuoteItem => Boolean(i));
  if (items.length === 0) return undefined;

  const id = nextQuotationId();
  state = {
    ...state,
    [id]: {
      id,
      podId: from.podId,
      mode: items.length > 1 ? "multiple" : "single",
      requoteOf: from.id,
      items,
      rates: from.rates,
      createdAt: stamp(),
      updatedAt: stamp(),
    },
  };
  emit();

  logQuotationEvent(
    id,
    "requote_created",
    `${id} raised as a requote of ${from.id} — ${items.map((i) => i.name).join(", ")}`,
  );
  logQuotationEvent(from.id, "requote_created", `Requoted as ${id}`);
  return id;
}

/**
 * Which revision of the commercial conversation this quotation is.
 *
 * The original is V1; each requote in the chain is one more. Computed from the
 * `requoteOf` links rather than stored, so it cannot drift from the chain that
 * defines it. The chain is finite, but a cycle written by a broken client must
 * not hang the header — hence the visited set.
 */
export function revisionNo(quotationId: string): number {
  let no = 1;
  const seen = new Set<string>();
  let current = state[quotationId];
  while (current?.requoteOf && !seen.has(current.requoteOf)) {
    seen.add(current.requoteOf);
    no += 1;
    current = state[current.requoteOf];
  }
  return no;
}

/** Choose which configured position is the price that goes to the buyer. */
export function setQuotedLine(quotationId: string, itemId: string, lineId: string) {
  const item = itemOf(quotationId, itemId);
  logQuotationEvent(
    quotationId,
    "quoted_line_changed",
    `${item?.name ?? "An item"} — quoted position changed`,
  );
  write(quotationId, (d) => ({
    ...d,
    items: d.items.map((i) => (i.id === itemId ? { ...i, quotedLineId: lineId } : i)),
  }));
}
