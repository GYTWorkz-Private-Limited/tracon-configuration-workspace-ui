/**
 * Quotations — the pipeline control center.
 *
 * The workflow builds a quotation inside a POD, which is the right place to
 * BUILD one and the wrong place to find one later. This page is the register
 * read top-down the way the commercial team actually asks its questions:
 *
 *   KPI ribbon      — where does the pipeline stand (each card IS a filter)
 *   risk alert      — which promises are drifting under us
 *   tabs + filters  — narrow to the slice being worked
 *   the table       — every quotation, money and risk on the row
 *
 * It owns no data. Composition comes from `quoteDraftStore`, internal stage
 * from `quotationLifecycle`, buyer position from `buyerResponseStore`, risk
 * from `masterSnapshot`, and the money is re-derived by `viewQuote` — the same
 * read the workspace uses, so a row here can never quote a different figure
 * from the quotation it links to. The one-axis pipeline status is derived in
 * `quotationPipeline`.
 */

import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  FileText,
  Search,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { cn } from "@/lib/utils";
import { pct, usd } from "@/lib/commercialProvisions";
import { usePods } from "@/lib/podsStore";
import { useCostingSelections } from "@/lib/costingSelectionStore";
import { useAllQuoteDrafts } from "@/lib/quoteDraftStore";
import { latestVersion, useAllQuotationHistories } from "@/lib/quotationHistory";
import { useQuotationApprovals } from "@/lib/quotationApprovalStore";
import { stateFrom } from "@/lib/quotationLifecycle";
import { totalsOf, viewQuote } from "@/lib/quotationView";
import { useAllSnapshots } from "@/lib/masterSnapshot";
import { useAllBuyerRecords } from "@/lib/buyerResponseStore";
import { ensureQuotationDemoData } from "@/lib/quotationDemoSeed";
import {
  PIPELINE_LABEL,
  PIPELINE_TONE,
  RISK_LABEL,
  pipelineStatusOf,
  marginNowPct,
  riskOf,
  validUntilOf,
  type PipelineStatus,
  type QuotationRisk,
  type RiskLevel,
} from "@/lib/quotationPipeline";

export const Route = createFileRoute("/quotations/")({
  head: () => ({
    meta: [
      { title: "Quotations · Tracon" },
      {
        name: "description",
        content:
          "Every quotation in the workspace — pipeline position, input-cost risk, value and margin, and a way straight back in.",
      },
    ],
  }),
  component: QuotationsList,
});

/* ------------------------------------------------------------------ *
 * The KPI ribbon — one card per pipeline position
 * ------------------------------------------------------------------ */

const KPI_CARDS: { status: PipelineStatus | "all"; label: string; note: string }[] = [
  { status: "all", label: "All", note: "Every quotation" },
  { status: "draft", label: "Draft", note: "Not yet sent" },
  { status: "pending_approval", label: "Pending Approval", note: "With reviewers" },
  { status: "sent", label: "Sent to Buyer", note: "Awaiting response" },
  { status: "accepted", label: "Accepted", note: "Order expected" },
  { status: "converted", label: "Converted", note: "Became an order" },
  { status: "revised", label: "Revised", note: "Revision asked" },
  { status: "rejected", label: "Rejected", note: "Lost / no order" },
  { status: "expired", label: "Expired", note: "Validity passed" },
];

const RISK_DOT: Record<RiskLevel, string> = {
  critical: "bg-red-600",
  high: "bg-orange-500",
  medium: "bg-amber-400",
};

const RISK_PILL: Record<RiskLevel, string> = {
  critical: "border-red-200 bg-red-50 text-red-700",
  high: "border-orange-200 bg-orange-50 text-orange-700",
  medium: "border-amber-300/60 bg-amber-50 text-amber-800",
};

type Tab = "all" | "at_risk" | "open" | "analysis";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All Quotations" },
  { id: "at_risk", label: "At Risk" },
  { id: "open", label: "Open / Sent" },
  { id: "analysis", label: "Conversion Analysis" },
];

/** Positions still in play — what the Open / Sent tab and the risk alert count. */
const OPEN_STATUSES = new Set<PipelineStatus>(["pending_approval", "sent", "revised", "accepted"]);

const fmtDate = (iso?: string | Date) => {
  if (!iso) return undefined;
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : undefined;
};

function QuotationsList() {
  // Quotations live in the browser store, which is empty during the server
  // render — so "no quotations yet" must wait for hydration, or a workspace
  // full of them flashes an empty state on every load.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    // Populate the demo pipeline before first client paint — two quotations
    // under every status, walked through the real store actions. No-op after
    // the first visit.
    ensureQuotationDemoData();
    setHydrated(true);
  }, []);
  const [tab, setTab] = useState<Tab>("all");
  const [statusFilter, setStatusFilter] = useState<PipelineStatus | "all">("all");
  const [buyerFilter, setBuyerFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [q, setQ] = useState("");

  const pods = usePods();
  const drafts = useAllQuoteDrafts();
  const histories = useAllQuotationHistories();
  const approvals = useQuotationApprovals();
  const selections = useCostingSelections();
  const snapshots = useAllSnapshots();
  const buyerRecords = useAllBuyerRecords();

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
          const version = history ? latestVersion(history) : undefined;
          const buyer = buyerRecords[draft.id];
          const status = pipelineStatusOf(state, buyer, version?.sentAt);
          const risk = riskOf(snapshots[draft.id]);
          const totals = totalsOf(views);

          // Whole-quotation INR figures at quoted quantities — what the
          // margin-now estimate is computed over.
          let costInr = 0;
          let sellingInr = 0;
          let rawInr = 0;
          const prices: number[] = [];
          for (const v of views) {
            const qty = v.kind === "kit" ? v.priced.sets : v.priced.moq;
            costInr += v.priced.commercial.finalCostInr * qty;
            sellingInr += v.priced.commercial.sellingInr * qty;
            prices.push(v.priced.commercial.sellingUsd);
            rawInr +=
              v.kind === "kit"
                ? v.priced.members.reduce((t, m) => t + m.rollup.rawMaterial * m.unitsPerSet, 0) *
                  qty
                : v.priced.rollup.rawMaterial * qty;
          }

          return {
            draft,
            pod,
            views,
            state,
            status,
            risk,
            totals,
            version,
            buyer,
            sentAt: version?.sentAt,
            validUntil: validUntilOf(version?.sentAt),
            priceMin: prices.length ? Math.min(...prices) : 0,
            priceMax: prices.length ? Math.max(...prices) : 0,
            marginNow: marginNowPct(sellingInr, costInr, rawInr, risk),
          };
        })
        .filter((r) => r.pod)
        .sort((a, b) => b.draft.updatedAt.localeCompare(a.draft.updatedAt)),
    [drafts, pods, histories, approvals, selections, snapshots, buyerRecords],
  );

  const countOf = (s: PipelineStatus) => rows.filter((r) => r.status === s).length;
  const convertedValue = rows
    .filter((r) => r.status === "converted")
    .reduce((t, r) => t + (r.buyer?.orderValueUsd ?? r.totals.orderValueUsd), 0);

  const atRisk = rows.filter((r) => r.risk && OPEN_STATUSES.has(r.status));
  const riskCounts: Record<RiskLevel, number> = {
    critical: atRisk.filter((r) => r.risk!.level === "critical").length,
    high: atRisk.filter((r) => r.risk!.level === "high").length,
    medium: atRisk.filter((r) => r.risk!.level === "medium").length,
  };

  const buyers = Array.from(new Set(rows.map((r) => r.pod!.buyer))).sort();

  const term = q.trim().toLowerCase();
  const visible = rows.filter((r) => {
    if (tab === "at_risk" && !r.risk) return false;
    if (tab === "open" && !OPEN_STATUSES.has(r.status)) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (buyerFilter !== "all" && r.pod!.buyer !== buyerFilter) return false;
    if (riskFilter !== "all" && r.risk?.level !== riskFilter) return false;
    if (!term) return true;
    return [r.draft.id, r.pod!.buyer, r.pod!.id, ...r.draft.items.map((i) => i.name)]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-ink-900">Quotations</h1>
            <p className="mt-1 text-[13px] text-ink-500">
              The whole pipeline at a glance — figures re-derived live from Configuration &amp;
              Costing, risk graded against the masters each price was built on.
            </p>
          </div>
        </div>

        {/* ---- KPI ribbon — each card is a filter ---- */}
        <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-5 xl:grid-cols-9">
          {KPI_CARDS.map((c) => {
            const active = statusFilter === c.status;
            const count = c.status === "all" ? rows.length : countOf(c.status);
            const note =
              c.status === "all"
                ? "Last 12 months"
                : c.status === "converted" && convertedValue > 0
                  ? usd(convertedValue, 0)
                  : c.note;
            return (
              <button
                key={c.status}
                type="button"
                onClick={() => setStatusFilter(active ? "all" : c.status)}
                aria-pressed={active}
                className={cn(
                  "px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700",
                  active
                    ? "bg-brand-50 shadow-[inset_0_-2px_0_0_var(--color-brand-700)]"
                    : "bg-surface hover:bg-surface-alt/70",
                )}
              >
                <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                  {c.label}
                </span>
                <span
                  className={cn(
                    "mt-0.5 block text-[18px] font-semibold tabular-nums leading-tight",
                    active ? "text-brand-800" : count > 0 ? "text-ink-900" : "text-ink-300",
                  )}
                >
                  {count}
                </span>
                <span className="block truncate text-[10.5px] text-ink-400">{note}</span>
              </button>
            );
          })}
        </div>

        {/* ---- Input-cost risk alert — only when there is something at risk ---- */}
        {atRisk.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-red-800">
                Input Cost Risk — {atRisk.length} open quotation{atRisk.length === 1 ? "" : "s"} at
                risk
              </p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-red-700/90">
                Input costs have risen since these were priced. Honoured as quoted, the actual
                margin will be lower than approved — review and consider requoting before the buyer
                accepts.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              {(["critical", "high", "medium"] as const).map(
                (lvl) =>
                  riskCounts[lvl] > 0 && (
                    <span
                      key={lvl}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                        RISK_PILL[lvl],
                      )}
                    >
                      <span className={cn("h-2 w-2 rounded-full", RISK_DOT[lvl])} aria-hidden />
                      {RISK_LABEL[lvl]}
                      {lvl === "critical" ? " (>10%)" : lvl === "high" ? " (5–10%)" : " (2–5%)"}:{" "}
                      {riskCounts[lvl]}
                    </span>
                  ),
              )}
              <button
                type="button"
                onClick={() => {
                  setTab("at_risk");
                  setStatusFilter("all");
                }}
                className="ml-1 inline-flex items-center gap-1 rounded-md bg-red-700 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700"
              >
                Review All Risks <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>
        )}

        {/* ---- Tabs ---- */}
        <div className="mt-4 flex items-center gap-1 border-b border-hairline">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={cn(
                "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                tab === t.id
                  ? "border-brand-700 font-semibold text-brand-800"
                  : "border-transparent text-ink-500 hover:text-ink-900",
              )}
            >
              {t.id === "at_risk" && <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
              {t.label}
              {t.id === "at_risk" && atRisk.length > 0 && (
                <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
                  {atRisk.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "analysis" ? (
          <ConversionAnalysis rows={rows} convertedValue={convertedValue} />
        ) : (
          <>
            {/* ---- Search & filters ---- */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-md border border-hairline bg-surface px-3 py-2">
                <Search className="h-4 w-4 text-ink-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search quote #, buyer, article, product…"
                  className="flex-1 bg-transparent text-[13px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
                />
              </div>
              <FilterSelect
                label="Buyer"
                value={buyerFilter}
                onChange={setBuyerFilter}
                options={[
                  { value: "all", label: "All Buyers" },
                  ...buyers.map((b) => ({ value: b, label: b })),
                ]}
              />
              <FilterSelect
                label="Status"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as PipelineStatus | "all")}
                options={[
                  { value: "all", label: "All Statuses" },
                  ...KPI_CARDS.filter((c) => c.status !== "all").map((c) => ({
                    value: c.status,
                    label: c.label,
                  })),
                ]}
              />
              <FilterSelect
                label="Risk"
                value={riskFilter}
                onChange={(v) => setRiskFilter(v as RiskLevel | "all")}
                options={[
                  { value: "all", label: "All Risk Levels" },
                  { value: "critical", label: "Critical" },
                  { value: "high", label: "High" },
                  { value: "medium", label: "Medium" },
                ]}
              />
            </div>

            {/* ---- The table ---- */}
            {rows.length === 0 && !hydrated ? (
              <div className="mt-4 rounded-lg border border-hairline bg-surface px-6 py-14" aria-busy />
            ) : rows.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border border-hairline bg-surface">
                <table className="w-full min-w-[1120px] text-[13px]">
                  <caption className="sr-only">All quotations</caption>
                  <thead>
                    <tr className="border-b border-hairline bg-surface-alt text-[11px] uppercase tracking-wide text-ink-500">
                      <Th>Quote #</Th>
                      <Th>Buyer</Th>
                      <Th>Products</Th>
                      <Th>Date Sent</Th>
                      <Th>Valid Until</Th>
                      <Th align="right">Quoted Price</Th>
                      <Th align="right">Quoted Margin</Th>
                      <Th align="right">Input Cost Δ</Th>
                      <Th align="right">Margin Now</Th>
                      <Th>Risk</Th>
                      <Th>Status</Th>
                      <Th align="right">
                        <span className="sr-only">Actions</span>
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.length === 0 && (
                      <tr>
                        <td colSpan={12} className="px-4 py-10 text-center text-[12.5px] text-ink-500">
                          No quotations match this view.
                        </td>
                      </tr>
                    )}
                    {visible.map((r) => (
                      <QuotationRow key={r.draft.id} row={r} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

type RowData = {
  draft: ReturnType<typeof useAllQuoteDrafts>[number];
  pod: ReturnType<typeof usePods>[number] | undefined;
  views: ReturnType<typeof viewQuote>;
  state: ReturnType<typeof stateFrom>;
  status: PipelineStatus;
  risk: QuotationRisk | undefined;
  totals: ReturnType<typeof totalsOf>;
  version: ReturnType<typeof latestVersion>;
  buyer: ReturnType<typeof useAllBuyerRecords>[string] | undefined;
  sentAt: string | undefined;
  validUntil: Date | undefined;
  priceMin: number;
  priceMax: number;
  marginNow: number;
};

function QuotationRow({ row: r }: { row: RowData }) {
  const expiringSoon =
    r.status === "sent" &&
    r.validUntil !== undefined &&
    r.validUntil.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

  const kits = r.draft.items.filter((i) => i.kind === "kit");
  const products = r.draft.items.filter((i) => i.kind !== "kit");

  return (
    <tr className="border-b border-hairline last:border-0 hover:bg-surface-alt/50">
      <td className="px-3 py-2.5 align-top">
        <Link
          to="/quotations/$quotationId"
          params={{ quotationId: r.draft.id }}
          search={{ action: undefined }}
          className="font-medium text-ink-900 hover:text-brand-700"
        >
          {r.draft.id}
        </Link>
        <div className="text-[11px] text-ink-500">
          {r.version ? `v${r.version.no}` : "unversioned"} ·{" "}
          {r.draft.mode === "multiple" ? "consolidated" : "single article"}
        </div>
      </td>

      <td className="px-3 py-2.5 align-top">
        <div className="text-ink-900">{r.pod!.buyer}</div>
        <div className="text-[11px] text-ink-500">{r.pod!.id}</div>
      </td>

      {/* Products, compactly grouped — one quotation stays one row. */}
      <td className="max-w-[220px] px-3 py-2.5 align-top">
        {products.length > 0 && (
          <div className="truncate text-[12.5px] text-ink-800" title={products.map((i) => i.name).join(" · ")}>
            {products.map((i) => i.name).join(" · ")}
          </div>
        )}
        {kits.map((k) => (
          <div key={k.id} className="flex items-center gap-1 text-[12.5px] text-ink-800">
            <Boxes className="h-3 w-3 shrink-0 text-[var(--color-cfg-strong)]" aria-hidden />
            <span className="truncate">{k.name}</span>
            <span className="shrink-0 text-[10.5px] text-ink-400">
              {k.members.length} articles · 1 kit
            </span>
          </div>
        ))}
        <div className="truncate text-[10.5px] text-ink-400">
          {r.draft.items
            .flatMap((i) => (i.kind === "kit" ? i.members.map((m) => m.articleId) : [i.articleId]))
            .join(" · ")}
        </div>
      </td>

      <td className="whitespace-nowrap px-3 py-2.5 align-top text-ink-700">
        {fmtDate(r.sentAt) ?? <span className="text-ink-300">—</span>}
      </td>

      <td className="whitespace-nowrap px-3 py-2.5 align-top">
        {r.validUntil ? (
          <span className={cn(expiringSoon ? "font-semibold text-amber-700" : "text-ink-700")}>
            {fmtDate(r.validUntil)}
          </span>
        ) : (
          <span className="text-ink-300">—</span>
        )}
      </td>

      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top">
        <div className="font-semibold tabular-nums text-ink-900">
          {r.priceMin === r.priceMax
            ? usd(r.priceMax)
            : `${usd(r.priceMin)}–${usd(r.priceMax)}`}
        </div>
        <div className="text-[10.5px] tabular-nums text-ink-400">
          {usd(r.totals.orderValueUsd, 0)} order value
        </div>
      </td>

      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-ink-700">
        {pct(r.totals.blendedMarginPct, 1)}
      </td>

      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums">
        {r.risk ? (
          <span className="font-semibold text-red-700">+{r.risk.maxPctUp.toFixed(1)}% ↑</span>
        ) : (
          <span className="text-ink-300">—</span>
        )}
      </td>

      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums">
        {r.risk ? (
          <span
            className={cn(
              "font-semibold",
              r.marginNow < 15 ? "text-red-700" : "text-amber-700",
            )}
          >
            {pct(r.marginNow, 1)}
          </span>
        ) : (
          <span className="text-ink-700">{pct(r.marginNow, 1)}</span>
        )}
      </td>

      <td className="whitespace-nowrap px-3 py-2.5 align-top">
        {r.risk ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
              RISK_PILL[r.risk.level],
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", RISK_DOT[r.risk.level])} aria-hidden />
            {RISK_LABEL[r.risk.level]}
          </span>
        ) : (
          <span className="text-[11px] text-ink-300">None</span>
        )}
      </td>

      <td className="whitespace-nowrap px-3 py-2.5 align-top">
        <span
          className={cn(
            "inline-flex rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
            PIPELINE_TONE[r.status],
          )}
        >
          {PIPELINE_LABEL[r.status]}
        </span>
        {r.state.submitted && r.state.reviewerCount > 0 && r.status === "pending_approval" && (
          <div className="mt-1 text-[10.5px] tabular-nums text-ink-500">
            {r.state.approvedCount}/{r.state.reviewerCount} approved
          </div>
        )}
      </td>

      <td className="px-3 py-2.5 align-top">
        <RowActions row={r} />
      </td>
    </tr>
  );
}

/**
 * Actions follow the status — a draft is continued, a risky or revised
 * quotation is requoted, an accepted one is discussed. View is the one
 * constant, and every action lands on the same detail workspace.
 */
function RowActions({ row: r }: { row: RowData }) {
  const link = (action?: "requote" | "respond") => ({
    to: "/quotations/$quotationId" as const,
    params: { quotationId: r.draft.id },
    search: { action: action ?? undefined },
  });

  const primary =
    r.status === "draft" ? (
      <Action {...link()} tone="solid">
        Continue
      </Action>
    ) : (r.status === "revised" || (r.risk && (r.status === "sent" || r.status === "expired"))) ? (
      <Action {...link("requote")} tone="danger">
        Requote
      </Action>
    ) : r.status === "accepted" ? (
      <Action {...link("respond")} tone="amber">
        Discuss
      </Action>
    ) : null;

  return (
    <div className="flex items-center justify-end gap-1.5">
      {primary}
      <Action {...link()} tone="ghost">
        View <ArrowUpRight className="h-3 w-3" aria-hidden />
      </Action>
    </div>
  );
}

function Action({
  tone,
  children,
  ...link
}: {
  to: "/quotations/$quotationId";
  params: { quotationId: string };
  search: { action: "requote" | "respond" | undefined };
  tone: "solid" | "danger" | "amber" | "ghost";
  children: React.ReactNode;
}) {
  return (
    <Link
      {...link}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
        tone === "solid" && "bg-ink-900 text-white hover:bg-ink-700",
        tone === "danger" && "bg-red-700 text-white hover:bg-red-800",
        tone === "amber" && "bg-amber-500 text-white hover:bg-amber-600",
        tone === "ghost" &&
          "border border-hairline bg-surface font-medium text-ink-700 hover:bg-surface-alt",
      )}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ *
 * Conversion analysis — the funnel, in numbers
 * ------------------------------------------------------------------ */

function ConversionAnalysis({
  rows,
  convertedValue,
}: {
  rows: RowData[];
  convertedValue: number;
}) {
  const total = rows.length;
  const sentOnward = rows.filter((r) =>
    ["sent", "accepted", "converted", "rejected", "expired", "revised"].includes(r.status),
  ).length;
  const accepted = rows.filter((r) => r.status === "accepted" || r.status === "converted").length;
  const converted = rows.filter((r) => r.status === "converted").length;
  const lost = rows.filter((r) => r.status === "rejected" || r.status === "expired").length;
  const rate = sentOnward > 0 ? Math.round((accepted / sentOnward) * 100) : 0;

  const steps = [
    { label: "Quotations raised", value: total },
    { label: "Reached the buyer", value: sentOnward },
    { label: "Accepted", value: accepted },
    { label: "Converted to order", value: converted },
  ];
  const max = Math.max(1, ...steps.map((s) => s.value));

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section className="rounded-lg border border-hairline bg-surface p-5">
        <h2 className="text-[13px] font-semibold text-ink-900">The funnel</h2>
        <div className="mt-4 space-y-3">
          {steps.map((s) => (
            <div key={s.label}>
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="text-ink-700">{s.label}</span>
                <span className="font-semibold tabular-nums text-ink-900">{s.value}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-brand-600"
                  style={{ width: `${(s.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-hairline bg-surface p-5">
        <h2 className="text-[13px] font-semibold text-ink-900">Outcomes</h2>
        <dl className="mt-4 space-y-3 text-[13px]">
          <div className="flex items-baseline justify-between">
            <dt className="text-ink-600">Acceptance rate (of those sent)</dt>
            <dd className="text-[18px] font-semibold tabular-nums text-brand-800">{rate}%</dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-ink-600">Converted order value</dt>
            <dd className="font-semibold tabular-nums text-ink-900">{usd(convertedValue, 0)}</dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-ink-600">Lost or lapsed</dt>
            <dd className="font-semibold tabular-nums text-ink-900">{lost}</dd>
          </div>
          <div className="flex items-baseline justify-between">
            <dt className="text-ink-600">Still in play</dt>
            <dd className="font-semibold tabular-nums text-ink-900">
              {rows.filter((r) => OPEN_STATUSES.has(r.status)).length}
            </dd>
          </div>
        </dl>
        <p className="mt-4 border-t border-hairline pt-3 text-[11px] leading-relaxed text-ink-400">
          Counted from the live pipeline — a quotation moves through this funnel the moment its
          buyer response is recorded.
        </p>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-hairline bg-surface px-2.5 py-2 text-[12.5px] text-ink-700 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState() {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-ink-200 bg-surface px-6 py-14 text-center">
      <FileText className="mx-auto h-6 w-6 text-ink-300" aria-hidden />
      <h2 className="mt-3 text-[15px] font-semibold text-ink-900">No quotations yet</h2>
      <p className="mx-auto mt-1 max-w-[460px] text-[12.5px] text-ink-500">
        A quotation starts on a Costing Report: mark the costing{" "}
        <strong className="font-medium text-ink-700">Ready for Quotation</strong>, then continue to
        Quotation.
      </p>
      <Link
        to="/pods"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-800"
      >
        Go to Costing <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={cn("px-3 py-2 font-medium", align === "right" ? "text-right" : "text-left")}
    >
      {children}
    </th>
  );
}
