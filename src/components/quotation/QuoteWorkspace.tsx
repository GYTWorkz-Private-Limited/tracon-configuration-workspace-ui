/**
 * Quotation Workspace — the step after Costing Report.
 *
 * Not a separate module: same shell, same header, same workflow band, same
 * bottom article bar as Configuration and Costing. What changes is the
 * question being answered — Configuration asks "what does it cost to make",
 * this asks "what do we sell it for".
 *
 * Everything on screen is the COMMERCIALLY SELECTED version of a costing:
 * scenarios, variants, options, MOQs and cost figures all come from
 * Configuration & Costing and are re-derived on read. Nothing is re-costed
 * here and nothing is invented here.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, PackagePlus, Send } from "lucide-react";

import { ProductHeader } from "@/components/layout/ProductHeader";
import { WorkflowStepper } from "@/components/layout/WorkflowStepper";
import { ArticleTabsBar } from "@/components/layout/ArticleTabsBar";
import { ActionGroup } from "@/components/changes/FlowActions";
import { cn } from "@/lib/utils";
import { usePod, type Article, type Pod } from "@/lib/podsStore";
import { usd } from "@/lib/commercialProvisions";
import { buildsIn, scenariosIn, useCostingSelections } from "@/lib/costingSelectionStore";
import {
  buildById,
  parseMoq,
  parseSize,
  priceKit,
  priceLine,
  scenarioById,
} from "@/lib/quotationPricing";
import { addProducts, ensureQuoteFor, useQuoteDraft, type QuoteItem } from "@/lib/quoteDraftStore";
import { viewQuote, type ViewedItem } from "@/lib/quotationView";
import { QuoteItemCard } from "./QuoteItemCard";
import { ConfigLegend } from "./ConfigChips";
import { ArticleSelectionModal } from "./ArticleSelectionModal";
import { QuotationBenchmarkPanels } from "./QuotationBenchmarkPanels";
import { QuotationPreview } from "./QuotationPreview";
import { QuotationApprovalWorkspace } from "./QuotationApprovalWorkspace";

export function QuoteWorkspace({
  podId,
  articleId,
  sel,
}: {
  podId: string;
  articleId: string;
  sel?: string;
}) {
  const pod = usePod(podId);
  const draft = useQuoteDraft(podId);
  const selections = useCostingSelections();
  const [mounted, setMounted] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  // What is ON the quote is decided in the selection modal, so arriving here
  // only guarantees the draft exists — it never adds an article by itself.
  useEffect(() => {
    ensureQuoteFor(podId);
  }, [podId]);

  const selectedIds = sel ? sel.split(",").filter(Boolean) : (pod?.articles ?? []).map((a) => a.id);
  const sheets = (pod?.articles ?? []).filter((a) => selectedIds.includes(a.id));
  const article = pod?.articles.find((a) => a.id === articleId) ?? pod?.articles[0];

  const items = draft?.items ?? [];
  const totals = useQuoteTotals(podId, items);

  if (!pod || !article) {
    return (
      <div className="min-h-screen bg-canvas">
        <div className="mx-auto mt-20 max-w-[720px] rounded-lg border border-hairline bg-surface p-10 text-center">
          <p className="text-[14px] text-ink-500">POD "{podId}" not found.</p>
          <Link to="/pods" className="mt-3 inline-block text-brand-700 hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const quotedIds = new Set(items.map((i) => i.articleId));
  const canAddMore = pod.articles.some((a) => !quotedIds.has(a.id));

  // One priced view of the quote, shared by the workspace's own totals, the
  // customer preview and the approval report — nobody re-derives it.
  const views: ViewedItem[] = viewQuote(podId, items, selections);
  const benchmarkView = views.find((v) => v.item.articleId === article.id) ?? views[0];

  return (
    <div className="flex h-screen w-full flex-col bg-canvas">
      <ProductHeader
        pod={pod}
        article={article}
        mounted={mounted}
        totalCost={`USD ${totals.orderValueUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
        backTo={
          <Link
            to="/pods/$id"
            params={{ id: pod.id }}
            aria-label="Back to articles"
            className="rounded-md p-1 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        }
      >
        <ActionGroup>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <FileText className="h-4 w-4" /> Review Quotation
          </button>
          <button
            type="button"
            disabled={items.length === 0}
            onClick={() => setApprovalOpen(true)}
            title={items.length === 0 ? "Add at least one item to the quotation first" : undefined}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" /> Send for Approval
          </button>
        </ActionGroup>
      </ProductHeader>

      <WorkflowStepper
        active="Quotation"
        podId={pod.id}
        articleId={article.id}
        costingRef={article.srfRef}
        onStepClick={(step) => {
          if (step !== "Approval") return false;
          setApprovalOpen(true);
          return true;
        }}
      />

      <main className="min-h-0 flex-1 overflow-y-auto">
        <QuoteTotalsStrip pod={pod} totals={totals} itemCount={items.length} />

        <div className="mx-auto max-w-[1320px] px-6 py-4 lg:px-8">
          <ConfigLegend className="mb-3" />

          {items.length === 0 ? (
            <EmptyState onAdd={() => setAddOpen(true)} />
          ) : (
            <div className="space-y-5">
              {items.map((item, i) => (
                <QuoteItemCard key={item.id} podId={podId} item={item} index={i} />
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-ink-200 bg-surface/60 px-4 py-3.5">
              <p className="min-w-0 flex-1 text-[12.5px] text-ink-500">
                Each product stays independently priced. Combine articles into a kit in
                Configuration to quote them as one set.
              </p>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                disabled={!canAddMore}
                className="inline-flex items-center gap-1.5 rounded-md border border-brand-700 bg-brand-50 px-3.5 py-2 text-[12.5px] font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                <PackagePlus className="h-3.5 w-3.5" /> Add Product
              </button>
            </div>
          )}

          <p className="mt-3 text-[10.5px] text-ink-400">
            * Cost figures are pulled live from Configuration & Costing. Changing a scenario there
            moves this quotation — the quote never holds its own copy of a cost.
          </p>

          {benchmarkView && (
            <QuotationBenchmarkPanels
              buyer={pod.buyer}
              srfRef={benchmarkView.item.srfRef}
              productName={benchmarkView.item.name}
              sizeLabel={
                benchmarkView.kind === "kit"
                  ? `Set of ${benchmarkView.priced.members.length}`
                  : (benchmarkView.item.size ?? benchmarkView.priced.sizeLabel)
              }
              moq={
                benchmarkView.kind === "kit" ? benchmarkView.priced.sets : benchmarkView.priced.moq
              }
              currentPriceUsd={benchmarkView.priced.commercial.sellingUsd}
            />
          )}
        </div>
      </main>

      <ArticleTabsBar
        podId={pod.id}
        articles={sheets}
        activeId={article.id}
        sel={sel}
        fixed={false}
        stage="Quotation"
        actions={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={!canAddMore}
            className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <PackagePlus className="h-3.5 w-3.5 text-ink-400" /> Add product to quote
          </button>
        }
      />

      {/* The same selection surface the Costing Report opens, so readiness
          behaves identically wherever an article joins a quotation. */}
      <ArticleSelectionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        podId={podId}
        articles={pod.articles}
        alreadyQuotedIds={quotedIds}
        confirmLabel="Add to Quotation"
        onConfirm={(ids) => {
          addProducts(podId, ids);
          setAddOpen(false);
        }}
      />

      {/* Three views, one quotation: `views` is the same priced data this
          page renders above — the preview and the approval report only ever
          choose what to show from it, never recompute it. */}
      <QuotationPreview
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        pod={pod}
        views={views}
        onSendForApproval={() => {
          setPreviewOpen(false);
          setApprovalOpen(true);
        }}
      />

      {approvalOpen && (
        <QuotationApprovalWorkspace
          pod={pod}
          articleId={article.id}
          costingRef={article.srfRef}
          views={views}
          onClose={() => setApprovalOpen(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Totals
 * ------------------------------------------------------------------ */

type Totals = { orderValueUsd: number; lines: number; blendedMarginPct: number };

/**
 * The quote's headline numbers, re-derived from the same pricing calls the
 * cards make so the strip can never disagree with the sections below it.
 */
function useQuoteTotals(podId: string, items: QuoteItem[]): Totals {
  const selections = useCostingSelections();
  return useMemo(() => {
    let orderValueUsd = 0;
    let costUsd = 0;
    let lines = 0;

    for (const item of items) {
      if (item.kind === "kit") {
        const kit = priceKit(
          item.members.map((m) => ({
            srfRef: m.srfRef,
            scenario: scenarioById(scenariosIn(selections, podId, m.articleId), m.line.scenarioId),
            build: buildById(buildsIn(selections, podId, m.articleId), m.line.buildId),
            defaults: { size: parseSize(m.size), moq: parseMoq(m.moq) },
            rates: item.rates,
            targetMarginPct: m.line.targetMarginPct,
            moqOverride: m.line.moqOverride,
            unitsPerSet: m.unitsPerSet,
            name: m.name,
            articleId: m.articleId,
            image: m.image,
          })),
          { rates: item.rates, targetMarginPct: item.targetMarginPct, sets: item.sets },
        );
        orderValueUsd += kit.orderValueUsd;
        costUsd += kit.commercial.finalCostUsd * kit.sets;
        lines += item.members.length;
        continue;
      }

      const line = item.lines.find((l) => l.id === item.quotedLineId) ?? item.lines[0];
      if (!line) continue;
      const priced = priceLine({
        srfRef: item.srfRef,
        scenario: scenarioById(scenariosIn(selections, podId, item.articleId), line.scenarioId),
        build: buildById(buildsIn(selections, podId, item.articleId), line.buildId),
        defaults: { size: parseSize(item.size), moq: parseMoq(item.moq) },
        rates: item.rates,
        targetMarginPct: line.targetMarginPct ?? item.targetMarginPct,
        moqOverride: line.moqOverride,
      });
      orderValueUsd += priced.orderValueUsd;
      costUsd += priced.commercial.finalCostUsd * priced.moq;
      lines += item.lines.length;
    }

    return {
      orderValueUsd: Math.round(orderValueUsd * 100) / 100,
      lines,
      blendedMarginPct:
        orderValueUsd > 0 ? Math.round(((orderValueUsd - costUsd) / orderValueUsd) * 1000) / 10 : 0,
    };
  }, [podId, items, selections]);
}

function QuoteTotalsStrip({
  pod,
  totals,
  itemCount,
}: {
  pod: Pod;
  totals: Totals;
  itemCount: number;
}) {
  const cells = [
    { label: "Buyer", value: pod.buyer, note: pod.buyerRef },
    { label: "Items quoted", value: String(itemCount), note: `${totals.lines} configured lines` },
    {
      label: "Blended margin",
      value: `${totals.blendedMarginPct.toFixed(1)}%`,
      note: "across the quote",
    },
    {
      label: "Total order value",
      value: usd(totals.orderValueUsd, 0),
      note: "at quoted quantities",
      strong: true,
    },
  ];

  return (
    <div className="border-b border-hairline bg-surface px-6 lg:px-8">
      <dl className="mx-auto grid max-w-[1320px] grid-cols-2 gap-px bg-hairline lg:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className="bg-surface px-4 py-3">
            <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-500">
              {c.label}
            </dt>
            <dd
              className={cn(
                "mt-0.5 truncate tabular-nums",
                c.strong ? "text-[19px] font-semibold text-brand-800" : "text-[15px] text-ink-900",
              )}
            >
              {c.value}
            </dd>
            <dd className="text-[11px] text-ink-400">{c.note}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-200 bg-surface px-6 py-14 text-center">
      <h2 className="text-[15px] font-semibold text-ink-900">Nothing on this quotation yet</h2>
      <p className="mx-auto mt-1 max-w-[440px] text-[12.5px] text-ink-500">
        Add a costed product, set or kit. Everything you add keeps the scenarios, variants, options
        and MOQs it was costed with.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        <PackagePlus className="h-4 w-4" /> Add Product
      </button>
    </div>
  );
}

export type { Article };
