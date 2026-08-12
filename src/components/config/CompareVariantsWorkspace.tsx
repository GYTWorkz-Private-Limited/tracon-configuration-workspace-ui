// CompareVariantsWorkspace — full-screen comparison of all pricing variants.
// The comparison body itself lives in VariantComparisonTable so the Costing
// Report can render exactly the same data.

import { X } from "lucide-react";
import type { CushionVariant } from "@/lib/cushionCosting";
import { VariantComparisonTable } from "./VariantComparisonTable";

type Props = {
  variants: CushionVariant[];
  activeId: string;
  productName: string;
  targetPriceUsd?: number;
  onClose: () => void;
  /** Make a compared column the active configuration. */
  onApplyVariant?: (id: string) => void;
  /** Start a new variant from a compared column. */
  onDuplicateVariant?: (v: CushionVariant) => void;
};

export function CompareVariantsWorkspace({
  variants,
  activeId,
  productName,
  targetPriceUsd,
  onClose,
  onApplyVariant,
  onDuplicateVariant,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      {/* Header */}
      <header className="shrink-0 border-b border-hairline bg-surface px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
              Costing workspace
            </div>
            <h1 className="text-[19px] font-semibold tracking-tight text-ink-900">
              Compare variants
            </h1>
          </div>
          <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[11.5px] font-medium tabular-nums text-ink-700">
            {variants.length} variants
          </span>
          <span className="text-[12px] text-ink-500">{productName}</span>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onClose}
              aria-label="Close comparison"
              className="rounded-md border border-hairline bg-surface p-2 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Body — vertical scroll; summary cards pinned */}
      <div className="min-h-0 flex-1 overflow-auto">
        <VariantComparisonTable
          variants={variants}
          activeId={activeId}
          productName={productName}
          targetPriceUsd={targetPriceUsd}
          onApplyVariant={onApplyVariant}
          onDuplicateVariant={onDuplicateVariant}
        />
      </div>
    </div>
  );
}
