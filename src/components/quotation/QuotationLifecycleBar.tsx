/**
 * Where this quotation is in its life, stated once at the top of the page.
 *
 * A quotation reached from the Quotations module carries no context with it —
 * the user did not walk the workflow to get here, so the screen has to say
 * what stage it is at before any figure on it means anything. "Approve" reads
 * very differently on a draft than on a document three reviewers have already
 * seen.
 *
 * Deliberately not the `WorkflowStepper`: that band is the ARTICLE's journey
 * through costing, and it belongs to a POD and an article. This is one
 * quotation's own lifecycle, which continues after the article's costing is
 * finished and can cover several articles at once.
 */

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { LIFECYCLE_STEPS, type QuotationState } from "@/lib/quotationLifecycle";

export function QuotationLifecycleBar({
  state,
  className,
}: {
  state: QuotationState;
  className?: string;
}) {
  return (
    <nav
      aria-label="Quotation lifecycle"
      className={cn(
        "overflow-x-auto rounded-xl border border-hairline bg-surface px-4 py-2.5",
        className,
      )}
    >
      <ol className="flex items-center gap-1">
        {LIFECYCLE_STEPS.map((step, i) => {
          const done = i < state.stepIndex;
          const current = i === state.stepIndex;
          return (
            <li key={step} className="flex items-center gap-1">
              <span
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] transition-colors",
                  current
                    ? "bg-ink-900 font-semibold text-white"
                    : done
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink-400",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold tabular-nums",
                    current
                      ? "bg-white/20 text-white"
                      : done
                        ? "bg-brand-700 text-white"
                        : "bg-ink-100 text-ink-500",
                  )}
                >
                  {done ? <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden /> : i + 1}
                </span>
                {step}
              </span>
              {i < LIFECYCLE_STEPS.length - 1 && (
                <span className="h-px w-4 shrink-0 bg-hairline" aria-hidden />
              )}
            </li>
          );
        })}

        {/* The one fact the step names cannot carry: a quotation sitting at
            "Approval" with two of three reviewers done is in a different place
            to one nobody has opened. */}
        {state.submitted && state.reviewerCount > 0 && (
          <li className="ml-auto pl-3 text-[11.5px] tabular-nums text-ink-500">
            {state.approvedCount}/{state.reviewerCount} approved
          </li>
        )}
      </ol>
    </nav>
  );
}
