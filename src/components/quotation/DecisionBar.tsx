/**
 * The commercial decision, and the numbers it is taken on.
 *
 * This is the dominant interaction on the Quotation workspace: everything
 * above it exists so that Approve, Override or Reject can be pressed with
 * confidence. It is pinned to the bottom of the viewport for the same reason —
 * a reviewer scrolling through twenty lines should never have to scroll back
 * to act, or lose sight of what the whole document is worth while reading one
 * row of it.
 *
 * The health strip on the left is the same arithmetic the sheet totals show,
 * read from `commercialHealth` — one source, so the bar cannot claim a margin
 * the table above disagrees with.
 */

import { CheckCircle2, FileWarning, Layers, PencilLine, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { inr, pct, usd } from "@/lib/commercialProvisions";
import type { CommercialHealth } from "@/lib/quotationReview";

export function DecisionBar({
  health,
  locked,
  blockedNames,
  onApprove,
  onOverride,
  onReject,
}: {
  health: CommercialHealth;
  /** a sent quotation is read-only until somebody opens the next version */
  locked: boolean;
  /** lines out for recosting — the quotation cannot be approved while they are */
  blockedNames: string[];
  onApprove: () => void;
  onOverride: () => void;
  onReject: () => void;
}) {
  const blocked = blockedNames.length > 0;
  const negative = health.avgMarginPct < 0;

  return (
    <div className="sticky bottom-0 z-20 border-t border-hairline bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3 lg:px-8">
        {/* ---- commercial health ---- */}
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Metric icon={<Layers className="h-3.5 w-3.5" aria-hidden />} label="Articles">
            {health.articles}
          </Metric>
          <Metric label="Pricing lines">{health.pricingLines}</Metric>
          <Metric label="Total cost">{usd(health.totalCostUsd, 0)}</Metric>
          <Metric label="Quote value" strong>
            {usd(health.orderValueUsd, 0)}
          </Metric>
          <Metric label="Avg. margin ₹" tone={health.avgMarginInr < 0 ? "risk" : undefined}>
            {inr(health.avgMarginInr)}
          </Metric>
          <Metric label="Avg. margin" strong tone={negative ? "risk" : undefined}>
            {pct(health.avgMarginPct, 2)}
          </Metric>
          <Metric
            icon={
              health.needsReview > 0 ? (
                <FileWarning className="h-3.5 w-3.5 text-gold-600" aria-hidden />
              ) : undefined
            }
            label="Requiring review"
            tone={health.needsReview > 0 ? "warning" : undefined}
          >
            {health.needsReview}
          </Metric>
          <Metric label="Overrides">{health.overrides}</Metric>
        </dl>

        {/* ---- the decision ---- */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {blocked && (
            <p className="max-w-[280px] text-[11px] leading-snug text-[var(--color-risk)]">
              {blockedNames.join(", ")} {blockedNames.length === 1 ? "is" : "are"} out for
              recosting.
            </p>
          )}

          <button
            type="button"
            disabled={locked || health.articles === 0}
            onClick={onReject}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-risk)]/40 bg-surface px-3.5 py-2 text-[13px] font-medium text-[var(--color-risk)] hover:bg-[var(--color-risk-soft)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-risk)]"
          >
            <XCircle className="h-4 w-4" aria-hidden /> Reject
          </button>

          <button
            type="button"
            disabled={locked || health.articles === 0}
            onClick={onOverride}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <PencilLine className="h-4 w-4" aria-hidden /> Override
          </button>

          <button
            type="button"
            disabled={locked || blocked || health.articles === 0}
            title={
              blocked
                ? `${blockedNames.join(", ")} must come back from recosting first.`
                : "Approve this quotation and lock it for final quotation generation"
            }
            onClick={onApprove}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Approve
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  children,
  strong,
  tone,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
  strong?: boolean;
  tone?: "risk" | "warning";
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-ink-500">
        {icon}
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 tabular-nums",
          strong ? "text-[15px] font-semibold" : "text-[13px] font-medium",
          tone === "risk"
            ? "text-[var(--color-risk)]"
            : tone === "warning"
              ? "text-gold-700"
              : "text-ink-900",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
