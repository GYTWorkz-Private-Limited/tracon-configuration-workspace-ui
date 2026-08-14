/**
 * The kit as ONE configuration table — variable by variable, not article by
 * article.
 *
 * A tab-per-member layout makes the user cost the same decision N times from
 * memory: pick the front fabric on the placemat, remember it, switch tabs,
 * pick it again on the runner. This table turns the kit sideways — one row per
 * VARIABLE ("Front Fabric", "Dyeing", "Polybag"), one column per member — so
 * the team works DOWN the decisions once and reads every member's answer side
 * by side.
 *
 * It is not a read-only mirror. A table you can only look at sends the user
 * back to the tabs to change anything, which is the very trip this screen
 * exists to remove — so a cell carries the SAME dropdown its own sheet has,
 * and a section can take a new component from the library on one member or on
 * every member at once. Adding to the whole set in one act is the only place in
 * the product where "all three placemats get this label" is a single decision
 * rather than three.
 *
 * Nothing here is a second copy of any number, and nothing here is a second
 * copy of any behaviour: rows are cut from the lines each member's own sheet
 * reports, and every edit is delegated straight back to that member's workspace
 * through the actions it published. A cell can never disagree with the sheet
 * behind it because there is only one sheet.
 */

import { useMemo, useState } from "react";
import { Check, ChevronDown, Plus, SquareArrowOutUpRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { KitItem } from "@/lib/podsStore";
import type { ArticleCosting } from "@/components/workspace/ArticleCostingWorkspace";
import { ComponentLibraryModal } from "@/components/workspace/ComponentLibraryModal";
import type { CostLine, LineKind, LineSection, OptionGroup } from "@/lib/costLines";
import type { LibraryItem } from "@/lib/library";

/* ------------------------------------------------------------------ *
 * Row assembly — the union of variables across members
 * ------------------------------------------------------------------ */

type Cell = {
  /** the configured value — material / method / pack standard */
  detail: string;
  rate: string;
  cost: number;
  /** what to select on the member's sheet when this cell is opened */
  componentId: string;
  /**
   * The line this cell can reconfigure. Where a member spends twice under one
   * variable name the FIRST line owns the dropdown — the summed figure is the
   * honest cost, but only a single line can be a single decision.
   */
  line: CostLine;
};

type MergedRow = {
  key: string;
  name: string;
  cells: Record<string, Cell>;
};

type MergedSection = {
  id: LineKind;
  label: string;
  rows: MergedRow[];
};

function mergeSections(
  members: KitItem[],
  costed: Record<string, ArticleCosting>,
): MergedSection[] {
  // Sections keep the costing sheet's fixed order; rows within a section keep
  // first-seen order across members, so the first member's sheet order leads
  // and later members only append what is genuinely theirs alone.
  const template = members
    .map((m) => costed[m.id]?.sections)
    .find((s): s is LineSection[] => Boolean(s));
  if (!template) return [];

  return template.map((section) => {
    const rows: MergedRow[] = [];
    const byName = new Map<string, MergedRow>();
    for (const m of members) {
      const lines = costed[m.id]?.sections.find((s) => s.id === section.id)?.lines ?? [];
      for (const line of lines) {
        let row = byName.get(line.name);
        if (!row) {
          row = { key: `${section.id}:${line.name}`, name: line.name, cells: {} };
          byName.set(line.name, row);
          rows.push(row);
        }
        const existing = row.cells[m.id];
        if (existing) {
          // Two lines under the same variable name (e.g. two carton lines) are
          // one decision costed twice — sum them rather than invent a row.
          existing.cost += line.cost;
        } else {
          row.cells[m.id] = {
            detail: line.detail,
            rate: line.rate,
            cost: line.cost,
            componentId: line.componentId,
            line,
          };
        }
      }
    }
    return { id: section.id, label: section.label, rows };
  });
}

/* ------------------------------------------------------------------ */

const inr2 = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const HEAD = "px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400";
const CELL = "px-3 py-2 align-top text-[12px]";

/** Which members a library add is destined for, and from which section. */
type AddFlow = { section: LineKind; memberIds: string[] };

export function KitMergedConfigTable({
  members,
  costed,
  onFocusLine,
}: {
  members: KitItem[];
  costed: Record<string, ArticleCosting>;
  /** open the member's full sheet with this line's component selected */
  onFocusLine: (memberId: string, componentId: string) => void;
}) {
  const sections = useMemo(() => mergeSections(members, costed), [members, costed]);

  /**
   * The add flow is two decisions — WHICH articles, then WHICH master — and it
   * is deliberately in that order: the member choice is about the set, and
   * asking it first means the library browser stays the same screen the sheet
   * opens, with no extra step bolted onto its footer.
   */
  const [flow, setFlow] = useState<AddFlow | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  if (sections.length === 0) return null;

  const setTotal = members.reduce(
    (t, m) => t + (costed[m.id]?.rollup.directCost ?? 0) * (m.qty > 0 ? m.qty : 1),
    0,
  );

  const chosen = flow ? members.filter((m) => flow.memberIds.includes(m.id)) : [];

  /**
   * Attach targets are offered by NAME, not by id: "Body Fabric" on the
   * placemat and "Body Fabric" on the runner are different component ids for
   * what the costing team reads as one part, and a set-wide add has to mean
   * the part, not one article's row of the database.
   */
  const unionTargets = (() => {
    const byName = new Map<string, string>();
    for (const m of chosen) {
      for (const t of costed[m.id]?.actions.attachTargets ?? []) {
        if (!byName.has(t.name)) byName.set(t.name, t.name);
      }
    }
    return [...byName.keys()].map((name) => ({ id: name, name }));
  })();

  const addToChosen = (item: LibraryItem, targetName: string | null, slot: string) => {
    if (!flow) return;
    const landed: string[] = [];
    for (const m of chosen) {
      const actions = costed[m.id]?.actions;
      if (!actions) continue;
      // A member without that part still gets product-level items; a process or
      // trim with nowhere to attach is skipped rather than guessed at.
      const target = targetName
        ? (actions.attachTargets.find((t) => t.name === targetName)?.id ?? null)
        : null;
      actions.addFromLibrary(item, target, slot);
      landed.push(m.name);
    }
    setLibraryOpen(false);
    setFlow(null);
    if (landed.length) toast.success(`${item.name} added to ${landed.join(", ")}`);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <p className="border-b border-hairline px-4 py-2.5 text-[11.5px] text-ink-500">
        One sheet for the whole set — work down the variables once and read every article side by
        side. Change any cell here, or add a component to one article or all of them.
      </p>

      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse text-left"
          style={{ minWidth: `${240 + members.length * 220}px` }}
        >
          <thead>
            <tr className="border-b border-hairline">
              <th className={cn(HEAD, "sticky left-0 z-10 w-[240px] bg-surface")}>Variable</th>
              {members.map((m) => (
                <th key={m.id} className={cn(HEAD, "min-w-[220px]")}>
                  {m.name}
                  {m.qty > 1 && <span className="ml-1 normal-case tracking-normal">×{m.qty}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <SectionRows
                key={section.id}
                section={section}
                members={members}
                costed={costed}
                onFocusLine={onFocusLine}
                flow={flow?.section === section.id ? flow : null}
                onStartAdd={() =>
                  setFlow({ section: section.id, memberIds: members.map((m) => m.id) })
                }
                onCancelAdd={() => setFlow(null)}
                onToggleMember={(id) =>
                  setFlow((f) =>
                    !f
                      ? f
                      : {
                          ...f,
                          memberIds: f.memberIds.includes(id)
                            ? f.memberIds.filter((x) => x !== id)
                            : [...f.memberIds, id],
                        },
                  )
                }
                onOpenLibrary={() => setLibraryOpen(true)}
              />
            ))}
          </tbody>
          <tfoot>
            {/* The totals close the loop: each column lands on the same direct
                cost its own sheet shows, and the set row is the header's
                figure derived a second way — sameness is the proof. */}
            <tr className="border-t border-hairline bg-surface-alt/60">
              <td className={cn(CELL, "sticky left-0 z-10 bg-surface font-semibold text-ink-900")}>
                Direct cost / pc
              </td>
              {members.map((m) => {
                const c = costed[m.id];
                return (
                  <td key={m.id} className={cn(CELL, "tabular-nums font-semibold text-ink-900")}>
                    {c ? inr2(c.rollup.directCost) : <span className="text-ink-400">—</span>}
                  </td>
                );
              })}
            </tr>
            <tr className="border-t border-hairline">
              <td className={cn(CELL, "sticky left-0 z-10 bg-surface font-semibold text-ink-900")}>
                Kit total / set
              </td>
              <td
                className={cn(CELL, "tabular-nums font-semibold text-brand-700")}
                colSpan={members.length}
              >
                {inr2(setTotal)}
                <span className="ml-1.5 text-[11px] font-normal text-ink-500">
                  = Σ direct cost × qty per set
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <ComponentLibraryModal
        open={libraryOpen && Boolean(flow)}
        onClose={() => setLibraryOpen(false)}
        section={flow?.section ?? null}
        targets={unionTargets}
        onAdd={addToChosen}
      />
    </div>
  );
}

function SectionRows({
  section,
  members,
  costed,
  onFocusLine,
  flow,
  onStartAdd,
  onCancelAdd,
  onToggleMember,
  onOpenLibrary,
}: {
  section: MergedSection;
  members: KitItem[];
  costed: Record<string, ArticleCosting>;
  onFocusLine: (memberId: string, componentId: string) => void;
  /** the in-progress add, when it belongs to THIS section */
  flow: AddFlow | null;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onToggleMember: (memberId: string) => void;
  onOpenLibrary: () => void;
}) {
  return (
    <>
      {/* The add sits on the SECTION header because the section is what decides
          which slice of the library is on offer — the same rule the sheet's own
          per-section add follows. */}
      <tr className="border-b border-hairline bg-surface-alt/60">
        <td className="sticky left-0 z-10 bg-surface-alt px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500">
          {section.label}
        </td>
        <td colSpan={members.length} className="px-3 py-1.5">
          {flow ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-700">
              <span className="font-medium text-ink-900">Add to</span>
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={flow.memberIds.includes(m.id)}
                    onChange={() => onToggleMember(m.id)}
                    className="h-3.5 w-3.5 accent-brand-700"
                  />
                  {m.name}
                </label>
              ))}
              <button
                type="button"
                disabled={flow.memberIds.length === 0}
                onClick={onOpenLibrary}
                className="rounded-md border border-brand-700 bg-brand-50 px-2 py-0.5 font-medium text-brand-800 transition-colors hover:bg-brand-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                Choose from library
              </button>
              <button
                type="button"
                onClick={onCancelAdd}
                className="rounded px-1.5 py-0.5 text-ink-500 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={onStartAdd}
              className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-medium text-ink-500 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              <Plus className="h-3 w-3" aria-hidden /> Add component
            </button>
          )}
        </td>
      </tr>
      {section.rows.map((row) => {
        // The row label steers to the FIRST member that has this variable —
        // a name is not member-specific, so any owner of the line will do.
        const first = members.find((m) => row.cells[m.id]);
        return (
          <tr key={row.key} className="border-b border-hairline last:border-b-0">
            <td className={cn(CELL, "sticky left-0 z-10 bg-surface")}>
              <button
                type="button"
                onClick={() => first && onFocusLine(first.id, row.cells[first.id].componentId)}
                className="rounded text-left font-medium text-ink-900 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                {row.name}
              </button>
            </td>
            {members.map((m) => {
              const cell = row.cells[m.id];
              return (
                <td key={m.id} className={cn(CELL, "p-0")}>
                  {cell ? (
                    <MemberCell
                      cell={cell}
                      memberName={m.name}
                      actions={costed[m.id]?.actions}
                      onOpenSheet={() => onFocusLine(m.id, cell.componentId)}
                    />
                  ) : (
                    <span className="block px-3 py-2 text-ink-400">—</span>
                  )}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

/**
 * A configurable line becomes a picker; a line with nothing to choose stays the
 * plain reading it always was. Both keep the door to the full sheet, but the
 * door moved to its own small control — a dropdown inside a navigation button
 * would make every attempt to change a value a navigation instead.
 */
function MemberCell({
  cell,
  memberName,
  actions,
  onOpenSheet,
}: {
  cell: Cell;
  memberName: string;
  actions?: ArticleCosting["actions"];
  onOpenSheet: () => void;
}) {
  const { line } = cell;
  const canPick = Boolean(line.optionGroup && line.target && actions);

  if (!canPick) {
    return (
      <button
        type="button"
        onClick={onOpenSheet}
        title={`Open ${memberName} on this line`}
        className="block h-full w-full rounded px-3 py-2 text-left transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700"
      >
        <span className="block truncate text-[12px] text-ink-800">{cell.detail}</span>
        <span className="block text-[10.5px] tabular-nums text-ink-500">
          {cell.rate} · <span className="font-medium text-ink-700">{inr2(cell.cost)} / pc</span>
        </span>
      </button>
    );
  }

  return (
    <div className="group px-3 py-2">
      <div className="flex items-start gap-1">
        <OptionPicker
          group={line.optionGroup as OptionGroup}
          onPick={(optionId) =>
            actions?.selectOption(
              line.kind,
              line.target!.componentId,
              line.target!.itemId,
              optionId,
            )
          }
        />
        <button
          type="button"
          onClick={onOpenSheet}
          title={`Open ${memberName} on this line`}
          aria-label={`Open ${memberName} on ${line.name}`}
          className="mt-1 rounded p-0.5 text-ink-400 opacity-0 transition-opacity hover:text-brand-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 group-hover:opacity-100"
        >
          <SquareArrowOutUpRight className="h-3 w-3" aria-hidden />
        </button>
      </div>
      <span className="mt-0.5 block text-[10.5px] tabular-nums text-ink-500">
        {cell.rate} · <span className="font-medium text-ink-700">{inr2(cell.cost)} / pc</span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Option picker — the sheet's control, rebuilt here
 *
 * It is a copy of `CostLineTable`'s picker because that one is private to the
 * sheet's row markup (spans inside a <td>, no popover portal). Sharing it would
 * mean exporting the sheet's internals to serve a different table; the honest
 * cost is a small duplicated control, and the behaviour it must match — label,
 * chevron, check marks, click-away — is entirely visible here.
 * ------------------------------------------------------------------ */

function OptionPicker({ group, onPick }: { group: OptionGroup; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = group.options.find((o) => o.id === group.selectedId);

  return (
    <span className="relative inline-block min-w-0 flex-1">
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
