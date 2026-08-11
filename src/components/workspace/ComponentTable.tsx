// ComponentTable — the primary workspace surface.
//
// Every row is a component; every row is clickable and opens the inspector
// without navigating away. Expanding a row reveals the four things that make
// its cost — material, specification, consumption and processes — inline, so
// the calculation can be read without opening anything at all.

import { useState } from "react";
import { ChevronDown, ChevronRight, Layers, Plus, Settings2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MoneyFormatter } from "@/lib/money";
import { finalOf, processCost, type CostRollup, type ResolvedComponent } from "@/lib/costingModel";
import type { ConfigField, ConfigNode } from "@/lib/componentConfigTree";
import { ConfigTreeRows } from "./ConfigTreeRows";

type Props = {
  rollup: CostRollup;
  money: MoneyFormatter;
  selectedId: string | null;
  onSelect: (componentId: string) => void;
  onAdd: () => void;
  /** the component's configuration sub-tree, shown when its row is expanded */
  treeFor: (componentId: string) => ConfigNode[];
  /** picking an option on a configurable variable re-costs immediately */
  onSelectOption: (componentId: string, field: ConfigField, optionId: string) => void;
  /** column header + footer wording change per cost category tab */
  caption?: string;
  totalLabel?: string;
  totalAmount?: number;
  /** ids currently expanded — owned by the route so Expand All can drive it */
  expanded: string[];
  onToggleExpand: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  /** flash the cost column when a recalculation lands */
  live?: boolean;
  /**
   * The inspector is docked alongside. Low-priority columns are dropped so
   * Component and Cost / pc stay on screen instead of scrolling out of reach
   * behind the drawer — the selected row must remain readable in context.
   */
  compact?: boolean;
};

const HEAD =
  "px-3 py-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-500 whitespace-nowrap";

export function ComponentTable({
  rollup,
  money,
  selectedId,
  onSelect,
  onAdd,
  treeFor,
  onSelectOption,
  caption,
  totalLabel,
  totalAmount,
  expanded,
  onToggleExpand,
  onExpandAll,
  onCollapseAll,
  live,
  compact,
}: Props) {
  const [dense, setDense] = useState(false);
  const rows = rollup.components;

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-sm">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
        <div>
          <h2 className="text-[13.5px] font-semibold uppercase tracking-[0.08em] text-ink-900">
            Product Components
          </h2>
          <p className="mt-0.5 text-[12px] text-ink-500">
            {caption ?? "Define all components that make up this product"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <ToolButton
            onClick={onExpandAll}
            icon={<Layers className="h-3.5 w-3.5" />}
            label="Expand All"
          />
          <ToolButton
            onClick={onCollapseAll}
            icon={<Layers className="h-3.5 w-3.5 rotate-180" />}
            label="Collapse All"
          />
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add Component
          </button>
          <button
            type="button"
            onClick={() => setDense((v) => !v)}
            title={dense ? "Comfortable row height" : "Compact row height"}
            aria-label={dense ? "Switch to comfortable row height" : "Switch to compact row height"}
            aria-pressed={dense}
            className={cn(
              "rounded-md border p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
              dense
                ? "border-brand-700 bg-brand-50 text-brand-700"
                : "border-hairline bg-surface text-ink-500 hover:bg-surface-alt hover:text-ink-900",
            )}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table
          className={cn(
            "w-full border-collapse text-left",
            compact ? "min-w-[520px]" : "min-w-[1080px]",
          )}
        >
          <thead className="bg-surface-alt">
            <tr className="border-b border-hairline">
              <th scope="col" className={cn(HEAD, "w-10 pl-4")} />
              <th scope="col" className={cn(HEAD, "w-10")}>
                #
              </th>
              <th scope="col" className={cn(HEAD, compact ? "min-w-[150px]" : "min-w-[190px]")}>
                Component
              </th>
              {!compact && (
                <th scope="col" className={cn(HEAD, "min-w-[140px]")}>
                  Type
                </th>
              )}
              <th scope="col" className={cn(HEAD, compact ? "min-w-[130px]" : "min-w-[180px]")}>
                Material / Detail
              </th>
              <th scope="col" className={cn(HEAD, "min-w-[92px]")}>
                Required
              </th>
              {!compact && (
                <th scope="col" className={cn(HEAD, "text-right")}>
                  Qty / Occ.
                </th>
              )}
              {!compact && (
                <th scope="col" className={cn(HEAD, "text-right")}>
                  Consumption / pc
                </th>
              )}
              {!compact && (
                <th scope="col" className={cn(HEAD, "text-right")}>
                  Wastage %
                </th>
              )}
              {!compact && (
                <th scope="col" className={cn(HEAD, "text-right")}>
                  Rate / Unit
                </th>
              )}
              <th scope="col" className={cn(HEAD, "pr-5 text-right")}>
                Cost / pc
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <ComponentRow
                key={r.component.id}
                index={i + 1}
                resolved={r}
                dense={dense}
                selected={selectedId === r.component.id}
                expanded={expanded.includes(r.component.id)}
                onSelect={() => onSelect(r.component.id)}
                onToggle={() => onToggleExpand(r.component.id)}
                live={live}
                compact={compact}
                money={money}
                tree={treeFor(r.component.id)}
                onSelectOption={onSelectOption}
              />
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={compact ? 6 : 11}
                  className="px-5 py-14 text-center text-[13px] text-ink-500"
                >
                  No components yet. Add the first component to start costing this product.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-hairline bg-surface-alt px-5 py-3.5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600">
            {totalLabel ?? "Total Direct Cost"}{" "}
            <span className="font-normal text-ink-400">(per pc)</span>
          </div>
          <p className="mt-0.5 text-[11px] text-ink-400">
            {totalLabel
              ? `Sum of the ${rows.length} line${rows.length === 1 ? "" : "s"} shown above`
              : "Raw Material + Process + Accessories / Trims + Packaging + Testing"}
          </p>
        </div>
        <span
          className={cn(
            "text-[22px] font-semibold tabular-nums transition-colors",
            live ? "text-brand-600" : "text-ink-900",
          )}
        >
          {money(totalAmount ?? rollup.directCost)}
        </span>
      </footer>
    </section>
  );
}

function ToolButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12.5px] text-ink-600 transition-colors hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
    >
      {icon} {label}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Row
 * ------------------------------------------------------------------ */

function ComponentRow({
  index,
  resolved,
  dense,
  selected,
  expanded,
  onSelect,
  onToggle,
  live,
  compact,
  money,
  tree,
  onSelectOption,
}: {
  index: number;
  resolved: ResolvedComponent;
  dense: boolean;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
  live?: boolean;
  compact?: boolean;
  money: MoneyFormatter;
  tree: ConfigNode[];
  onSelectOption: (componentId: string, field: ConfigField, optionId: string) => void;
}) {
  const { component: c, material, consumptionRule } = resolved;
  const pad = dense ? "py-1.5" : "py-2.5";
  const cell = cn("px-3 align-middle text-[12.5px] text-ink-700", pad);

  const rate = material ? finalOf(material.rate) : null;
  const rateUnit = material?.rateUnit === "per metre" ? "/ m" : "/ pc";
  const detail = material
    ? [material.name, materialDetail(resolved)].filter(Boolean).join(" · ")
    : (c.makingSpec?.fields[0]?.value ?? "—");

  return (
    <>
      <tr
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
        tabIndex={0}
        role="button"
        aria-expanded={expanded}
        aria-label={`${c.name}, ${money(resolved.totalCost)} per piece. Open component details.`}
        className={cn(
          "cursor-pointer border-b border-hairline transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700",
          selected ? "bg-brand-50" : "hover:bg-surface-alt",
        )}
      >
        <td className={cn("pl-4 pr-0 align-middle", pad)}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            aria-label={expanded ? `Collapse ${c.name} breakdown` : `Expand ${c.name} breakdown`}
            className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        </td>
        <td className={cn(cell, "tabular-nums text-ink-400")}>{index}</td>
        <td className={cn("px-3 align-middle", pad)}>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-alt text-ink-400",
                selected && "border-brand-500 bg-brand-50 text-brand-700",
              )}
              aria-hidden
            >
              <Sparkles className="h-3 w-3" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-ink-900">
                {c.name}
                {c.quantity > 1 && <span className="text-ink-500"> (×{c.quantity})</span>}
              </span>
              <span className="block truncate text-[11px] text-ink-400">{c.usage}</span>
            </span>
          </div>
        </td>
        {!compact && (
          <td className={cell}>
            <span className="inline-flex rounded bg-surface-alt px-1.5 py-0.5 text-[11px] text-ink-600">
              {c.type}
            </span>
          </td>
        )}
        <td className={cn(cell, "max-w-[240px]")}>
          <span className="block truncate" title={detail}>
            {detail}
          </span>
        </td>
        <td className={cell}>
          <RequiredBadge required={c.required} />
        </td>
        {!compact && <td className={cn(cell, "text-right tabular-nums")}>{c.quantity}</td>}
        {!compact && (
          <td className={cn(cell, "text-right tabular-nums")}>
            {resolved.consumptionPerPiece > 0
              ? `${resolved.consumptionPerPiece.toFixed(3)} ${consumptionRule?.unit ?? ""}`
              : "—"}
          </td>
        )}
        {!compact && (
          <td className={cn(cell, "text-right tabular-nums")}>
            {consumptionRule ? `${consumptionRule.wastagePct}%` : "—"}
          </td>
        )}
        {!compact && (
          <td className={cn(cell, "text-right tabular-nums")}>
            {rate !== null ? `${money(rate)} ${rateUnit}` : processRateLabel(resolved, money)}
          </td>
        )}
        <td className={cn("px-3 pr-5 text-right align-middle", pad)}>
          <span
            className={cn(
              "text-[13px] font-semibold tabular-nums transition-colors",
              live ? "text-brand-600" : "text-ink-900",
            )}
          >
            {money(resolved.totalCost)}
          </span>
        </td>
      </tr>

      {expanded && (
        <ConfigTreeRows
          nodes={tree}
          colSpan={compact ? 6 : 11}
          money={money}
          onSelectOption={onSelectOption}
        />
      )}
    </>
  );
}

function RequiredBadge({ required }: { required: boolean }) {
  // Shape + text, never colour alone — the label reads the same to a
  // screen reader and to anyone who cannot distinguish the two hues.
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium",
        required ? "bg-[#fbe6e2] text-[#8f2c22]" : "bg-gold-100 text-gold-700",
      )}
    >
      <span className={cn("h-1.5 w-1.5", required ? "rounded-full" : "rotate-45")} aria-hidden />
      {required ? "Required" : "Optional"}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Row helpers
 * ------------------------------------------------------------------ */

function materialDetail(resolved: ResolvedComponent): string {
  const m = resolved.material?.master;
  if (!m) return "";
  return [m.gsm ? `${m.gsm} GSM` : null, m.width ? `${m.width}"` : null]
    .filter(Boolean)
    .join(" · ");
}

/** Process-only components have no material rate — show the dominant process rate. */
function processRateLabel(resolved: ResolvedComponent, money: MoneyFormatter): string {
  const top = [...resolved.processes].sort((a, b) => processCost(b) - processCost(a))[0];
  if (!top) return "—";
  return `${money(finalOf(top.rate))} ${top.basis === "per m" ? "/ m" : "/ pc"}`;
}
