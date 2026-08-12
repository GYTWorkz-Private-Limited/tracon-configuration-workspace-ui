/**
 * One priced view of a quote draft — the shape every read-only surface
 * (the workspace totals strip, the customer preview, the approval report)
 * builds from.
 *
 * There is exactly one quotation object: the `QuoteDraft` in
 * `quoteDraftStore`. This module does not hold a copy of it — it re-runs the
 * same `priceLine` / `priceKit` calls `QuoteItemCard` uses and hands back
 * plain priced data, so a preview and an approval screen can never disagree
 * with the workspace or with each other.
 */

import {
  buildById,
  parseMoq,
  parseSize,
  priceKit,
  priceLine,
  scenarioById,
  type PricedKit,
  type PricedLine,
} from "./quotationPricing";
import { buildsIn, scenariosIn, type State as SelectionState } from "./costingSelectionStore";
import type { QuoteItem } from "./quoteDraftStore";

export type ViewedProduct = {
  kind: "product";
  item: QuoteItem;
  priced: PricedLine;
};

export type ViewedKit = {
  kind: "kit";
  item: QuoteItem;
  priced: PricedKit;
};

export type ViewedItem = ViewedProduct | ViewedKit;

/** Price every item on the quote, exactly as the workspace cards do. */
export function viewQuote(
  podId: string,
  items: QuoteItem[],
  selections: SelectionState,
): ViewedItem[] {
  return items.map((item): ViewedItem => {
    if (item.kind === "kit") {
      const priced = priceKit(
        item.members.map((m) => ({
          srfRef: m.srfRef,
          scenario: scenarioById(scenariosIn(selections, podId, m.articleId), m.line.scenarioId),
          build: buildById(buildsIn(selections, podId, m.articleId), m.line.buildId),
          defaults: { size: parseSize(m.size), moq: parseMoq(m.moq) },
          rates: item.rates,
          targetMarginPct: m.line.targetMarginPct,
          moqOverride: m.line.moqOverride,
          finalCostOverrideInr: m.line.finalCostOverrideInr,
          unitsPerSet: m.unitsPerSet,
          name: m.name,
          articleId: m.articleId,
          image: m.image,
        })),
        {
          rates: item.rates,
          targetMarginPct: item.targetMarginPct,
          sets: item.sets,
          finalCostOverrideInr: item.finalCostOverrideInr,
        },
      );
      return { kind: "kit", item, priced };
    }

    const line = item.lines.find((l) => l.id === item.quotedLineId) ?? item.lines[0];
    const priced = priceLine({
      srfRef: item.srfRef,
      scenario: scenarioById(scenariosIn(selections, podId, item.articleId), line.scenarioId),
      build: buildById(buildsIn(selections, podId, item.articleId), line.buildId),
      defaults: { size: parseSize(item.size), moq: parseMoq(item.moq) },
      rates: item.rates,
      targetMarginPct: line.targetMarginPct ?? item.targetMarginPct,
      moqOverride: line.moqOverride,
      finalCostOverrideInr: line.finalCostOverrideInr,
    });
    return { kind: "product", item, priced };
  });
}

/** Quotation-wide totals — same arithmetic the header strip shows. */
export function totalsOf(views: ViewedItem[]) {
  let orderValueUsd = 0;
  let costUsd = 0;
  for (const v of views) {
    if (v.kind === "kit") {
      orderValueUsd += v.priced.orderValueUsd;
      costUsd += v.priced.commercial.finalCostUsd * v.priced.sets;
    } else {
      orderValueUsd += v.priced.orderValueUsd;
      costUsd += v.priced.commercial.finalCostUsd * v.priced.moq;
    }
  }
  return {
    orderValueUsd: Math.round(orderValueUsd * 100) / 100,
    blendedMarginPct:
      orderValueUsd > 0 ? Math.round(((orderValueUsd - costUsd) / orderValueUsd) * 1000) / 10 : 0,
  };
}
