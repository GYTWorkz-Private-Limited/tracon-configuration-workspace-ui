/**
 * "Override this article."
 *
 * Every quotable configuration of the article, with the three figures the
 * commercial team is allowed to move: quoted MOQ, margin, selling price. Laid
 * out as a table because that is the shape of the decision — the reason to open
 * this at all is usually to compare the rows before deciding which one to move,
 * and a form that showed one row at a time would hide exactly that.
 *
 * The rest of the quotation is read-only context here: direct cost and total
 * cost are shown so a typed price can be judged against what the thing costs,
 * but they belong to Costing and are not editable.
 *
 * Nothing new is computed. Each edit goes through the same store action the
 * inline cells use, and the commercial calculation derives everything else
 * exactly as it always did — pin the price and margin follows, set the margin
 * and the price follows.
 *
 * An override always carries a reason. A hand-set price with no explanation is
 * indistinguishable from a typo three weeks later, and the audit trail is the
 * whole point of routing the decision through a dialog rather than an inline
 * cell — original value, new value, difference, who, when, why.
 */

import { useEffect, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr, pct, usd } from "@/lib/commercialProvisions";
import type { QuoteRow } from "./QuoteLinesTable";

/**
 * What the row would leave, given whatever has been typed so far.
 *
 * Computed here rather than saved-and-read-back so the reviewer sees the
 * consequence before committing to it — the same formula `commercialProvisions`
 * applies when a price is pinned: margin is what the price leaves over the
 * final cost.
 */
function NewMargin({ row, override }: { row: QuoteRow; override: RowOverride }) {
  const c = row.priced.commercial;

  if (override.clearSelling) {
    return <span className="text-[11.5px] text-ink-500">back to {pct(c.marginPct, 1)}</span>;
  }

  if (override.sellingUsd !== undefined && override.sellingUsd > 0) {
    const sellingInr = override.sellingUsd * c.fxRate;
    const next = sellingInr > 0 ? ((sellingInr - c.finalCostInr) / sellingInr) * 100 : 0;
    return (
      <span className="inline-flex flex-col items-end">
        <span
          className={cn(
            "text-[12.5px] font-semibold tabular-nums",
            next < 0 ? "text-[var(--color-risk)]" : "text-brand-700",
          )}
        >
          {pct(next, 2)}
        </span>
        <span className="text-[10.5px] tabular-nums text-ink-400 line-through">
          {pct(c.marginPct, 2)}
        </span>
      </span>
    );
  }

  if (override.marginPct !== undefined) {
    return (
      <span className="text-[12.5px] font-semibold tabular-nums text-brand-700">
        {pct(override.marginPct, 2)}
      </span>
    );
  }

  return <span className="text-[12px] tabular-nums text-ink-400">{pct(c.marginPct, 2)}</span>;
}

/** What one row is being changed to. Absent fields are left alone. */
export type RowOverride = {
  lineId: string;
  moq?: number;
  marginPct?: number;
  sellingUsd?: number;
  /** hand the selling price back to the margin-derived figure */
  clearSelling?: boolean;
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
  /** the row the user came from, highlighted so they can find it */
  initialLineId: string;
  isKit: boolean;
  onClose: () => void;
  onSave: (overrides: RowOverride[], reason: string) => void;
}) {
  const [draft, setDraft] = useState<Record<string, RowOverride>>({});
  const [reason, setReason] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const unit = isKit ? "/ set" : "/ pc";

  const edit = (lineId: string, patch: Partial<RowOverride>) =>
    setDraft((d) => ({ ...d, [lineId]: { ...d[lineId], lineId, ...patch } }));

  const changed = Object.values(draft).filter(
    (o) =>
      o.moq !== undefined ||
      o.marginPct !== undefined ||
      o.sellingUsd !== undefined ||
      o.clearSelling,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Override ${articleName}`}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <button className="absolute inset-0 bg-ink-900/40" aria-label="Cancel" onClick={onClose} />

      <div className="relative flex max-h-[88vh] w-full max-w-[820px] flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl">
        <header className="flex shrink-0 items-start gap-3 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-ink-900">Override {articleName}</h2>
            <p className="mt-0.5 text-[12px] text-ink-500">
              Set the quoted MOQ, margin or selling price on any configuration. The costing
              underneath is never changed — pin a price and margin follows it, set a margin and the
              price follows.
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

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-hairline bg-surface-alt/60 text-[10px] uppercase tracking-[0.1em] text-ink-500">
                <th scope="col" className="min-w-[240px] px-4 py-2 text-left font-medium">
                  Configuration
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Total cost
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {isKit ? "Quoted sets" : "Quoted MOQ"}
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Margin %
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Selling price $
                </th>
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  New margin
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = r.priced.commercial;
                const o = draft[r.lineId] ?? {};
                const came = r.lineId === initialLineId;
                return (
                  <tr
                    key={r.lineId}
                    className={cn(
                      "border-b border-hairline/70 align-middle",
                      came && "bg-brand-50/40",
                    )}
                  >
                    <td className="px-4 py-2.5">
                      <div className="text-[12.5px] font-medium text-ink-900">
                        {r.priced.scenario.name}
                      </div>
                      <div className="text-[11px] text-ink-500">
                        {r.priced.build.name} · {r.priced.sizeLabel}
                      </div>
                    </td>

                    {/* Costing's number, for judging a typed price against. */}
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      <div className="text-ink-700">{inr(c.finalCostInr)}</div>
                      <div className="text-[10.5px] text-ink-400">
                        {usd(c.finalCostUsd)} {unit}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        min={1}
                        step={100}
                        value={o.moq ?? r.priced.moq}
                        aria-label={`${r.priced.scenario.name} — quoted quantity`}
                        onChange={(e) => edit(r.lineId, { moq: Number(e.target.value) })}
                        className="w-24 rounded border border-hairline bg-surface px-2 py-1 text-right text-[12px] tabular-nums text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                      />
                      {r.moqOverridden && (
                        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                          Override
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <span className="inline-flex items-baseline">
                        <input
                          type="number"
                          step={0.5}
                          value={o.marginPct ?? Number(c.marginPct.toFixed(1))}
                          disabled={c.sellingPriceEdited && !o.clearSelling}
                          aria-label={`${r.priced.scenario.name} — target margin percent`}
                          onChange={(e) => edit(r.lineId, { marginPct: Number(e.target.value) })}
                          className="w-16 rounded border border-hairline bg-surface px-2 py-1 text-right text-[12px] tabular-nums text-ink-900 disabled:bg-surface-alt disabled:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                        />
                        <span className="pl-0.5 text-ink-500" aria-hidden>
                          %
                        </span>
                      </span>
                      {/* A pinned price OWNS the margin — offering both would be
                          offering two answers to one question. */}
                      {c.sellingPriceEdited && !o.clearSelling && (
                        <div className="mt-0.5 text-[10px] text-ink-500">derived from price</div>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={o.clearSelling ? "" : (o.sellingUsd ?? c.sellingUsd)}
                        placeholder={usd(c.calculatedSellingUsd)}
                        aria-label={`${r.priced.scenario.name} — selling price`}
                        onChange={(e) =>
                          edit(r.lineId, {
                            sellingUsd: Number(e.target.value),
                            clearSelling: false,
                          })
                        }
                        className="w-24 rounded border border-hairline bg-surface px-2 py-1 text-right text-[12px] font-semibold tabular-nums text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                      />
                      {(c.sellingPriceEdited || o.sellingUsd !== undefined) && !o.clearSelling && (
                        <button
                          type="button"
                          onClick={() =>
                            edit(r.lineId, { clearSelling: true, sellingUsd: undefined })
                          }
                          className="mt-0.5 inline-flex items-center gap-1 text-[10.5px] font-medium text-ink-500 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                        >
                          <RotateCcw className="h-3 w-3" aria-hidden /> Use margin
                        </button>
                      )}
                      {o.clearSelling && (
                        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-brand-700">
                          Back to margin
                        </div>
                      )}
                    </td>

                    {/* What the typed figures leave, before anything is saved —
                        the answer to "and does that actually fix the margin?" */}
                    <td className="px-3 py-2.5 text-right">
                      <NewMargin row={r} override={o} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <footer className="shrink-0 border-t border-hairline bg-surface-alt/40 px-5 py-3.5">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600">
              Reason{" "}
              <span className="font-normal normal-case tracking-normal text-ink-400">
                — recorded against the override with your name and the time
              </span>
            </span>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this price being set by hand? e.g. matched to the buyer's counter-offer on the 4,800 pc break."
              className="mt-1 w-full resize-y rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
          </label>

          <div className="mt-3 flex items-center gap-3">
            <span className="text-[12px] text-ink-500">
              {changed.length === 0
                ? "Nothing changed yet"
                : `${changed.length} configuration${changed.length === 1 ? "" : "s"} changed`}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={onClose}
                className="rounded-md border border-hairline bg-surface px-3.5 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                Cancel
              </button>
              <button
                disabled={changed.length === 0 || reason.trim().length === 0}
                title={
                  reason.trim().length === 0
                    ? "An override needs a reason before it can be applied."
                    : undefined
                }
                onClick={() => onSave(changed, reason.trim())}
                className="rounded-md bg-brand-700 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                Apply Override
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
