/**
 * Quotations — every quotation in the workspace, in one list.
 *
 * The workflow builds a quotation inside a POD, which is the right place to
 * BUILD one and the wrong place to find one later. This is the register: what
 * exists, which version each is on, what it is worth, and a way straight back
 * into it.
 *
 * It owns no data. Composition comes from `quoteDraftStore`, versions and the
 * audit from `quotationHistory`, and the money is re-derived by `viewQuote` —
 * the same read the workspace uses, so a row here can never quote a different
 * figure from the quotation it links to.
 */

import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileText, Lock, Pencil } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { cn } from "@/lib/utils";
import { usd } from "@/lib/commercialProvisions";
import { usePods } from "@/lib/podsStore";
import { useCostingSelections } from "@/lib/costingSelectionStore";
import { useAllQuoteDrafts } from "@/lib/quoteDraftStore";
import { latestVersion, useAllQuotationHistories } from "@/lib/quotationHistory";
import { totalsOf, viewQuote } from "@/lib/quotationView";
import { VersionStatusPill } from "@/components/quotation/QuotationHistoryPanel";

export const Route = createFileRoute("/quotations/")({
  head: () => ({
    meta: [
      { title: "Quotations · Tracon" },
      {
        name: "description",
        content:
          "Every quotation in the workspace — what it contains, which version it is on, and what it is worth.",
      },
    ],
  }),
  component: QuotationsList,
});

function QuotationsList() {
  // Quotations live in the browser store, which is empty during the server
  // render — so "no quotations yet" must wait for hydration, or a workspace
  // full of them flashes an empty state on every load.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const pods = usePods();
  const drafts = useAllQuoteDrafts();
  const histories = useAllQuotationHistories();
  const selections = useCostingSelections();

  const rows = drafts
    .map((draft) => {
      const pod = pods.find((p) => p.id === draft.podId);
      const views = viewQuote(draft.podId, draft.items, selections);
      const history = histories[draft.id];
      return {
        draft,
        pod,
        views,
        history,
        version: history ? latestVersion(history) : undefined,
        locked: history?.locked ?? false,
        totals: totalsOf(views),
      };
    })
    .filter((r) => r.pod)
    .sort((a, b) => b.draft.updatedAt.localeCompare(a.draft.updatedAt));

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-6 py-6 lg:px-8">
        <header className="mb-5">
          <h1 className="text-[20px] font-semibold text-ink-900">Quotations</h1>
          <p className="mt-1 text-[13px] text-ink-500">
            Every quotation built from a costing. Figures are re-derived live from Configuration &
            Costing — a quotation is never a stored copy of a price.
          </p>
        </header>

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
          <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
            <table className="w-full text-[13px]">
              <caption className="sr-only">All quotations</caption>
              <thead>
                <tr className="border-b border-hairline bg-surface-alt/60 text-[10px] uppercase tracking-[0.1em] text-ink-500">
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">
                    Quotation
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">
                    Items
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-left font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    Blended margin
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    Order value
                  </th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.draft.id} className="border-b border-hairline/70 last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink-900">{r.draft.id}</div>
                      <div className="text-[11.5px] text-ink-500">
                        {r.pod!.buyer} · {r.pod!.id}
                      </div>
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

                    <td className="px-4 py-3">
                      {r.version ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11.5px] font-medium text-ink-700">
                            v{r.version.no}
                          </span>
                          <VersionStatusPill status={r.version.status} />
                          {!r.locked && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-ink-500">
                              <Pencil className="h-3 w-3" aria-hidden /> v{r.version.no + 1} open
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2 py-0.5 text-[10.5px] font-medium text-ink-600">
                          <Pencil className="h-3 w-3" aria-hidden /> Draft
                        </span>
                      )}
                      {r.draft.items.some((i) => i.rejected) && (
                        <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-amber-900">
                          Waiting on recosting
                        </span>
                      )}
                      {r.locked && (
                        <span className="mt-1 flex items-center gap-1 text-[11px] text-ink-400">
                          <Lock className="h-3 w-3" aria-hidden /> Read-only
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right tabular-nums text-ink-700">
                      {r.totals.blendedMarginPct.toFixed(1)}%
                    </td>

                    <td className="px-4 py-3 text-right text-[15px] font-semibold tabular-nums text-ink-900">
                      {usd(r.totals.orderValueUsd, 0)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {r.draft.mode === "multiple" ? (
                        <Link
                          to="/quotations/$quotationId"
                          params={{ quotationId: r.draft.id }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                        >
                          Open <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <Link
                          to="/quotation/$podId/$articleId"
                          params={{
                            podId: r.draft.podId,
                            articleId: r.draft.items[0]?.articleId ?? "",
                          }}
                          search={{ sel: undefined }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                        >
                          Open <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
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
