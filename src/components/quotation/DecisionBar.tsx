/**
 * The commercial decision, and the numbers it is taken on.
 *
 * One strip of figures, pinned to the bottom of the viewport: a reviewer
 * scrolling through twenty lines should never lose sight of what the whole
 * document is worth while reading one row of it. The ACTIONS — send, and the
 * approver's Approve / Override / Reject — live in the page header with every
 * other CTA; this bar only reports.
 *
 * The strip is the same arithmetic the sheet totals show, read from
 * `commercialHealth` — one source, so a bar cannot claim a margin the table
 * above disagrees with.
 */

import { FileWarning, Layers } from "lucide-react";

import { cn } from "@/lib/utils";
import { inr, pct, usd } from "@/lib/commercialProvisions";
import type { CommercialHealth } from "@/lib/quotationReview";

/**
 * The figures, with no action attached — the Quotation stage's footer.
 *
 * The note follows the stage, because a bar that still says "being prepared"
 * over a quotation three reviewers are looking at is worse than no note at
 * all: it tells the reader the screen has not noticed what has happened to it.
 */
export function PreparationBar({
  health,
  submitted,
}: {
  health: CommercialHealth;
  submitted: boolean;
}) {
  return (
    <BarShell>
      <HealthStrip health={health} />
      <p className="ml-auto max-w-[340px] text-right text-[11px] leading-snug text-ink-500">
        {submitted
          ? "This quotation is out for approval and read-only. Approve, override or reject it from the header above."
          : "This quotation is still being prepared. Send it for approval from the header when the figures are right."}
      </p>
    </BarShell>
  );
}

/* ------------------------------------------------------------------ *
 * Shared pieces
 * ------------------------------------------------------------------ */

function BarShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-hairline bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3 lg:px-8">
        {children}
      </div>
    </div>
  );
}

export function HealthStrip({ health }: { health: CommercialHealth }) {
  const negative = health.avgMarginPct < 0;
  return (
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
