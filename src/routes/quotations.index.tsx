/**
 * Quotations — every quotation in the workspace, in one list.
 *
 * The workflow builds a quotation inside a POD, which is the right place to
 * BUILD one and the wrong place to find one later. This is the register: what
 * exists, what stage each is at, what it is worth, and a way straight back
 * into it.
 *
 * It owns no data. Composition comes from `quoteDraftStore`, stage from
 * `quotationLifecycle`, versions from `quotationHistory`, and the money is
 * re-derived by `viewQuote` — the same read the workspace uses, so a row here
 * can never quote a different figure from the quotation it links to.
 */

import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, FileText, Lock } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { cn } from "@/lib/utils";
import { usd } from "@/lib/commercialProvisions";
import { usePods } from "@/lib/podsStore";
import { useCostingSelections } from "@/lib/costingSelectionStore";
import { useAllQuoteDrafts } from "@/lib/quoteDraftStore";
import { latestVersion, useAllQuotationHistories } from "@/lib/quotationHistory";
import { useQuotationApprovals } from "@/lib/quotationApprovalStore";
import { stateFrom, type QuotationStage } from "@/lib/quotationLifecycle";
import { totalsOf, viewQuote } from "@/lib/quotationView";
import { commercialHealth } from "@/lib/quotationReview";

export const Route = createFileRoute("/quotations/")({
  head: () => ({
    meta: [
      { title: "Quotations · Tracon" },
      {
        name: "description",
        content:
          "Every quotation in the workspace — what it contains, what stage it is at, and what it is worth.",
      },
    ],
  }),
  component: QuotationsList,
});

/* ------------------------------------------------------------------ *
 * Filters
 * ------------------------------------------------------------------ */

type Filter = "all" | QuotationStage | "at_risk";

const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  quotation: "Draft",
  approval: "In Approval",
  approved: "Approved",
  changes: "Changes Requested",
  at_risk: "At Risk",
};

const FILTERS: Filter[] = ["all", "quotation", "approval", "approved", "changes", "at_risk"];

const STAGE_TONE: Record<QuotationStage, string> = {
  quotation: "border-hairline bg-surface-alt text-ink-600",
  approval: "border-gold-500/40 bg-gold-50 text-gold-700",
  approved: "border-brand-600/30 bg-brand-50 text-brand-700",
  changes: "border-[var(--color-risk)]/30 bg-[var(--color-risk-soft)] text-[var(--color-risk)]",
};

function QuotationsList() {
  // Quotations live in the browser store, which is empty during the server
  // render — so "no quotations yet" must wait for hydration, or a workspace
  // full of them flashes an empty state on every load.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [filter, setFilter] = useState<Filter>("all");

  const pods = usePods();
  const drafts = useAllQuoteDrafts();
  const histories = useAllQuotationHistories();
  const approvals = useQuotationApprovals();
  const selections = useCostingSelections();

  const rows = useMemo(
    () =>
      drafts
        .map((draft) => {
          const pod = pods.find((p) => p.id === draft.podId);
          const views = viewQuote(draft, selections);
          const history = histories[draft.id];
          const state = stateFrom(
            approvals[draft.id] ?? {
              podId: draft.id,
              submitted: false,
              assign: {},
              reviewStatus: {},
            },
            history ?? {
              quotationId: draft.id,
              versions: [],
              audit: [],
              comments: [],
              locked: false,
            },
          );
          const health = commercialHealth(views);
          return {
            draft,
            pod,
            views,
            state,
            health,
            version: history ? latestVersion(history) : undefined,
            locked: history?.locked ?? false,
            totals: totalsOf(views),
            // "At risk" is a commercial judgement, not a stage: a quotation
            // carrying a line below the review threshold, or one waiting on a
            // recosting, is exposed whatever the approval workflow says.
            atRisk: health.needsReview > 0 || draft.items.some((i) => i.rejected),
          };
        })
        .filter((r) => r.pod)
        .sort((a, b) => b.draft.updatedAt.localeCompare(a.draft.updatedAt)),
    [drafts, pods, histories, approvals, selections],
  );

  const counts: Record<Filter, number> = {
    all: rows.length,
    quotation: rows.filter((r) => r.state.stage === "quotation").length,
    approval: rows.filter((r) => r.state.stage === "approval").length,
    approved: rows.filter((r) => r.state.stage === "approved").length,
    changes: rows.filter((r) => r.state.stage === "changes").length,
    at_risk: rows.filter((r) => r.atRisk).length,
  };

  const visible = rows.filter((r) =>
    filter === "all" ? true : filter === "at_risk" ? r.atRisk : r.state.stage === filter,
  );

  /** Where a quotation opens: its own workspace, or the article's page. */
  const openLink = (r: (typeof rows)[number]) =>
    r.draft.mode === "multiple"
      ? ({ to: "/quotations/$quotationId", params: { quotationId: r.draft.id } } as const)
      : ({
          to: "/quotation/$podId/$articleId",
          params: { podId: r.draft.podId, articleId: r.draft.items[0]?.articleId ?? "" },
          search: { sel: undefined },
        } as const);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-6 py-6 lg:px-8">
        <header className="mb-4">
          <h1 className="text-[20px] font-semibold text-ink-900">Quotations</h1>
          <p className="mt-1 text-[13px] text-ink-500">
            Every quotation built from a costing. Figures are re-derived live from Configuration &
            Costing — a quotation is never a stored copy of a price.
          </p>
        </header>

        {rows.length > 0 && (
          <div
            className="mb-4 flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Filter"
          >
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                  filter === f
                    ? "border-ink-900 bg-ink-900 font-semibold text-white"
                    : "border-hairline bg-surface text-ink-600 hover:bg-surface-alt hover:text-ink-900",
                )}
              >
                {f === "at_risk" && (
                  <AlertTriangle
                    className={cn("h-3 w-3", filter === f ? "text-white" : "text-gold-600")}
                    aria-hidden
                  />
                )}
                {FILTER_LABEL[f]}
                <span
                  className={cn("tabular-nums", filter === f ? "text-white/70" : "text-ink-400")}
                >
                  {counts[f]}
                </span>
              </button>
            ))}
          </div>
        )}

        {rows.length === 0 && !hydrated ? (
          <div className="rounded-xl border border-hairline bg-surface px-6 py-14" aria-busy />
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ink-200 bg-surface px-6 py-14 text-center">
            <FileText className="mx-auto h-6 w-6 text-ink-300" aria-hidden />
            <h2 className="mt-3 text-[15px] font-semibold text-ink-900">No quotations yet</h2>
            <p className="mx-auto mt-1 max-w-[460px] text-[12.5px] text-ink-500">
              A quotation starts on a Costing Report: mark the costing{" "}
              <strong className="font-medium text-ink-700">Ready for Quotation</strong>, then
              continue to Quotation.
            </p>
            <Link
              to="/pods"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-800"
            >
              Go to Costing <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
            <table className="w-full min-w-[1040px] text-[13px]">
              <caption className="sr-only">All quotations</caption>
              <thead>
                <tr className="border-b border-hairline bg-surface-alt/60 text-[10px] uppercase tracking-[0.1em] text-ink-500">
                  <Th>Quote #</Th>
                  <Th>Buyer</Th>
                  <Th>Articles</Th>
                  <Th align="right">Quote value</Th>
                  <Th align="right">Margin</Th>
                  <Th align="right">Lines at risk</Th>
                  <Th>Stage</Th>
                  <Th align="right">
                    <span className="sr-only">Open</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-[12.5px] text-ink-500">
                      No quotations at this stage.
                    </td>
                  </tr>
                )}

                {visible.map((r) => (
                  <tr key={r.draft.id} className="border-b border-hairline/70 last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-900">{r.draft.id}</div>
                      <div className="text-[11.5px] text-ink-500">
                        {r.draft.mode === "multiple" ? "Consolidated" : "Single article"}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="text-ink-900">{r.pod!.buyer}</div>
                      <div className="text-[11.5px] text-ink-500">{r.pod!.id}</div>
                    </td>

                    <td className="px-4 py-3">
                      <ul className="flex flex-wrap gap-1">
                        {r.draft.items.map((i) => (
                          <li
                            key={i.id}
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[11px] font-medium",
                              i.kind === "kit"
                                ? "bg-[var(--color-cfg-soft)] text-[var(--color-cfg-strong)]"
                                : "bg-ink-100 text-ink-700",
                            )}
                          >
                            {i.kind === "kit" ? `Kit — ${i.name}` : i.name}
                          </li>
                        ))}
                      </ul>
                    </td>

                    <td className="px-4 py-3 text-right text-[15px] font-semibold tabular-nums text-ink-900">
                      {usd(r.totals.orderValueUsd, 0)}
                    </td>

                    <td
                      className={cn(
                        "px-4 py-3 text-right tabular-nums",
                        r.totals.blendedMarginPct < 0 ? "text-[var(--color-risk)]" : "text-ink-700",
                      )}
                    >
                      {r.totals.blendedMarginPct.toFixed(1)}%
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums">
                      {r.atRisk ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-gold-500/40 bg-gold-50 px-2 py-0.5 text-[11px] font-semibold text-gold-700">
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                          {r.health.needsReview || "recost"}
                        </span>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
                          STAGE_TONE[r.state.stage],
                        )}
                      >
                        {r.state.label}
                      </span>
                      {r.version && (
                        <div className="mt-1 text-[11px] text-ink-500">
                          v{r.version.no}
                          {r.state.submitted && r.state.reviewerCount > 0 && (
                            <>
                              {" · "}
                              {r.state.approvedCount}/{r.state.reviewerCount} approved
                            </>
                          )}
                        </div>
                      )}
                      {r.locked && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-ink-400">
                          <Lock className="h-3 w-3" aria-hidden /> Read-only
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <Link
                        {...openLink(r)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                      >
                        Open <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={cn("px-4 py-2.5 font-medium", align === "right" ? "text-right" : "text-left")}
    >
      {children}
    </th>
  );
}
