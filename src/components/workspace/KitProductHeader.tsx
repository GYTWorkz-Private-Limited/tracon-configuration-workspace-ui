/**
 * The kit's single navigation surface — a row of product cards, not a tab strip.
 *
 * Tabs said "pick ONE article to look at"; the cards say "here is the whole
 * set". Each card carries the member's live per-piece cost so the kit's shape
 * is readable without opening anything, and the running SET total sits pinned
 * at the right — exactly where a single article's direct-cost figure would sit,
 * because for a kit the set IS the unit being costed.
 *
 * Clicking a card opens that member's full sheet; "Merged view" returns to the
 * variable-by-variable table; "Compare side by side" is the third arrangement.
 */

import { Boxes, LayoutGrid, Package, Rows3 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Article, KitItem } from "@/lib/podsStore";
import type { ArticleCosting } from "@/components/workspace/ArticleCostingWorkspace";
import { inrShort } from "@/lib/fabricRequirement";
import { createMoney } from "@/lib/money";

/** Which arrangement of the kit is on screen. */
export type KitView = "merged" | "compare" | `member:${string}`;

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
  const openMemberId = memberOf(view);

  // The set total is honest arithmetic over what has actually been costed —
  // a member without a report contributes nothing rather than a guess, and
  // the label says so while any card still reads "not costed yet".
  const costedMembers = members.filter((m) => costed[m.id]);
  const allCosted = costedMembers.length === members.length;
  const setInr = costedMembers.reduce(
    (t, m) => t + costed[m.id].rollup.directCost * (m.qty > 0 ? m.qty : 1),
    0,
  );
  const fxRate = costedMembers.length ? costed[costedMembers[0].id].fxRate : 0;

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
          {/* A single member has nothing to sit beside, so the toggle would
              only invite a no-op. */}
          {members.length > 1 && (
            <button
              type="button"
              onClick={() => onView(view === "compare" ? "merged" : "compare")}
              aria-pressed={view === "compare"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                view === "compare"
                  ? "border-brand-700 bg-brand-50 text-brand-700"
                  : "border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              Compare side by side
            </button>
          )}
        </div>
      </div>

      <div className="flex items-stretch gap-2 overflow-x-auto px-6 py-2.5 lg:px-8">
        {members.map((m) => {
          const c = costed[m.id];
          const open = m.id === openMemberId;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onView(memberView(m.id))}
              aria-pressed={open}
              title={`Open ${m.name}'s full costing sheet`}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                open
                  ? "border-brand-700 bg-brand-50"
                  : "border-hairline bg-surface hover:bg-surface-alt",
              )}
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
                <span
                  className={cn(
                    "block whitespace-nowrap text-[12.5px]",
                    open ? "font-semibold text-brand-700" : "font-medium text-ink-900",
                  )}
                >
                  {m.name}
                  {m.qty > 1 && (
                    <span className="ml-1 text-[10.5px] font-normal tabular-nums text-ink-500">
                      ×{m.qty}
                    </span>
                  )}
                </span>
                <span className="block whitespace-nowrap text-[10.5px] text-ink-500">
                  {[m.size, m.moq && `MOQ ${m.moq}`].filter(Boolean).join(" · ") || "—"}
                </span>
                <span className="block whitespace-nowrap text-[11px] tabular-nums text-ink-700">
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
          );
        })}

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
              <span className="text-[10.5px] tabular-nums text-ink-500">
                {fxRate > 0 && `$${(setInr / fxRate).toFixed(2)} / set`}
                {!allCosted && " · partial"}
              </span>
            </>
          ) : (
            <span className="text-[12px] text-ink-400">not costed yet</span>
          )}
        </div>
      </div>

      <KitOutputStrip kit={kit} members={members} costed={costed} />
    </div>
  );
}

/** Digits out of a free-text MOQ like "1,500 sets" — 0 when there are none. */
const moqNumber = (text: string | undefined) => Number((text ?? "").replace(/[^\d]/g, "")) || 0;

/**
 * What the SET is worth, live.
 *
 * The cards below say what each piece costs; this says what the deal is —
 * quantity, margin and the order value that follows from them. Every figure is
 * read straight off the members' reported costings (each already carries its
 * own selling price and FX), so there is exactly one costing engine in the app
 * and this strip can never disagree with the sheets it sums.
 *
 * Money follows the house convention: ₹ is the working currency, $ trails it
 * for the buyer-facing figure.
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
  const fxRate = priced[0].c.fxRate;
  const usd = createMoney("USD", fxRate);

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

  return (
    <div className="flex flex-wrap items-stretch gap-x-6 gap-y-2 border-t border-hairline bg-surface-alt/40 px-6 py-2 lg:px-8">
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
        note={`${inrShort(marginInr)} · ${usd(marginInr)} / set`}
      />
      <Output label="Set selling value" value={inrShort(sellInr)} note={`${usd(sellInr)} / set`} />
      {/* The number the room actually argues about, so it gets the emphasis. */}
      <Output
        label="Potential order value"
        value={inrShort(sellInr * sets)}
        note={`${usd(sellInr * sets, 0)} at ${sets.toLocaleString("en-IN")} sets`}
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
