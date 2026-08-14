/**
 * Costing a KIT.
 *
 * A kit is not a product with a bill of materials of its own — it is several
 * articles ordered as one unit. So this is not a different costing experience:
 * it is a tab per member article, each running the SAME single-product
 * workspace, plus one summary tab that consolidates them.
 *
 *   Kit: Placemat + Runner
 *   [ Placemat ] [ Runner ] [ Kit Summary ]
 *
 * Every member tab stays mounted. That is deliberate: the Kit Summary has to
 * show a live consolidation, and unmounting a tab would throw away that
 * member's scenarios, variants and options the moment you looked at another
 * one.
 */

import { useCallback, useState } from "react";
import { Boxes, LayoutGrid, Package, Sigma } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Article, Pod } from "@/lib/podsStore";
import {
  ArticleCostingWorkspace,
  type ArticleCosting,
} from "@/components/workspace/ArticleCostingWorkspace";
import { KitSummary } from "@/components/workspace/KitSummary";
import { fabricRequirementsFor, metres, tierLabel } from "@/lib/fabricRequirement";

const SUMMARY_TAB = "__kit_summary__";

export function KitCostingWorkspace({
  pod,
  kit,
  stepper,
}: {
  pod: Pod;
  kit: Article;
  /** the workflow band — rendered once, above the tabs */
  stepper?: React.ReactNode;
}) {
  const members = kit.kitItems ?? [];
  const [activeTab, setActiveTab] = useState(members[0]?.id ?? SUMMARY_TAB);
  const [costed, setCosted] = useState<Record<string, ArticleCosting>>({});
  // Process cost rarely matches across members — a pillowcase is not a sheet —
  // so one-tab-at-a-time forces users to cost from memory. Compare mode puts
  // every member's sheet on screen at once so each can be adjusted against the
  // others. The Kit Summary still takes the full width: it is already the
  // consolidated view, so splitting it into a column would say nothing new.
  const [compare, setCompare] = useState(false);
  const comparing = compare && activeTab !== SUMMARY_TAB;

  // Members report their roll-up as they change. A stable callback keeps the
  // child effect from re-firing on every parent render.
  const report = useCallback((summary: ArticleCosting) => {
    setCosted((prev) =>
      prev[summary.articleId]?.rollup === summary.rollup
        ? prev
        : { ...prev, [summary.articleId]: summary },
    );
  }, []);

  if (members.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {stepper}
        <div className="m-6 rounded-xl border border-dashed border-ink-200 bg-surface px-6 py-14 text-center">
          <h2 className="text-[15px] font-semibold text-ink-900">This set has no articles yet</h2>
          <p className="mx-auto mt-1 max-w-[420px] text-[12.5px] text-ink-500">
            Add articles to the set to start costing it. Each one is costed on its own sheet and the
            set is their sum.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {stepper}

      {/* kit identity + product tabs */}
      <div className="shrink-0 border-b border-hairline bg-surface">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-6 pt-2.5 lg:px-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-cfg-strong)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">
            <Boxes className="h-3 w-3" aria-hidden /> Kit
          </span>
          <h2 className="text-[14px] font-semibold text-ink-900">{kit.name}</h2>
          <span className="text-[11.5px] text-ink-500">
            {members.length} article{members.length === 1 ? "" : "s"} per set · each configured and
            costed on its own
          </span>

          {/* A single member has nothing to sit beside, so the toggle would
              only invite a no-op. */}
          {members.length > 1 && (
            <button
              type="button"
              onClick={() => setCompare((v) => !v)}
              aria-pressed={compare}
              className={cn(
                "ml-auto inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                compare
                  ? "border-brand-700 bg-brand-50 text-brand-700"
                  : "border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
              Compare side by side
            </button>
          )}
        </div>

        <div
          role="tablist"
          aria-label="Articles in this kit"
          className="flex items-stretch gap-1 overflow-x-auto px-6 pt-2 lg:px-8"
        >
          {members.map((m) => {
            const active = m.id === activeTab;
            const c = costed[m.id];
            return (
              <button
                key={m.id}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(m.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-t-lg border border-b-0 px-3.5 py-2 text-left transition-colors",
                  active
                    ? "border-hairline bg-canvas"
                    : "border-transparent text-ink-500 hover:bg-surface-alt",
                )}
              >
                {m.image ? (
                  <img
                    src={m.image}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded border border-hairline object-cover"
                  />
                ) : (
                  <Package className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                )}
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block whitespace-nowrap text-[12.5px]",
                      active ? "font-semibold text-ink-900" : "font-medium",
                    )}
                  >
                    {m.name}
                    {m.qty > 1 && (
                      <span className="ml-1 text-[10.5px] font-normal tabular-nums text-ink-500">
                        ×{m.qty}
                      </span>
                    )}
                  </span>
                  <span className="block whitespace-nowrap text-[10.5px] tabular-nums text-ink-400">
                    {c ? `₹${c.rollup.directCost.toFixed(2)} / pc` : "not costed yet"}
                  </span>
                </span>
              </button>
            );
          })}

          <button
            role="tab"
            aria-selected={activeTab === SUMMARY_TAB}
            onClick={() => setActiveTab(SUMMARY_TAB)}
            className={cn(
              "ml-1 flex shrink-0 items-center gap-2 rounded-t-lg border border-b-0 px-3.5 py-2 transition-colors",
              activeTab === SUMMARY_TAB
                ? "border-[var(--color-cfg)] bg-canvas"
                : "border-transparent text-ink-500 hover:bg-surface-alt",
            )}
          >
            <Sigma
              className={cn(
                "h-4 w-4",
                activeTab === SUMMARY_TAB ? "text-[var(--color-cfg-strong)]" : "text-ink-400",
              )}
              aria-hidden
            />
            <span
              className={cn(
                "whitespace-nowrap text-[12.5px]",
                activeTab === SUMMARY_TAB ? "font-semibold text-ink-900" : "font-medium",
              )}
            >
              Kit Summary
            </span>
          </button>
        </div>
      </div>

      {/* Every member stays mounted so its configuration survives a tab switch
          and the summary always reflects the live build. Compare mode reuses
          those same instances — same map, same keys, only the wrapper layout
          changes — so toggling it never costs anyone their in-progress work. */}
      <div
        className={cn(
          "min-h-0 flex-1",
          comparing
            ? // One implicit row pinned to the container height; columns wide
              // enough for a full costing sheet, so >2 members scroll sideways
              // instead of crushing each other.
              "grid auto-cols-[minmax(640px,1fr)] grid-flow-col grid-rows-[minmax(0,1fr)] overflow-x-auto"
            : "flex flex-col overflow-hidden",
        )}
      >
        {members.map((m) => {
          const shown = comparing || m.id === activeTab;
          const c = costed[m.id];
          return (
            <div
              key={m.id}
              hidden={!shown}
              className={cn(
                "min-h-0 overflow-hidden",
                comparing
                  ? "flex min-w-0 flex-col border-r border-hairline last:border-r-0"
                  : cn("flex-1 flex-col", shown && "flex"),
              )}
            >
              {/* In the grid the tab strip no longer says which sheet is
                  which, so each column restates its identity and live price. */}
              {comparing && (
                <div className="flex shrink-0 items-baseline justify-between gap-2 border-b border-hairline bg-surface px-4 py-1.5">
                  <span className="truncate text-[12.5px] font-semibold text-ink-900">
                    {m.name}
                    {m.qty > 1 && (
                      <span className="ml-1 text-[10.5px] font-normal tabular-nums text-ink-500">
                        ×{m.qty}
                      </span>
                    )}
                  </span>
                  <span className="whitespace-nowrap text-[11px] tabular-nums text-ink-500">
                    {c ? `₹${c.rollup.directCost.toFixed(2)} / pc` : "not costed yet"}
                  </span>
                </div>
              )}
              <ArticleCostingWorkspace
                podId={pod.id}
                buyer={pod.buyer}
                buyerRef={pod.buyerRef}
                identity={{
                  articleId: m.id,
                  name: m.name,
                  srfRef: m.srfRef ?? kit.srfRef,
                  size: m.size,
                  moq: m.moq,
                  image: m.image,
                  currency: kit.currency,
                }}
                onCosted={report}
              />
            </div>
          );
        })}

        {activeTab === SUMMARY_TAB && (
          <div className="min-h-0 flex-1 overflow-y-auto bg-canvas">
            {/* Fabric FIRST, then the rate: for a set cut from common cloth
                the metres must be summed across every member before any rate
                is chosen — pick the rate per article and the team is guessing
                which MOQ band the mill will actually quote. */}
            <KitFabricRequirement pod={pod} kit={kit} />
            <KitSummary kit={kit} members={members} costed={costed} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Stage one of the kit's material cost: the combined metres.
 *
 * The POD-wide requirement pass already sums consumption × MOQ per fabric;
 * here it is filtered to this kit's member articles so the summary states,
 * per cloth, the total the SET commits to — and only then the tier that
 * total buys. The ordering is the point: rate follows quantity, never the
 * other way round.
 */
function KitFabricRequirement({ pod, kit }: { pod: Pod; kit: Article }) {
  const memberIds = new Set((kit.kitItems ?? []).map((m) => m.id));
  const reqs = fabricRequirementsFor(pod)
    .map((r) => {
      const uses = r.uses.filter((u) => memberIds.has(u.articleId));
      const metresForKit = uses.reduce((t, u) => t + u.metres, 0);
      return { ...r, uses, metresForKit: Math.round(metresForKit) };
    })
    .filter((r) => r.uses.length > 0);
  if (reqs.length === 0) return null;

  return (
    <section className="mx-4 mt-4 overflow-hidden rounded-xl border border-hairline bg-surface">
      <header className="flex flex-wrap items-baseline gap-x-2 border-b border-hairline bg-surface-alt/60 px-4 py-2.5">
        <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-700">
          Kit fabric requirement
        </h3>
        <p className="text-[11.5px] text-ink-500">
          Total metres across every member first — the tier and rate follow from the total.
        </p>
      </header>
      <ul className="divide-y divide-hairline">
        {reqs.map((r) => (
          <li
            key={r.masterId}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5"
          >
            <span className="text-[12.5px] font-medium text-ink-900">{r.name}</span>
            <span className="text-[11.5px] text-ink-500">
              {r.uses
                .map((u) => `${u.componentName} (${u.articleName}) ${metres(u.metres)}`)
                .join(" + ")}
            </span>
            <span className="ml-auto whitespace-nowrap text-[12px] tabular-nums text-ink-700">
              set total {metres(r.metresForKit)} · POD total {metres(r.metres)} →{" "}
              {tierLabel(r.tier)}{" "}
              <strong className="font-semibold text-ink-900">₹{r.tier.rate}/m</strong>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
