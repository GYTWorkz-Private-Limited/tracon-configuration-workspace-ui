// Input-cost drift banner.
//
// Recomputed live against current costing on every render — never a frozen
// snapshot — so it stays truthful even when costing moves after the quote went
// out. Two ways out: requote at the recommended price, or accept the risk with
// a logged reason.

import { useState } from "react";
import { AlertTriangle, Zap, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuotationDrift } from "@/lib/quotationsStore";

const inr = (n: number) => `₹${Math.abs(n).toFixed(0)}`;

export function CostRiskBanner({
  drift,
  accepted,
  sentAt,
  onRequote,
  onAcceptRisk,
}: {
  drift: QuotationDrift;
  accepted: boolean;
  sentAt?: string;
  onRequote: () => void;
  onAcceptRisk: (reason: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  const critical = drift.severity === "critical";
  const up = drift.costDeltaInr >= 0;
  const sentLabel = sentAt
    ? new Date(sentAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "the quote was sent";

  if (accepted) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-hairline bg-surface-alt px-4 py-3">
        <ShieldCheck className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
        <p className="min-w-0 flex-1 text-[12.5px] text-ink-600">
          Cost risk accepted — proceeding at quoted terms. Margin if accepted today:{" "}
          <strong className="text-ink-900">{drift.marginNow.toFixed(1)}%</strong> (quoted at{" "}
          {drift.marginAtSend.toFixed(1)}%). Logged in the audit trail.
        </p>
        <button
          onClick={onRequote}
          className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
        >
          Generate Requote anyway
        </button>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        "rounded-lg border px-4 py-3",
        critical ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50",
      )}
    >
      <div className="flex flex-wrap items-start gap-3">
        <AlertTriangle
          className={cn("mt-0.5 h-4 w-4 shrink-0", critical ? "text-rose-600" : "text-amber-600")}
          aria-hidden
        />
        <p
          className={cn(
            "min-w-0 flex-1 text-[13px] leading-relaxed",
            critical ? "text-rose-900" : "text-amber-900",
          )}
        >
          <strong className="font-semibold">
            Input Cost Risk — {critical ? "Critical" : "Moderate"}.
          </strong>{" "}
          Costs have {up ? "risen" : "fallen"} {inr(drift.costDeltaInr)}/pc (
          {drift.costDeltaPct >= 0 ? "+" : ""}
          {drift.costDeltaPct.toFixed(1)}%) since this quote was sent on {sentLabel}. Current margin
          if accepted:{" "}
          <strong className="font-semibold tabular-nums">{drift.marginNow.toFixed(1)}%</strong> (was{" "}
          <span className="tabular-nums">{drift.marginAtSend.toFixed(1)}%</span>).{" "}
          <span className="whitespace-nowrap">
            Recommended revised price:{" "}
            <strong className="font-semibold tabular-nums">
              ${drift.recommendedPriceUsd.toFixed(2)}
            </strong>
            .
          </span>
        </p>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onRequote}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[12.5px] font-semibold text-white",
              critical ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700",
            )}
          >
            <Zap className="h-3.5 w-3.5" /> Generate Requote
          </button>
          <button
            onClick={() => setConfirming((v) => !v)}
            className="rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
          >
            Accept Risk
          </button>
        </div>
      </div>

      {confirming && (
        <div className="mt-3 rounded-md border border-hairline bg-surface p-3">
          <div className="flex items-start justify-between gap-2">
            <label htmlFor="risk-reason" className="text-[12px] font-medium text-ink-700">
              Why are we proceeding at the quoted price? (required — this is logged)
            </label>
            <button
              onClick={() => setConfirming(false)}
              aria-label="Cancel accepting risk"
              className="rounded p-0.5 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            id="risk-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="e.g. Strategic account — absorbing the increase to hold the AW26 slot."
            className="mt-2 w-full rounded-md border border-hairline bg-surface px-2.5 py-2 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
          />
          <div className="mt-2 flex justify-end">
            <button
              disabled={reason.trim().length < 4}
              onClick={() => {
                onAcceptRisk(reason.trim());
                setConfirming(false);
                setReason("");
              }}
              className="rounded-md bg-ink-900 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirm & log
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
