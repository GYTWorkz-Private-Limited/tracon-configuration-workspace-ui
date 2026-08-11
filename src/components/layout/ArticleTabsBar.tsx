// Shared bottom article tab bar — consistent across Product, Configuration,
// Costing and Quotation. Each tab navigates to that article's own stage.
// Set/kit quotations render as extra tabs after the articles.

import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Layers, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePod } from "@/lib/podsStore";
import { removeKit, useQuoteWorkspace } from "@/lib/quotationWorkspace";
import {
  isPendingApproval,
  recordStage,
  stageOf,
  useArticleFlow,
  type FlowStage,
} from "@/lib/articleFlow";

export type TabArticle = { id: string; name: string; srfRef: string };

function linkFor(podId: string, a: TabArticle, stage: FlowStage, sel?: string) {
  if (stage === "Product")
    return {
      to: "/product/$podId/$articleId",
      params: { podId, articleId: a.id },
      search: { sel },
    } as const;
  if (stage === "Configuration")
    return {
      to: "/config/$podId/$articleId",
      params: { podId, articleId: a.id },
      search: { sel },
    } as const;
  if (stage === "Quotation")
    return {
      to: "/quotation/$podId/$articleId",
      params: { podId, articleId: a.id },
      search: { sel },
    } as const;
  if (stage === "Approval")
    return {
      to: "/costing/$id",
      params: { id: a.srfRef },
      search: { podId, articleId: a.id, report: true, approval: true },
    } as const;
  return {
    to: "/costing/$id",
    params: { id: a.srfRef },
    search: { podId, articleId: a.id },
  } as const;
}

export function ArticleTabsBar({
  podId,
  articles,
  activeId,
  sel,
  actions,
  fixed = true,
  stage,
  activeKitId,
}: {
  podId: string;
  articles: TabArticle[];
  activeId: string;
  sel?: string;
  /** Right-aligned slot (e.g. set/kit button). */
  actions?: React.ReactNode;
  fixed?: boolean;
  /** Stage of the screen rendering this bar — advances the demo flow. */
  stage?: FlowStage;
  /** Highlighted set/kit tab, when a combined quotation is open. */
  activeKitId?: string;
}) {
  const { reached } = useArticleFlow();
  const { kits } = useQuoteWorkspace();
  const activeName = articles.find((a) => a.id === activeId)?.name ?? "";
  useEffect(() => {
    if (stage && activeName && !isPendingApproval(activeName)) recordStage(stage);
  }, [stage, activeName]);
  const kitTarget = articles[0];
  return (
    <div
      className={cn(
        "border-t border-hairline bg-surface",
        fixed ? "fixed bottom-0 left-0 right-0 z-20" : "shrink-0",
      )}
    >
      <div className="flex items-center gap-2 px-6 py-2.5 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {articles.map((a) => {
            const active = a.id === activeId && !activeKitId;
            const aStage = stageOf(a, reached);
            return (
              <Link
                key={a.id}
                {...linkFor(podId, a, aStage, sel)}
                title={`${a.name} · ${aStage}`}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors",
                  active
                    ? "border-hairline bg-surface font-medium text-ink-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                    : "border-transparent text-ink-500 hover:bg-surface-alt hover:text-ink-900",
                )}
              >
                {a.name}
                {isPendingApproval(a.name) && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                    In approval
                  </span>
                )}
              </Link>
            );
          })}

          {/* Set / kit quotation tabs — quotation only, no product/config stages */}
          {kitTarget &&
            kits.map((k) => {
              const active = k.id === activeKitId;
              return (
                <span
                  key={k.id}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] transition-colors",
                    active
                      ? "border-hairline bg-surface font-medium text-ink-900 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                      : "border-transparent text-ink-500 hover:bg-surface-alt hover:text-ink-900",
                  )}
                >
                  <Link
                    to="/quotation/$podId/$articleId"
                    params={{ podId, articleId: kitTarget.id }}
                    search={{ sel, kit: k.id }}
                    title={`${k.name} · Quotation only`}
                    className="flex items-center gap-1.5"
                  >
                    <Layers className="h-3.5 w-3.5 text-brand-700" />
                    {k.name}
                    <span className="rounded bg-ink-100 px-1 text-[10.5px] tabular-nums text-ink-600">
                      {k.articleIds.length}
                    </span>
                  </Link>
                  <button
                    onClick={() => removeKit(k.id)}
                    aria-label={`Remove ${k.name}`}
                    className="rounded p-0.5 text-ink-400 hover:bg-ink-100 hover:text-ink-900"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Tabs bar that resolves the POD's articles itself (for workspaces that only know ids). */
export function PodArticleTabs({
  podId,
  activeId,
  stage,
  fixed = false,
  actions,
}: {
  podId?: string;
  activeId?: string;
  stage?: FlowStage;
  fixed?: boolean;
  actions?: React.ReactNode;
}) {
  const pod = usePod(podId ?? "");
  if (!pod) return null;
  const articles = pod.articles.map((a) => ({ id: a.id, name: a.name, srfRef: a.srfRef }));
  return (
    <ArticleTabsBar
      podId={pod.id}
      articles={articles}
      activeId={activeId ?? articles[0]?.id ?? ""}
      stage={stage}
      fixed={fixed}
      actions={actions}
    />
  );
}
