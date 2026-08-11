// ConfigCompareWorkspace — full-screen shell around the configuration
// comparison: summary cards at the top, then the whole 0..7 costing spine read
// as a report. Every number comes from costingSpine / configTree, so nothing
// here can disagree with the canvas or the cost network.

import { useMemo } from "react";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr, type ConfigState } from "@/lib/fabricConfig";
import { type FabricComponent, type PhaseRollup } from "@/lib/configTree";
import { buildCompareRows, deriveRoute, type CompareColumn } from "@/lib/costingSpine";
import { ConfigComparisonTable } from "./ConfigComparisonTable";
import type { WorkVariant } from "./VariantTabs";

export type CompareEntry = {
  variant: WorkVariant;
  state: ConfigState;
  /** extra fabric components for this variant — the spine ctx */
  extras: FabricComponent[];
  phases: PhaseRollup[];
  directTotal: number;
};

type Props = {
  entries: CompareEntry[];
  activeId: string;
  productName: string;
  onClose: () => void;
  onSelect: (id: string) => void;
  onAddColumn: (kind: "variant" | "option") => void;
};

const TOTAL_LABEL = "Total direct manufacturing cost";

export function ConfigCompareWorkspace({
  entries,
  activeId,
  productName,
  onClose,
  onSelect,
  onAddColumn,
}: Props) {
  const cheapest = entries.reduce(
    (best, e) => (e.directTotal < best.directTotal ? e : best),
    entries[0],
  );
  const activeEntry = entries.find((e) => e.variant.id === activeId) ?? entries[0];

  const columns: CompareColumn[] = useMemo(
    () =>
      entries.map((e) => {
        const parent =
          e.variant.kind === "option" && e.variant.parentId
            ? entries.find((x) => x.variant.id === e.variant.parentId)?.variant
            : undefined;
        return {
          id: e.variant.id,
          variantName: parent?.name ?? e.variant.name,
          optionName: e.variant.kind === "option" ? e.variant.name : undefined,
          kind: e.variant.kind,
          total: e.directTotal,
        };
      }),
    [entries],
  );

  const rows = useMemo(
    () =>
      buildCompareRows(
        entries.map((e) => ({
          id: e.variant.id,
          state: e.state,
          ctx: { fabricExtras: e.extras },
        })),
      ),
    [entries],
  );

  /* Phase subtotals, then the direct total — read straight off rollupPhases. */
  const rollups = useMemo(() => {
    const phaseRows = (entries[0]?.phases ?? [])
      .filter((p) => p.id !== "input")
      .map((p) => ({
        label: `${p.label} subtotal`,
        values: entries.map((e) => e.phases.find((x) => x.id === p.id)?.amount ?? 0),
      }));
    return [...phaseRows, { label: TOTAL_LABEL, values: entries.map((e) => e.directTotal) }];
  }, [entries]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="shrink-0 border-b border-hairline bg-surface px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
              Configuration workspace
            </div>
            <h1 className="text-[19px] font-semibold tracking-tight text-ink-900">
              Compare variants
            </h1>
          </div>
          <span className="rounded-full bg-ink-100 px-2.5 py-1 text-[11.5px] font-medium tabular-nums text-ink-700">
            {entries.length} columns
          </span>
          <span className="text-[12px] text-ink-500">{productName}</span>
          <span
            title="Overheads, supplier margin, duty drawback, FX and selling price are handled outside the configuration workspace."
            className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-ink-400"
          >
            Direct manufacturing cost only
          </span>
          <button
            onClick={onClose}
            aria-label="Close comparison"
            className="ml-auto rounded-md border border-hairline bg-surface p-2 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Summary strip — one compact card per variant / option */}
      <div className="flex shrink-0 gap-2.5 overflow-x-auto border-b border-hairline bg-surface px-6 py-3">
        {entries.map((e) => {
          const delta = e.directTotal - activeEntry.directTotal;
          const parent =
            e.variant.kind === "option" && e.variant.parentId
              ? entries.find((x) => x.variant.id === e.variant.parentId)?.variant
              : undefined;
          return (
            <button
              key={e.variant.id}
              title={`Open ${e.variant.name}`}
              onClick={() => {
                onSelect(e.variant.id);
                onClose();
              }}
              className={cn(
                "group w-[228px] shrink-0 rounded-xl border bg-surface px-3 py-2.5 text-left transition-colors",
                e.variant.id === activeId
                  ? "border-brand-700 ring-1 ring-brand-700/20"
                  : "border-hairline hover:border-ink-200",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12.5px] font-semibold text-ink-900">
                  {e.variant.name}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]",
                    e.variant.kind === "option"
                      ? "bg-cfg-soft text-cfg-strong"
                      : "bg-ink-100 text-ink-600",
                  )}
                >
                  {e.variant.kind}
                </span>
              </div>
              <div className="truncate text-[10.5px] text-ink-400">
                {parent ? `Option of ${parent.name}` : deriveRoute(e.state).label}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-[19px] font-semibold leading-none tabular-nums text-ink-900">
                  {inr(e.directTotal)}
                </span>
                <span className="text-[10.5px] text-ink-400">/ pc</span>
                <ArrowRight className="ml-auto h-3 w-3 text-ink-300 group-hover:text-brand-700" />
              </div>
              <div className="mt-1 flex items-center gap-2 text-[10.5px]">
                {e.variant.id === cheapest.variant.id && (
                  <span className="rounded-full bg-brand-50 px-1.5 py-0.5 font-medium text-brand-700">
                    Lowest cost
                  </span>
                )}
                {delta !== 0 && (
                  <span className="tabular-nums text-ink-500">
                    {delta > 0 ? "+" : "−"}
                    {inr(Math.abs(delta))} vs current
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* The comparison itself — one row per costing-spine variable */}
      <ConfigComparisonTable
        columns={columns}
        rows={rows}
        rollups={rollups}
        activeId={activeId}
        productName={productName}
        onSelectColumn={(id) => {
          onSelect(id);
          onClose();
        }}
        onAddColumn={onAddColumn}
      />
    </div>
  );
}
