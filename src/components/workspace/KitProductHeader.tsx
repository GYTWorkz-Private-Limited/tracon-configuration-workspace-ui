/**
 * The kit's identity band: what this set is, and what it costs right now.
 *
 * Member identity used to live here as a row of product cards, but the cards
 * never lined up with the merged table's columns underneath them — two
 * different geometries describing the same members. Member identity now sits
 * in the merged table's own column headers, where the alignment is structural,
 * and this band keeps only what belongs to the SET: its name, the way back to
 * the merged view, the running set direct cost, and the output strip.
 *
 * Every figure here is ₹. Configuration is costed in the working currency;
 * dollars belong to the quotation stage.
 */

import { Boxes, Rows3 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Article, KitItem } from "@/lib/podsStore";
import type { ArticleCosting } from "@/components/workspace/ArticleCostingWorkspace";
import { inrShort } from "@/lib/fabricRequirement";

/** Which arrangement of the kit is on screen. */
export type KitView = "merged" | `member:${string}`;

export const memberView = (id: string): KitView => `member:${id}`;
export const memberOf = (view: KitView): string | null =>
  view.startsWith("member:") ? view.slice("member:".length) : null;

const inr2 = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function KitProductHeader({
  kit,
  members,
  costed,
  view,
  onView,
}: {
  kit: Article;
  members: KitItem[];
  costed: Record<string, ArticleCosting>;
  view: KitView;
  onView: (view: KitView) => void;
}) {
  // The set total is honest arithmetic over what has actually been costed —
  // a member without a report contributes nothing rather than a guess, and
  // the label says so while any card still reads "not costed yet".
  const costedMembers = members.filter((m) => costed[m.id]);
  const allCosted = costedMembers.length === members.length;
  const setInr = costedMembers.reduce(
    (t, m) => t + costed[m.id].rollup.directCost * (m.qty > 0 ? m.qty : 1),
    0,
  );

  return (
    <div className="shrink-0 border-b border-hairline bg-surface">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-6 pt-2.5 lg:px-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-cfg-strong)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
          <Boxes className="h-3 w-3" aria-hidden /> Kit
        </span>
        <h2 className="text-[14px] font-semibold text-ink-900">{kit.name}</h2>
        <span className="text-[11.5px] text-ink-500">
          {members.length} article{members.length === 1 ? "" : "s"} per set · configured together,
          costed as one
        </span>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Only shown once the user has left the merged view — the default
              arrangement should not advertise a button to itself. */}
          {view !== "merged" && (
            <button
              type="button"
              onClick={() => onView("merged")}
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-700 transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              <Rows3 className="h-3.5 w-3.5" aria-hidden />
              Merged view
            </button>
          )}
        </div>
      </div>

      {/* The output figures sit on the SAME line as the kit's direct cost
          rather than in a band of their own: they are one statement of where
          the set stands, and splitting them across two rows left a stripe of
          empty white between the identity and the numbers it belongs to. */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-6 pb-3 pt-1 lg:px-8">
        <KitOutputStrip kit={kit} members={members} costed={costed} />

        {/* The set total takes the seat a single article's direct cost would
            occupy: right-aligned, always in view, moving live as any sheet
            changes underneath it. */}
        <div className="ml-auto flex shrink-0 flex-col items-end justify-center rounded-lg border border-[var(--color-cfg)] bg-surface px-3.5 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            Kit direct cost
          </span>
          {costedMembers.length > 0 ? (
            <>
              <span className="text-[14px] font-semibold tabular-nums text-ink-900">
                {inr2(setInr)} <span className="text-[11px] font-normal text-ink-500">/ set</span>
              </span>
              {!allCosted && <span className="text-[10.5px] text-ink-500">partial</span>}
            </>
          ) : (
            <span className="text-[12px] text-ink-400">not costed yet</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Digits out of a free-text MOQ like "1,500 sets" — 0 when there are none. */
const moqNumber = (text: string | undefined) => Number((text ?? "").replace(/[^\d]/g, "")) || 0;

/**
 * What the SET is worth, live.
 *
 * The merged table says what each piece costs; this says what the deal is —
 * quantity, margin and the order value that follows from them. Every figure is
 * read straight off the members' reported costings (each already carries its
 * own selling price and FX), so there is exactly one costing engine in the app
 * and this strip can never disagree with the sheets it sums.
 *
 * ₹ only: the buyer-facing dollar figure is the quotation stage's job.
 */
function KitOutputStrip({
  kit,
  members,
  costed,
}: {
  kit: Article;
  members: KitItem[];
  costed: Record<string, ArticleCosting>;
}) {
  const priced = members
    .map((m) => ({ m, c: costed[m.id] }))
    .filter((x): x is { m: KitItem; c: ArticleCosting } => Boolean(x.c));
  if (priced.length === 0) return null;

  const partial = priced.length !== members.length;

  // Weighted by pieces per set: a set with two placemats carries two of their
  // costs and two of their prices, so both sides of the margin scale together.
  const costInr = priced.reduce((t, p) => t + p.c.rollup.directCost * Math.max(1, p.m.qty), 0);
  const sellInr = priced.reduce(
    (t, p) => t + p.c.sellingUsd * p.c.fxRate * Math.max(1, p.m.qty),
    0,
  );
  const marginInr = sellInr - costInr;
  const marginPct = sellInr > 0 ? (marginInr / sellInr) * 100 : 0;

  // The set's own MOQ is the commitment the buyer made; the piece MOQs on the
  // members are what production has to cover to honour it, so a member that
  // cannot cover its share caps the sets that can actually ship.
  const declaredSets = moqNumber(kit.moq);
  const coveredSets = Math.min(...priced.map((p) => Math.floor(p.c.moq / Math.max(1, p.m.qty))));
  const sets = declaredSets || coveredSets;
  const short = declaredSets > 0 && coveredSets < declaredSets;

  // No band of its own any more — it shares the header's white row, so it
  // brings no border, no tint and no padding of its own.
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
      <Output
        label="Set MOQ"
        value={`${sets.toLocaleString("en-IN")} sets`}
        note={
          short
            ? `pieces cover ${coveredSets.toLocaleString("en-IN")} sets`
            : priced.map((p) => `${p.c.moq.toLocaleString("en-IN")} pcs`).join(" · ")
        }
      />
      <Output
        label="Set margin"
        value={`${marginPct.toFixed(1)}%`}
        note={`${inrShort(marginInr)} / set`}
      />
      <Output label="Set selling value" value={inrShort(sellInr)} note="per set" />
      {/* The number the room actually argues about, so it gets the emphasis. */}
      <Output
        label="Potential order value"
        value={inrShort(sellInr * sets)}
        note={`at ${sets.toLocaleString("en-IN")} sets`}
        strong
      />
      {partial && (
        <span className="self-center rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-medium text-amber-700">
          partial — {priced.length} of {members.length} costed
        </span>
      )}
    </div>
  );
}

function Output({
  label,
  value,
  note,
  strong,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-400">
        {label}
      </div>
      <div
        className={cn(
          "tabular-nums",
          strong
            ? "text-[14px] font-semibold text-ink-900"
            : "text-[13px] font-medium text-ink-800",
        )}
      >
        {value}
      </div>
      {note && <div className="truncate text-[10px] tabular-nums text-ink-500">{note}</div>}
    </div>
  );
}
