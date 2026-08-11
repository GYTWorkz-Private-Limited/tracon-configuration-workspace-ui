import { ChevronRight, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useRequestedChanges } from "@/lib/requestedChangesStore";

// Approval is no longer a destination of its own — commercial sign-off happens
// inside Quotation, so the workflow is three steps end to end.
export const WORKFLOW_STEPS = [
  "Configuration & Costing",
  "Costing Report",
  "Quotation",
] as const;

/** Legacy step names kept so existing screens keep highlighting the right band. */
export type WorkflowStep =
  | (typeof WORKFLOW_STEPS)[number]
  | "Configuration"
  | "Costing"
  | "Approval";

const normalize = (s: WorkflowStep): (typeof WORKFLOW_STEPS)[number] =>
  s === "Configuration" || s === "Costing"
    ? "Configuration & Costing"
    : s === "Approval"
      ? "Quotation"
      : s;


/** Full-width workflow band shown directly below the page header on every step. */
export function WorkflowStepper({
  active,
  podId,
  articleId,
  costingRef,
  onStepClick,
}: {
  active: WorkflowStep;
  /** Pass POD + article ids to make completed steps clickable. */
  podId?: string;
  articleId?: string;
  /** Costing route id (article srfRef) — enables navigating back to Costing. */
  costingRef?: string;
  /**
   * Overlay hook: return true when the click was fully handled locally
   * (e.g. closing an overlay) so no route navigation happens.
   */
  onStepClick?: (step: WorkflowStep) => boolean | void;
}) {
  const activeIndex = WORKFLOW_STEPS.indexOf(normalize(active));
  const rc = useRequestedChanges();
  // Commercial sign-off progress now rides on the Quotation step (1/4 → 4/4).
  const approvalBadge = rc.submitted ? `${rc.approvalDone ? 4 : 1}/4` : null;

  const linkFor = (step: WorkflowStep) => {
    if (!podId || !articleId) return null;

    if (step === "Configuration & Costing")
      return { to: "/config/$podId/$articleId", params: { podId, articleId } } as const;
    if (step === "Quotation")
      return { to: "/quotation/$podId/$articleId", params: { podId, articleId } } as const;

    if (step === "Costing Report" && costingRef)
      return {
        to: "/costing/$id",
        params: { id: costingRef },
        search: { podId, articleId, report: true },
      } as const;
    return null;

  };


  return (
    <div className="border-b border-hairline bg-surface">
      <div className="flex items-center gap-1 overflow-x-auto px-6 py-2.5 lg:px-8">
        {WORKFLOW_STEPS.map((step, i) => {
          const isActive = i === activeIndex;
          const isDone = i < activeIndex;
          // Demo mode: every step is reachable, forward and back.
          const link = linkFor(step);
          const clickable = !isActive && (!!link || !!onStepClick);

          const inner = (
            <div
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition-colors",
                isActive
                  ? "bg-ink-900 font-medium text-white"
                  : isDone
                    ? cn(
                        "bg-brand-50 text-brand-700",
                        clickable && "hover:bg-brand-100 hover:text-brand-800",
                      )
                    : cn("text-ink-400", clickable && "hover:bg-surface-alt hover:text-ink-700"),
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold tabular-nums",
                  isActive
                    ? "bg-white/20 text-white"
                    : isDone
                      ? "bg-brand-700 text-white"
                      : "bg-ink-100 text-ink-500",
                )}
              >
                {isDone ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : i + 1}
              </span>
              {step}
              {step === "Quotation" && approvalBadge && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums",
                    isActive
                      ? "bg-white/20 text-white"
                      : rc.approvalDone
                        ? "bg-brand-700 text-white"
                        : "bg-ink-100 text-ink-600",
                  )}
                  title={`${approvalBadge} reviewers approved`}
                >
                  {approvalBadge}
                </span>
              )}
            </div>
          );

          const handled = (e: React.MouseEvent) => {
            if (!onStepClick) return;
            if (onStepClick(step) === true) e.preventDefault();
          };

          return (
            <div key={step} className="flex items-center gap-1">
              {link && !isActive ? (
                <Link
                  {...link}
                  onClick={handled}
                  title={`Go to ${step}`}
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
                >
                  {inner}
                </Link>
              ) : !isActive && onStepClick ? (
                <button
                  onClick={() => onStepClick(step)}
                  title={`Go to ${step}`}
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
                >
                  {inner}
                </button>
              ) : (
                inner
              )}
              {i < WORKFLOW_STEPS.length - 1 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-300" aria-hidden />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

