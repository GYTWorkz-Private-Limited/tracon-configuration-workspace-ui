/**
 * The article's own Quotation step.
 *
 * Not a separate module: same shell, same header, same workflow band, same
 * bottom article bar as Configuration and Costing. What changes is the
 * question being answered — Configuration asks "what does it cost to make",
 * this asks "what do we sell it for".
 *
 * It always shows ONE article's quotation. When that article is quoted on its
 * own, this is the whole quotation. When it was quoted together with others,
 * this still shows only its own position, plus the number of the parent
 * quotation it belongs to and a way into it — because "Placemat's quotation"
 * and "the quotation Placemat happens to be on" are different things, and
 * stacking the second under the first is what made multi-product quotes
 * unreadable.
 *
 * Everything on screen is the COMMERCIALLY SELECTED version of a costing:
 * scenarios, variants, options, MOQs and cost figures all come from
 * Configuration & Costing and are re-derived on read. Nothing is re-costed
 * here and nothing is invented here.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, FileText, History, Layers, Send } from "lucide-react";

import { ProductHeader } from "@/components/layout/ProductHeader";
import { WorkflowStepper } from "@/components/layout/WorkflowStepper";
import { ArticleTabsBar } from "@/components/layout/ArticleTabsBar";
import { ActionGroup } from "@/components/changes/FlowActions";
import { cn } from "@/lib/utils";
import { usePod, type Article } from "@/lib/podsStore";
import { DEFAULT_PROVISIONS } from "@/lib/commercialProvisions";
import { useCostingSelections } from "@/lib/costingSelectionStore";
import {
  ratesFor,
  rejectSelection,
  resetQuotationRates,
  setQuotationRate,
  setQuotationTerms,
  useQuotationForArticle,
} from "@/lib/quoteDraftStore";
import { rejectQuotation } from "@/lib/quotationApprovalStore";
import { useQuotationState, type QuotationStage } from "@/lib/quotationLifecycle";
import { toast } from "sonner";
import { OverrideDialog } from "./OverrideDialog";
import { RejectDialog } from "./RejectDialog";
import { applyRowOverrides, rowsForItem } from "./quoteRows";
import {
  latestVersion,
  startNewVersion,
  useQuotationHistory,
  workingVersionNo,
  type VersionStatus,
} from "@/lib/quotationHistory";
import { totalsOf, viewQuote, type ViewedItem } from "@/lib/quotationView";
import { recordSnapshot, snapshotFromViews } from "@/lib/masterSnapshot";
import { QuotationRiskBanner } from "./QuotationRiskBanner";
import { QuotationLifecycleBar } from "./QuotationLifecycleBar";
import { CommercialAssumptions } from "./CommercialAssumptions";
import { WorkingSheet } from "./WorkingSheet";
import { CombinedSummary } from "./MultiQuotationWorkspace";
import { QuotationEntryFlow } from "./QuotationEntryFlow";
import { QuotationPreview } from "./QuotationPreview";
import { QuotationApprovalWorkspace } from "./QuotationApprovalWorkspace";
import { QuotationHistoryPanel, VersionStatusPill } from "./QuotationHistoryPanel";

export function QuoteWorkspace({
  podId,
  articleId,
  sel,
}: {
  podId: string;
  articleId: string;
  sel?: string;
}) {
  const navigate = useNavigate();
  const pod = usePod(podId);
  const quotation = useQuotationForArticle(podId, articleId);
  const history = useQuotationHistory(quotation?.id ?? "");
  const selections = useCostingSelections();
  /** the stage of the quotation this article sits on, if any */
  const qState = useQuotationState(quotation?.id ?? "");
  const [mounted, setMounted] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  /** the item whose override dialog is open; undefined means closed */
  const [overrideFor, setOverrideFor] = useState<string | undefined>(undefined);
  /** the item a rejection was started from; null means the whole quotation */
  const [rejectFor, setRejectFor] = useState<string | null | undefined>(undefined);

  useEffect(() => setMounted(true), []);

  const article = pod?.articles.find((a) => a.id === articleId) ?? pod?.articles[0];

  // Only this article's position, even when the quotation carries several.
  const items = useMemo(
    () => (quotation?.items ?? []).filter((i) => i.articleId === article?.id),
    [quotation, article?.id],
  );
  const views: ViewedItem[] = useMemo(
    () => (quotation ? viewQuote(quotation, selections, items) : []),
    [quotation, items, selections],
  );
  const totals = totalsOf(views);

  /* Same date-stamped master record the multi-article workspace keeps: a
     single-article quotation is no less exposed to a moving cotton market. */
  useEffect(() => {
    if (quotation && views.length > 0) {
      recordSnapshot(quotation.id, snapshotFromViews(views));
    }
  }, [quotation, views]);

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

  const sent = latestVersion(history);
  const locked = history.locked || !qState.editable;
  const companions = (quotation?.items ?? []).filter((i) => i.articleId !== article.id);
  const blocked = items.filter((i) => i.rejected);
  const isMulti = quotation?.mode === "multiple";

  // The same assumptions band the working sheet leads with — read through
  // `ratesFor` so it reports what the lines were actually priced under.
  const termsDays = quotation?.paymentTermsDays ?? 60;
  const liveRates = {
    ...DEFAULT_PROVISIONS,
    ...(quotation && items[0] ? ratesFor(quotation, items[0]) : {}),
  };
  const fxRate = views[0]?.priced.fxRate ?? 60;

  const overrideItem = items.find((i) => i.id === overrideFor);
  const overrideKitView = overrideItem
    ? views.find((v) => v.item.id === overrideItem.id)
    : undefined;

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
          {quotation && (
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              <History className="h-4 w-4" /> History
              {history.versions.length > 0 && (
                <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink-600">
                  v{history.versions.length}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            disabled={!quotation}
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <FileText className="h-4 w-4" /> Preview Quotation
          </button>
          {/* A multi-article quotation is sent as one document from its own
              workspace — sending "half of it" from here would be a second,
              conflicting approval for the same quotation. */}
          {isMulti ? (
            <Link
              to="/quotations/$quotationId"
              params={{ quotationId: quotation!.id }}
              search={{ action: undefined }}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-brand-800"
            >
              <Layers className="h-4 w-4" /> View Full Quotation
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : locked ? (
            <button
              type="button"
              onClick={() => quotation && startNewVersion(quotation.id)}
              title="Re-open this quotation to re-cost it as the next version"
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-brand-800"
            >
              <Send className="h-4 w-4" /> Create version {workingVersionNo(history)}
            </button>
          ) : (
            <button
              type="button"
              disabled={items.length === 0 || blocked.length > 0}
              onClick={() => setApprovalOpen(true)}
              title={
                blocked.length > 0
                  ? `${blocked.map((i) => i.name).join(", ")} ${blocked.length === 1 ? "is" : "are"} out for recosting — the quotation cannot be sent until ${blocked.length === 1 ? "it comes" : "they come"} back.`
                  : items.length === 0
                    ? "Quote this article first"
                    : undefined
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" /> Send for Approval
            </button>
          )}
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
        <div className="mx-auto max-w-[1320px] px-6 py-4 lg:px-8">
          {/* Where this quotation stands, said the same way the working sheet
              says it — this page IS that sheet, scoped to one article. */}
          {quotation && <QuotationLifecycleBar state={qState} className="mb-4" />}

          {/* ONE status banner. The version-sent facts fold into the stage
              statement rather than stacking a second band above it — the two
              banners that earn their place here are this one and the risk
              banner below. */}
          {quotation && (sent || companions.length > 0) && (
            <QuotationStatusBanner
              quotationId={quotation.id}
              companions={companions.map((c) => c.name)}
              articleName={article.name}
              stage={qState.stage}
              submitted={qState.submitted}
              sent={sent}
              locked={locked}
              nextVersion={workingVersionNo(history)}
              isMulti={Boolean(isMulti)}
              onHistory={() => setHistoryOpen(true)}
            />
          )}

          {items.length === 0 || !quotation ? (
            <EmptyState onQuote={() => setEntryOpen(true)} name={article.name} />
          ) : (
            <>
              {/* The recent working-sheet design, scoped to this article's
                  position: assumptions once, then the summary sheet with its
                  in-place drill-down, then the document's own summary. */}
              <CommercialAssumptions
                rates={liveRates}
                fxRate={fxRate}
                termsDays={termsDays}
                readOnly={locked}
                onRateChange={(id, value) => setQuotationRate(quotation.id, id, value)}
                onTermsChange={(d) => setQuotationTerms(quotation.id, d)}
                onReset={() => resetQuotationRates(quotation.id)}
              />

              <QuotationRiskBanner quotationId={quotation.id} />

              <WorkingSheet
                views={views}
                pod={pod}
                quotationId={quotation.id}
                readOnly={locked}
                onOverride={(itemId) => setOverrideFor(itemId)}
                onReject={(itemId) => setRejectFor(itemId)}
                onOpenContext={(id) =>
                  navigate({
                    to: "/config/$podId/$articleId",
                    params: { podId, articleId: id },
                    search: { sel: undefined },
                  })
                }
              />

              <CombinedSummary
                views={views}
                quotationId={quotation.id}
                orderValueUsd={totals.orderValueUsd}
                blendedMarginPct={totals.blendedMarginPct}
              />
            </>
          )}

          <p className="mt-3 pb-2 text-[10.5px] text-ink-400">
            * Cost figures are pulled live from Configuration & Costing. Changing a scenario there
            moves this quotation — the quote never holds its own copy of a cost.
          </p>
        </div>
      </main>

      <ArticleTabsBar
        podId={pod.id}
        articles={pod.articles}
        activeId={article.id}
        sel={sel}
        fixed={false}
        stage="Quotation"
      />

      <QuotationEntryFlow
        open={entryOpen}
        onClose={() => setEntryOpen(false)}
        podId={podId}
        articleId={article.id}
        articleName={article.name}
      />

      {quotation && (
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
      )}

      {historyOpen && quotation && (
        <QuotationHistoryPanel quotationId={quotation.id} onClose={() => setHistoryOpen(false)} />
      )}

      {/* The same two dialogs the consolidated workspace hosts — an approver
          deciding on a single-article quotation uses the same code path. */}
      {quotation && overrideItem && (
        <OverrideDialog
          articleName={overrideItem.name}
          rows={rowsForItem(
            quotation,
            overrideItem,
            selections,
            overrideKitView?.kind === "kit"
              ? {
                  priced: {
                    ...overrideKitView.priced.members[0],
                    commercial: overrideKitView.priced.commercial,
                  },
                  sets: overrideKitView.priced.sets,
                }
              : undefined,
          )}
          initialLineId={overrideItem.quotedLineId ?? overrideItem.lines[0]?.id ?? overrideItem.id}
          isKit={overrideItem.kind === "kit"}
          onClose={() => setOverrideFor(undefined)}
          onSave={(overrides, reason) => {
            applyRowOverrides(quotation.id, overrideItem, overrides, reason);
            setOverrideFor(undefined);
            toast.success(`${overrideItem.name} — override applied`);
          }}
        />
      )}

      {quotation && rejectFor !== undefined && (
        <RejectDialog
          quotationId={quotation.id}
          podId={pod.id}
          items={quotation.items}
          preselect={rejectFor ? [rejectFor] : quotation.items.map((i) => i.id)}
          onClose={() => setRejectFor(undefined)}
          onConfirm={(selection, reason) => {
            rejectSelection(quotation.id, selection, reason);
            if (qState.submitted) rejectQuotation(quotation.id);
            setRejectFor(undefined);
            toast.success("Sent back, with your reason recorded against the line");
          }}
        />
      )}

      {approvalOpen && quotation && (
        <QuotationApprovalWorkspace
          pod={pod}
          quotationId={quotation.id}
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
 * The one status banner
 * ------------------------------------------------------------------ */

/**
 * Where this quotation stands, in one band.
 *
 * This used to be two banners — "Version N sent" and "quoted with others" —
 * stacked above the sheet. They answered the same reader's question ("can I
 * still change this, and where does it live?"), so they are one statement now:
 * the stage leads, and the version facts and companions are its detail.
 */
function QuotationStatusBanner({
  quotationId,
  companions,
  articleName,
  stage,
  submitted,
  sent,
  locked,
  nextVersion,
  isMulti,
  onHistory,
}: {
  quotationId: string;
  companions: string[];
  articleName: string;
  stage: QuotationStage;
  submitted: boolean;
  /** the latest sent version, if any */
  sent?: { no: number; status: VersionStatus; sentBy: string; sentAt: string };
  locked: boolean;
  nextVersion: number;
  isMulti: boolean;
  onHistory: () => void;
}) {
  const withOthers = companions.length > 0;

  const { title, tone } = submitted
    ? stage === "approval" || stage === "changes"
      ? { title: "In approval", tone: "amber" as const }
      : stage === "approved"
        ? { title: "Approved", tone: "brand" as const }
        : { title: "Submitted", tone: "brand" as const }
    : sent
      ? { title: `Version ${sent.no} sent`, tone: "neutral" as const }
      : { title: "Quoted with other articles", tone: "neutral" as const };

  const detail = [
    withOthers
      ? `${articleName} is part of quotation ${quotationId} with ${companions.join(" and ")}, sent for approval as one document.`
      : null,
    sent
      ? `Version ${sent.no} sent by ${sent.sentBy} on ${new Date(sent.sentAt).toLocaleDateString()}${locked ? ` — read-only until version ${nextVersion} is opened` : ""}.`
      : submitted
        ? "The quotation is read-only while it is being reviewed."
        : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cn(
        "mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3",
        tone === "amber"
          ? "border-gold-500/40 bg-gold-50"
          : tone === "brand"
            ? "border-brand-600/30 bg-brand-50"
            : "border-hairline bg-surface",
      )}
    >
      <Layers className="h-4 w-4 shrink-0 text-ink-500" aria-hidden />
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink-900">
          {title}
          {sent && <VersionStatusPill status={sent.status} />}
        </p>
        <p className="mt-0.5 text-[11.5px] text-ink-600">{detail}</p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {sent && (
          <button
            type="button"
            onClick={onHistory}
            className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
          >
            View history
          </button>
        )}
        {isMulti && (
          <Link
            to="/quotations/$quotationId"
            params={{ quotationId }}
            search={{ action: undefined }}
            className="inline-flex items-center gap-1.5 rounded-md border border-brand-700 bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold text-brand-700 hover:bg-brand-100"
          >
            View Quotation <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onQuote, name }: { onQuote: () => void; name: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-200 bg-surface px-6 py-14 text-center">
      <h2 className="text-[15px] font-semibold text-ink-900">{name} is not quoted yet</h2>
      <p className="mx-auto mt-1 max-w-[440px] text-[12.5px] text-ink-500">
        Quote it on its own, or together with the other articles in this costing workspace. Whatever
        you quote keeps the scenarios, variants, options and MOQs it was costed with.
      </p>
      <button
        type="button"
        onClick={onQuote}
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        <Send className="h-4 w-4" /> Generate Quotation
      </button>
    </div>
  );
}

export type { Article };
