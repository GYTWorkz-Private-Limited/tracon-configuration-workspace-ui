/**
 * "Quotation at risk" — the price you promised was built on rates that moved.
 *
 * Reads the master snapshot pinned when this quotation was priced and compares
 * it against the current rate feed. Softened rates stay silent — the banner
 * exists to stop a quote being honoured at a loss, so it only speaks when an
 * input cost ROSE, and it names exactly which masters did it so the commercial
 * team can re-cost the right lines instead of re-opening everything.
 *
 * Given commercial context (`marginContext`), it goes further than naming the
 * masters: it states what the risk MEANS — the margin the quotation would earn
 * today against the margin that was approved, and the price that would restore
 * it — and offers the two honest ways out: requote, or accept the risk on the
 * record. An accepted risk collapses to a quiet acknowledgement line rather
 * than shouting forever about a decision already taken.
 */

import { useState } from "react";
import { AlertTriangle, ChevronDown, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr, pct, usd } from "@/lib/commercialProvisions";
import { riskAssessment, useSnapshot, STALE_AFTER_DAYS } from "@/lib/masterSnapshot";
import { acceptQuotationRisk, useBuyerRecord } from "@/lib/buyerResponseStore";
import {
  marginNowPct,
  recommendedPriceUsd,
  riskOf,
  RISK_LABEL,
} from "@/lib/quotationPipeline";
import { toast } from "sonner";

export type RiskMarginContext = {
  /** whole-quotation figures, INR — what the estimate is computed over */
  sellingInr: number;
  finalCostInr: number;
  rawMaterialInr: number;
  quotedMarginPct: number;
  fxRate: number;
};

export function QuotationRiskBanner({
  quotationId,
  marginContext,
  onRequote,
}: {
  quotationId: string;
  /** given, the banner states margin impact and offers requote / accept risk */
  marginContext?: RiskMarginContext;
  onRequote?: () => void;
}) {
  const snapshot = useSnapshot(quotationId);
  const buyerRecord = useBuyerRecord(quotationId);
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
      <p className="mb-3 rounded-lg border border-hairline bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-900">
        Rates recorded {new Date(snapshot.takenAt).toLocaleDateString()} — older than{" "}
        {STALE_AFTER_DAYS} days, refresh before sending.
      </p>
    );
  }

  const graded = riskOf(snapshot);

  // The risk was seen and the price stands — one line on the record, not a
  // permanent alarm over a decision already taken.
  if (buyerRecord.riskAcceptedAt) {
    return (
      <p className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-surface-alt px-3.5 py-2.5 text-[12px] text-ink-600">
        <ShieldCheck className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
        <span>
          Input-cost risk accepted by{" "}
          <span className="font-medium text-ink-800">{buyerRecord.riskAcceptedBy}</span> on{" "}
          {new Date(buyerRecord.riskAcceptedAt).toLocaleDateString()} — the quoted price stands
          despite {risk.risen.length} costlier master{risk.risen.length === 1 ? "" : "s"}.
        </span>
      </p>
    );
  }

  const now = marginContext
    ? marginNowPct(
        marginContext.sellingInr,
        marginContext.finalCostInr,
        marginContext.rawMaterialInr,
        graded,
      )
    : undefined;
  const recommended = marginContext
    ? recommendedPriceUsd(
        marginContext.sellingInr,
        marginContext.finalCostInr,
        marginContext.rawMaterialInr,
        marginContext.quotedMarginPct,
        marginContext.fxRate,
        graded,
      )
    : undefined;

  return (
    <section
      className="mb-3 overflow-hidden rounded-lg border border-red-200 bg-red-50"
      aria-label="Quotation at risk"
    >
      <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <span className="block text-[12.5px] font-semibold text-red-800">
            Quotation at risk{graded && ` — ${RISK_LABEL[graded.level]}`} · input costs have moved
            since this was priced
          </span>
          <span className="mt-0.5 block text-[11.5px] text-red-700/80">
            {graded && `Worst input up ${graded.maxPctUp.toFixed(1)}% · `}
            {risk.risen.length} master{risk.risen.length === 1 ? "" : "s"} costlier than the rate
            this quotation used
            {marginContext && now !== undefined && (
              <>
                {" "}
                · margin if honoured today{" "}
                <strong className="font-semibold">{pct(now, 1)}</strong> (approved{" "}
                {pct(marginContext.quotedMarginPct, 1)})
                {recommended !== undefined && (
                  <>
                    {" "}
                    · recommended revised price{" "}
                    <strong className="font-semibold">{usd(recommended)}</strong>
                  </>
                )}
              </>
            )}
          </span>
        </button>

        {marginContext && (
          <span className="flex shrink-0 items-center gap-1.5">
            {onRequote && (
              <button
                type="button"
                onClick={onRequote}
                className="inline-flex items-center gap-1 rounded-md bg-red-700 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> Generate Requote
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                acceptQuotationRisk(quotationId);
                toast.success("Risk accepted — recorded against the quotation");
              }}
              className="rounded-md border border-red-300 bg-surface px-2.5 py-1.5 text-[12px] font-medium text-red-800 hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
            >
              Accept Risk
            </button>
          </span>
        )}

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Hide affected masters" : "Show affected masters"}
          className="shrink-0 rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <ChevronDown
            className={cn("h-4 w-4 text-red-700 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>

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
