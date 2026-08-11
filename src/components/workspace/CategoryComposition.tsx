// CategoryComposition — "what's actually in this number."
//
// The cost strip says Raw Material is $2.15 / 54.9%. This answers the next
// question a costing reviewer always asks: which lines add up to that. Reuses
// the same rollup/packaging/testing data the table and strip already read —
// no second cost calculation exists anywhere in the workspace.

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MoneyFormatter } from "@/lib/money";
import type { CostRollup, PackagingItem, TestingItem } from "@/lib/costingModel";
import { packagingCost, testingCost } from "@/lib/costingModel";
import type { CostCategory } from "./CostBreakdownStrip";

type Line = { id: string; label: string; detail?: string; amount: number };

const COLLAPSED_COUNT = 4;

function linesFor(
  category: CostCategory,
  rollup: CostRollup,
  packaging: PackagingItem[],
  testing: TestingItem[],
): Line[] {
  if (category === "raw") {
    return rollup.components
      .filter((c) => c.materialCost > 0)
      .map((c) => ({ id: c.component.id, label: c.component.name, amount: c.materialCost }));
  }
  if (category === "process") {
    return rollup.components
      .filter((c) => c.processTotal > 0)
      .map((c) => ({ id: c.component.id, label: c.component.name, amount: c.processTotal }));
  }
  if (category === "accessories") {
    return rollup.components
      .filter((c) => c.accessoryTotal > 0)
      .map((c) => ({ id: c.component.id, label: c.component.name, amount: c.accessoryTotal }));
  }
  if (category === "packaging") {
    return packaging.map((p) => ({
      id: p.id,
      label: p.subtype,
      detail: p.packagingType,
      amount: packagingCost(p),
    }));
  }
  if (category === "testing") {
    return testing.map((t) => ({
      id: t.id,
      label: t.name,
      detail: `${t.testType} · ${t.labName}`,
      amount: testingCost(t),
    }));
  }
  return rollup.components.map((c) => ({
    id: c.component.id,
    label: c.component.name,
    amount: c.totalCost,
  }));
}

export function CategoryComposition({
  category,
  rollup,
  packaging,
  testing,
  money,
}: {
  category: CostCategory;
  rollup: CostRollup;
  packaging: PackagingItem[];
  testing: TestingItem[];
  money: MoneyFormatter;
}) {
  const [expanded, setExpanded] = useState(false);
  if (category === "direct") return null;

  const lines = linesFor(category, rollup, packaging, testing).sort((a, b) => b.amount - a.amount);
  if (!lines.length) return null;

  const shown = expanded ? lines : lines.slice(0, COLLAPSED_COUNT);
  const hiddenCount = lines.length - shown.length;

  return (
    <div className="shrink-0 border-b border-hairline bg-surface-alt/30 px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {shown.map((line) => (
          <span key={line.id} className="inline-flex items-baseline gap-1 text-[11.5px]">
            <span className="text-ink-600">{line.label}</span>
            <span className="font-medium tabular-nums text-ink-900">— {money(line.amount)}</span>
          </span>
        ))}

        {lines.length > COLLAPSED_COUNT && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-hairline px-2 py-0.5 text-[11px] font-medium text-brand-700 transition-colors",
              "hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
            )}
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                + {hiddenCount} selected <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
