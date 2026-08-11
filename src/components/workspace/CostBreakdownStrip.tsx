// CostBreakdownStrip — the workspace's only top-level cost summary.
//
// Raw Material + Process + Accessories / Trims + Packaging = Direct Cost.
// Nothing commercial appears here: no selling price, no margin, no overheads.
// The workspace ends at direct cost by design.

import type { MoneyFormatter } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CostRollup } from "@/lib/costingModel";

export type CostCategory = "raw" | "process" | "accessories" | "packaging" | "testing" | "direct";

type Cell = {
  key: CostCategory;
  label: string;
  amount: number;
};

export function CostBreakdownStrip({
  rollup,
  money,
  activeKey,
  onSelect,
  live,
}: {
  rollup: CostRollup;
  money: MoneyFormatter;
  /** the category currently used as a table filter, if any */
  activeKey: CostCategory | null;
  onSelect: (key: CostCategory) => void;
  /** true while a recalculation has just landed */
  live?: boolean;
}) {
  const cells: Cell[] = [
    { key: "raw", label: "Raw Material", amount: rollup.rawMaterial },
    { key: "process", label: "Process", amount: rollup.process },
    { key: "accessories", label: "Accessories / Trims", amount: rollup.accessories },
    { key: "packaging", label: "Packaging", amount: rollup.packaging },
    { key: "testing", label: "Testing & Certification", amount: rollup.testing },
    { key: "direct", label: "Direct Cost", amount: rollup.directCost },
  ];

  const total = rollup.directCost || 1;

  return (
    <div
      className="grid shrink-0 grid-cols-2 border-b border-hairline bg-surface md:grid-cols-3 lg:grid-cols-6"
      role="group"
      aria-label="Direct cost breakdown"
    >
      {cells.map((cell) => {
        const pct = cell.key === "direct" ? 100 : Math.round((cell.amount / total) * 1000) / 10;
        const isDirect = cell.key === "direct";
        const isActive = activeKey === cell.key;
        return (
          <button
            key={cell.key}
            type="button"
            onClick={() => onSelect(cell.key)}
            aria-pressed={isActive}
            className={cn(
              "group flex flex-col gap-1.5 border-r border-hairline px-5 py-3 text-left transition-colors last:border-r-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700",
              isActive ? "bg-brand-50" : "hover:bg-surface-alt",
              isDirect && "bg-surface-alt",
              isDirect && isActive && "bg-brand-50",
            )}
          >
            <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-500">
              {cell.label}
            </span>
            <span className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-[17px] font-semibold tabular-nums transition-colors",
                  isDirect ? "text-brand-700" : "text-ink-900",
                  live && "text-brand-600",
                )}
              >
                {money(cell.amount)}
              </span>
              <span className="text-[11.5px] tabular-nums text-ink-400">{pct.toFixed(1)}%</span>
            </span>
            {/* Progress indicator — share of direct cost. Not the only signal:
                the percentage above carries the same information as text. */}
            <span className="h-1 w-full overflow-hidden rounded-full bg-ink-100" aria-hidden>
              <span
                className={cn(
                  "block h-full rounded-full transition-all duration-500",
                  isDirect ? "bg-brand-700" : "bg-brand-500",
                )}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
