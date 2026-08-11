// ScenarioBar — costing positions across the top of the workspace.
//
// Each tab is a whole scenario, not a filter: selecting one re-costs the entire
// build. The percentage is the selling-price delta against the base scenario,
// which is what a commercial team actually compares positions on.

import { MoreVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Scenario } from "@/lib/scenarios";

type Props = {
  scenarios: Scenario[];
  activeId: string;
  /** signed selling-price delta vs base, by scenario id. Base itself has none. */
  delta: (id: string) => number | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
};

export function ScenarioBar({ scenarios, activeId, delta, onSelect, onClose }: Props) {
  return (
    <div className="relative flex shrink-0 items-stretch border-b border-hairline bg-surface">
      <div className="flex shrink-0 items-center gap-2 border-r border-hairline px-4">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-500">
          Scenarios
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {scenarios.map((s) => {
          const active = s.id === activeId;
          const d = delta(s.id);
          return (
            <div
              key={s.id}
              className={cn(
                "group relative flex shrink-0 items-center border-r border-hairline transition-colors",
                active ? "bg-surface" : "bg-surface-alt/40 hover:bg-surface-alt",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={active ? "true" : undefined}
                className="min-w-[128px] px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "truncate text-[13px]",
                      active ? "font-semibold text-ink-900" : "font-medium text-ink-600",
                    )}
                  >
                    {s.name}
                  </span>
                  {/* The dot marks the active position for anyone who cannot
                      pick the selected tab out by background alone. */}
                  {active && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden />
                  )}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5">
                  {d === null ? (
                    <span className="text-[11px] text-ink-400">{s.subtitle}</span>
                  ) : (
                    <span
                      className={cn(
                        "text-[11px] font-medium tabular-nums",
                        d > 0 ? "text-[#8f2c22]" : d < 0 ? "text-brand-700" : "text-ink-400",
                      )}
                    >
                      {d > 0 ? "+" : ""}
                      {d.toFixed(1)}%
                    </span>
                  )}
                </span>
              </button>

              {!s.isBase && (
                <button
                  type="button"
                  onClick={() => onClose(s.id)}
                  aria-label={`Close ${s.name} scenario`}
                  className="mr-2 rounded p-1 text-ink-300 transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              {active && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-700" aria-hidden />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center border-l border-hairline px-2">
        <button
          type="button"
          aria-label="Scenario options"
          className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
