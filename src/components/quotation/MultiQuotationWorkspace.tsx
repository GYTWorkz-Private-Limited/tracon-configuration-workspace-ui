/**
 * The Quotation Working Sheet — a commercial review and approval workspace.
 *
 * This page does NOT build products. The articles, variants, MOQ breaks and
 * costs all arrive from Configuration & Costing already decided; what happens
 * here is the commercial pass over them: Review → Override → Approve / Reject
 * → send the quotation. Keeping creation out is what makes the separation
 * legible — Configuration answers "what is this and what does it cost", the
 * quotation answers "what do we sell it for, and do we stand behind that".
 *
 * The shape follows the working sheet the costing team already reads:
 *
 *   assumptions          — priced under these, stated once
 *     summary sheet      — one row per article, the comparison
 *       drill-down       — the full build-up, in place, on the row
 *   decision bar         — the three-way call, always in reach
 *
 * There is exactly one quotation object behind all of it: the `QuoteDraft`.
 * Every figure on this page is re-derived from it through `quotationView`, so
 * the sheet, the drill-down, the preview and the approval screen cannot
 * disagree with each other.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  FileText,
  History,
  Layers,
  Lock,
  MoreVertical,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { usePod } from "@/lib/podsStore";
import { DEFAULT_PROVISIONS, inr, pct, usd } from "@/lib/commercialProvisions";
import { useCostingSelections } from "@/lib/costingSelectionStore";
import {
  createRequote,
  ratesFor,
  rejectSelection,
  resetQuotationRates,
  revisionNo,
  setItemSellingPrice,
  setLineSellingPrice,
  setQuotationRate,
  setQuotationTerms,
  updateLine,
  useQuotation,
  type QuoteItem,
} from "@/lib/quoteDraftStore";
import {
  STATUS_LABEL,
  latestVersion,
  logQuotationEvent,
  startNewVersion,
  useQuotationHistory,
  workingVersionNo,
  type QuotationVersion,
} from "@/lib/quotationHistory";
import { totalsOf, viewQuote, type ViewedItem } from "@/lib/quotationView";
import { commercialHealth } from "@/lib/quotationReview";
import { useQuotationState, type QuotationState } from "@/lib/quotationLifecycle";
import { QuotationLifecycleBar } from "./QuotationLifecycleBar";
import { inrShort } from "@/lib/fabricRequirement";
import { requestRecost } from "@/lib/recostingStore";
import { approveQuotation, rejectQuotation } from "@/lib/quotationApprovalStore";
import { toast } from "sonner";
import { WorkingSheet } from "./WorkingSheet";
import { CommercialAssumptions } from "./CommercialAssumptions";
import { PreparationBar } from "./DecisionBar";
import { QuotationRiskBanner } from "./QuotationRiskBanner";
import { VersionInputCompare } from "./VersionInputCompare";
import { recordSnapshot, snapshotFromViews } from "@/lib/masterSnapshot";
import { QuotationPreview } from "./QuotationPreview";
import { QuotationApprovalWorkspace } from "./QuotationApprovalWorkspace";
import { QuotationHistoryPanel, VersionStatusPill } from "./QuotationHistoryPanel";
import { RequotePicker } from "./RequotePicker";
import { OverrideDialog, type RowOverride } from "./OverrideDialog";
import { RejectDialog } from "./RejectDialog";
import { applyRowOverrides, rowsForItem } from "./quoteRows";
import type { PaymentTermsDays } from "@/lib/quotationAssumptions";

export function MultiQuotationWorkspace({ quotationId }: { quotationId: string }) {
  const navigate = useNavigate();
  const quotation = useQuotation(quotationId);
  const pod = usePod(quotation?.podId ?? "");
  const history = useQuotationHistory(quotationId);
  const selections = useCostingSelections();
  /** which stage this quotation is at — decides what the page may offer */
  const qState = useQuotationState(quotationId);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [requoteOpen, setRequoteOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  /** the item whose override dialog is open; undefined means closed */
  const [overrideFor, setOverrideFor] = useState<string | undefined>(undefined);
  /** the item a rejection was started from; null means the whole quotation */
  const [rejectFor, setRejectFor] = useState<string | null | undefined>(undefined);

  const items = useMemo(() => quotation?.items ?? [], [quotation]);
  const views: ViewedItem[] = useMemo(
    () => (quotation ? viewQuote(quotation, selections) : []),
    [quotation, selections],
  );
  const totals = totalsOf(views);
  const health = commercialHealth(views);

  /* ---- masters this pricing referenced, date-stamped ----
     Recorded every time the quotation is read, so the snapshot always names
     the rates the figures on screen were actually built from. */
  useEffect(() => {
    if (quotation && views.length > 0) {
      recordSnapshot(quotation.id, snapshotFromViews(views));
    }
  }, [quotation, views]);

  if (!quotation || !pod) {
    return (
      <div className="min-h-screen bg-canvas">
        <div className="mx-auto mt-20 max-w-[720px] rounded-lg border border-hairline bg-surface p-10 text-center">
          <p className="text-[14px] text-ink-500">Quotation "{quotationId}" not found.</p>
          <Link to="/quotations" className="mt-3 inline-block text-brand-700 hover:underline">
            ← All quotations
          </Link>
        </div>
      </div>
    );
  }

  const sent = latestVersion(history);
  // A submitted quotation is frozen for the same reason a sent version is:
  // what a reviewer is looking at must not move under them.
  const locked = history.locked || !qState.editable;
  const blocked = items.filter((i) => i.rejected);
  const termsDays = quotation.paymentTermsDays ?? 60;

  // The rates actually in force. Read through `ratesFor` so the band reports
  // what the lines were priced under, rather than a parallel set of defaults.
  const liveRates = { ...DEFAULT_PROVISIONS, ...(items[0] ? ratesFor(quotation, items[0]) : {}) };
  const fxRate = views[0]?.priced.fxRate ?? 60;

  /** Leaving returns to the article the quotation was started from. */
  const close = () =>
    navigate({
      to: "/quotation/$podId/$articleId",
      params: { podId: quotation.podId, articleId: items[0]?.articleId ?? pod.articles[0].id },
      search: { sel: undefined },
    });

  const openCosting = (articleId: string) =>
    navigate({
      to: "/config/$podId/$articleId",
      params: { podId: quotation.podId, articleId },
      search: { sel: undefined },
    });

  const overrideItem = items.find((i) => i.id === overrideFor);
  const overrideKitView = overrideItem
    ? views.find((v) => v.item.id === overrideItem.id)
    : undefined;

  return (
    <div className="flex h-screen w-full flex-col bg-canvas">
      <Header
        quotationId={quotation.id}
        requoteOf={quotation.requoteOf}
        createdAt={quotation.createdAt}
        buyer={pod.buyer}
        podId={pod.id}
        sent={sent}
        locked={locked}
        qState={qState}
        blockedNames={blocked.map((i) => i.name)}
        itemCount={items.length}
        onSendForApproval={() => setApprovalOpen(true)}
        termsDays={termsDays}
        overflowOpen={overflowOpen}
        onOverflow={setOverflowOpen}
        onTerms={(d) => setQuotationTerms(quotation.id, d)}
        onPreview={() => setPreviewOpen(true)}
        onHistory={() => {
          setOverflowOpen(false);
          setHistoryOpen(true);
        }}
        onRequote={
          sent
            ? () => {
                setOverflowOpen(false);
                setRequoteOpen(true);
              }
            : undefined
        }
        onNewVersion={
          locked
            ? () => {
                setOverflowOpen(false);
                startNewVersion(quotation.id);
              }
            : undefined
        }
        newVersionNo={workingVersionNo(history)}
        onClose={close}
      />

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1320px] px-6 py-4 lg:px-8">
          {/* Reached from the Quotations module the user has walked no
              workflow to get here, so the page says where it stands first. */}
          <QuotationLifecycleBar state={qState} className="mb-4" />

          <CommercialAssumptions
            rates={liveRates}
            fxRate={fxRate}
            termsDays={termsDays}
            readOnly={locked}
            onRateChange={(id, value) => setQuotationRate(quotation.id, id, value)}
            onTermsChange={(d) => setQuotationTerms(quotation.id, d)}
            onReset={() => resetQuotationRates(quotation.id)}
          />

          {items.length > 0 ? (
            <>
              {/* Input-cost drift first: a quotation whose masters have moved
                  is not safe to approve, and that must be visible before the
                  numbers are read. */}
              <QuotationRiskBanner quotationId={quotation.id} />
              <VersionInputCompare quotationId={quotation.id} requoteOfId={quotation.requoteOf} />

              <WorkingSheet
                views={views}
                pod={pod}
                quotationId={quotation.id}
                readOnly={locked}
                onOverride={(itemId) => setOverrideFor(itemId)}
                onReject={(itemId) => setRejectFor(itemId)}
                onOpenContext={openCosting}
              />

              <CombinedSummary
                views={views}
                quotationId={quotation.id}
                orderValueUsd={totals.orderValueUsd}
                blendedMarginPct={totals.blendedMarginPct}
              />
            </>
          ) : (
            <EmptyQuotation quotationId={quotation.id} podId={pod.id} />
          )}

          <p className="mt-3 pb-2 text-[10.5px] leading-relaxed text-ink-400">
            Costs are read live from Configuration &amp; Costing — this workspace prices them, it
            does not change them. Articles, variants and MOQ breaks are added upstream, on the
            Costing Report.
          </p>
        </div>
      </main>

      {/* Approve / Reject / Override are the APPROVER's actions and belong to
          the Approval stage — offering them here would let the person
          preparing a quotation approve their own work before anybody had seen
          it. What this stage has is a summary of what is being prepared. */}
      {items.length > 0 && <PreparationBar health={health} submitted={qState.submitted} />}

      {/* ------------------------------ dialogs ------------------------------ */}

      {overrideItem && (
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

      {rejectFor !== undefined && (
        <RejectDialog
          quotationId={quotation.id}
          podId={pod.id}
          items={items}
          preselect={rejectFor ? [rejectFor] : items.map((i) => i.id)}
          onClose={() => setRejectFor(undefined)}
          onConfirm={(selection, reason) => {
            rejectSelection(quotation.id, selection, reason);
            // A rejection taken by an approver is also a verdict on the
            // approval itself, so the reviewer panel reflects it rather than
            // sitting at "pending" over a quotation that has been sent back.
            if (qState.submitted) rejectQuotation(quotation.id);
            setRejectFor(undefined);
            toast.success("Sent back, with your reason recorded against the line");
          }}
        />
      )}

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

      {historyOpen && (
        <QuotationHistoryPanel
          quotationId={quotation.id}
          onClose={() => setHistoryOpen(false)}
          onNewVersion={
            locked
              ? () => {
                  setHistoryOpen(false);
                  startNewVersion(quotation.id);
                }
              : undefined
          }
        />
      )}

      {requoteOpen && (
        <RequotePicker
          quotationId={quotation.id}
          podId={pod.id}
          items={items}
          versionNo={sent?.no}
          statusLabel={sent ? STATUS_LABEL[sent.status] : "Draft"}
          priceOf={(id) => views.find((x) => x.item.id === id)?.priced.commercial.sellingUsd ?? 0}
          onClose={() => setRequoteOpen(false)}
          onConfirm={(picks, destination) => {
            // Sending to the costing team is not a new quotation — it is the
            // recosting ask itself, on the same document. The articles move to
            // Recosting, and only when they come back is anything new raised.
            if (destination === "team") {
              const chosen = items.filter((i) => picks.some((x) => x.itemId === i.id));
              for (const item of chosen) {
                const articleIds =
                  item.kind === "kit" ? item.members.map((m) => m.articleId) : [item.articleId];
                for (const articleId of articleIds) {
                  requestRecost({
                    podId: pod.id,
                    articleId,
                    quotationId: quotation.id,
                    reason: "Sent to the costing team for recosting",
                  });
                }
              }
              toast.success(
                `${chosen.map((i) => i.name).join(", ")} sent to the costing team — status Recosting`,
              );
              setRequoteOpen(false);
              return;
            }

            // Editing the configuration means the costing is being redone, so
            // hand-set cost and price must not survive into the new round;
            // editing the quotation keeps the costing and moves only the
            // commercial position.
            const scope = destination === "configuration" ? "full" : "override";
            const next = createRequote(
              quotation.id,
              picks.map(({ itemId, lineIds }) => ({ itemId, lineIds, scope })),
            );
            setRequoteOpen(false);
            if (!next) return;

            if (destination === "configuration") {
              const first = items.find((i) => i.id === picks[0]?.itemId);
              if (first) {
                openCosting(first.articleId);
                return;
              }
            }
            navigate({ to: "/quotations/$quotationId", params: { quotationId: next } });
          }}
        />
      )}

      {approvalOpen && (
        <QuotationApprovalWorkspace
          pod={pod}
          quotationId={quotation.id}
          articleId={items[0]?.articleId ?? ""}
          views={views}
          onClose={() => setApprovalOpen(false)}
          onRequote={() => {
            setApprovalOpen(false);
            setRequoteOpen(true);
          }}
          // The approver's three calls reuse the dialogs this page already
          // hosts, so an override taken at approval is written by the same
          // code — and lands in the same audit — as one taken while drafting.
          onApprove={() => {
            approveQuotation(quotation.id);
            toast.success(`${quotation.id} approved`);
          }}
          onOverride={() => setOverrideFor(items[0]?.id)}
          onReject={() => setRejectFor(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Header
 * ------------------------------------------------------------------ */

function Header({
  quotationId,
  requoteOf,
  createdAt,
  buyer,
  podId,
  sent,
  locked,
  qState,
  blockedNames,
  itemCount,
  onSendForApproval,
  termsDays,
  overflowOpen,
  onOverflow,
  onTerms,
  onPreview,
  onHistory,
  onRequote,
  onNewVersion,
  newVersionNo,
  onClose,
}: {
  quotationId: string;
  requoteOf?: string;
  createdAt: string;
  buyer: string;
  podId: string;
  sent: QuotationVersion | undefined;
  locked: boolean;
  qState: QuotationState;
  blockedNames: string[];
  itemCount: number;
  onSendForApproval: () => void;
  termsDays: PaymentTermsDays;
  overflowOpen: boolean;
  onOverflow: (open: boolean) => void;
  onTerms: (days: PaymentTermsDays) => void;
  onPreview: () => void;
  onHistory: () => void;
  onRequote?: () => void;
  onNewVersion?: () => void;
  newVersionNo: number;
  onClose: () => void;
}) {
  const prepared = new Date(createdAt).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <header className="shrink-0 border-b border-hairline bg-surface px-6 py-3 lg:px-8">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-start gap-4">
        <Link
          to="/quotations"
          aria-label="All quotations"
          className="mt-1 rounded-md p-1 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[19px] font-semibold text-ink-900">Quotation Working Sheet</h1>
            {requoteOf && (
              <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-white">
                V{revisionNo(quotationId)} · Revised
              </span>
            )}
            {/* A quotation nobody has submitted is a DRAFT. Calling it
                "Pending Approval" before it has been sent claims a stage it
                has not reached and makes the Send action look redundant. */}
            {sent ? (
              <VersionStatusPill status={sent.status} />
            ) : (
              <span className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-600">
                {qState.label}
              </span>
            )}
            {locked && (
              <span className="inline-flex items-center gap-1 text-[11px] text-ink-500">
                <Lock className="h-3 w-3" aria-hidden /> Read-only
              </span>
            )}
          </div>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-ink-500">
            <span className="font-semibold text-ink-700">{quotationId}</span>
            <Meta label="Buyer">{buyer}</Meta>
            <Meta label="POD">{podId}</Meta>
            <Meta label="Prepared">{prepared}</Meta>
            {requoteOf && (
              <Link
                to="/quotations/$quotationId"
                params={{ quotationId: requoteOf }}
                className="font-medium text-brand-700 hover:underline"
              >
                Requote of {requoteOf}
              </Link>
            )}
          </p>
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
          {/* Payment terms lead the actions because they are the assumption a
              buyer conversation moves most often, and every figure below
              re-prices when they change. */}
          <div
            className="flex items-center gap-1 rounded-full border border-hairline bg-surface p-0.5"
            role="group"
            aria-label="Payment terms"
          >
            <span className="pl-2 pr-1 text-[11px] font-medium text-ink-500">Payment terms</span>
            {([60, 90] as const).map((d) => (
              <button
                key={d}
                type="button"
                disabled={locked}
                onClick={() => onTerms(d)}
                aria-pressed={termsDays === d}
                className={cn(
                  "rounded-full px-3 py-1 text-[11.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                  termsDays === d
                    ? "bg-brand-700 font-semibold text-white"
                    : "text-ink-600 hover:bg-surface-alt hover:text-ink-900",
                )}
              >
                {d} Days
              </button>
            ))}
          </div>

          {/* Every figure is derived on read, so the sheet is already current.
              The button says so out loud rather than implying a stale document
              somebody has to remember to refresh. */}
          <HeaderButton
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() =>
              toast.success("Recalculated — costs re-read live from Configuration & Costing")
            }
          >
            Recalculate
          </HeaderButton>

          <HeaderButton icon={<FileText className="h-4 w-4" />} onClick={onPreview}>
            Preview
          </HeaderButton>

          <HeaderButton
            icon={<Download className="h-4 w-4" />}
            onClick={() => toast.info("Export to Excel and PDF is not wired up in this build")}
          >
            Export
          </HeaderButton>

          {/* The stage's one primary action, in the header where every other
              screen in the app carries its forward step. Once submitted the
              way on is the Approval screen itself, not a second send. */}
          {qState.submitted ? (
            <button
              type="button"
              onClick={onSendForApproval}
              className="inline-flex items-center gap-1.5 rounded-md border border-brand-700 bg-brand-50 px-3.5 py-2 text-[13px] font-semibold text-brand-700 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              <Send className="h-4 w-4" /> Open Approval
            </button>
          ) : (
            <button
              type="button"
              disabled={itemCount === 0 || blockedNames.length > 0}
              title={
                blockedNames.length > 0
                  ? `${blockedNames.join(", ")} ${blockedNames.length === 1 ? "is" : "are"} out for recosting — the quotation cannot be sent until ${blockedNames.length === 1 ? "it comes" : "they come"} back.`
                  : itemCount === 0
                    ? "There is nothing on this quotation to send"
                    : "Choose approvers and send this quotation for approval"
              }
              onClick={onSendForApproval}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              <Send className="h-4 w-4" /> Send for Approval
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}

          <div
            className="relative"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onOverflow(false);
            }}
          >
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={overflowOpen}
              aria-label="More quotation actions"
              onClick={() => onOverflow(!overflowOpen)}
              className="rounded-md border border-hairline bg-surface p-2 text-ink-600 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {overflowOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-40 mt-1 w-60 overflow-hidden rounded-lg border border-hairline bg-surface py-1 shadow-lg"
              >
                <OverflowItem icon={<History className="h-3.5 w-3.5" />} onClick={onHistory}>
                  Version history &amp; audit
                </OverflowItem>
                {onRequote && (
                  <OverflowItem icon={<Sparkles className="h-3.5 w-3.5" />} onClick={onRequote}>
                    Generate requote
                  </OverflowItem>
                )}
                {onNewVersion && (
                  <OverflowItem icon={<Send className="h-3.5 w-3.5" />} onClick={onNewVersion}>
                    Create version {newVersionNo}
                  </OverflowItem>
                )}
                <OverflowItem icon={<X className="h-3.5 w-3.5" />} onClick={onClose}>
                  Close quotation
                </OverflowItem>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span>
      <span className="text-ink-400">{label} </span>
      <span className="font-medium text-ink-700">{children}</span>
    </span>
  );
}

function HeaderButton({
  icon,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
    >
      {icon}
      {children}
    </button>
  );
}

function OverflowItem({
  icon,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-ink-700 hover:bg-surface-alt focus-visible:bg-surface-alt focus-visible:outline-none"
    >
      <span className="text-ink-500">{icon}</span>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Nothing to review
 * ------------------------------------------------------------------ */

/**
 * A quotation with no lines is a routing problem, not something to fix here —
 * articles arrive from the Costing Report, so that is where the way out points.
 */
function EmptyQuotation({ quotationId, podId }: { quotationId: string; podId: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-200 bg-surface px-6 py-14 text-center">
      <h2 className="text-[15px] font-semibold text-ink-900">Nothing on this quotation</h2>
      <p className="mx-auto mt-1 max-w-[460px] text-[12.5px] leading-relaxed text-ink-500">
        {quotationId} has no lines to review. Articles are added upstream: mark a costing ready on
        the Costing Report, then continue to quotation.
      </p>
      <Link
        to="/pods/$id"
        params={{ id: podId }}
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-800"
      >
        Go to the POD
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * One quotation, one summary
 * ------------------------------------------------------------------ */

/**
 * The combined figures for the whole quotation — the same arithmetic the sheet
 * totals show, stated as the document's own position rather than as a table
 * footer, because this is the number that gets approved.
 */
function CombinedSummary({
  views,
  quotationId,
  orderValueUsd,
  blendedMarginPct,
}: {
  views: ViewedItem[];
  quotationId: string;
  orderValueUsd: number;
  blendedMarginPct: number;
}) {
  let costInr = 0;
  let sellingInr = 0;
  let quantity = 0;
  for (const v of views) {
    const qty = v.kind === "kit" ? v.priced.sets : v.priced.moq;
    costInr += v.priced.commercial.finalCostInr * qty;
    sellingInr += v.priced.commercial.sellingInr * qty;
    quantity += qty;
  }

  const cells = [
    { label: "Articles", value: String(views.length) },
    { label: "Quoted quantity", value: quantity.toLocaleString("en-IN") },
    { label: "Total Cost", value: inr(costInr, 0) },
    { label: "Selling Price", value: inr(sellingInr, 0) },
    { label: "Margin", value: pct(blendedMarginPct, 2), strong: true },
    {
      label: "Total Quote Value",
      value: `${usd(orderValueUsd, 0)} · ${inrShort(sellingInr)}`,
      strong: true,
    },
  ];

  return (
    <section
      aria-label="Final quotation summary"
      className="overflow-hidden rounded-xl border border-brand-600/30 bg-surface"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline bg-brand-50 px-4 py-2.5">
        <Layers className="h-3.5 w-3.5 text-brand-700" aria-hidden />
        <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-brand-800">
          Final quotation summary · {quotationId}
        </h2>
        <span className="ml-auto flex items-baseline gap-2">
          <span className="text-[10.5px] uppercase tracking-[0.1em] text-ink-500">Quote value</span>
          <span className="text-[19px] font-semibold tabular-nums text-ink-900">
            {usd(orderValueUsd, 0)}
          </span>
          <span className="text-[12px] tabular-nums text-ink-500">{inrShort(sellingInr)}</span>
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-px bg-hairline sm:grid-cols-3 lg:grid-cols-6">
        {cells.map((c) => (
          <div key={c.label} className="bg-surface px-4 py-2.5">
            <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-500">
              {c.label}
            </dt>
            <dd
              className={cn(
                "mt-0.5 tabular-nums",
                c.strong ? "text-[15px] font-semibold text-ink-900" : "text-[13px] text-ink-700",
              )}
            >
              {c.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="border-t border-hairline px-4 py-2 text-[11px] text-ink-500">
        This is what the buyer receives as one quotation. Each article's own cost, price and margin
        stay on its row above.
      </p>
    </section>
  );
}
