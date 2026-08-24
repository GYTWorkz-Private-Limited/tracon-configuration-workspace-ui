/**
 * Every quotable configuration of one item, priced.
 *
 * The summary sheet shows the position actually being quoted — one row per
 * article. The override dialog needs the others too: the reason to open it is
 * usually to compare the ways the product could be built before deciding which
 * one to move. This builds that fuller set.
 *
 * Same pricing calls as everywhere else, so a figure here is the figure the
 * sheet shows for the same configuration.
 */

import {
  buildById,
  parseMoq,
  parseSize,
  priceLine,
  scenarioById,
  type PricedLine,
} from "@/lib/quotationPricing";
import { buildsIn, scenariosIn, type State as SelectionState } from "@/lib/costingSelectionStore";
import { podFabricRates } from "@/lib/fabricRequirement";
import {
  ratesFor,
  setItemSellingPrice,
  setLineSellingPrice,
  updateLine,
  type QuoteDraft,
  type QuoteItem,
} from "@/lib/quoteDraftStore";
import { logQuotationEvent } from "@/lib/quotationHistory";
import type { QuoteRow } from "./QuoteLinesTable";
import type { RowOverride } from "./OverrideDialog";

/**
 * A kit is one commercial position: its members are costed individually but
 * the provisions and margin land once, on the set. So there is a single row to
 * override, carrying the set's figures.
 */
function kitRow(item: QuoteItem, priced: PricedLine, sets: number): QuoteRow {
  return {
    lineId: item.members[0]?.line.id ?? item.id,
    priced: { ...priced, moq: sets },
  };
}

export function rowsForItem(
  draft: QuoteDraft,
  item: QuoteItem,
  selections: SelectionState,
  /** the kit's set-level pricing, already computed by the summary */
  kitPriced?: { priced: PricedLine; sets: number },
): QuoteRow[] {
  const { podId } = draft;
  const rates = ratesFor(draft, item);
  const fabricRates = podFabricRates(podId);

  if (item.kind === "kit") {
    return kitPriced ? [kitRow(item, kitPriced.priced, kitPriced.sets)] : [];
  }

  const scenarios = scenariosIn(selections, podId, item.articleId);
  const builds = buildsIn(selections, podId, item.articleId);

  return item.lines.map((l) => ({
    lineId: l.id,
    priced: priceLine({
      srfRef: item.srfRef,
      scenario: scenarioById(scenarios, l.scenarioId),
      build: buildById(builds, l.buildId),
      defaults: { size: parseSize(item.size), moq: parseMoq(item.moq) },
      rates,
      targetMarginPct: l.targetMarginPct ?? item.targetMarginPct,
      moqOverride: l.moqOverride,
      finalCostOverrideInr: l.finalCostOverrideInr,
      sellingPriceOverrideUsd: l.sellingPriceOverrideUsd,
      fabricRates,
    }),
    moqOverridden: l.moqOverride !== undefined,
    rejected: Boolean(l.rejected),
  }));
}

/**
 * Apply the override dialog's changes.
 *
 * Lives here rather than on either workspace because BOTH reach it: the
 * consolidated quotation and a single article's own page host the same dialog,
 * and an override must be written the same way — and land in the same audit —
 * whichever screen the approver happened to be on.
 *
 * The reason is logged first, so the trail reads as a decision followed by its
 * consequences rather than a run of bare figures.
 */
export function applyRowOverrides(
  quotationId: string,
  item: QuoteItem,
  overrides: RowOverride[],
  reason: string,
) {
  logQuotationEvent(quotationId, "option_changed", `${item.name} — override applied: ${reason}`);

  for (const o of overrides) {
    if (o.moq !== undefined) updateLine(quotationId, item.id, o.lineId, { moqOverride: o.moq });
    if (o.marginPct !== undefined) {
      updateLine(quotationId, item.id, o.lineId, { targetMarginPct: o.marginPct });
    }

    const price = o.clearSelling ? undefined : o.sellingUsd;
    if (o.clearSelling || o.sellingUsd !== undefined) {
      if (item.kind === "kit") setItemSellingPrice(quotationId, item.id, price);
      else setLineSellingPrice(quotationId, item.id, o.lineId, price);
    }
  }
}
