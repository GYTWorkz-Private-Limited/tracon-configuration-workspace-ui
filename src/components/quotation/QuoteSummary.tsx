// The number being sent for approval.
//
// Deliberately the loudest thing in each product/kit section: everything above
// it explains how the figure was reached, but this is what a buyer sees and
// what an approver signs. A kit reports per SET, a product per piece, and the
// label says which so the two can never be misread for each other.

import { ArrowRight, Check, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr, pct, usd, type CommercialResult } from "@/lib/commercialProvisions";

export type SummaryVariant = "product" | "kit";

export function QuoteSummary({
  variant,
  result,
  quantity,
  quantityLabel,
  orderValueUsd,
  title,
}: {
  variant: SummaryVariant;
  result: CommercialResult;
  /** pieces for a product, sets for a kit */
  quantity: number;
  quantityLabel: string;
  orderValueUsd: number;
  title?: string;
}) {
  const isKit = variant === "kit";
  const unit = isKit ? "/ set" : "/ pc";
  const heading = title ?? (isKit ? "Kit Quotation Summary" : "Quotation Summary");

  const cells = [
    { label: isKit ? "Combined MOQ" : "Quoted MOQ", value: quantityLabel },
    {
      label: isKit ? "Combined Final Cost" : "Final Cost",
      value: `${inr(result.finalCostInr)} ${unit}`,
    },
    {
      label: isKit ? "Selling Price / Set" : "Selling Price INR",
      value: `${inr(result.sellingInr)} ${unit}`,
    },
    {
      label: isKit ? "Selling Price USD / Set" : "Selling Price USD",
      value: `${usd(result.sellingUsd)} ${unit}`,
      strong: true,
    },
    { label: "Margin INR", value: `${inr(result.marginInr)} ${unit}` },
    { label: "Margin %", value: pct(result.marginPct, 1), strong: true },
    { label: "Buyer Target", value: `${usd(result.buyerTargetUsd)} ${unit}` },
    { label: "Order Value", value: usd(orderValueUsd, 0), strong: true },
  ];

  return (
    <section
      aria-label={heading}
      className="overflow-hidden rounded-lg border-2 border-brand-700 bg-surface shadow-sm"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-brand-700 px-4 py-2.5 text-white">
        <h4 className="text-[12px] font-semibold uppercase tracking-[0.12em]">{heading}</h4>
        <span className="ml-auto flex items-baseline gap-2">
          <span className="text-[11px] uppercase tracking-[0.1em] text-white/70">
            {isKit ? "Set price" : "Unit price"}
          </span>
          <span className="text-[20px] font-semibold tabular-nums">{usd(result.sellingUsd)}</span>
          <span className="text-[11px] text-white/70">{unit}</span>
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-px bg-hairline sm:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className="bg-surface px-4 py-2.5">
            <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-500">
              {c.label}
            </dt>
            <dd
              className={cn(
                "mt-0.5 tabular-nums",
                c.strong ? "text-[15px] font-semibold text-ink-900" : "text-[13px] text-ink-700",
              )}
            >
              {c.value}
            </dd>
          </div>
        ))}
      </dl>

      <TargetBar result={result} quantity={quantity} isKit={isKit} />
    </section>
  );
}

/** How the quote sits against what the buyer said they would pay. */
function TargetBar({
  result,
  quantity,
  isKit,
}: {
  result: CommercialResult;
  quantity: number;
  isKit: boolean;
}) {
  const on = result.onTarget;
  const gap = Math.abs(result.headroomUsd);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 border-t px-4 py-2 text-[12px]",
        on
          ? "border-brand-100 bg-brand-50 text-brand-800"
          : "border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      {on ? (
        <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      <span className="min-w-0">
        {on ? (
          <>
            Quote is <strong className="font-semibold">{usd(gap)} under</strong> the buyer target of{" "}
            {usd(result.buyerTargetUsd)}.
          </>
        ) : (
          <>
            Quote is <strong className="font-semibold">{usd(gap)} over</strong> the buyer target of{" "}
            {usd(result.buyerTargetUsd)} — margin or specification needs a decision.
          </>
        )}
      </span>
      <span className="ml-auto flex items-center gap-1.5 whitespace-nowrap tabular-nums">
        {quantity.toLocaleString("en-IN")} {isKit ? "sets" : "pcs"}
        <ArrowRight className="h-3 w-3" aria-hidden />
        {usd(result.sellingUsd * quantity, 0)}
      </span>
    </div>
  );
}
