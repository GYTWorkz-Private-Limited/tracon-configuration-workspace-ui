/**
 * The working sheet — the quotation the way Tracon reads it first.
 *
 * The Excel this mirrors opens on a compact grid of every line with its cost,
 * price and margin, and the detail sits behind each row. This component is
 * that grid: one row per item, priced from the SAME `ViewedItem`s the cards
 * below render, so the sheet and the drill-down can never disagree. It owns no
 * pricing — everything here is a read of `priced`.
 */

import { useState } from "react";
import { Table2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { inr, pct, usd } from "@/lib/commercialProvisions";
import { inrShort } from "@/lib/fabricRequirement";
import type { CostRollup } from "@/lib/costingModel";
import type { ViewedItem } from "@/lib/quotationView";

/**
 * Payment terms are a quotation-presentation decision, not a costing one: the
 * buyer choosing 90-day credit changes what we must charge to carry the
 * receivable, not what the product costs to make. So the uplift is applied
 * here, at display time, over the already-priced views — the costing pipeline
 * and the cards below never see it.
 */
const FINANCE_UPLIFT_90D = 1.015;

type Terms = 60 | 90;

type Row = {
  id: string;
  article: string;
  size: string;
  compGsm: string;
  qty: number;
  /** kits are quoted per set, products per piece — the money columns follow */
  unit: "pc" | "set";
  materialInr: number;
  finalCostInr: number;
  sellingUsd: number;
  sellingInr: number;
  marginInr: number;
  marginPct: number;
};

/** The fabric the costing actually priced, read off the resolved components. */
const compositionOf = (rollup: CostRollup): string | undefined =>
  rollup.components.find((c) => c.material?.master?.composition)?.material?.master?.composition;

const uniq = (xs: (string | undefined)[]) =>
  Array.from(new Set(xs.filter((x): x is string => Boolean(x))));

function toRow(v: ViewedItem, terms: Terms): Row {
  const c = v.priced.commercial;

  // The uplift moves the selling price only; margin is then re-read off the
  // uplifted price so the row stays internally consistent for the reader.
  const uplift = terms === 90 ? FINANCE_UPLIFT_90D : 1;
  const sellingUsd = Math.round(c.sellingUsd * uplift * 100) / 100;
  const sellingInr = Math.round(c.sellingInr * uplift * 100) / 100;
  const marginInr = Math.round((sellingInr - c.finalCostInr) * 100) / 100;
  const marginPct = sellingInr > 0 ? Math.round((marginInr / sellingInr) * 1000) / 10 : 0;

  if (v.kind === "kit") {
    const comps = uniq(v.priced.members.map((m) => compositionOf(m.rollup)));
    const gsms = uniq(v.priced.members.map((m) => `${m.gsm}`));
    return {
      id: v.item.id,
      article: `Kit — ${v.item.name}`,
      size: v.item.size ?? `Set of ${v.priced.members.length}`,
      compGsm: `${comps.join(" / ") || "—"} · ${gsms.join("/")} GSM`,
      qty: v.priced.sets,
      unit: "set",
      // A kit has no single roll-up; its material cost per set is each
      // member's raw material × its units, the same sum the set price stacks.
      materialInr:
        Math.round(
          v.priced.members.reduce((t, m) => t + m.rollup.rawMaterial * m.unitsPerSet, 0) * 100,
        ) / 100,
      finalCostInr: c.finalCostInr,
      sellingUsd,
      sellingInr,
      marginInr,
      marginPct,
    };
  }

  return {
    id: v.item.id,
    article: v.item.name,
    size: v.item.size ?? v.priced.sizeLabel,
    compGsm: `${compositionOf(v.priced.rollup) ?? "—"} · ${v.priced.gsm} GSM`,
    qty: v.priced.moq,
    unit: "pc",
    materialInr: v.priced.rollup.rawMaterial,
    finalCostInr: c.finalCostInr,
    sellingUsd,
    sellingInr,
    marginInr,
    marginPct,
  };
}

export function WorkingSheet({
  views,
  quotationId,
  onOpen,
}: {
  views: ViewedItem[];
  quotationId: string;
  onOpen: (itemId: string) => void;
}) {
  const [terms, setTerms] = useState<Terms>(60);
  const rows = views.map((v) => toRow(v, terms));

  const totalQty = rows.reduce((t, r) => t + r.qty, 0);
  const totalMaterialInr = rows.reduce((t, r) => t + r.materialInr * r.qty, 0);
  const totalFinalCostInr = rows.reduce((t, r) => t + r.finalCostInr * r.qty, 0);
  const totalSellingInr = rows.reduce((t, r) => t + r.sellingInr * r.qty, 0);
  const totalSellingUsd = rows.reduce((t, r) => t + r.sellingUsd * r.qty, 0);
  const blendedMarginPct =
    totalSellingInr > 0 ? ((totalSellingInr - totalFinalCostInr) / totalSellingInr) * 100 : 0;

  return (
    <section
      aria-label="Working sheet"
      className="mb-4 overflow-hidden rounded-xl border border-hairline bg-surface"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline bg-surface-alt px-4 py-2.5">
        <Table2 className="h-3.5 w-3.5 text-ink-500" aria-hidden />
        <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-700">
          Working sheet · {quotationId}
        </h2>
        {terms === 90 && (
          <span className="text-[10.5px] text-ink-500">incl. 90-day finance +1.5%</span>
        )}
        <div
          className="ml-auto flex items-center gap-1 rounded-full border border-hairline bg-surface p-0.5"
          role="group"
          aria-label="Payment terms"
        >
          {([60, 90] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTerms(t)}
              aria-pressed={terms === t}
              className={cn(
                "rounded-full px-3 py-1 text-[11.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                terms === t
                  ? "bg-brand-700 font-semibold text-white"
                  : "text-ink-600 hover:bg-surface-alt hover:text-ink-900",
              )}
            >
              {t} days
            </button>
          ))}
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-hairline bg-surface-alt/60 text-[10px] uppercase tracking-[0.1em] text-ink-500">
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Article
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Size
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Composition / GSM
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                MOQ (pcs)
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Material ₹/pc
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Final cost ₹/pc
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Selling $/pc
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Margin ₹/pc
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Margin %
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => onOpen(r.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen(r.id);
                  }
                }}
                tabIndex={0}
                title="Open this article's detail card"
                className="cursor-pointer border-b border-hairline transition-colors last:border-b-0 hover:bg-surface-alt/60 focus-visible:bg-surface-alt/60 focus-visible:outline-none"
              >
                <td className="px-3 py-2 font-medium text-ink-900">{r.article}</td>
                <td className="px-3 py-2 text-ink-700">{r.size}</td>
                <td className="px-3 py-2 text-ink-700">{r.compGsm}</td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                  {r.qty.toLocaleString("en-IN")}
                  {r.unit === "set" && <span className="ml-1 text-[10px] text-ink-400">sets</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                  {inr(r.materialInr)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                  {inr(r.finalCostInr)}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="font-semibold tabular-nums text-ink-900">{usd(r.sellingUsd)}</div>
                  <div className="text-[10.5px] tabular-nums text-ink-400">{inr(r.sellingInr)}</div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-700">
                  {inr(r.marginInr)}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink-900">
                  {pct(r.marginPct, 1)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-hairline bg-surface-alt/60 font-semibold text-ink-900">
              <td className="px-3 py-2" colSpan={3}>
                Total
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {totalQty.toLocaleString("en-IN")}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{inrShort(totalMaterialInr)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{inrShort(totalFinalCostInr)}</td>
              <td className="px-3 py-2 text-right">
                <div className="tabular-nums">{usd(totalSellingUsd, 0)}</div>
                <div className="text-[10.5px] font-normal tabular-nums text-ink-500">
                  {inrShort(totalSellingInr)}
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {inrShort(totalSellingInr - totalFinalCostInr)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{pct(blendedMarginPct, 1)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="border-t border-hairline px-4 py-2 text-[10.5px] text-ink-400">
        Kits are quoted per set — their money columns read ₹ or $ per set. Click a row for the full
        article card below.
      </p>
    </section>
  );
}
