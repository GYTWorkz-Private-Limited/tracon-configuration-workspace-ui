// Commercial Overheads & Provisions.
//
// Deliberately BELOW the product/kit costing details rather than mixed into
// the component-level table: the component table is a manufacturing document
// and stays a pure direct-cost roll-up. Everything here is applied on top of
// that number and never feeds back into it.
//
// Three groups, each foldable, so a quote stays readable when nobody is
// interrogating the provisions.

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  inr,
  pct,
  usd,
  type CommercialResult,
  type ProvisionLine,
} from "@/lib/commercialProvisions";

export function CommercialBreakdown({
  result,
  /** open the whole block by default — used on the kit summary */
  defaultOpen = false,
  title = "Commercial Overheads & Provisions",
  caption = "Applied on top of direct cost. Nothing here changes the manufacturing roll-up.",
}: {
  result: CommercialResult;
  defaultOpen?: boolean;
  title?: string;
  caption?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700"
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-ink-400 transition-transform",
            !open && "-rotate-90",
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-ink-900">{title}</span>
          <span className="mt-0.5 block text-[11px] text-ink-500">{caption}</span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[10px] font-medium uppercase tracking-[0.1em] text-ink-500">
            Loaded cost
          </span>
          <span className="block text-[14px] font-semibold tabular-nums text-ink-900">
            {inr(result.finalCostInr)}
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-hairline">
          <Group
            label="Purchase / Supplier Provisions"
            hint="What it costs us to buy the goods, on top of the ex-works cost."
            lines={result.purchaseLines}
            subtotalLabel="Total Provision on Purchase %"
            subtotalPct={result.totalPurchasePct}
            subtotalInr={result.totalPurchaseInr}
          />
          <Group
            label="Sale / Commercial Provisions"
            hint="What it costs us to inspect, ship, document and bill the order."
            lines={result.saleLines}
            subtotalLabel="Total Provision on Sale %"
            subtotalPct={result.totalSalePct}
            subtotalInr={result.totalSaleInr}
          />
          <FinalCalculation result={result} />
        </div>
      )}
    </section>
  );
}

function Group({
  label,
  hint,
  lines,
  subtotalLabel,
  subtotalPct,
  subtotalInr,
}: {
  label: string;
  hint: string;
  lines: ProvisionLine[];
  subtotalLabel: string;
  subtotalPct: number;
  subtotalInr: number;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-b border-hairline last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 bg-surface-alt/60 px-4 py-2 text-left hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform",
            !open && "-rotate-90",
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-700">
            {label}
          </span>
          {open && (
            <span className="mt-0.5 block text-[11px] normal-case text-ink-500">{hint}</span>
          )}
        </span>
        <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink-700">
          {pct(subtotalPct)}
        </span>
      </button>

      {open && (
        <table className="w-full text-[12px]">
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.1em] text-ink-400">
              <th scope="col" className="px-4 py-1.5 text-left font-medium">
                Provision
              </th>
              <th scope="col" className="px-3 py-1.5 text-right font-medium">
                Rate
              </th>
              <th scope="col" className="px-4 py-1.5 text-right font-medium">
                ₹ / pc
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t border-hairline/70">
                <th scope="row" className="px-4 py-1.5 text-left font-normal text-ink-700">
                  <span className="flex items-center gap-1.5">
                    {l.label}
                    {l.credit && (
                      <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-brand-700">
                        Credit
                      </span>
                    )}
                    <span title={l.hint} className="text-ink-300">
                      <Info className="h-3 w-3" aria-hidden />
                      <span className="sr-only">{l.hint}</span>
                    </span>
                  </span>
                </th>
                <td
                  className={cn(
                    "px-3 py-1.5 text-right tabular-nums",
                    l.pct < 0 ? "text-brand-700" : "text-ink-600",
                  )}
                >
                  {pct(l.pct)}
                </td>
                <td
                  className={cn(
                    "px-4 py-1.5 text-right tabular-nums",
                    l.amountInr < 0 ? "text-brand-700" : "text-ink-900",
                  )}
                >
                  {inr(l.amountInr)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-ink-200 bg-surface-alt/40">
              <th
                scope="row"
                className="px-4 py-2 text-left text-[11.5px] font-semibold text-ink-900"
              >
                {subtotalLabel}
              </th>
              <td className="px-3 py-2 text-right text-[11.5px] font-semibold tabular-nums text-ink-900">
                {pct(subtotalPct)}
              </td>
              <td className="px-4 py-2 text-right text-[11.5px] font-semibold tabular-nums text-ink-900">
                {inr(subtotalInr)}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

/** The block that turns a loaded cost into the number actually being quoted. */
function FinalCalculation({ result }: { result: CommercialResult }) {
  const rows: { label: string; value: string; strong?: boolean; tone?: "credit" }[] = [
    { label: "Exchange Rate", value: `₹${result.fxRate.toFixed(2)} / $` },
    { label: "Direct Cost", value: inr(result.directCostInr) },
    { label: "Commercial Overheads", value: inr(result.commercialOverheadsInr) },
    { label: "Supplier Margins", value: inr(result.supplierMarginsInr) },
    { label: "Other Indirect Costs", value: inr(result.otherIndirectInr) },
    { label: "Provisions", value: inr(result.provisionsInr) },
    { label: "Final Cost", value: inr(result.finalCostInr), strong: true },
    { label: "Margin INR", value: inr(result.marginInr) },
    { label: "Margin %", value: pct(result.marginPct, 1) },
    { label: "Selling Price INR", value: inr(result.sellingInr), strong: true },
    { label: "Selling Price USD", value: usd(result.sellingUsd), strong: true },
  ];

  return (
    <div>
      <div className="bg-surface-alt/60 px-4 py-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-700">
          Final Commercial Calculation
        </h4>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-hairline sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="bg-surface px-4 py-2">
            <dt className="text-[10.5px] text-ink-500">{r.label}</dt>
            <dd
              className={cn(
                "mt-0.5 tabular-nums",
                r.strong ? "text-[14px] font-semibold text-ink-900" : "text-[12.5px] text-ink-700",
              )}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-hairline bg-brand-50/60 px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-800">
          Final Selling Price
        </span>
        <span className="flex items-baseline gap-2">
          <span className="text-[17px] font-semibold tabular-nums text-brand-800">
            {usd(result.sellingUsd)}
          </span>
          <span className="text-[11.5px] tabular-nums text-brand-700">
            {inr(result.sellingInr)} · margin {pct(result.marginPct, 1)}
          </span>
        </span>
      </div>
    </div>
  );
}
