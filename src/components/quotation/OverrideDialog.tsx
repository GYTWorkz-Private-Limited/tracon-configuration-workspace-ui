/**
 * "Override this article."
 *
 * One way in for every figure the commercial team is allowed to fix by hand,
 * rather than four separate cells to discover. The inline pencils in the table
 * are still there and still faster for a single tweak — this is the deliberate
 * version: pick the configuration you are quoting, see every overridable value
 * next to what the costing calculated, change what you need, save once.
 *
 * The fields it offers ARE the existing overrides: quoted quantity, target
 * margin, total cost and selling price. Nothing new is computed here — each
 * one goes through the same store action the table uses, and the commercial
 * calculation derives the rest exactly as it always did.
 */

import { useEffect, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr, usd } from "@/lib/commercialProvisions";
import type { QuoteRow } from "./QuoteLinesTable";

export type OverrideDraft = {
  moq?: number;
  marginPct?: number;
  finalCostInr?: number;
  sellingUsd?: number;
};

/** What the user typed, and which fields they cleared back to calculated. */
export type OverrideResult = {
  lineId: string;
  set: OverrideDraft;
  cleared: (keyof OverrideDraft)[];
};

export function OverrideDialog({
  articleName,
  rows,
  initialLineId,
  isKit,
  onClose,
  onSave,
}: {
  articleName: string;
  /** the quotable configurations — a row per variant, as the table shows them */
  rows: QuoteRow[];
  initialLineId: string;
  isKit: boolean;
  onClose: () => void;
  onSave: (result: OverrideResult) => void;
}) {
  const [lineId, setLineId] = useState(initialLineId);
  const [draft, setDraft] = useState<OverrideDraft>({});
  const [cleared, setCleared] = useState<Set<keyof OverrideDraft>>(new Set());

  const row = rows.find((r) => r.lineId === lineId) ?? rows[0];

  // Switching configuration starts a fresh set of edits: the numbers on screen
  // belong to the row being looked at, and carrying half-typed values across
  // would silently apply them to the wrong one.
  useEffect(() => {
    setDraft({});
    setCleared(new Set());
  }, [lineId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!row) return null;

  const c = row.priced.commercial;
  const unit = isKit ? "/ set" : "/ pc";

  const fields = [
    {
      key: "moq" as const,
      label: isKit ? "Quoted sets" : "Quoted MOQ",
      current: row.priced.moq,
      calculated: row.priced.moq,
      overridden: Boolean(row.moqOverridden),
      step: 100,
      format: (n: number) => n.toLocaleString("en-IN"),
      note: "The quantity being quoted, when it differs from the costed break.",
    },
    {
      key: "marginPct" as const,
      label: "Target margin %",
      current: c.marginPct,
      calculated: c.marginPct,
      overridden: false,
      step: 0.5,
      format: (n: number) => `${n.toFixed(1)}%`,
      note: "Margin on the selling price. Moves the price, not the cost.",
    },
    {
      key: "finalCostInr" as const,
      label: `Total cost ₹ ${unit}`,
      current: c.finalCostInr,
      calculated: c.calculatedFinalCostInr,
      overridden: c.finalCostEdited,
      step: 0.01,
      format: (n: number) => inr(n),
      note: "Replaces direct cost + provisions. Selling price follows the margin.",
    },
    {
      key: "sellingUsd" as const,
      label: `Selling price $ ${unit}`,
      current: c.sellingUsd,
      calculated: c.calculatedSellingUsd,
      overridden: c.sellingPriceEdited,
      step: 0.01,
      format: (n: number) => usd(n),
      note: "Pins the price the buyer sees. Margin is what it leaves over cost.",
    },
  ];

  const dirty = Object.values(draft).some((v) => v !== undefined) || cleared.size > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Override ${articleName}`}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <button className="absolute inset-0 bg-ink-900/40" aria-label="Cancel" onClick={onClose} />

      <div className="relative flex max-h-[88vh] w-full max-w-[620px] flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl">
        <header className="flex shrink-0 items-start gap-3 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-ink-900">Override {articleName}</h2>
            <p className="mt-0.5 text-[12px] text-ink-500">
              Every figure the commercial team may fix by hand, in one place. The costing underneath
              is never changed.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto shrink-0 rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* Which configuration is being overridden. A product can carry a row
              per variant, and they do not share a price. */}
          {rows.length > 1 && (
            <div className="mb-4">
              <label
                htmlFor="override-line"
                className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-500"
              >
                Configuration
              </label>
              <select
                id="override-line"
                value={lineId}
                onChange={(e) => setLineId(e.target.value)}
                className="w-full rounded-md border border-hairline bg-surface px-2.5 py-2 text-[12.5px] text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              >
                {rows.map((r) => (
                  <option key={r.lineId} value={r.lineId}>
                    {r.priced.scenario.name} · {r.priced.build.name} ·{" "}
                    {usd(r.priced.commercial.sellingUsd)} {unit}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-3">
            {fields.map((f) => {
              const typed = draft[f.key];
              const isCleared = cleared.has(f.key);
              return (
                <div
                  key={f.key}
                  className="rounded-lg border border-hairline bg-surface px-3.5 py-3"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[12.5px] font-medium text-ink-900">{f.label}</span>
                    {f.overridden && !isCleared && (
                      <span className="rounded-full border border-hairline bg-surface-alt px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-600">
                        Overridden
                      </span>
                    )}
                    <span className="ml-auto text-[11.5px] tabular-nums text-ink-500">
                      now {f.format(f.current)}
                      {f.overridden && ` · calculated ${f.format(f.calculated)}`}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step={f.step}
                      value={typed ?? ""}
                      disabled={isCleared}
                      placeholder={String(f.current)}
                      aria-label={f.label}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          [f.key]: e.target.value === "" ? undefined : Number(e.target.value),
                        }))
                      }
                      className="w-32 rounded border border-hairline bg-surface px-2 py-1.5 text-[13px] font-semibold tabular-nums text-ink-900 disabled:bg-surface-alt disabled:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                    />
                    {/* Only a figure that has been overridden has anything to
                        go back to. */}
                    {f.overridden && (f.key === "finalCostInr" || f.key === "sellingUsd") && (
                      <button
                        type="button"
                        onClick={() =>
                          setCleared((prev) => {
                            const next = new Set(prev);
                            if (next.has(f.key)) next.delete(f.key);
                            else next.add(f.key);
                            return next;
                          })
                        }
                        className={cn(
                          "inline-flex items-center gap-1 rounded border px-2 py-1 text-[11.5px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                          isCleared
                            ? "border-brand-600 bg-brand-50 text-brand-700"
                            : "border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
                        )}
                      >
                        <RotateCcw className="h-3 w-3" aria-hidden /> Use calculated
                      </button>
                    )}
                    <span className="min-w-0 flex-1 text-[11px] text-ink-500">{f.note}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-hairline bg-surface-alt/40 px-5 py-3.5">
          <button
            onClick={onClose}
            className="rounded-md border border-hairline bg-surface px-3.5 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            Cancel
          </button>
          <button
            disabled={!dirty}
            onClick={() => onSave({ lineId, set: draft, cleared: Array.from(cleared) })}
            className="rounded-md bg-brand-700 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            Save overrides
          </button>
        </footer>
      </div>
    </div>
  );
}
