/**
 * A quotation over several articles — QT-2601 — as its own document.
 *
 * The reason this is a page and not a section of an article: a quotation that
 * contains a Placemat, a Runner and a Napkin belongs to none of them. Rendering
 * it under whichever article the user happened to start from makes the other
 * two look like sub-items of the first, and gives the combined quotation no
 * place of its own to carry a number, a status, or a single Send for Approval.
 *
 * What it reuses, deliberately: the same `QuoteItemCard` the single-product
 * quotation renders, the same pricing through `quotationView`, the same
 * selection modal, the same approval and history surfaces. The only thing new
 * here is the frame around them — and the fact that the summary is computed
 * once, for the whole quotation, because one quotation is sent as one number.
 */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronDown,
  FileText,
  History,
  Layers,
  Lock,
  PackagePlus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { usePod } from "@/lib/podsStore";
import { inr, pct, usd } from "@/lib/commercialProvisions";
import { useCostingSelections } from "@/lib/costingSelectionStore";
import {
  addProducts,
  createRequote,
  removeItems,
  revisionNo,
  useQuotation,
} from "@/lib/quoteDraftStore";
import {
  STATUS_LABEL,
  latestVersion,
  startNewVersion,
  useQuotationHistory,
  workingVersionNo,
} from "@/lib/quotationHistory";
import { totalsOf, viewQuote, type ViewedItem } from "@/lib/quotationView";
import { inrShort } from "@/lib/fabricRequirement";
import { requestRecost } from "@/lib/recostingStore";
import { toast } from "sonner";
import { QuoteItemCard } from "./QuoteItemCard";
import { WorkingSheet } from "./WorkingSheet";
import { QuotationRiskBanner } from "./QuotationRiskBanner";
import { VersionInputCompare } from "./VersionInputCompare";
import { recordSnapshot, snapshotFromViews } from "@/lib/masterSnapshot";
import { ConfigLegend } from "./ConfigChips";
import { ArticleSelectionModal } from "./ArticleSelectionModal";
import { QuotationPreview } from "./QuotationPreview";
import { QuotationApprovalWorkspace } from "./QuotationApprovalWorkspace";
import { QuotationHistoryPanel, VersionStatusPill } from "./QuotationHistoryPanel";
import { RequotePicker } from "./RequotePicker";

export function MultiQuotationWorkspace({ quotationId }: { quotationId: string }) {
  const navigate = useNavigate();
  const quotation = useQuotation(quotationId);
  const pod = usePod(quotation?.podId ?? "");
  const history = useQuotationHistory(quotationId);
  const selections = useCostingSelections();

  const [addOpen, setAddOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [focus, setFocus] = useState<string>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [requoteOpen, setRequoteOpen] = useState(false);
  // The detail cards default to open: the working sheet is a new entry point,
  // not a curtain over what users already rely on seeing.
  const [detailsOpen, setDetailsOpen] = useState(true);

  const items = useMemo(() => quotation?.items ?? [], [quotation]);
  const views: ViewedItem[] = useMemo(
    () => (quotation ? viewQuote(quotation.podId, items, selections) : []),
    [quotation, items, selections],
  );
  const totals = totalsOf(views);

  /* ---- masters this pricing referenced, date-stamped ----
     Recorded every time the quotation is read, so the snapshot always names
     the rates the figures on screen were actually built from. The risk banner
     compares these against the (simulated) refreshed masters. */
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
  const locked = history.locked;
  const activeFocus = focus !== "all" && items.some((i) => i.id === focus) ? focus : "all";
  // A quotation with a line out for recosting is not a quotation yet.
  const blocked = items.filter((i) => i.rejected);
  const quotedIds = new Set(items.map((i) => i.articleId));

  /** Leaving returns to the article the quotation was started from. */
  const close = () =>
    navigate({
      to: "/quotation/$podId/$articleId",
      params: { podId: quotation.podId, articleId: items[0]?.articleId ?? pod.articles[0].id },
      search: { sel: undefined },
    });

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  /**
   * A working-sheet row is an index entry; opening it must defeat both things
   * that could be hiding the card — the details collapse and a focus pill —
   * before the scroll, or the jump lands on nothing.
   */
  const openCard = (id: string) => {
    setDetailsOpen(true);
    if (activeFocus !== "all") setFocus("all");
    requestAnimationFrame(() => {
      document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="flex h-screen w-full flex-col bg-canvas">
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
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                Quotation
              </span>
              <h1 className="text-[19px] font-semibold text-ink-900">{quotation.id}</h1>
              {/* A requote is a new commercial round — say which one, so nobody
                  mistakes the revision for the document the buyer already has. */}
              {quotation.requoteOf && (
                <span className="rounded-full bg-brand-700 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-white">
                  V{revisionNo(quotation.id)} · Revised
                </span>
              )}
              {sent ? (
                <VersionStatusPill status={sent.status} />
              ) : (
                <span className="rounded-full border border-hairline bg-surface px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-600">
                  Draft
                </span>
              )}
              {locked && (
                <span className="inline-flex items-center gap-1 text-[11px] text-ink-500">
                  <Lock className="h-3 w-3" aria-hidden /> Read-only
                </span>
              )}
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-500">
              <span>
                {pod.buyer} · {pod.id} · {items.length} article{items.length === 1 ? "" : "s"}{" "}
                quoted as one document
              </span>
              {quotation.requoteOf && (
                <Link
                  to="/quotations/$quotationId"
                  params={{ quotationId: quotation.requoteOf }}
                  className="font-medium text-brand-700 hover:underline"
                >
                  Requote of {quotation.requoteOf}
                </Link>
              )}
            </p>
          </div>

          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
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
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              <FileText className="h-4 w-4" /> Preview Quotation
            </button>
            {/* A quotation the buyer has agreed is finished. Going again is a
                new document, so it gets its own button rather than reopening
                the one they accepted. */}
            {/* Any sent version — approved, rejected, superseded — can be the
                start of the next round; the customer's answer is exactly when
                a requote happens. */}
            {sent && (
              <button
                type="button"
                onClick={() => setRequoteOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-brand-700 bg-brand-50 px-3 py-2 text-[13px] font-medium text-brand-700 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                <Sparkles className="h-4 w-4" /> Generate Requote
              </button>
            )}
            {locked ? (
              <button
                type="button"
                onClick={() => startNewVersion(quotation.id)}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-brand-800"
              >
                <Send className="h-4 w-4" /> Create version {workingVersionNo(history)}
              </button>
            ) : (
              <button
                type="button"
                disabled={items.length === 0 || blocked.length > 0}
                title={
                  blocked.length > 0
                    ? `${blocked.map((i) => i.name).join(", ")} ${blocked.length === 1 ? "is" : "are"} out for recosting — the quotation cannot be sent until ${blocked.length === 1 ? "it comes" : "they come"} back.`
                    : undefined
                }
                onClick={() => setApprovalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" /> Send for Approval
              </button>
            )}
            <button
              type="button"
              onClick={close}
              aria-label="Close this quotation"
              title="Back to the article"
              className="rounded-md p-2 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1320px] px-6 py-4 lg:px-8">
          {/* Which articles are on this quotation, and the way to each one. */}
          <nav
            aria-label="Articles on this quotation"
            className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-surface px-3.5 py-2.5"
          >
            <span className="mr-1 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-500">
              On this quotation
            </span>
            <FocusPill active={activeFocus === "all"} onClick={() => setFocus("all")}>
              All items <span className="tabular-nums text-ink-400">{items.length}</span>
            </FocusPill>
            {items.map((item) => (
              <FocusPill
                key={item.id}
                active={activeFocus === item.id}
                onClick={() => setFocus(item.id)}
              >
                {item.kind === "kit" ? `Kit — ${item.name}` : item.name}
              </FocusPill>
            ))}
            {!locked && (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-brand-600 bg-brand-50/50 px-3.5 py-1.5 text-[12.5px] font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                <PackagePlus className="h-3.5 w-3.5" aria-hidden /> Add Product
              </button>
            )}
          </nav>

          {!locked && items.length > 0 && (
            <SelectedProducts
              items={items.map((i) => ({ id: i.id, name: i.name, kind: i.kind }))}
              picked={picked}
              onToggle={toggle}
              onSelectAll={() =>
                setPicked(
                  picked.size === items.length ? new Set() : new Set(items.map((i) => i.id)),
                )
              }
              onRemove={() => {
                removeItems(quotation.id, Array.from(picked));
                setPicked(new Set());
              }}
            />
          )}

          {/* Summary first, the way the Excel working sheet opens — the cards
              below are the drill-down, not the entry point. */}
          {items.length > 0 && (
            <>
              {/* Input-cost drift first: a quotation whose masters have moved
                  is not safe to send, and that must be visible before the
                  numbers. */}
              <QuotationRiskBanner quotationId={quotation.id} />
              <VersionInputCompare quotationId={quotation.id} requoteOfId={quotation.requoteOf} />
              <WorkingSheet views={views} quotationId={quotation.id} onOpen={openCard} />
            </>
          )}

          <ConfigLegend className="mb-3" />

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-ink-200 bg-surface px-6 py-14 text-center">
              <h2 className="text-[15px] font-semibold text-ink-900">
                Nothing left on this quotation
              </h2>
              <p className="mx-auto mt-1 max-w-[440px] text-[12.5px] text-ink-500">
                Add a costed product, set or kit back onto {quotation.id}.
              </p>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-800"
              >
                <PackagePlus className="h-4 w-4" /> Add Product
              </button>
            </div>
          ) : (
            <section aria-label="Article details">
              <button
                type="button"
                onClick={() => setDetailsOpen((o) => !o)}
                aria-expanded={detailsOpen}
                className="mb-3 flex w-full items-center gap-2 rounded-md px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "h-4 w-4 text-ink-500 transition-transform",
                    !detailsOpen && "-rotate-90",
                  )}
                />
                <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-700">
                  Article details
                </h2>
                <span className="text-[11.5px] tabular-nums text-ink-500">{items.length}</span>
              </button>
              {detailsOpen && (
                <div className="space-y-5">
                  {items.map((item, i) =>
                    activeFocus === "all" || activeFocus === item.id ? (
                      // The id is the working sheet's jump target; scroll-mt
                      // keeps the landed-on card clear of the viewport edge.
                      <div key={item.id} id={`card-${item.id}`} className="scroll-mt-4">
                        <QuoteItemCard
                          podId={quotation.podId}
                          quotationId={quotation.id}
                          item={item}
                          index={i}
                          readOnly={locked}
                          siblings={items}
                          // One quotation, one summary — at the end, over everything.
                          showSummary={false}
                        />
                      </div>
                    ) : null,
                  )}
                </div>
              )}
            </section>
          )}

          {items.length > 0 && <CombinedSummary views={views} quotationId={quotation.id} />}

          <p className="mt-3 text-[10.5px] text-ink-400">
            * Cost figures are pulled live from Configuration & Costing. Each article keeps its own
            lifecycle — being on this quotation does not change what stage it is at.
          </p>
        </div>
      </main>

      <ArticleSelectionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        podId={quotation.podId}
        articles={pod.articles}
        alreadyQuotedIds={quotedIds}
        title={`Add Products to ${quotation.id}`}
        confirmLabel="Add to Quotation"
        onConfirm={(ids) => {
          addProducts(quotation.id, ids);
          setAddOpen(false);
        }}
      />

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
          priceOf={(id) => {
            const v = views.find((x) => x.item.id === id);
            return v ? v.priced.commercial.sellingUsd : 0;
          }}
          onClose={() => setRequoteOpen(false)}
          onConfirm={(picks, destination) => {
            // Sending to the costing team is not a new quotation — it is the
            // recosting ask itself, on the same document. The articles move to
            // Recosting, the team re-costs and marks them ready, and only then
            // is anything new raised.
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
            // commercial position. Same distinction createRequote always drew.
            const scope = destination === "configuration" ? "full" : "override";
            const next = createRequote(
              quotation.id,
              picks.map(({ itemId, lineIds }) => ({ itemId, lineIds, scope })),
            );
            setRequoteOpen(false);
            if (!next) return;

            if (destination === "configuration") {
              // The work continues in Configuration, on the first selected
              // article; the requote reads its costs live from there, so the
              // path back is Costing Report → Quotation as always.
              const first = items.find((i) => i.id === picks[0]?.itemId);
              if (first) {
                navigate({
                  to: "/config/$podId/$articleId",
                  params: { podId: pod.id, articleId: first.articleId },
                  search: { sel: undefined },
                });
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
        />
      )}
    </div>
  );
}

function FocusPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
        active
          ? "border-brand-700 bg-brand-50 font-semibold text-brand-800"
          : "border-hairline bg-surface text-ink-600 hover:bg-surface-alt hover:text-ink-900",
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Managing what is on the quotation
 * ------------------------------------------------------------------ */

/**
 * The list of what is currently quoted, with the bulk actions.
 *
 * Separate from the article navigation above because they answer different
 * questions: the nav asks "show me this one", this asks "what is on here, and
 * take these off".
 */
function SelectedProducts({
  items,
  picked,
  onToggle,
  onSelectAll,
  onRemove,
}: {
  items: { id: string; name: string; kind: "product" | "kit" }[];
  picked: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onRemove: () => void;
}) {
  const all = picked.size === items.length && items.length > 0;

  return (
    <section
      aria-label="Selected products"
      className="mb-4 overflow-hidden rounded-xl border border-hairline bg-surface"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline bg-surface-alt px-4 py-2.5">
        <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-700">
          Selected products
        </h2>
        <span className="text-[11.5px] text-ink-500">
          {picked.size} of {items.length} selected
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            {all ? "Clear selection" : "Select all"}
          </button>
          <button
            type="button"
            disabled={picked.size === 0}
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12px] font-medium text-[#8f2c22] hover:bg-surface-alt disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove selected
          </button>
        </div>
      </header>

      <ul className="flex flex-wrap gap-x-6 gap-y-2 px-4 py-3">
        {items.map((i) => (
          <li key={i.id}>
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-800">
              <input
                type="checkbox"
                checked={picked.has(i.id)}
                onChange={() => onToggle(i.id)}
                className="h-3.5 w-3.5 accent-[var(--color-brand-700)]"
              />
              {i.kind === "kit" ? `Kit — ${i.name}` : i.name}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * One quotation, one summary
 * ------------------------------------------------------------------ */

/**
 * The combined figures for the whole quotation.
 *
 * Same neutral ribbon treatment as the single-product summary, and the same
 * arithmetic — `totalsOf` over the same priced views the cards above render.
 * Per-article summaries are switched off in this workspace: the buyer receives
 * one quotation, so there is one number to approve.
 */
function CombinedSummary({ views, quotationId }: { views: ViewedItem[]; quotationId: string }) {
  const totals = totalsOf(views);

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
    { label: "Quoted MOQ", value: quantity.toLocaleString("en-IN") },
    { label: "Total Cost", value: inr(costInr, 0) },
    { label: "Selling Price", value: inr(sellingInr, 0) },
    { label: "Margin", value: pct(totals.blendedMarginPct, 1), strong: true },
    {
      label: "Total Quote Value",
      value: `${usd(totals.orderValueUsd, 0)} · ${inrShort(sellingInr)}`,
      strong: true,
    },
  ];

  return (
    <section
      aria-label="Total quotation summary"
      className="mt-5 overflow-hidden rounded-lg border border-hairline bg-surface"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline bg-surface-alt px-4 py-2.5">
        <Layers className="h-3.5 w-3.5 text-ink-500" aria-hidden />
        <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-700">
          Total quotation summary · {quotationId}
        </h2>
        <span className="ml-auto flex items-baseline gap-2">
          <span className="text-[10.5px] uppercase tracking-[0.1em] text-ink-500">Quote value</span>
          <span className="text-[19px] font-semibold tabular-nums text-ink-900">
            {usd(totals.orderValueUsd, 0)}
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
        Every article's own cost, price and margin stay on its card above — this is what the buyer
        receives as one quotation.
      </p>
    </section>
  );
}
