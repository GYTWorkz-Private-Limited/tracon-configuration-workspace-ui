// CompareWorkspace — side-by-side comparison of every variant/option the user
// has added, plus a fixed panel of scenario projections (Premium, Low Cost,
// High Margin, …) computed on the base article. One table, two data sources,
// so "compare what I built" and "compare what it could be" share one UI.

import { useState } from "react";
import { Award, Layers, TrendingDown, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Selling price on a CompareRow is already in USD (it comes straight out of
 * `commercialOutput`). The workspace's `money` formatter expects an INR input
 * and converts it — feeding it an already-converted USD figure would divide
 * by the FX rate a second time, so selling price gets its own formatter.
 */
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type CompareRow = {
  id: string;
  name: string;
  subtitle?: string;
  /** true for the row the workspace currently has open/active */
  isActive?: boolean;
  size: string;
  moq: string;
  quality: string;
  /** every figure below is ₹ per piece, straight from the roll-up — feed through `money()` */
  rawMaterialInr: number;
  processInr: number;
  accessoriesInr: number;
  packagingInr: number;
  testingInr: number;
  directCostUsd: number;
  componentCount: number;
  sellingUsd: number;
  marginPct: number;
  buyerTargetUsd: number;
  onTarget: boolean;
  /** selling-price delta vs. the base row, as a signed percentage */
  deltaPct?: number | null;
};

type Mode = "variants" | "scenarios";

type Props = {
  open: boolean;
  onClose: () => void;
  productName: string;
  articleNo: string;
  variantRows: CompareRow[];
  scenarioRows: CompareRow[];
  money: (usd: number) => string;
  onApplyVariant?: (id: string) => void;
};

export function CompareWorkspace({
  open,
  onClose,
  productName,
  articleNo,
  variantRows,
  scenarioRows,
  money,
  onApplyVariant,
}: Props) {
  const [mode, setMode] = useState<Mode>("variants");
  if (!open) return null;

  const rows = mode === "variants" ? variantRows : scenarioRows;
  const cheapestId = rows.reduce<CompareRow | null>(
    (min, r) => (!min || r.sellingUsd < min.sellingUsd ? r : min),
    null,
  )?.id;
  const bestMarginId = rows.reduce<CompareRow | null>(
    (max, r) => (!max || r.marginPct > max.marginPct ? r : max),
    null,
  )?.id;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compare variants and scenarios"
      className="fixed inset-0 z-50 flex flex-col bg-canvas"
    >
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
            {rows.length} {mode === "variants" ? "variants" : "scenarios"}
          </span>
          <span className="text-[12px] text-ink-500">
            {productName} · {articleNo}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close comparison"
              className="rounded-md border border-hairline bg-surface p-2 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-hairline bg-surface-alt p-0.5">
            <button
              type="button"
              onClick={() => setMode("variants")}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                mode === "variants" ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900",
              )}
            >
              Compare Variants
            </button>
            <button
              type="button"
              onClick={() => setMode("scenarios")}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                mode === "scenarios" ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900",
              )}
            >
              Compare Scenarios
            </button>
          </div>
          <p className="text-[12px] text-ink-500">
            {mode === "variants"
              ? "Every variant and option currently open in this workspace, priced live."
              : "Four standard costing positions, computed on the base article's build."}
          </p>
        </div>
      </header>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-ink-500">
            Nothing to compare yet.
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="border-b border-hairline bg-surface-alt/40 px-6 py-4">
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(${Math.min(rows.length, 4)}, minmax(200px, 1fr))` }}
              >
                {rows.map((r) => (
                  <SummaryCard
                    key={r.id}
                    row={r}
                    isCheapest={r.id === cheapestId}
                    isBestMargin={r.id === bestMarginId}
                    onApply={onApplyVariant}
                  />
                ))}
              </div>
            </div>

            {/* Comparison table — bounded height with its own scroll (vertical + horizontal),
                so a full cost breakdown never pushes the summary cards or footer off screen. */}
            <div className="max-h-[46vh] overflow-auto">
              <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
                <tbody>
                  <RowGroup label="Product Details">
                    <DataRow label="Product" rows={rows} render={() => productName} />
                    <DataRow label="Size" rows={rows} render={(r) => r.size} />
                    <DataRow label="MOQ" rows={rows} render={(r) => r.moq} />
                    <DataRow label="Quality" rows={rows} render={(r) => r.quality} />
                    <DataRow
                      label={mode === "variants" ? "Variant" : "Scenario"}
                      rows={rows}
                      render={(r) => r.name}
                    />
                    <DataRow
                      label="Cost lines"
                      rows={rows}
                      render={(r) => `${r.componentCount} component${r.componentCount === 1 ? "" : "s"}`}
                    />
                  </RowGroup>

                  <RowGroup label="Cost Breakdown (per piece)">
                    <DataRow
                      label="Raw material"
                      rows={rows}
                      render={(r) => money(r.rawMaterialInr)}
                    />
                    <DataRow label="Process" rows={rows} render={(r) => money(r.processInr)} />
                    <DataRow
                      label="Accessories / trims"
                      rows={rows}
                      render={(r) => money(r.accessoriesInr)}
                    />
                    <DataRow label="Packaging" rows={rows} render={(r) => money(r.packagingInr)} />
                    <DataRow
                      label="Testing & certification"
                      rows={rows}
                      render={(r) => money(r.testingInr)}
                    />
                    <DataRow
                      label="Direct cost / pc"
                      rows={rows}
                      render={(r) => <span className="font-semibold">{money(r.directCostUsd)}</span>}
                    />
                  </RowGroup>

                  <RowGroup label="Commercial">
                    <DataRow label="Selling price / pc" rows={rows} render={(r) => usd(r.sellingUsd)} />
                    <DataRow label="Margin" rows={rows} render={(r) => `${r.marginPct.toFixed(1)}%`} />
                    <DataRow label="Buyer target" rows={rows} render={(r) => usd(r.buyerTargetUsd)} />
                    <DataRow
                      label="On target"
                      rows={rows}
                      render={(r) => (
                        <span className={r.onTarget ? "text-emerald-700" : "text-red-600"}>
                          {r.onTarget ? "Yes" : "No"}
                        </span>
                      )}
                    />
                    <DataRow
                      label="vs. base"
                      rows={rows}
                      render={(r) =>
                        r.deltaPct == null ? (
                          <span className="text-ink-400">base</span>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 font-medium",
                              r.deltaPct > 0 ? "text-red-600" : r.deltaPct < 0 ? "text-emerald-700" : "text-ink-500",
                            )}
                          >
                            {r.deltaPct > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : r.deltaPct < 0 ? (
                              <TrendingDown className="h-3 w-3" />
                            ) : null}
                            {r.deltaPct > 0 ? "+" : ""}
                            {r.deltaPct.toFixed(1)}%
                          </span>
                        )
                      }
                    />
                  </RowGroup>
                </tbody>
              </table>
            </div>

            {/* Suggested quote footer, pinned under the table */}
            <div
              className="grid gap-3 border-t border-hairline bg-surface px-6 py-4"
              style={{ gridTemplateColumns: `repeat(${Math.min(rows.length, 4)}, minmax(200px, 1fr))` }}
            >
              {rows.map((r) => (
                <div
                  key={r.id}
                  className={cn(
                    "rounded-lg border px-3.5 py-2.5",
                    r.isActive ? "border-brand-700 bg-brand-50/50" : "border-hairline bg-surface",
                  )}
                >
                  <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-500">
                    Suggested quote
                  </div>
                  <div className="mt-0.5 flex items-baseline justify-between gap-2">
                    <span className="text-[18px] font-semibold tabular-nums text-ink-900">
                      {usd(r.sellingUsd)}
                    </span>
                    <span className="text-[11px] text-ink-500">Margin {r.marginPct.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  row,
  isCheapest,
  isBestMargin,
  onApply,
}: {
  row: CompareRow;
  isCheapest: boolean;
  isBestMargin: boolean;
  onApply?: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-xl border bg-surface p-3.5 shadow-sm transition-colors",
        row.isActive ? "border-brand-700 ring-1 ring-brand-700/20" : "border-hairline",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate text-[13px] font-semibold text-ink-900" title={row.name}>
          {row.name}
        </span>
        <span className="shrink-0 text-[16px] font-semibold tabular-nums text-ink-900">
          {usd(row.sellingUsd)}
        </span>
      </div>
      {row.subtitle && <p className="mt-0.5 truncate text-[11px] text-ink-500">{row.subtitle}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-ink-500">
        <span>
          MOQ <span className="font-medium text-ink-800">{row.moq}</span>
        </span>
        <span>
          Margin <span className="font-medium text-ink-800">{row.marginPct.toFixed(1)}%</span>
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {row.isActive && (
          <Badge tone="ink">
            <Layers className="h-2.5 w-2.5" /> Active
          </Badge>
        )}
        {isCheapest && (
          <Badge tone="emerald">
            <Award className="h-2.5 w-2.5" /> Cheapest
          </Badge>
        )}
        {isBestMargin && (
          <Badge tone="brand">
            <TrendingUp className="h-2.5 w-2.5" /> Best margin
          </Badge>
        )}
      </div>

      {onApply && !row.isActive && (
        <button
          type="button"
          onClick={() => onApply(row.id)}
          className="mt-2.5 rounded-md border border-hairline bg-surface py-1.5 text-[11.5px] font-medium text-ink-700 hover:border-brand-700 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          Switch to this
        </button>
      )}
    </div>
  );
}

function Badge({ tone, children }: { tone: "ink" | "emerald" | "brand"; children: React.ReactNode }) {
  const tones = {
    ink: "bg-ink-900 text-white",
    emerald: "bg-emerald-100 text-emerald-800",
    brand: "bg-brand-100 text-brand-800",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

function RowGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <tr className="sticky top-0 bg-surface-alt">
        <td colSpan={999} className="px-6 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-500">
          {label}
        </td>
      </tr>
      {children}
    </>
  );
}

function DataRow({
  label,
  rows,
  render,
}: {
  label: string;
  rows: CompareRow[];
  render: (row: CompareRow) => React.ReactNode;
}) {
  return (
    <tr className="border-b border-hairline/60">
      <th
        scope="row"
        className="sticky left-0 w-[160px] min-w-[160px] bg-surface px-6 py-2.5 text-left text-[11.5px] font-medium text-ink-500"
      >
        {label}
      </th>
      {rows.map((r) => (
        <td
          key={r.id}
          className={cn(
            "min-w-[200px] px-4 py-2.5 text-ink-900",
            r.isActive && "bg-brand-50/40",
          )}
        >
          {render(r)}
        </td>
      ))}
    </tr>
  );
}
