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
 * also the navigation: a column header opens that member's full sheet, a cell
 * opens its component's master in a drawer over the table (with the full sheet
 * one click further), and "Merged view" in the band comes back.
 *
 * Every member's sheet stays mounted through all of it. That is deliberate:
 * the merged table renders from the roll-ups those sheets report, and
 * unmounting one would throw away its scenarios, variants and options the
 * moment you looked elsewhere.
 */

import { useCallback, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { createMoney } from "@/lib/money";
import type { Article, Pod } from "@/lib/podsStore";
import {
  ArticleCostingWorkspace,
  type ArticleCosting,
} from "@/components/workspace/ArticleCostingWorkspace";
import { ComponentInspector, LineOptionPanel } from "@/components/workspace/ComponentInspector";
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
  // Jumping to a member's sheet carries a target line with it. The nonce makes
  // the same line jumpable twice — the inspector may have been closed since —
  // without the signal object churning on unrelated renders.
  const [focus, setFocus] = useState<{ memberId: string; componentId: string; nonce: number }>();
  /**
   * The component a merged-table click is inspecting. A row click should not
   * cost the reader their place in the set — so instead of navigating to the
   * member's sheet, the clicked line's component master opens in a drawer OVER
   * the table, and the full sheet stays one deliberate click further away.
   */
  const [inspect, setInspect] = useState<{
    memberId: string;
    componentId: string;
    /** the exact clicked line — names WHICH of the component's choices to offer */
    lineId?: string;
  } | null>(null);

  // Members report their roll-up as they change. A stable callback keeps the
  // child effect from re-firing on every parent render.
  const report = useCallback((summary: ArticleCosting) => {
    setCosted((prev) =>
      prev[summary.articleId]?.rollup === summary.rollup
        ? prev
        : { ...prev, [summary.articleId]: summary },
    );
  }, []);

  const focusLine = useCallback((memberId: string, componentId: string, lineId?: string) => {
    setInspect({ memberId, componentId, lineId });
  }, []);

  /** The drawer's escape hatch: the member's full sheet, opened on this line. */
  const openMemberSheet = useCallback((memberId: string, componentId: string) => {
    setInspect(null);
    setFocus((prev) => ({ memberId, componentId, nonce: (prev?.nonce ?? 0) + 1 }));
    setView(memberView(memberId));
  }, []);

  // Configuration costs in ₹; the drawer reads the same numbers the table shows.
  const money = useMemo(() => createMoney("INR", 1), []);

  // Resolved fresh from the member's live rollup on every render, so an
  // option applied in the drawer re-reads its own consequence immediately.
  const inspected = inspect
    ? (costed[inspect.memberId]?.rollup.components.find(
        (c) => c.component.id === inspect.componentId,
      ) ?? null)
    : null;
  const inspectedMember = inspect ? members.find((m) => m.id === inspect.memberId) : undefined;
  // The inspected component's configurable line — the drawer's option cards
  // are this choice, committed through the member's own published action.
  const inspectedCosting = inspect ? costed[inspect.memberId] : undefined;
  const inspectedLine =
    inspect && inspectedCosting
      ? (inspectedCosting.sections
          .flatMap((s) => s.lines)
          .find((l) => l.id === inspect.lineId && l.optionGroup && l.target) ??
        inspectedCosting.sections
          .flatMap((s) => s.lines)
          .find((l) => l.componentId === inspect.componentId && l.optionGroup && l.target))
      : undefined;

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

            {/* The component master, as a drawer over the merged table. The
                inspector is the SAME right column the member's own sheet
                shows, so a component answers "what is this made of, how much,
                what does it come to" identically from either door. */}
            {inspect && (inspected || inspectedLine) && (
              <div className="fixed inset-0 z-50 flex">
                <div
                  className="flex-1 bg-ink-900/30 backdrop-blur-[1px]"
                  onClick={() => setInspect(null)}
                  aria-hidden
                />
                <div className="flex h-full shrink-0 flex-col bg-surface shadow-2xl">
                  <div className="min-h-0 flex-1">
                    {!inspected && inspectedLine ? (
                      <LineOptionPanel
                        title={inspectedLine.name}
                        context={`${inspectedMember?.name ?? ""} · ${inspectedLine.context}`}
                        picker={{
                          group: inspectedLine.optionGroup!,
                          onPick: (optionId) =>
                            inspectedCosting!.actions.selectOption(
                              inspectedLine.kind,
                              inspectedLine.target!.componentId,
                              inspectedLine.target!.itemId,
                              optionId,
                            ),
                        }}
                        onClose={() => setInspect(null)}
                      />
                    ) : (
                    <ComponentInspector
                      resolved={inspected}
                      productName={inspectedMember?.name ?? ""}
                      scenarioName={costed[inspect.memberId]?.scenarioName ?? ""}
                      money={money}
                      picker={
                        inspectedLine?.optionGroup && inspectedLine.target && inspectedCosting
                          ? {
                              group: inspectedLine.optionGroup,
                              onPick: (optionId) =>
                                inspectedCosting.actions.selectOption(
                                  inspectedLine.kind,
                                  inspectedLine.target!.componentId,
                                  inspectedLine.target!.itemId,
                                  optionId,
                                ),
                            }
                          : undefined
                      }
                      onClose={() => setInspect(null)}
                    />
                    )}
                  </div>
                  {/* The trip the click used to make, kept one step away. */}
                  <button
                    type="button"
                    onClick={() => openMemberSheet(inspect.memberId, inspect.componentId)}
                    className="flex shrink-0 items-center justify-center gap-1.5 border-t border-hairline bg-surface-alt/60 px-4 py-2.5 text-[12px] font-medium text-brand-700 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700"
                  >
                    Open {inspectedMember?.name ?? "member"}&rsquo;s full sheet on this line
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            )}
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
