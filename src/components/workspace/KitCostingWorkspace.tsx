/**
 * Costing a KIT.
 *
 * A kit is not a product with a bill of materials of its own — it is several
 * articles ordered as one unit. Earlier this screen was a tab per member; the
 * tabs made the user cost each decision N times from memory, so the kit is now
 * ONE merged workspace:
 *
 *   kit identity band                            Kit direct cost ₹848 / set
 *   ─ merged table: one row per variable, one column per member ─
 *
 * The merged table carries member identity in its own column headers, so it is
 * also the navigation: a column header (or any cell) opens that member's full
 * sheet, and "Merged view" in the band comes back.
 *
 * Every member's sheet stays mounted through all of it. That is deliberate:
 * the merged table renders from the roll-ups those sheets report, and
 * unmounting one would throw away its scenarios, variants and options the
 * moment you looked elsewhere.
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";

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
import { CopilotPanel } from "@/components/configuration/CopilotPanel";
import { inrShort } from "@/lib/fabricRequirement";

export function KitCostingWorkspace({
  pod,
  kit,
  stepper,
  copilotOpen = false,
  onCopilotOpenChange,
}: {
  pod: Pod;
  kit: Article;
  /** the workflow band — rendered once, above the header */
  stepper?: React.ReactNode;
  /** driven by the page header's AI Copilot button */
  copilotOpen?: boolean;
  onCopilotOpenChange?: (open: boolean) => void;
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

  const openMemberId = memberOf(view);

  const setCopilotOpen = (open: boolean) => onCopilotOpenChange?.(open);

  // There is exactly one copilot on screen: with a member's sheet open the
  // header's toggle is forwarded to THAT sheet (which knows its own variant),
  // and the kit-level panel below only exists in the merged view.
  const setInr = members.reduce(
    (t, m) => t + (costed[m.id]?.rollup.directCost ?? 0) * Math.max(1, m.qty),
    0,
  );
  const memberNames = members.map((m) => m.name).join(" + ");
  const kitContext = [
    kit.name,
    // Kits are often named after their members; saying it twice reads as noise.
    kit.name.includes(memberNames) ? null : memberNames,
    `${inrShort(setInr)} / set direct`,
  ]
    .filter(Boolean)
    .join(" · ");

  // The merged view is a DOCUMENT: a long table, then the fabric requirement,
  // then the summary — read top to bottom, so it scrolls with the page. A
  // member's own sheet is an app-like pane that owns the viewport height.
  // Constraining the merged view the same way gave it a second scroller inside
  // a page that also scrolled, and the reader could never tell which one was
  // "the end".
  const paneLayout = view !== "merged";

  return (
    <div className={cn("flex flex-col", paneLayout && "min-h-0 flex-1")}>
      {stepper}

      <KitProductHeader kit={kit} members={members} costed={costed} view={view} onView={setView} />

      {/* Every member stays mounted so its configuration survives a view
          switch and the merged table always reflects the live build — the
          merged table IS the comparison, so the sheets below it only ever
          surface one at a time. */}
      <div className={cn("flex flex-col", paneLayout && "min-h-0 flex-1 overflow-hidden")}>
        {members.map((m) => {
          const shown = m.id === openMemberId;
          return (
            <div
              key={m.id}
              hidden={!shown}
              className={cn("min-h-0 flex-1 flex-col overflow-hidden", shown && "flex")}
            >
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
                {...(shown ? { copilotOpen, onCopilotOpenChange: setCopilotOpen } : {})}
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
          <div className="flex bg-canvas pb-24">
            <div className="min-w-0 flex-1">
              <div className="mx-4 mt-4">
                <KitMergedConfigTable
                  pod={pod}
                  members={members}
                  costed={costed}
                  onFocusLine={focusLine}
                  onOpenMember={(id) => setView(memberView(id))}
                />
              </div>
            </div>
            {copilotOpen && (
              /* The merged view scrolls with the page, so the panel sticks to
                 the viewport instead of scrolling off with the table. */
              <div className="sticky top-0 h-screen w-[360px] shrink-0 self-start">
                <CopilotPanel
                  context={kitContext}
                  onClose={() => setCopilotOpen(false)}
                  onApply={() => toast("Open an article's sheet to apply this")}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
