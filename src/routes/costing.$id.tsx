/**
 * Costing Report — step 2 of the workflow.
 *
 * This address used to host the old node-canvas configurator, with the report
 * opened on top of it when `report=true` was present. That is why any link to
 * the Costing stage without that flag landed on a screen the workspace had
 * already replaced with the costing sheet.
 *
 * There is now one place to configure and cost an article — the sheet at
 * `/config/:podId/:articleId` — and this address is the report over it.
 * Anything arriving here without a report to show is sent to the sheet rather
 * than shown a second, older way of doing the same job.
 */

import { createFileRoute, notFound, redirect, useNavigate } from "@tanstack/react-router";

import { SRFS, INQUIRIES } from "@/lib/inquiries-data";
import { getPod, podIdForSrf, usePod } from "@/lib/podsStore";
import { CostingReportWorkspace } from "@/components/config/CostingReportWorkspace";

/** `"£4.80 FOB"` → 4.8. The report prices against a number. */
function targetPriceOf(input: string): number {
  return parseFloat(input.replace(/[^\d.]/g, "")) || 0;
}

/** The POD and article this costing reference belongs to. */
function resolve(srfId: string, search: { podId?: string; articleId?: string }) {
  const podId = search.podId ?? podIdForSrf(srfId);
  const pod = podId ? getPod(podId) : undefined;
  const article =
    pod?.articles.find((a) => a.id === search.articleId) ??
    pod?.articles.find((a) => a.srfRef === srfId) ??
    pod?.articles[0];
  return { podId, pod, article };
}

export const Route = createFileRoute("/costing/$id")({
  validateSearch: (
    s: Record<string, unknown>,
  ): {
    mode?: "approved" | "edit";
    approvalId?: string;
    report?: boolean;
    approval?: boolean;
    podId?: string;
    sel?: string;
    articleId?: string;
  } => ({
    mode:
      s.mode === "approved"
        ? ("approved" as const)
        : s.mode === "edit"
          ? ("edit" as const)
          : undefined,
    approvalId: typeof s.approvalId === "string" ? s.approvalId : undefined,
    report: s.report === "1" || s.report === true ? true : undefined,
    approval: s.approval === "1" || s.approval === true ? true : undefined,
    podId: typeof s.podId === "string" ? s.podId : undefined,
    sel: typeof s.sel === "string" ? s.sel : undefined,
    articleId: typeof s.articleId === "string" ? s.articleId : undefined,
  }),

  /**
   * No report asked for means the user wants the costing itself, which lives
   * on the sheet. Redirecting here rather than rendering something else keeps
   * one screen for one job.
   */
  beforeLoad: ({ params, search }) => {
    if (search.report || search.approval) return;
    const { podId, article } = resolve(params.id, search);
    if (!podId || !article) return;
    throw redirect({
      to: "/config/$podId/$articleId",
      params: { podId, articleId: article.id },
      search: { sel: search.sel },
      replace: true,
    });
  },

  loader: ({ params }) => {
    const srf = SRFS.find((s) => s.id === params.id);
    if (!srf) throw notFound();
    return { srf, inquiry: INQUIRIES.find((i) => i.id === srf.inquiryId) };
  },

  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Costing Report · ${loaderData.srf.productName} · Tracon`
          : "Costing Report · Tracon",
      },
      {
        name: "description",
        content:
          "The costing of an article reviewed end to end — variants, financials, cost build-up and the decision to take it to quotation.",
      },
    ],
  }),

  component: CostingReportRoute,
  notFoundComponent: () => <div className="p-10 text-sm text-ink-500">POD not found.</div>,
});

function CostingReportRoute() {
  const { srf } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const podId = search.podId ?? podIdForSrf(srf.id);
  const pod = usePod(podId ?? "");
  const article =
    pod?.articles.find((a) => a.id === search.articleId) ??
    pod?.articles.find((a) => a.srfRef === srf.id) ??
    pod?.articles[0];

  const approved = Boolean(search.approvalId) || search.mode === "approved";

  return (
    <CostingReportWorkspace
      srfId={srf.id}
      productName={article?.name ?? srf.productName}
      buyer={pod?.buyer ?? srf.buyer}
      buyerRef={pod?.buyerRef}
      podRef={pod?.id ?? podId ?? srf.id}
      statusLabel={approved ? "Costing approved" : "Costing in progress"}
      updatedAt={article?.updatedAt}
      targetPriceUsd={targetPriceOf(srf.targetPrice) || 5.5}
      articles={pod?.articles.map((a) => ({ id: a.id, name: a.name, size: a.size, moq: a.moq }))}
      activeArticleId={article?.id}
      navPodId={pod?.id ?? podId}
      navArticleId={article?.id}
      initialApprovalOpen={search.approval === true}
      onSelectArticle={(id) =>
        navigate({
          to: "/costing/$id",
          params: { id: pod?.articles.find((a) => a.id === id)?.srfRef ?? srf.id },
          search: { ...search, articleId: id },
          replace: true,
        })
      }
      onClose={() =>
        pod && article
          ? navigate({
              to: "/config/$podId/$articleId",
              params: { podId: pod.id, articleId: article.id },
              search: { sel: search.sel },
            })
          : navigate({ to: "/pods" })
      }
    />
  );
}
