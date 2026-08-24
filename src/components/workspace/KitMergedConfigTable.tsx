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
 * exists to remove — so a cell opens its component in the inspector drawer,
 * where the SAME option choice its own sheet offers is made, and each
 * member's column can take a new component from the library on its own. Adding
 * belongs to one article because a component is an article's decision; the
 * column the user reaches for is the article they mean.
 *
 * Nothing here is a second copy of any number, and nothing here is a second
 * copy of any behaviour: rows are cut from the lines each member's own sheet
 * reports, and every edit is delegated straight back to that member's workspace
 * through the actions it published. A cell can never disagree with the sheet
 * behind it because there is only one sheet.
 */

import { Fragment, useMemo, useState } from "react";
import { ChevronRight, Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { KitItem, Pod } from "@/lib/podsStore";
import {
  fabricRequirementsFor,
  metres,
  tierLabel,
  type FabricRequirement,
} from "@/lib/fabricRequirement";
import type { ArticleCosting } from "@/components/workspace/ArticleCostingWorkspace";
import { ComponentLibraryModal } from "@/components/workspace/ComponentLibraryModal";
import { FabricDetailModal } from "@/components/workspace/FabricDetailModal";
import type { CostLine, LineKind, LineSection } from "@/lib/costLines";
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
   * variable name the FIRST line owns the choice — the summed figure is the
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

/* ------------------------------------------------------------------ *
 * Fabric requirement — the metres behind the Raw Material rows
 * ------------------------------------------------------------------ */

/** One cloth, said per member and then per set. */
type KitFabric = {
  masterId: string;
  name: string;
  /**
   * What this member commits to this cloth: metres per piece, the pieces its
   * MOQ buys, the metres that multiplies out to, and the money — per piece and
   * for the whole run. Cost per piece is the figure that reaches the sheet's
   * material lines; the run total is the figure that reaches a purchase order.
   */
  byMember: Record<
    string,
    { perPiece: number; moq: number; metres: number; costPerPc: number; costInr: number }
  >;
  /** what the SET commits across all its members */
  setMetres: number;
  /** metres in one set — the per-set consumption, before MOQ */
  setPerSet: number;
  /** cost of this cloth in a single set */
  setCostPerSet: number;
  /** the POD-wide total that actually earns the tier */
  podMetres: number;
  tierText: string;
  rate: number;
  costInr: number;
  /** the full requirement, so the breakdown modal can be opened on it */
  req: FabricRequirement;
};

/**
 * The cloth belongs with the rows that consume it.
 *
 * A placemat and a runner cut from one greige are one purchase, so the metres
 * are summed across every member BEFORE a rate is read — rate follows quantity,
 * never the other way round. The tier itself is earned POD-wide (the pass
 * already sums every article), and this view simply states the share this set
 * is responsible for.
 */
function kitFabrics(pod: Pod, members: KitItem[]): KitFabric[] {
  const memberIds = new Set(members.map((m) => m.id));
  const qtyOf = new Map(members.map((m) => [m.id, Math.max(1, m.qty)]));
  return fabricRequirementsFor(pod)
    .map((r) => {
      const uses = r.uses.filter((u) => memberIds.has(u.articleId));
      const byMember: KitFabric["byMember"] = {};
      for (const u of uses) {
        // One member can cut the same cloth in two components — that is one
        // fabric decision bought twice, so the metres add rather than split.
        const at = byMember[u.articleId] ?? {
          perPiece: 0,
          moq: u.moq,
          metres: 0,
          costPerPc: 0,
          costInr: 0,
        };
        at.perPiece += u.perPiece;
        at.metres += u.metres;
        byMember[u.articleId] = at;
      }
      // Money is read off the TIER rate, not the master's base rate: the tier
      // is what these metres actually buy, so pricing a piece at anything else
      // would quote a rate the mill never offered.
      for (const at of Object.values(byMember)) {
        at.costPerPc = at.perPiece * r.tier.rate;
        at.costInr = at.metres * r.tier.rate;
      }
      const setMetres = uses.reduce((t, u) => t + u.metres, 0);
      // One set's worth: each member's per-piece consumption times how many of
      // that member go into a set.
      const setPerSet = Object.entries(byMember).reduce(
        (t, [id, at]) => t + at.perPiece * (qtyOf.get(id) ?? 1),
        0,
      );
      return {
        masterId: r.masterId,
        name: r.name,
        byMember,
        setMetres: Math.round(setMetres),
        setPerSet,
        setCostPerSet: setPerSet * r.tier.rate,
        podMetres: r.metres,
        tierText: tierLabel(r.tier),
        rate: r.tier.rate,
        costInr: Math.round(setMetres * r.tier.rate),
        req: r,
        used: uses.length > 0,
      };
    })
    .filter((r) => r.used);
}

/* ------------------------------------------------------------------ */

const inr2 = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Whole rupees, for order-level money.
 *
 * Everything on this table is ₹: configuration is the internal costing stage
 * and dollars only appear once a quotation is being written.
 */
const inrWhole = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;



const HEAD = "px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400";
const CELL = "px-3 py-2 align-top text-[12px]";

/** Which member a library add is destined for, and from which section. */
type AddFlow = { section: LineKind; memberId: string };

export function KitMergedConfigTable({
  pod,
  members,
  costed,
  onFocusLine,
  onOpenMember,
}: {
  /** the POD this kit sits in — fabric tiers are earned across all of it */
  pod: Pod;
  members: KitItem[];
  costed: Record<string, ArticleCosting>;
  /** open this line's component master for that member (the inspector drawer) */
  onFocusLine: (memberId: string, componentId: string, lineId?: string) => void;
  /** open the member's sheet with nothing in particular selected */
  onOpenMember?: (memberId: string) => void;
}) {
  const sections = useMemo(() => mergeSections(members, costed), [members, costed]);
  const fabrics = useMemo(() => kitFabrics(pod, members), [pod, members]);

  /**
   * The add flow carries no member question of its own: the affordance lives in
   * the member's OWN COLUMN of the section header, so the column that was
   * clicked already says which article is being added to. That leaves exactly
   * one decision — which master — and the library browser is the whole flow,
   * the same single screen the article sheet opens.
   */
  const [flow, setFlow] = useState<AddFlow | null>(null);
  /** which cloth's full breakdown is open, if any */
  const [fabricDetail, setFabricDetail] = useState<FabricRequirement | null>(null);

  if (sections.length === 0) return null;

  const setTotal = members.reduce(
    (t, m) => t + (costed[m.id]?.rollup.directCost ?? 0) * (m.qty > 0 ? m.qty : 1),
    0,
  );

  const target = flow ? members.find((m) => m.id === flow.memberId) : undefined;

  /**
   * The attach targets are that member's own components, by id — one article is
   * being configured, so there is nothing to reconcile across the set and a
   * process or trim lands on exactly the part the user picked.
   */
  const addTargets = flow ? (costed[flow.memberId]?.actions.attachTargets ?? []) : [];

  const addToMember = (item: LibraryItem, targetId: string | null, slot: string) => {
    const actions = flow ? costed[flow.memberId]?.actions : undefined;
    setFlow(null);
    if (!actions || !target) return;
    actions.addFromLibrary(item, targetId, slot);
    toast.success(`${item.name} added to ${target.name}`);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <p className="border-b border-hairline px-4 py-2.5 text-[11.5px] text-ink-500">
        One sheet for the whole set — work down the variables once and read every article side by
        side. Change any cell here, click one to inspect its component master, or add a component to
        a single article from its own column.
      </p>

      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse text-left"
          style={{ minWidth: `${240 + members.length * 220}px` }}
        >
          <thead>
            <tr className="border-b border-hairline">
              <th className={cn(HEAD, "sticky left-0 z-10 w-[240px] bg-surface")}>Variable</th>
              {/* The member's identity lives in its own column header rather
                  than in a card row above the table: a thumbnail that sits
                  anywhere else has to be matched to a column by eye, and the
                  wider the set the more often that matching goes wrong. Here
                  the picture, the size, the MOQ and the ₹/pc are aligned with
                  the numbers they belong to by construction. */}
              {members.map((m) => {
                const c = costed[m.id];
                const firstComponentId = c?.sections.flatMap((s) => s.lines)[0]?.componentId;
                return (
                  <th key={m.id} className="min-w-[220px] px-3 py-2.5 align-bottom">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenMember
                          ? onOpenMember(m.id)
                          : firstComponentId && onFocusLine(m.id, firstComponentId)
                      }
                      title={`Open ${m.name}'s full costing sheet`}
                      className="flex w-full items-center gap-2.5 rounded-md p-0.5 text-left transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                    >
                      {m.image ? (
                        <img
                          src={m.image}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded border border-hairline object-cover"
                        />
                      ) : (
                        <Package className="h-5 w-5 shrink-0 text-ink-400" aria-hidden />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-semibold text-ink-900">
                          {m.name}
                          {m.qty > 1 && (
                            <span className="ml-1 text-[10.5px] font-normal tabular-nums text-ink-500">
                              ×{m.qty}
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[10.5px] font-normal normal-case tracking-normal text-ink-500">
                          {[m.size, m.moq && `MOQ ${m.moq}`].filter(Boolean).join(" · ") || "—"}
                        </span>
                        <span className="block text-[11px] font-normal normal-case tabular-nums tracking-normal text-ink-700">
                          {c ? (
                            <>
                              <strong className="font-semibold text-ink-900">
                                {inr2(c.rollup.directCost)}
                              </strong>{" "}
                              / pc
                            </>
                          ) : (
                            <span className="text-ink-400">not costed yet</span>
                          )}
                        </span>
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <SectionRows
                key={section.id}
                section={section}
                members={members}
                costed={costed}
                fabrics={section.id === "material" ? fabrics : []}
                onFabricDetail={setFabricDetail}
                onFocusLine={onFocusLine}
                onStartAdd={(memberId) => setFlow({ section: section.id, memberId })}
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

      {fabricDetail && (
        <FabricDetailModal req={fabricDetail} onClose={() => setFabricDetail(null)} />
      )}

      <ComponentLibraryModal
        open={Boolean(flow)}
        onClose={() => setFlow(null)}
        section={flow?.section ?? null}
        targets={addTargets}
        onAdd={addToMember}
      />
    </div>
  );
}

function SectionRows({
  section,
  members,
  costed,
  fabrics,
  onFabricDetail,
  onFocusLine,
  onStartAdd,
}: {
  section: MergedSection;
  members: KitItem[];
  costed: Record<string, ArticleCosting>;
  /** the cloths this section's rows consume — Raw Material only, empty elsewhere */
  fabrics: KitFabric[];
  onFabricDetail: (req: FabricRequirement) => void;
  onFocusLine: (memberId: string, componentId: string, lineId?: string) => void;
  /** open the library for ONE member, scoped to this section */
  onStartAdd: (memberId: string) => void;
}) {
  return (
    <>
      {/* The add sits on the SECTION header because the section is what decides
          which slice of the library is on offer — the same rule the sheet's own
          per-section add follows. But it sits once PER COLUMN, because adding a
          component is an article's decision: the column the user reaches for is
          the article they mean, so no separate "which articles" question has to
          be asked and then read back. */}
      <tr className="border-b border-hairline bg-surface-alt/60">
        <td className="sticky left-0 z-10 bg-surface-alt px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-500">
          {section.label}
        </td>
        {members.map((m) => (
          <td key={m.id} className="px-3 py-1.5">
            <button
              type="button"
              onClick={() => onStartAdd(m.id)}
              title={`Add ${section.label} to ${m.name}`}
              // Ten "Add" buttons read alike to a screen reader; the column is
              // the whole point of this control, so it belongs in the name.
              aria-label={`Add ${section.label} to ${m.name}`}
              className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-medium text-ink-500 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              <Plus className="h-3 w-3" aria-hidden /> Add
            </button>
          </td>
        ))}
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
                onClick={() =>
                  first &&
                  onFocusLine(first.id, row.cells[first.id].componentId, row.cells[first.id].line.id)
                }
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
                      onOpenSheet={() => onFocusLine(m.id, cell.componentId, cell.line.id)}
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

      {/* The cloth sits under the rows that consume it, not in a panel of its
          own further down the page: the metres are what the fabric decisions
          above actually commit to, and the tier is the consequence. Rate
          follows quantity, never the other way round — so the set's metres are
          stated first and the rate is read off them. */}
      {fabrics.map((f) => (
        <Fragment key={`fabric:${f.masterId}`}>
          <tr className="border-b border-hairline bg-brand-50/40">
            <td className={cn(CELL, "sticky left-0 z-10 bg-surface")}>
              <span className="block font-medium text-ink-900">{f.name}</span>
              <span className="block text-[10.5px] text-ink-500">
                Fabric requirement · ₹{f.rate}/m
              </span>
              {/* The same breakdown the single-article sheet opens, so a set and
                  an article answer "where did this rate come from" the same way. */}
              <button
                type="button"
                onClick={() => onFabricDetail(f.req)}
                aria-label={`View ${f.name} requirement details`}
                className="mt-1 text-[11px] font-medium text-brand-700 underline-offset-2 transition-colors hover:text-brand-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                View Details
              </button>
            </td>
            {members.map((m) => {
              const use = f.byMember[m.id];
              return (
                <td key={m.id} className={cn(CELL, "tabular-nums text-ink-700")}>
                  {use ? (
                    <>
                      <span className="block">
                        {use.perPiece.toFixed(2)} m/pc × {use.moq.toLocaleString("en-IN")} pcs ={" "}
                        <span className="font-medium text-ink-900">{metres(use.metres)}</span>
                      </span>
                      {/* Per piece is what the sheet's material lines charge;
                          the run total is what the purchase order will say. */}
                      <span className="mt-0.5 block text-[11px] text-ink-500">
                        <span className="font-medium text-ink-700">{inr2(use.costPerPc)}</span> / pc
                        · <span className="font-medium text-ink-700">{inrWhole(use.costInr)}</span>{" "}
                        at this MOQ
                      </span>
                    </>
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </td>
              );
            })}
          </tr>
          <tr className="border-b border-hairline bg-brand-50/40">
            <td className={cn(CELL, "sticky left-0 z-10 bg-surface text-[11px] text-ink-500")}>
              {f.name} — set total
            </td>
            <td
              className={cn(CELL, "tabular-nums text-[11.5px] text-ink-700")}
              colSpan={members.length}
            >
              <span className="font-semibold text-ink-900">{f.setPerSet.toFixed(2)} m</span> per set
              at <span className="font-semibold text-ink-900">{inr2(f.setCostPerSet)}</span> ·{" "}
              <span className="font-semibold text-ink-900">{metres(f.setMetres)}</span> for the full
              run · {f.tierText} reached at {metres(f.podMetres)} across the POD · ₹{f.rate}/m ·{" "}
              <span className="font-semibold text-ink-900">{inrWhole(f.costInr)}</span> fabric cost
            </td>
          </tr>
        </Fragment>
      ))}
      {/* Several cloths are several purchases; the section still commits to one
          number, so it is stated rather than left to be added up by eye. */}
      {fabrics.length > 1 && (
        <tr className="border-b border-hairline bg-brand-50/60">
          <td className={cn(CELL, "sticky left-0 z-10 bg-surface font-semibold text-ink-900")}>
            All fabrics — total
          </td>
          <td
            className={cn(CELL, "tabular-nums text-[11.5px] font-semibold text-ink-900")}
            colSpan={members.length}
          >
            {fabrics.reduce((t, f) => t + f.setPerSet, 0).toFixed(2)} m per set at{" "}
            {inr2(fabrics.reduce((t, f) => t + f.setCostPerSet, 0))} ·{" "}
            {metres(fabrics.reduce((t, f) => t + f.setMetres, 0))} for the full run ·{" "}
            {inrWhole(fabrics.reduce((t, f) => t + f.costInr, 0))} fabric cost
          </td>
        </tr>
      )}

      {/* A section that cannot be added up is a list, not a costing. The
          subtotal carries the section header's own tint so it reads as the
          band's closing statement rather than one more editable line. */}
      <tr className="border-b border-hairline bg-surface-alt/60">
        <td className={cn(CELL, "sticky left-0 z-10 bg-surface-alt font-semibold text-ink-800")}>
          {section.label} total
        </td>
        {members.map((m) => (
          <td key={m.id} className={cn(CELL, "tabular-nums font-semibold text-ink-800")}>
            {inr2(sectionTotalFor(section, m.id))} <span className="font-normal">/ pc</span>
          </td>
        ))}
      </tr>
      <tr className="border-b border-hairline bg-surface-alt/60">
        <td className={cn(CELL, "sticky left-0 z-10 bg-surface-alt text-[11px] text-ink-500")}>
          per set
        </td>
        <td
          className={cn(CELL, "tabular-nums text-[11.5px] font-semibold text-ink-800")}
          colSpan={members.length}
        >
          {inr2(
            members.reduce(
              (t, m) => t + sectionTotalFor(section, m.id) * (m.qty > 0 ? m.qty : 1),
              0,
            ),
          )}
          <span className="ml-1.5 text-[11px] font-normal text-ink-500">
            = Σ member × qty per set
          </span>
        </td>
      </tr>
    </>
  );
}

/** A member's spend inside one section — the rows are already its own lines. */
function sectionTotalFor(section: MergedSection, memberId: string) {
  return section.rows.reduce((t, r) => t + (r.cells[memberId]?.cost ?? 0), 0);
}

/**
 * A configurable line becomes a picker; a line with nothing to choose stays the
 * plain reading it always was. Either way the WHOLE cell is the door to that
 * component's master in the inspector drawer, exactly as a row on the
 * single-article sheet opens its component in the inspector — the kit table
 * should not be the one place where a costing line is not clickable. The
 * dropdown keeps its own clicks (it already stops them propagating), so
 * changing a value never turns into a navigation.
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
  const configurable = Boolean(line.optionGroup && line.target && actions);

  // One shape for every cell: the reading, and the door to the inspector —
  // which now owns the option choice the cell's dropdown used to carry.
  return (
    <button
      type="button"
      onClick={onOpenSheet}
      title={
        configurable
          ? "Choose this component's option in the inspector"
          : "View this component's master"
      }
      aria-label={`${cell.detail} on ${memberName}. Open this component in the inspector.`}
      className="block h-full w-full rounded px-3 py-2 text-left transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700"
    >
      <span className="flex items-center gap-1">
        <span className="truncate text-[12px] text-ink-800">{cell.detail}</span>
        {configurable && (
          <ChevronRight className="h-3 w-3 shrink-0 text-ink-400" aria-hidden />
        )}
      </span>
      <span className="block text-[10.5px] tabular-nums text-ink-500">
        {cell.rate} · <span className="font-medium text-ink-700">{inr2(cell.cost)} / pc</span>
      </span>
    </button>
  );
}
