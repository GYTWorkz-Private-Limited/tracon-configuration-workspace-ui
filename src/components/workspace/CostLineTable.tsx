// CostLineTable — the costing sheet, at the level costs are actually incurred.
//
// A row is a COST LINE, not a component: the Process view lists Dyeing,
// Cutting, Stitching, Hemming — each with its own method, rate and cost — and
// the component it belongs to is context on the row, not the row itself.
//
// The Direct Cost view stacks every section (Raw Material → Process →
// Accessories → Packaging → Testing) with its own subtotal, so the sheet reads
// the same way the roll-up is computed.

import { Fragment, useState } from "react";
import { BookOpen, ChevronRight, Layers, Plus, Settings2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MoneyFormatter } from "@/lib/money";
import type { CostLine, LineSection, OptionGroup } from "@/lib/costLines";
import { fabricLine, inrShort, type FabricRequirement } from "@/lib/fabricRequirement";
import { FabricDetailModal } from "./FabricDetailModal";

type Props = {
  sections: LineSection[];
  money: MoneyFormatter;
  /** the component whose inspector is open */
  selectedId: string | null;
  /** the row's component opens the inspector; the LINE names which of the
      component's choices the inspector should offer */
  onSelect: (componentId: string, line: CostLine) => void;
  /** open the Component Library, optionally scoped to one section */
  onAdd: (section?: LineSection["id"]) => void;
  /** delete a line from the configuration */
  onRemove: (line: CostLine) => void;
  /** heading + total wording for the active view */
  title: string;
  caption: string;
  totalLabel: string;
  total: number;
  /** true while a recalculation is settling */
  live?: boolean;
  /** the inspector is docked — drop low-priority columns */
  compact?: boolean;
  /** the sheet is being read, not edited (e.g. a member article inside a set) */
  readOnly?: boolean;
  /**
   * The POD's fabric requirement, so each fabric can state its aggregated
   * metres and the tier that bought it, under the rows that consume it.
   */
  fabricRollups?: FabricRequirement[];
};

/**
 * Fabric rows regrouped so every component cut from one cloth sits together,
 * with that cloth's order-level total closing the group.
 *
 * The sheet is per piece; the purchase is not. Without this the metre total
 * that decided the rate would exist only in a report somewhere else, and the
 * rate on these rows would look like it came from nowhere.
 */
function groupByFabric(
  section: LineSection,
  rollups: FabricRequirement[] | undefined,
): { key: string; lines: CostLine[]; rollup?: FabricRequirement }[] {
  if (section.id !== "material" || !rollups?.length) {
    return [{ key: section.id, lines: section.lines }];
  }

  const blocks: { key: string; lines: CostLine[]; rollup?: FabricRequirement }[] = [];
  const taken = new Set<string>();

  for (const line of section.lines) {
    const req = line.libraryId ? rollups.find((r) => r.masterId === line.libraryId) : undefined;
    if (!req) continue;
    if (taken.has(req.masterId)) continue;
    taken.add(req.masterId);
    blocks.push({
      key: req.masterId,
      lines: section.lines.filter((l) => l.libraryId === req.masterId),
      rollup: req,
    });
  }

  // Anything not cut from a tiered fabric keeps its place at the end rather
  // than being dropped — a trim is still a raw material.
  const rest = section.lines.filter((l) => !l.libraryId || !taken.has(l.libraryId));
  if (rest.length) blocks.push({ key: `${section.id}-rest`, lines: rest });
  return blocks;
}

function FabricRollupRow({
  req,
  cols,
  onViewDetails,
}: {
  req: FabricRequirement;
  cols: number;
  onViewDetails: () => void;
}) {
  return (
    <tr className="border-b border-hairline bg-surface-alt/50">
      <td colSpan={cols - 2} className="px-5 py-1.5">
        <span className="inline-flex items-baseline gap-x-2">
          <Layers className="h-3 w-3 shrink-0 self-center text-ink-400" aria-hidden />
          <span className="text-[11.5px] font-medium text-ink-700">{fabricLine(req)}</span>
        </span>
      </td>
      {/* The two numbers a purchase is made of: how much cloth, and what it
          costs. The per-metre rate is stated in the line itself. */}
      <td className="px-3 py-1.5 text-right text-[11.5px] font-semibold tabular-nums text-ink-700">
        {inrShort(req.costInr)}
      </td>
      <td className="px-3 pr-5 py-1.5 text-right">
        <button
          type="button"
          onClick={onViewDetails}
          aria-label={`View ${req.name} requirement details`}
          className="whitespace-nowrap text-[11px] font-medium text-brand-700 underline-offset-2 transition-colors hover:text-brand-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          View Details
        </button>
      </td>
    </tr>
  );
}

const HEAD =
  "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400 whitespace-nowrap";

/**
 * Rate lists are short and already grouped by the row they hang off, so the
 * sheet keeps the search box out of them entirely — including the eleven-entry
 * fabric master list, which is the one group that would otherwise cross the
 * shared default and change how a row that exists today looks.
 */

export function CostLineTable({
  sections,
  money,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
  title,
  caption,
  totalLabel,
  total,
  live,
  compact,
  readOnly,
  fabricRollups,
}: Props) {
  const [dense, setDense] = useState(false);
  // The open fabric detail modal, if any — held here so one modal at the table
  // root serves every rollup row instead of each row mounting its own dialog.
  const [openFabric, setOpenFabric] = useState<FabricRequirement | null>(null);
  // + 1 for the row-actions column
  const cols = (compact ? 5 : 8) + 1;
  const populated = sections.filter((s) => s.lines.length > 0);
  const showSectionHeads = populated.length > 1;

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-sm">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-hairline px-5 py-2">
        {/* Title and caption share one line: the caption is orientation, not a
            heading of its own, and stacking it cost a row of the sheet. */}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-900">
            {title}
          </h2>
          <p className="truncate text-[11.5px] text-ink-500">{caption}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {!readOnly && (
            <button
              type="button"
              onClick={() => onAdd()}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-1"
            >
              <BookOpen className="h-3.5 w-3.5" /> Add from Component Library
            </button>
          )}
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
            compact ? "min-w-[520px]" : "min-w-[960px]",
          )}
        >
          <thead className="bg-surface-alt">
            <tr className="border-b border-hairline">
              <th scope="col" className={cn(HEAD, "pl-5")}>
                Line
              </th>
              {!compact && (
                <th scope="col" className={HEAD}>
                  Type
                </th>
              )}
              <th scope="col" className={HEAD}>
                Selected Option
              </th>
              {!compact && (
                <th scope="col" className={cn(HEAD, "text-right")}>
                  Qty
                </th>
              )}
              {!compact && (
                <th scope="col" className={cn(HEAD, "text-right")}>
                  Consumption
                </th>
              )}
              {!compact && (
                <th scope="col" className={cn(HEAD, "text-right")}>
                  Wastage
                </th>
              )}
              <th scope="col" className={cn(HEAD, "text-right")}>
                Rate
              </th>
              <th scope="col" className={cn(HEAD, "text-right")}>
                Cost / pc
              </th>
              <th scope="col" className={cn(HEAD, "pr-5 text-right")}>
                <span className="sr-only">Row actions</span>
              </th>
            </tr>
          </thead>

          {populated.map((section) => (
            <tbody key={section.id}>
              {showSectionHeads && (
                <tr className="border-b border-hairline bg-surface-alt/70">
                  <td colSpan={cols - 2} className="px-5 py-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-700">
                      {section.label}
                    </span>
                    <span className="ml-2 text-[11px] text-ink-400">
                      {section.lines.length} line{section.lines.length === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right text-[11.5px] font-semibold tabular-nums text-ink-700">
                    {money(section.total)}
                  </td>
                  <td className="px-3 pr-5 py-1.5" />
                </tr>
              )}
              {groupByFabric(section, fabricRollups).map((block) => (
                <Fragment key={block.key}>
                  {block.lines.map((line) => (
                    <LineRow
                      key={line.id}
                      line={line}
                      dense={dense}
                      compact={compact}
                      money={money}
                      live={live}
                      selected={selectedId === line.componentId}
                      onSelect={() => onSelect(line.componentId, line)}
                      onRemove={() => onRemove(line)}
                      readOnly={readOnly}
                    />
                  ))}
                  {block.rollup && (
                    <FabricRollupRow
                      req={block.rollup}
                      cols={cols}
                      onViewDetails={() => setOpenFabric(block.rollup!)}
                    />
                  )}
                </Fragment>
              ))}
              {!readOnly && (
                <tr className="border-b border-hairline">
                  <td colSpan={cols} className="px-5 py-1.5">
                    <AddLineButton label={section.label} onClick={() => onAdd(section.id)} />
                  </td>
                </tr>
              )}
            </tbody>
          ))}

          {!populated.length && (
            <tbody>
              <tr>
                <td colSpan={cols} className="px-5 py-12 text-center">
                  <p className="text-[13px] text-ink-500">
                    Nothing is configured in this category yet.
                  </p>
                  {!readOnly && (
                    <div className="mt-3 flex justify-center">
                      <AddLineButton label="line" onClick={() => onAdd(sections[0]?.id)} />
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-hairline bg-surface-alt px-5 py-2.5">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600">
            {totalLabel} <span className="font-normal text-ink-400">(per pc)</span>
          </div>
          <p className="mt-0.5 text-[11px] text-ink-400">
            {populated.reduce((t, s) => t + s.lines.length, 0)} cost lines
            {showSectionHeads ? " across " + populated.length + " categories" : ""}
          </p>
        </div>
        <span
          className={cn(
            "text-[19px] font-semibold tabular-nums transition-colors",
            live ? "text-brand-600" : "text-ink-900",
          )}
        >
          {money(total)}
        </span>
      </footer>

      {openFabric && <FabricDetailModal req={openFabric} onClose={() => setOpenFabric(null)} />}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Add / remove
 * ------------------------------------------------------------------ */

function AddLineButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-hairline px-2.5 py-1 text-[11.5px] text-ink-500 transition-colors hover:border-brand-700 hover:bg-brand-50 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
    >
      <Plus className="h-3 w-3" aria-hidden />
      Add {label.toLowerCase()} line from library
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Row
 * ------------------------------------------------------------------ */

function LineRow({
  line,
  dense,
  compact,
  money,
  live,
  selected,
  onSelect,
  onRemove,
  readOnly,
}: {
  line: CostLine;
  dense: boolean;
  compact?: boolean;
  money: MoneyFormatter;
  live?: boolean;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  readOnly?: boolean;
}) {
  const pad = dense ? "py-1" : "py-1.5";
  const cell = cn("px-3 align-middle text-[12.5px] text-ink-700", pad);

  return (
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
      aria-label={`${line.name} on ${line.context}, ${money(line.cost)} per piece. Open component details.`}
      className={cn(
        "cursor-pointer border-b border-hairline transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700",
        selected ? "bg-brand-50" : "hover:bg-surface-alt",
      )}
    >
      <td className={cn("pl-5 pr-3 align-middle", pad)}>
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-ink-900">{line.name}</span>
          {line.required && (
            <span
              title="Required by the style"
              className="shrink-0 rounded bg-surface-alt px-1 py-px text-[9px] font-medium uppercase tracking-[0.06em] text-ink-400"
            >
              Req
            </span>
          )}
        </span>
        <span className="block truncate text-[11px] text-ink-400">{line.context}</span>
      </td>

      {!compact && (
        <td className={cell}>
          <span className="inline-flex rounded bg-surface-alt px-1.5 py-0.5 text-[11px] text-ink-600">
            {line.typeLabel}
          </span>
        </td>
      )}

      {/* Selected Option — stated, not edited. The choice itself moved to the
          side panel: clicking the row opens the inspector, whose option cards
          commit through the same action the old dropdown called. The chevron
          marks the lines where there IS a choice to make. */}
      <td className={cn(cell, "max-w-[240px]")}>
        <span className="flex items-center gap-1" title={line.detail}>
          <span className="truncate">
            {line.optionGroup
              ? (line.optionGroup.options.find((o) => o.id === line.optionGroup?.selectedId)
                  ?.label ?? line.detail)
              : line.detail}
          </span>
          {line.optionGroup && line.target && !readOnly && (
            <ChevronRight className="h-3 w-3 shrink-0 text-ink-400" aria-hidden />
          )}
        </span>
      </td>

      {!compact && (
        <td className={cn(cell, "whitespace-nowrap text-right tabular-nums")}>{line.quantity}</td>
      )}
      {!compact && (
        <td className={cn(cell, "whitespace-nowrap text-right tabular-nums")}>
          {line.consumption}
        </td>
      )}
      {!compact && <td className={cn(cell, "text-right tabular-nums")}>{line.wastage}</td>}
      {/* "82.00 / metre" is one fact — broken over three lines it stops
          reading as a rate. */}
      <td className={cn(cell, "whitespace-nowrap text-right tabular-nums")}>{line.rate}</td>
      <td className={cn("px-3 text-right align-middle", pad)}>
        <span
          className={cn(
            "text-[13px] font-semibold tabular-nums transition-colors",
            live ? "text-brand-600" : "text-ink-900",
          )}
        >
          {money(line.cost)}
        </span>
      </td>

      {/* Removal is a costing decision, so it sits on the row. Lines the style
          requires keep their Req marker on the name, so deleting one stays a
          visible call rather than an accident. */}
      <td className={cn("px-2 pr-5 text-right align-middle", pad)}>
        {line.removable && !readOnly && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label={`Remove ${line.name} on ${line.context}`}
            title={
              line.required ? "Remove — this line is required by the style" : "Remove this line"
            }
            className="rounded p-1 text-ink-400 transition-colors hover:bg-ink-50 hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </td>
    </tr>
  );
}
