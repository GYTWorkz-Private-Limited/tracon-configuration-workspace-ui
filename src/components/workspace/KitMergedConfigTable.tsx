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
 * Nothing here is a second copy of any number. Rows are cut from the same
 * `buildSections` derivation each member's own sheet renders, over the same
 * reported roll-up, so a cell can never disagree with the sheet behind it.
 * Every cell is a door: clicking it opens that member's full sheet with that
 * line already selected in the inspector.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { KitItem } from "@/lib/podsStore";
import type { ArticleCosting } from "@/components/workspace/ArticleCostingWorkspace";
import { buildSections, type LineKind, type LineSection } from "@/lib/costLines";

/* ------------------------------------------------------------------ *
 * Row assembly — the union of variables across members
 * ------------------------------------------------------------------ */

type Cell = {
  /** the configured value — material / method / pack standard */
  detail: string;
  rate: string;
  cost: number;
  /** what to select on the member's sheet when this cell is clicked */
  componentId: string;
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
  const perMember = new Map<string, LineSection[]>();
  for (const m of members) {
    const c = costed[m.id];
    if (!c) continue;
    perMember.set(m.id, buildSections(c.rollup.components, c.packaging, c.testing));
  }

  // Sections keep the costing sheet's fixed order; rows within a section keep
  // first-seen order across members, so the first member's sheet order leads
  // and later members only append what is genuinely theirs alone.
  const template = perMember.values().next().value as LineSection[] | undefined;
  if (!template) return [];

  return template.map((section) => {
    const rows: MergedRow[] = [];
    const byName = new Map<string, MergedRow>();
    for (const m of members) {
      const lines = perMember.get(m.id)?.find((s) => s.id === section.id)?.lines ?? [];
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

  if (sections.length === 0) return null;

  const setTotal = members.reduce(
    (t, m) => t + (costed[m.id]?.rollup.directCost ?? 0) * (m.qty > 0 ? m.qty : 1),
    0,
  );

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <p className="border-b border-hairline px-4 py-2.5 text-[11.5px] text-ink-500">
        One sheet for the whole set — work down the variables once and read every article side by
        side. Click any cell to open that article&apos;s sheet on that line.
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
            {sections.map((section) =>
              section.rows.length === 0 ? null : (
                <SectionRows
                  key={section.id}
                  section={section}
                  members={members}
                  onFocusLine={onFocusLine}
                />
              ),
            )}
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
    </div>
  );
}

function SectionRows({
  section,
  members,
  onFocusLine,
}: {
  section: MergedSection;
  members: KitItem[];
  onFocusLine: (memberId: string, componentId: string) => void;
}) {
  return (
    <>
      <tr className="border-b border-hairline bg-surface-alt/60">
        <td
          className="sticky left-0 z-10 bg-surface-alt px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500"
          colSpan={1}
        >
          {section.label}
        </td>
        <td colSpan={members.length} />
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
                    <button
                      type="button"
                      onClick={() => onFocusLine(m.id, cell.componentId)}
                      title={`Open ${m.name} on this line`}
                      className="block h-full w-full rounded px-3 py-2 text-left transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700"
                    >
                      <span className="block truncate text-[12px] text-ink-800">{cell.detail}</span>
                      <span className="block text-[10.5px] tabular-nums text-ink-500">
                        {cell.rate} ·{" "}
                        <span className="font-medium text-ink-700">{inr2(cell.cost)} / pc</span>
                      </span>
                    </button>
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
