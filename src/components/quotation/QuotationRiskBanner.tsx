/**
 * "Quotation at risk" — the price you promised was built on rates that moved.
 *
 * Reads the master snapshot pinned when this quotation was priced and compares
 * it against the current rate feed. Softened rates stay silent — the banner
 * exists to stop a quote being honoured at a loss, so it only speaks when an
 * input cost ROSE, and it names exactly which masters did it so the commercial
 * team can re-cost the right lines instead of re-opening everything.
 */

import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/commercialProvisions";
import { riskAssessment, useSnapshot, STALE_AFTER_DAYS } from "@/lib/masterSnapshot";

export function QuotationRiskBanner({ quotationId }: { quotationId: string }) {
  const snapshot = useSnapshot(quotationId);
  const [open, setOpen] = useState(false);

  // No snapshot means this quotation was never priced through the snapshot
  // path — there is nothing recorded to be at risk against.
  if (!snapshot) return null;

  const risk = riskAssessment(snapshot);
  if (risk.risen.length === 0) {
    // Staleness alone still deserves a nudge: an old rate that HAPPENS to
    // match today's feed is luck, not assurance.
    if (!risk.stale) return null;
    return (
      <p className="rounded-lg border border-hairline bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-900">
        Rates recorded {new Date(snapshot.takenAt).toLocaleDateString()} — older than{" "}
        {STALE_AFTER_DAYS} days, refresh before sending.
      </p>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-lg border border-red-200 bg-red-50"
      aria-label="Quotation at risk"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold text-red-800">
            Quotation at risk — input costs have moved since this was priced
          </span>
          <span className="mt-0.5 block text-[11.5px] text-red-700/80">
            {risk.risen.length} master{risk.risen.length === 1 ? "" : "s"} costlier than the rate
            this quotation used
          </span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-red-700 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && (
        <div className="border-t border-red-200/70 bg-surface px-3.5 py-2.5">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-ink-500">
                <th className="py-1.5 pr-3 font-medium">Master</th>
                <th className="py-1.5 pr-3 text-right font-medium">Rate used</th>
                <th className="py-1.5 pr-3 text-right font-medium">Current</th>
                <th className="py-1.5 text-right font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              {risk.risen.map(({ ref, currentRate, pctUp }) => (
                <tr key={ref.masterId} className="border-t border-hairline/70">
                  <td className="py-1.5 pr-3">
                    <span className="font-medium text-ink-900">{ref.name}</span>{" "}
                    <span className="text-[11px] text-ink-500">{ref.code}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-ink-700">
                    {inr(ref.rateUsed)}
                    <span className="block text-[10.5px] text-ink-400">
                      as of {new Date(ref.asOf).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-ink-900">
                    {inr(currentRate)}
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular-nums text-red-700">
                    +{pctUp.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {risk.stale && (
            <p className="mt-2 border-t border-hairline/70 pt-2 text-[11.5px] text-amber-900">
              Rates recorded {new Date(snapshot.takenAt).toLocaleDateString()} — older than{" "}
              {STALE_AFTER_DAYS} days, refresh before sending.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
