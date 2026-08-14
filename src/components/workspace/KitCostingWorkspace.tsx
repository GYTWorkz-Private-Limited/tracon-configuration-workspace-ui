/**
 * Costing a KIT.
 *
 * A kit is not a product with a bill of materials of its own — it is several
 * articles ordered as one unit. Earlier this screen was a tab per member; the
 * tabs made the user cost each decision N times from memory, so the kit is now
 * ONE merged workspace:
 *
 *   [ Placemat card ] [ Runner card ]            Kit direct cost ₹848 / set
 *   ─ merged table: one row per variable, one column per member ─
 *
 * The header's product cards are the only navigation. The default view is the
 * merged variable-by-variable table; a card (or any table cell) opens that
 * member's full sheet; "Compare side by side" mounts every sheet in a grid.
 *
 * Every member's sheet stays mounted through all of it. That is deliberate:
 * the merged table and the Kit Summary render from the roll-ups those sheets
 * report, and unmounting one would throw away its scenarios, variants and
 * options the moment you looked elsewhere.
 */

import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";
import type { Article, Pod } from "@/lib/podsStore";
import {
  ArticleCostingWorkspace,
  type ArticleCosting,
} from "@/components/workspace/ArticleCostingWorkspace";
import {
  KitProductHeader,
  memberOf,
  memberView,
  type KitView,
} from "@/components/workspace/KitProductHeader";
import { KitMergedConfigTable } from "@/components/workspace/KitMergedConfigTable";
import { KitSummary } from "@/components/workspace/KitSummary";
import { fabricRequirementsFor, metres, tierLabel } from "@/lib/fabricRequirement";

export function KitCostingWorkspace({
  pod,
  kit,
  stepper,
}: {
  pod: Pod;
  kit: Article;
  /** the workflow band — rendered once, above the header */
  stepper?: React.ReactNode;
}) {
  const members = kit.kitItems ?? [];
  const [view, setView] = useState<KitView>("merged");
  const [costed, setCosted] = useState<Record<string, ArticleCosting>>({});
  // A merged-table click carries a target line into the member's sheet. The
  // nonce makes the same cell clickable twice — the inspector may have been
  // closed since — without the signal object churning on unrelated renders.
  const [focus, setFocus] = useState<{ memberId: string; componentId: string; nonce: number }>();

  // Members report their roll-up as they change. A stable callback keeps the
  // child effect from re-firing on every parent render.
  const report = useCallback((summary: ArticleCosting) => {
    setCosted((prev) =>
      prev[summary.articleId]?.rollup === summary.rollup
        ? prev
        : { ...prev, [summary.articleId]: summary },
    );
  }, []);

  const focusLine = useCallback((memberId: string, componentId: string) => {
    setFocus((prev) => ({ memberId, componentId, nonce: (prev?.nonce ?? 0) + 1 }));
    setView(memberView(memberId));
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

  const comparing = view === "compare";
  const openMemberId = memberOf(view);

  // The merged view is a DOCUMENT: a long table, then the fabric requirement,
  // then the summary — read top to bottom, so it scrolls with the page. The
  // member and compare views are app-like panes that own the viewport height.
  // Constraining the merged view the same way gave it a second scroller inside
  // a page that also scrolled, and the reader could never tell which one was
  // "the end".
  const paneLayout = view !== "merged";

  return (
    <div className={cn("flex flex-col", paneLayout && "min-h-0 flex-1")}>
      {stepper}

      <KitProductHeader kit={kit} members={members} costed={costed} view={view} onView={setView} />

      {/* Every member stays mounted so its configuration survives a view
          switch and the merged table always reflects the live build. Compare
          mode reuses those same instances — same map, same keys, only the
          wrapper layout changes — so no arrangement ever costs anyone their
          in-progress work. */}
      <div
        className={cn(
          paneLayout && "min-h-0 flex-1",
          comparing
            ? // One implicit row pinned to the container height; columns wide
              // enough for a full costing sheet, so >2 members scroll sideways
              // instead of crushing each other.
              "grid auto-cols-[minmax(640px,1fr)] grid-flow-col grid-rows-[minmax(0,1fr)] overflow-x-auto"
            : cn("flex flex-col", paneLayout && "overflow-hidden"),
        )}
      >
        {members.map((m) => {
          const shown = comparing || m.id === openMemberId;
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
              {/* In the grid the header cards no longer say which sheet is
                  which column, so each column restates its identity and live
                  price. */}
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
                focusSignal={
                  focus?.memberId === m.id
                    ? { componentId: focus.componentId, nonce: focus.nonce }
                    : undefined
                }
              />
            </div>
          );
        })}

        {view === "merged" && (
          <div className="bg-canvas pb-8">
            <div className="mx-4 mt-4">
              <KitMergedConfigTable members={members} costed={costed} onFocusLine={focusLine} />
            </div>
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
