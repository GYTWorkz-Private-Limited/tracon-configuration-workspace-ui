// The number being sent for approval.
//
// Deliberately the loudest thing in each product/kit section: everything above
// it explains how the figure was reached, but this is what a buyer sees and
// what an approver signs. A kit reports per SET, a product per piece, and the
// label says which so the two can never be misread for each other.
//
// Prominent, not heavy: a neutral ribbon heading with the figures laid out
// underneath, rather than a second strongly-coloured card nested inside the
// quotation card it already sits in.

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Pencil, RotateCcw, TriangleAlert, X } from "lucide-react";
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
  onSaveFinalCost,
}: {
  variant: SummaryVariant;
  result: CommercialResult;
  /** pieces for a product, sets for a kit */
  quantity: number;
  quantityLabel: string;
  orderValueUsd: number;
  title?: string;
  /**
   * Save a hand-fixed total cost (₹ / pc, or ₹ / set for a kit), or `undefined`
   * to hand the line back to the calculated figure. Omit the prop entirely on
   * read-only surfaces — the pencil is then not offered at all.
   */
  onSaveFinalCost?: (finalCostInr: number | undefined) => void;
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
      className="overflow-hidden rounded-lg border border-hairline bg-surface"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline bg-surface-alt px-4 py-2.5">
        <h4 className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-700">
          {heading}
        </h4>
        <span className="ml-auto flex items-baseline gap-2">
          <span className="text-[10.5px] uppercase tracking-[0.1em] text-ink-500">
            {isKit ? "Set price" : "Unit price"}
          </span>
          <span className="text-[19px] font-semibold tabular-nums text-ink-900">
            {usd(result.sellingUsd)}
          </span>
          <span className="text-[11px] text-ink-500">{unit}</span>
        </span>
      </header>

      <TotalCostRow result={result} unit={unit} isKit={isKit} onSaveFinalCost={onSaveFinalCost} />

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

/* ------------------------------------------------------------------ *
 * Total cost — the one figure the commercial team may fix by hand
 * ------------------------------------------------------------------ */

/**
 * Editing the total cost is an explicit act: pencil, type, Save. Until Save is
 * pressed nothing about the quotation moves, and once it is saved the selling
 * price and margin above are re-derived by the SAME commercial calculation —
 * this only pins the number that calculation starts the margin from.
 */
function TotalCostRow({
  result,
  unit,
  isKit,
  onSaveFinalCost,
}: {
  result: CommercialResult;
  unit: string;
  isKit: boolean;
  onSaveFinalCost?: (finalCostInr: number | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [savedAt, setSavedAt] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // "Saved" is a confirmation, not a state — it fades so it can never be read
  // as "this quotation has unsaved work".
  useEffect(() => {
    if (!savedAt) return;
    const t = window.setTimeout(() => setSavedAt(0), 4000);
    return () => window.clearTimeout(t);
  }, [savedAt]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const label = isKit ? "Total Cost / set" : "Total Cost";
  const typed = Number(value.replace(/[^\d.]/g, ""));
  const valid = Number.isFinite(typed) && typed > 0;

  const open = () => {
    setValue(String(result.finalCostInr));
    setEditing(true);
  };

  const save = () => {
    if (!valid || !onSaveFinalCost) return;
    onSaveFinalCost(Math.round(typed * 100) / 100);
    setEditing(false);
    setSavedAt(Date.now());
  };

  const reset = () => {
    onSaveFinalCost?.(undefined);
    setEditing(false);
    setSavedAt(Date.now());
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-hairline px-4 py-3">
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-500">
          {label}
        </div>

        {editing ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-ink-500">₹</span>
            <input
              ref={inputRef}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
                if (e.key === "Escape") setEditing(false);
              }}
              aria-label={`${label} in rupees`}
              className="w-32 rounded border border-hairline bg-surface px-2 py-1 text-[15px] font-semibold tabular-nums text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
            <span className="text-[11px] tabular-nums text-ink-500">
              {valid ? `≈ ${usd(typed / result.fxRate)} ${unit}` : `${unit}`}
            </span>
            <button
              type="button"
              onClick={save}
              disabled={!valid}
              className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              <Check className="h-3.5 w-3.5" aria-hidden /> Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              <X className="h-3.5 w-3.5" aria-hidden /> Cancel
            </button>
          </div>
        ) : (
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="text-[17px] font-semibold tabular-nums text-ink-900">
              {inr(result.finalCostInr)}
            </span>
            <span className="text-[11.5px] tabular-nums text-ink-500">
              {usd(result.finalCostUsd)} {unit}
            </span>
            {onSaveFinalCost && (
              <button
                type="button"
                onClick={open}
                aria-label={`Edit ${label}`}
                title={`Edit ${label}`}
                className="rounded p-1 text-ink-400 hover:bg-surface-alt hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
            {savedAt > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] font-semibold text-brand-700">
                <Check className="h-3 w-3" aria-hidden /> Saved
              </span>
            )}
          </div>
        )}
      </div>

      {result.finalCostEdited && !editing && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[11.5px] text-ink-500">
          <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-alt px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-600">
            Edited
          </span>
          <span className="tabular-nums">
            Calculated {inr(result.calculatedFinalCostInr)} {unit}
          </span>
          {onSaveFinalCost && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 rounded border border-hairline bg-surface px-2 py-1 text-[11.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              <RotateCcw className="h-3 w-3" aria-hidden /> Use calculated
            </button>
          )}
        </div>
      )}

      <p className="ml-auto max-w-[280px] text-right text-[10.5px] text-ink-400">
        Selling price and margin are recalculated from this total cost.
      </p>
    </div>
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
