/**
 * PodComparisonTable — every article and kit of a POD in one horizontal grid.
 *
 * The Compare Variants table answers "which build of ONE article?"; this one
 * answers the release question — "does the WHOLE order hold together?" — so it
 * reprices each SKU through the exact pipeline the Configuration workspace
 * uses (resolve → seed → applyParameters → rollup → commercial) rather than
 * reading any stored number. There is no second copy of the truth to drift.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { usePod, type Article, type KitItem } from "@/lib/podsStore";
import { rollupVariant } from "@/lib/costingModel";
import { resolveCostingModel } from "@/lib/costingModels";
import { seedVariantFor, type ArticleDimensions } from "@/lib/articleCosting";
import { applyParameters, commercialOutput, moqOf } from "@/lib/pricingVariants";
import { podFabricRates, inrShort, type FabricRateOverrides } from "@/lib/fabricRequirement";
import { parseMoq } from "@/lib/quotationPricing";

/* ------------------------------------------------------------------ *
 * Pricing pass
 * ------------------------------------------------------------------ */

type PricedUnit = {
  /** ₹ / pc */
  rawMaterial: number;
  process: number;
  /** raw material + process — what the piece costs to MAKE */
  direct: number;
  /** + accessories, packaging, testing — the cost the commercial layer prices */
  final: number;
  sellingUsd: number;
  fxRate: number;
};

/** One SKU through the canonical pipeline, at the POD's earned fabric tiers. */
function priceUnit(
  dims: ArticleDimensions & { srfRef?: string },
  fabricRates: FabricRateOverrides,
): PricedUnit & { moq: number } {
  const bundle = resolveCostingModel(dims.srfRef);
  const seeded = seedVariantFor(bundle.defaultVariant, dims);
  const priced = applyParameters(seeded, seeded.parameters, bundle.masters, fabricRates);
  const roll = rollupVariant(priced, bundle.masters);
  const co = commercialOutput(roll.directCost, priced.commercial);
  return {
    rawMaterial: roll.rawMaterial,
    process: roll.process,
    direct: roll.rawMaterial + roll.process,
    final: roll.directCost,
    sellingUsd: co.sellingUsd,
    fxRate: priced.commercial.fxRate > 0 ? priced.commercial.fxRate : 90,
    moq: moqOf(priced.parameters),
  };
}

type Row = {
  id: string;
  name: string;
  size: string;
  kind: "article" | "kit";
  moqLabel: string;
  /** pieces for an article, sets for a kit — absent when the kit MOQ is prose */
  qty?: number;
  unit: PricedUnit;
};

/** A kit is priced as the sum of its members per set — same loop shape as
 *  estimateKitDirectUsd, so the row lands on the number the Kit Summary shows. */
function priceKit(kit: Article, fabricRates: FabricRateOverrides): Row {
  const items: KitItem[] = kit.kitItems ?? [];
  const perSet: PricedUnit = {
    rawMaterial: 0,
    process: 0,
    direct: 0,
    final: 0,
    sellingUsd: 0,
    fxRate: 90,
  };
  for (const item of items) {
    const u = priceUnit(item, fabricRates);
    const q = item.qty > 0 ? item.qty : 1;
    perSet.rawMaterial += u.rawMaterial * q;
    perSet.process += u.process * q;
    perSet.direct += u.direct * q;
    perSet.final += u.final * q;
    perSet.sellingUsd += u.sellingUsd * q;
    perSet.fxRate = u.fxRate;
  }
  const sets = parseMoq(kit.moq);
  return {
    id: kit.id,
    name: kit.name,
    size: kit.size,
    kind: "kit",
    moqLabel: sets ? `${sets.toLocaleString("en-IN")} sets` : kit.moq,
    qty: sets,
    unit: perSet,
  };
}

function buildRows(articles: Article[], fabricRates: FabricRateOverrides): Row[] {
  const rows: Row[] = [];
  for (const a of articles) {
    // One broken article must not cost the page the whole table — this is a
    // pre-release summary, and a partial grid beats an error boundary.
    try {
      if (a.type === "kit") {
        rows.push(priceKit(a, fabricRates));
      } else {
        const u = priceUnit(a, fabricRates);
        rows.push({
          id: a.id,
          name: a.name,
          size: a.size,
          kind: "article",
          moqLabel: `${u.moq.toLocaleString("en-IN")} pcs`,
          qty: u.moq,
          unit: u,
        });
      }
    } catch {
      continue;
    }
  }
  return rows;
}

/* ------------------------------------------------------------------ *
 * Formatting — per-piece money keeps its paise, order money goes short
 * ------------------------------------------------------------------ */

const inr2 = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usd2 = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usdOrder = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

const HEAD = "px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400";
const CELL = "px-3 py-2.5 text-[12.5px] tabular-nums";

export function PodComparisonTable({ podId }: { podId: string }) {
  const pod = usePod(podId);

  const rows = useMemo(() => {
    if (!pod) return [];
    // Fabric tiers are a POD-level fact: the metre total across every article
    // sharing a cloth earns the price break, so each row is priced at the rate
    // the ORDER pays — not the rate a lone article would have been quoted.
    return buildRows(pod.articles, podFabricRates(pod.id));
  }, [pod]);

  const totals = useMemo(() => {
    // Only rows with a readable quantity can join the order value — summing a
    // guessed quantity would put a made-up number in the release check.
    const t = { orderUsd: 0, orderInr: 0, costInr: 0, sellInr: 0 };
    for (const r of rows) {
      if (!r.qty) continue;
      const sellInr = r.unit.sellingUsd * r.unit.fxRate;
      t.orderUsd += r.unit.sellingUsd * r.qty;
      t.orderInr += sellInr * r.qty;
      t.costInr += r.unit.final * r.qty;
      t.sellInr += sellInr * r.qty;
    }
    return { ...t, marginPct: t.sellInr > 0 ? ((t.sellInr - t.costInr) / t.sellInr) * 100 : 0 };
  }, [rows]);

  if (!pod || rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <p className="border-b border-hairline px-4 py-2.5 text-[11.5px] text-ink-500">
        Every article and set of this POD priced at today&apos;s configuration — the pre-release
        sanity check.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-left">
          <thead>
            <tr className="border-b border-hairline">
              <th className={cn(HEAD, "sticky left-0 z-10 bg-surface")}>Article</th>
              <th className={HEAD}>MOQ</th>
              <th className={cn(HEAD, "text-right")}>Raw material ₹/pc</th>
              <th className={cn(HEAD, "text-right")}>Process ₹/pc</th>
              <th className={cn(HEAD, "text-right")}>Direct cost ₹/pc</th>
              <th className={cn(HEAD, "text-right")}>Final cost ₹/pc</th>
              <th className={cn(HEAD, "text-right")}>Selling $/pc</th>
              <th className={cn(HEAD, "text-right")}>Margin ₹/pc</th>
              <th className={cn(HEAD, "text-right")}>Margin %</th>
              <th className={cn(HEAD, "text-right")}>Order value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const sellInr = r.unit.sellingUsd * r.unit.fxRate;
              const marginInr = sellInr - r.unit.final;
              const marginPct = sellInr > 0 ? (marginInr / sellInr) * 100 : 0;
              return (
                <tr key={r.id} className="border-b border-hairline last:border-b-0">
                  <td className={cn(CELL, "sticky left-0 z-10 bg-surface")}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink-900">{r.name}</span>
                      <span
                        className={cn(
                          "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                          r.kind === "kit"
                            ? "border-brand-600/30 bg-brand-50 text-brand-700"
                            : "border-hairline bg-surface-alt text-ink-500",
                        )}
                      >
                        {r.kind === "kit" ? "Kit" : "Article"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-500">{r.size}</div>
                  </td>
                  <td className={cn(CELL, "text-ink-600")}>{r.moqLabel}</td>
                  <td className={cn(CELL, "text-right text-ink-800")}>
                    {inr2(r.unit.rawMaterial)}
                  </td>
                  <td className={cn(CELL, "text-right text-ink-800")}>{inr2(r.unit.process)}</td>
                  <td className={cn(CELL, "text-right text-ink-800")}>{inr2(r.unit.direct)}</td>
                  <td className={cn(CELL, "text-right font-medium text-ink-900")}>
                    {inr2(r.unit.final)}
                  </td>
                  <td className={cn(CELL, "text-right")}>
                    <div className="font-medium text-ink-900">{usd2(r.unit.sellingUsd)}</div>
                    <div className="text-[11px] text-ink-500">{inr2(sellInr)}</div>
                  </td>
                  <td className={cn(CELL, "text-right text-ink-800")}>{inr2(marginInr)}</td>
                  <td
                    className={cn(
                      CELL,
                      "text-right font-medium",
                      marginPct > 0 ? "text-brand-700" : "text-ink-500",
                    )}
                  >
                    {marginPct.toFixed(1)}%
                  </td>
                  <td className={cn(CELL, "text-right")}>
                    {r.qty ? (
                      <>
                        <div className="font-medium text-ink-900">
                          {usdOrder(r.unit.sellingUsd * r.qty)}
                        </div>
                        <div className="text-[11px] text-ink-500">{inrShort(sellInr * r.qty)}</div>
                      </>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-hairline">
              <td className={cn(CELL, "sticky left-0 z-10 bg-surface font-semibold text-ink-900")}>
                POD total
              </td>
              <td className={CELL} colSpan={6} />
              <td className={cn(CELL, "text-right text-[11px] text-ink-500")}>blended</td>
              <td className={cn(CELL, "text-right font-semibold text-brand-700")}>
                {totals.marginPct.toFixed(1)}%
              </td>
              <td className={cn(CELL, "text-right")}>
                <div className="font-semibold text-ink-900">{usdOrder(totals.orderUsd)}</div>
                <div className="text-[11px] text-ink-500">{inrShort(totals.orderInr)}</div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
