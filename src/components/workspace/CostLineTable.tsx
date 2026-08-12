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
import { BookOpen, Check, ChevronDown, Layers, Plus, Settings2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MoneyFormatter } from "@/lib/money";
import type { CostLine, LineSection, OptionGroup } from "@/lib/costLines";
import { metres, tierLabel, type FabricRequirement } from "@/lib/fabricRequirement";

type Props = {
  sections: LineSection[];
  money: MoneyFormatter;
  /** the component whose inspector is open */
  selectedId: string | null;
  onSelect: (componentId: string) => void;
  /** open the Component Library, optionally scoped to one section */
  onAdd: (section?: LineSection["id"]) => void;
  /** delete a line from the configuration */
  onRemove: (line: CostLine) => void;
  /** picking an option on a line re-costs immediately */
  onSelectOption: (
    kind: CostLine["kind"],
    componentId: string,
    itemId: string,
    optionId: string,
  ) => void;
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

const discountPct = (r: FabricRequirement) =>
  r.baseRate > 0 ? Math.round((1 - r.tier.rate / r.baseRate) * 100) : 0;

function FabricRollupRow({
  req,
  cols,
  compact,
}: {
  req: FabricRequirement;
  cols: number;
  compact?: boolean;
}) {
  return (
    <tr className="border-b border-hairline bg-surface-alt/50">
      <td colSpan={cols - 2} className="px-5 py-1.5">
        <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Layers className="h-3 w-3 shrink-0 self-center text-ink-400" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-700">
            {req.name}
          </span>
          <span className="text-[11px] text-ink-500">
            {metres(req.metres)} for this POD · {tierLabel(req.tier)}
          </span>
          {!compact && req.nextTier && (
            <span className="text-[11px] text-ink-400">
              {metres(req.nextTier.metresAway)} more → next tier
            </span>
          )}
        </span>
      </td>
      {/* The rate COLUMN above already carries the discounted number on every
          row; repeating the master's list rate here would read as a second,
          contradictory price. What the roll-up adds is the size of the break. */}
      <td className="px-3 py-1.5 text-right text-[11.5px] font-semibold tabular-nums text-ink-700">
        {discountPct(req) > 0 ? `−${discountPct(req)}%` : "list rate"}
      </td>
      <td className="px-3 pr-5 py-1.5" />
    </tr>
  );
}

const HEAD =
  "px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400 whitespace-nowrap";

export function CostLineTable({
  sections,
  money,
  selectedId,
  onSelect,
  onAdd,
  onRemove,
  onSelectOption,
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
  // + 1 for the row-actions column
  const cols = (compact ? 5 : 8) + 1;
  const populated = sections.filter((s) => s.lines.length > 0);
  const showSectionHeads = populated.length > 1;

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-sm">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
        <div>
          <h2 className="text-[13.5px] font-semibold uppercase tracking-[0.08em] text-ink-900">
            {title}
          </h2>
          <p className="mt-0.5 text-[12px] text-ink-500">{caption}</p>
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
                      onSelect={() => onSelect(line.componentId)}
                      onSelectOption={onSelectOption}
                      onRemove={() => onRemove(line)}
                      readOnly={readOnly}
                    />
                  ))}
                  {block.rollup && (
                    <FabricRollupRow req={block.rollup} cols={cols} compact={compact} />
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

      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-hairline bg-surface-alt px-5 py-3.5">
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
            "text-[22px] font-semibold tabular-nums transition-colors",
            live ? "text-brand-600" : "text-ink-900",
          )}
        >
          {money(total)}
        </span>
      </footer>
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
  onSelectOption,
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
  onSelectOption: (
    kind: CostLine["kind"],
    componentId: string,
    itemId: string,
    optionId: string,
  ) => void;
  onRemove: () => void;
  readOnly?: boolean;
}) {
  const pad = dense ? "py-1.5" : "py-2.5";
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

      {/* Selected Option — a real control where the variable is configurable,
          plain text where the value comes from the master and is read-only. */}
      <td className={cn(cell, "max-w-[240px]")}>
        {line.optionGroup && line.target && !readOnly ? (
          <OptionPicker
            group={line.optionGroup}
            onPick={(optionId) =>
              onSelectOption(line.kind, line.target!.componentId, line.target!.itemId, optionId)
            }
          />
        ) : (
          <span className="block truncate" title={line.detail}>
            {readOnly && line.optionGroup
              ? (line.optionGroup.options.find((o) => o.id === line.optionGroup?.selectedId)
                  ?.label ?? line.detail)
              : line.detail}
          </span>
        )}
      </td>

      {!compact && <td className={cn(cell, "text-right tabular-nums")}>{line.quantity}</td>}
      {!compact && <td className={cn(cell, "text-right tabular-nums")}>{line.consumption}</td>}
      {!compact && <td className={cn(cell, "text-right tabular-nums")}>{line.wastage}</td>}
      <td className={cn(cell, "text-right tabular-nums")}>{line.rate}</td>
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

/* ------------------------------------------------------------------ *
 * Option picker
 * ------------------------------------------------------------------ */

function OptionPicker({ group, onPick }: { group: OptionGroup; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = group.options.find((o) => o.id === group.selectedId);

  return (
    <span className="relative inline-block max-w-full">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label={`${group.label}: ${selected?.label ?? "not set"}. Change.`}
        className="inline-flex max-w-full items-center gap-1 rounded-md border border-hairline bg-surface px-2 py-1 text-[12px] text-ink-800 transition-colors hover:border-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        <span className="truncate">{selected?.label ?? "Select…"}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-ink-400" aria-hidden />
      </button>

      {open && (
        <>
          <span
            className="fixed inset-0 z-30"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <span className="absolute left-0 top-full z-40 mt-1 block w-[280px] overflow-hidden rounded-lg border border-hairline bg-surface shadow-2xl">
            <span className="block border-b border-hairline px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
              {group.label}
            </span>
            <span className="block max-h-[260px] overflow-y-auto p-1">
              {group.options.map((o) => {
                const active = o.id === group.selectedId;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      onPick(o.id);
                    }}
                    className={cn(
                      "flex w-full items-start gap-1.5 rounded px-2 py-1.5 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                      active ? "bg-brand-50" : "hover:bg-surface-alt",
                    )}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-3 w-3 shrink-0 text-brand-700",
                        !active && "opacity-0",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-[12px]",
                          active ? "font-medium text-brand-800" : "text-ink-800",
                        )}
                      >
                        {o.label}
                      </span>
                      {o.detail && (
                        <span className="block truncate text-[10.5px] text-ink-400">
                          {o.detail}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-ink-500">
                      ₹{o.rate.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </span>
          </span>
        </>
      )}
    </span>
  );
}
