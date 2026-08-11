// CostProgressBar — the compact horizontal cost summary + focus filter that
// replaces the old fixed phase rail and side rail. Five buckets: Raw Material,
// Process, Accessories, Packaging, Direct Cost. Clicking a bucket focuses the
// matching lanes in the network canvas — it never navigates away from it.

import { cn } from "@/lib/utils";
import { inr } from "@/lib/fabricConfig";

export type ProgressKey = "raw" | "process" | "accessories" | "packaging" | "direct";

export type ProgressBucket = { key: ProgressKey; label: string; amount: number; lanes: number[] };

type Props = {
  buckets: ProgressBucket[];
  activeKey: ProgressKey | null;
  onSelect: (key: ProgressKey) => void;
};

export function CostProgressBar({ buckets, activeKey, onSelect }: Props) {
  const max = Math.max(...buckets.map((b) => b.amount), 0.0001);

  return (
    <div className="grid shrink-0 grid-cols-5 gap-px border-b border-hairline bg-hairline">
      {buckets.map((b) => {
        const active = activeKey === b.key;
        const pct = Math.max(3, Math.round((b.amount / max) * 100));
        return (
          <button
            key={b.key}
            type="button"
            onClick={() => onSelect(b.key)}
            aria-pressed={active}
            className={cn(
              "flex flex-col gap-1.5 bg-surface px-4 py-2.5 text-left transition-colors",
              active ? "bg-brand-50" : "hover:bg-surface-alt",
            )}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={cn(
                  "text-[10.5px] font-medium uppercase tracking-[0.1em]",
                  active ? "text-brand-700" : "text-ink-500",
                )}
              >
                {b.label}
              </span>
              <span
                className={cn(
                  "text-[13.5px] font-semibold tabular-nums",
                  b.key === "direct" ? "text-brand-700" : active ? "text-ink-900" : "text-ink-800",
                )}
              >
                {inr(b.amount)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
              <div
                className={cn(
                  "h-full rounded-full",
                  b.key === "direct" ? "bg-brand-900" : "bg-brand-600",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
