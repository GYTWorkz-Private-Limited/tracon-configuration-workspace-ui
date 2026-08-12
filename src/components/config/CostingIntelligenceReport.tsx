// CostingIntelligenceReport — the "Generate Costing" deliverable.
// A full-screen, executive decision intelligence package that transforms the
// configured variants into a rich commercial report: variant comparison,
// financial feasibility, hierarchical cost build-up, trends, historical
// benchmarks and AI recommendations.

import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { SensitivityAnalysis } from "./SensitivityAnalysis";
import {
  X,
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Trophy,
  Scale,
  Layers,
  LineChart,
  History,
  Wand2,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Download,
  Send,
  Target,
  ShieldCheck,
  Zap,
  Info,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PodArticleTabs } from "@/components/layout/ArticleTabsBar";
import { WorkflowStepper } from "@/components/layout/WorkflowStepper";
import {
  ActionGroup,
  RequestedChangesAction,
  RevisionHistoryAction,
  useActionHost,
} from "@/components/changes/FlowActions";

import {
  computeCushion,
  HISTORICAL_BASELINES,
  sensitivity,
  type CushionVariant,
  type CushionMetrics,
  type CushionInputs,
} from "@/lib/cushionCosting";
import { VariantComparisonTable } from "./VariantComparisonTable";
import { ApprovalWorkspace } from "./ApprovalWorkspace";
import { RequestedChangesButton } from "./RequestedChangesButton";
import { RequestedChangesWorkspace } from "./RequestedChangesWorkspace";
import type { ApprovalSnapshot } from "@/lib/approvalsStore";

import { useChangesGate } from "@/lib/requestedChangesStore";
import { useIsReadyForQuotation, READY_LABEL, NOT_READY_LABEL } from "@/lib/quotationReadiness";
import { QuotationEntryFlow } from "@/components/quotation/QuotationEntryFlow";
import { QuotationReadyAction } from "@/components/quotation/QuotationReadyAction";
type Tab = "overview" | "variants" | "financial" | "buildup" | "trends" | "ai";

type ReportArticle = { id: string; name: string; size?: string; moq?: string };

type Props = {
  variants: CushionVariant[];
  activeId: string;
  buyer: string;
  productName: string;
  srfId: string;
  targetPriceUsd: number;
  onClose: () => void;
  onPromote?: (variantId: string) => void;
  /** shell context — reused from the costing workspace */
  podRef?: string;
  buyerRef?: string;
  statusLabel?: string;
  updatedAt?: string;
  articles?: ReportArticle[];
  activeArticleId?: string;
  onSelectArticle?: (id: string) => void;
  navPodId?: string;
  navArticleId?: string;
  /** what-if driver changes applied from the Sensitivity analysis section */
  onApplySensitivity?: (patch: Partial<CushionInputs>) => void;
  initialApprovalOpen?: boolean;
};

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Executive summary", icon: Trophy },
  { id: "variants", label: "Variant comparison", icon: Scale },
  { id: "financial", label: "Financial analysis", icon: Target },
  { id: "buildup", label: "Cost build-up", icon: Layers },
  { id: "trends", label: "Trends & benchmarks", icon: LineChart },
  { id: "ai", label: "AI insights", icon: Sparkles },
];

export function CostingIntelligenceReport({
  variants,
  activeId,
  buyer,
  productName,
  srfId,
  targetPriceUsd,
  onClose,
  onPromote,
  podRef,
  buyerRef,
  statusLabel,
  updatedAt,
  articles,
  activeArticleId,
  onSelectArticle,
  navPodId,
  navArticleId,
  onApplySensitivity,
  initialApprovalOpen,
}: Props) {
  const changesGate = useChangesGate();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [promoted, setPromoted] = useState<string>(activeId);
  const [approvalOpen, setApprovalOpen] = useState(initialApprovalOpen ?? false);
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  useActionHost();

  /**
   * Readiness is the gate between costing and quotation. Until this article is
   * marked ready, "Continue to Quotation" is not the action on offer — the
   * decision in front of the user is whether the costing is finished at all.
   */
  const isReady = useIsReadyForQuotation(navPodId, navArticleId);

  const metricsByVariant = useMemo(
    () =>
      variants.map((v) => ({
        variant: v,
        metrics: computeCushion(v.inputs),
      })),
    [variants],
  );

  const active = metricsByVariant.find((x) => x.variant.id === promoted) ?? metricsByVariant[0];
  const cheapest = [...metricsByVariant].sort(
    (a, b) => a.metrics.suggestedQuoteUsd - b.metrics.suggestedQuoteUsd,
  )[0];
  const bestMargin = [...metricsByVariant].sort(
    (a, b) => b.metrics.quoteMarginPct - a.metrics.quoteMarginPct,
  )[0];
  const bestValue = [...metricsByVariant].sort((a, b) => {
    // heuristic score: within-target quotes + margin
    const scoreA =
      (a.metrics.suggestedQuoteUsd <= targetPriceUsd ? 1 : 0) * 100 +
      a.metrics.quoteMarginPct * 100;
    const scoreB =
      (b.metrics.suggestedQuoteUsd <= targetPriceUsd ? 1 : 0) * 100 +
      b.metrics.quoteMarginPct * 100;
    return scoreB - scoreA;
  })[0];

  if (changesOpen) {
    return (
      <RequestedChangesWorkspace
        productName={productName}
        podRef={podRef ?? srfId}
        buyer={buyer}
        buyerRef={buyerRef}
        updatedAt={updatedAt}
        variantName={active.variant.name}
        summaryRows={[
          {
            label: "Size",
            value: active.variant.inputs.sizeInches
              ? `${active.variant.inputs.sizeInches}" \u00d7 ${active.variant.inputs.sizeInches}"`
              : "\u2014",
          },
          { label: "MOQ", value: `${active.variant.inputs.qty.toLocaleString()} pcs` },
          {
            label: "Quality",
            value: active.variant.inputs.fabricGsm
              ? `${active.variant.inputs.fabricGsm} GSM`
              : "\u2014",
          },
          { label: "Quote / pc", value: `$${active.metrics.suggestedQuoteUsd.toFixed(2)}` },
          { label: "Margin", value: `${(active.metrics.quoteMarginPct * 100).toFixed(1)}%` },
          { label: "Target", value: `$${targetPriceUsd.toFixed(2)}` },
        ]}
        onClose={() => setChangesOpen(false)}
        navPodId={navPodId}
        navArticleId={navArticleId}
        costingRef={srfId}
      />
    );
  }

  if (approvalOpen) {
    return (
      <ApprovalWorkspace
        variants={variants}
        activeId={promoted}
        buyer={buyer}
        productName={productName}
        srfId={srfId}
        targetPriceUsd={targetPriceUsd}
        onClose={() => setApprovalOpen(false)}
        podRef={podRef}
        buyerRef={buyerRef}
        statusLabel="Ready for approval"
        updatedAt={updatedAt}
        articles={articles}
        activeArticleId={activeArticleId}
        onSelectArticle={onSelectArticle}
        navPodId={navPodId}
        navArticleId={navArticleId}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      {/* Header — same shell as Product / Configuration / Costing */}
      <header className="shrink-0 border-b border-hairline bg-surface px-6 py-3 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={() => {
                // Back means the costing this report is about — the sheet on
                // the configuration route.
                if (navPodId && navArticleId) {
                  navigate({
                    to: "/config/$podId/$articleId",
                    params: { podId: navPodId, articleId: navArticleId },
                    search: { sel: undefined },
                  });
                  return;
                }
                onClose();
              }}
              aria-label="Back to Configuration & Costing"
              className="mt-1 rounded-md p-1 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[20px] font-semibold tracking-tight text-ink-900">
                  {productName}
                </h1>
                <span
                  suppressHydrationWarning
                  className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-400"
                >
                  {podRef ?? srfId}
                </span>
                {/* Two different facts, deliberately both shown: how the
                    costing itself stands, and whether it has been released to
                    be quoted. */}
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-700">
                  {statusLabel ?? "Costing report"}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    isReady
                      ? "bg-brand-50 text-brand-700"
                      : "border border-hairline bg-surface text-ink-500",
                  )}
                >
                  {isReady ? (
                    <CheckCircle2 className="h-3 w-3" aria-hidden />
                  ) : (
                    <AlertTriangle className="h-3 w-3" aria-hidden />
                  )}
                  {isReady ? READY_LABEL : NOT_READY_LABEL}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-ink-500">
                <span>
                  Buyer <span className="text-ink-900">{buyer}</span>
                </span>
                {buyerRef && (
                  <span>
                    Buyer Ref <span className="text-ink-900">{buyerRef}</span>
                  </span>
                )}
                {updatedAt && (
                  <span>
                    Last updated <span className="text-ink-900">{updatedAt}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Grouped actions — always right; secondary first, primary last. */}
          <ActionGroup>
            <button
              onClick={() => setCopilotOpen((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors",
                copilotOpen
                  ? "border-brand-700 bg-brand-50 text-brand-700"
                  : "border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
              )}
            >
              <Sparkles className="h-4 w-4" /> AI Copilot
            </button>
            {changesGate.submitted && <RequestedChangesAction />}
            {changesGate.submitted && <RevisionHistoryAction />}
            {/* One decision at a time: mark the costing ready, then quote it.
                The status shows where it stands once it is set, and stays
                reversible — a costing that has changed is no longer signed
                off. */}
            <QuotationReadyAction
              podId={navPodId}
              articleId={navArticleId}
              articleName={productName}
              onGenerate={() => setSelectOpen(true)}
            />
          </ActionGroup>
        </div>
      </header>

      <WorkflowStepper
        active="Costing Report"
        podId={navPodId}
        articleId={navArticleId}
        costingRef={srfId}
        onStepClick={(step) => {
          if (step === "Costing Report") return true;
          if (step === "Costing") {
            onClose();
            return true;
          }
          onClose();
          return false;
        }}
      />

      {/* Product details — full-bleed card, report tabs live inside */}
      <div className="shrink-0 border-b border-hairline bg-surface">
        <div className="border-b border-hairline bg-gradient-to-r from-brand-50/50 via-white to-white px-6 py-3 lg:px-8">
          <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
            <div className="min-w-[200px]">
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
                Product
              </div>
              <div className="mt-0.5 text-[15px] font-semibold leading-tight text-ink-900">
                {productName}
              </div>
              <div className="text-[11.5px] text-ink-600">
                {buyer}
                {buyerRef ? ` · ${buyerRef}` : ""}
              </div>
            </div>
            <VContextCell
              label="Variant"
              value={active.variant.name}
              sub={active.variant.tagline}
              accent
            />
            <VContextCell
              label="Size"
              value={
                active.variant.inputs.sizeInches
                  ? `${active.variant.inputs.sizeInches}" × ${active.variant.inputs.sizeInches}"`
                  : "—"
              }
            />
            <VContextCell label="MOQ" value={`${active.variant.inputs.qty.toLocaleString()} pcs`} />
            <VContextCell
              label="Quality"
              value={
                active.variant.inputs.fabricGsm ? `${active.variant.inputs.fabricGsm} GSM` : "—"
              }
            />
            <VContextCell
              label="Quotation status"
              value={isReady ? READY_LABEL : NOT_READY_LABEL}
            />
          </div>
        </div>

        {/* Report navigation */}
        <div className="flex items-center gap-1 overflow-x-auto px-6 py-2 lg:px-8">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] transition-colors",
                  isActive
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-surface-alt hover:text-ink-900",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 pl-3">
            <span className="whitespace-nowrap text-[11.5px] text-ink-500">read only report</span>
            <button className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1 text-[12px] text-ink-700 hover:bg-surface-alt">
              <Download className="h-3.5 w-3.5" /> Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1720px] px-6 py-6 lg:px-8">
            {tab === "overview" && (
              <OverviewTab
                active={active}
                metricsByVariant={metricsByVariant}
                cheapest={cheapest}
                bestMargin={bestMargin}
                bestValue={bestValue}
                targetPriceUsd={targetPriceUsd}
                productName={productName}
                onApplySensitivity={onApplySensitivity}
                promoted={promoted}
                onPromote={(id) => {
                  setPromoted(id);
                  onPromote?.(id);
                }}
              />
            )}
            {tab === "variants" && (
              <div className="-mx-6 -my-6 overflow-x-auto lg:-mx-8">
                <VariantComparisonTable
                  variants={variants}
                  activeId={active.variant.id}
                  productName={productName}
                  targetPriceUsd={targetPriceUsd}
                />
              </div>
            )}

            {tab === "financial" && <FinancialTab entry={active} targetPriceUsd={targetPriceUsd} />}
            {tab === "buildup" && <CostBuildupTab entry={active} />}
            {tab === "trends" && <TrendsTab entry={active} />}
            {tab === "ai" && (
              <AiInsightsTab
                entry={active}
                metricsByVariant={metricsByVariant}
                targetPriceUsd={targetPriceUsd}
              />
            )}
          </div>
        </div>

        {copilotOpen && (
          <aside className="hidden w-[340px] shrink-0 border-l border-hairline bg-white xl:block">
            <ReportCopilot
              entry={active}
              targetPriceUsd={targetPriceUsd}
              onClose={() => setCopilotOpen(false)}
              onOpenTab={(t) => setTab(t)}
            />
          </aside>
        )}

        {revisionsOpen && (
          <aside className="hidden w-[340px] shrink-0 border-l border-hairline bg-white xl:block">
            <RevisionHistoryPanel entry={active} onClose={() => setRevisionsOpen(false)} />
          </aside>
        )}
      </div>

      {/* Bottom — shared article tabs */}
      <PodArticleTabs podId={navPodId} activeId={activeArticleId ?? navArticleId} stage="Costing" />

      {/*
       * Continuing to Quotation is two decisions, not one: this costing is
       * ready (settled above), and then — one product, or several?
       */}
      {navPodId && (
        <QuotationEntryFlow
          open={selectOpen}
          onClose={() => setSelectOpen(false)}
          podId={navPodId}
          articleId={navArticleId}
          articleName={productName}
        />
      )}
    </div>
  );
}

/* -------------------- Report copilot (read-only) -------------------- */

function ReportCopilot({
  entry,
  targetPriceUsd,
  onClose,
  onOpenTab,
}: {
  entry: Entry;
  targetPriceUsd: number;
  onClose: () => void;
  onOpenTab: (t: Tab) => void;
}) {
  const m = entry.metrics;
  const fx = entry.variant.inputs.fxRate;
  const drivers = [
    { label: "Fabric", v: m.fabricSubtotal },
    { label: "Making", v: m.makingSubtotal },
    { label: "Overhead", v: m.overhead },
  ].sort((a, b) => b.v - a.v);
  const gap = m.suggestedQuoteUsd - targetPriceUsd;

  const notes: { q: string; a: string; tab?: Tab }[] = [
    {
      q: "What drives this cost?",
      a: `${drivers[0].label} is the largest block at ₹${drivers[0].v.toFixed(2)}/pc (${((drivers[0].v / (m.fabricSubtotal + m.makingSubtotal + m.overhead)) * 100).toFixed(0)}% of direct cost). ${drivers[1].label} follows at ₹${drivers[1].v.toFixed(2)}.`,
      tab: "buildup",
    },
    {
      q: "How does it read commercially?",
      a: `Quote $${m.suggestedQuoteUsd.toFixed(2)} at ${(m.quoteMarginPct * 100).toFixed(1)}% margin, FX ₹${fx.toFixed(1)}/$. Buyer target $${targetPriceUsd.toFixed(2)} — ${gap <= 0 ? `${Math.abs(gap).toFixed(2)} headroom` : `${gap.toFixed(2)} above target`}.`,
      tab: "financial",
    },
    {
      q: "Where is the saving?",
      a: "Marker optimisation on waste, higher MOQ tier on fabric, and consolidating trims are the three fastest levers without a spec change.",
      tab: "ai",
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2.5">
        <Sparkles className="h-4 w-4 text-brand-700" />
        <span className="text-[13px] font-medium text-ink-900">Report copilot</span>
        <span className="ml-auto text-[11px] text-ink-500">read only</span>
        <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:text-ink-900">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {notes.map((n) => (
          <div key={n.q} className="rounded-xl border border-hairline bg-white p-3 shadow-sm">
            <div className="text-[12px] font-medium text-ink-900">{n.q}</div>
            <div className="mt-1 text-[12px] leading-relaxed text-ink-600">{n.a}</div>
            {n.tab && (
              <button
                onClick={() => onOpenTab(n.tab!)}
                className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-brand-700 hover:underline"
              >
                Open section <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        <div className="rounded-xl bg-surface-alt p-3 text-[11.5px] leading-relaxed text-ink-600">
          The copilot only explains this report. To change any value, go back to Configuration and
          regenerate the costing.
        </div>
      </div>
    </div>
  );
}

/* -------------------- Revision history -------------------- */

function RevisionHistoryPanel({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const m = entry.metrics;
  const revisions = [
    {
      by: "Priya S.",
      what: "Target margin",
      from: "18.0%",
      to: `${(entry.variant.inputs.targetMarginPct * 100).toFixed(1)}%`,
      at: "Today · 09:14",
      reason: "Aligned with buyer programme margin floor",
    },
    {
      by: "Rohit P.",
      what: "MOQ",
      from: "1,000 pcs",
      to: `${entry.variant.inputs.qty.toLocaleString()} pcs`,
      at: "Yesterday · 17:42",
      reason: "Buyer confirmed higher first drop",
    },
    {
      by: "Gautam K.",
      what: "Suggested quote",
      from: `$${(m.suggestedQuoteUsd * 1.04).toFixed(2)}`,
      to: `$${m.suggestedQuoteUsd.toFixed(2)}`,
      at: "Yesterday · 11:05",
      reason: "Waste reduced to 4% after marker optimisation",
    },
  ];
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div className="flex items-center gap-2 border-b border-hairline px-3 py-2.5">
        <History className="h-4 w-4 text-ink-700" />
        <span className="text-[13px] font-medium text-ink-900">Revision history</span>
        <span className="ml-auto text-[11px] tabular-nums text-ink-500">{revisions.length}</span>
        <button onClick={onClose} className="rounded-md p-1 text-ink-400 hover:text-ink-900">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {revisions.map((r, i) => (
          <div key={i} className="rounded-xl border border-hairline bg-white p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12.5px] font-medium text-ink-900">{r.what}</span>
              <span className="text-[10.5px] text-ink-500">{r.at}</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[12px] tabular-nums">
              <span className="text-ink-500 line-through">{r.from}</span>
              <span className="text-ink-300">→</span>
              <span className="font-medium text-brand-700">{r.to}</span>
            </div>
            <div className="mt-1 text-[11.5px] text-ink-600">{r.reason}</div>
            <div className="mt-1 text-[11px] text-ink-500">by {r.by}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildApprovalSnapshot({
  productName,
  buyer,
  srfId,
  targetPriceUsd,
  active,
  metricsByVariant,
}: {
  productName: string;
  buyer: string;
  srfId: string;
  targetPriceUsd: number;
  active: { variant: CushionVariant; metrics: CushionMetrics };
  metricsByVariant: { variant: CushionVariant; metrics: CushionMetrics }[];
}): ApprovalSnapshot {
  const { variant, metrics } = active;
  const i = variant.inputs;
  const totalUsd = metrics.suggestedQuoteUsd;
  const costUsd = metrics.totalPc / i.fxRate;
  const marginPct = metrics.quoteMarginPct * 100;
  const totalDirect = metrics.fabricSubtotal + metrics.makingSubtotal;
  const pct = (v: number) => (totalDirect > 0 ? (v / totalDirect) * 100 : 0);
  const bestMargin = [...metricsByVariant].sort(
    (a, b) => b.metrics.quoteMarginPct - a.metrics.quoteMarginPct,
  )[0];

  return {
    productName,
    buyer,
    articleId: srfId,
    articleCode: `${srfId}-${variant.id.toUpperCase()}`,
    srfId,
    moq: `${i.qty.toLocaleString()} pcs`,
    size: i.sizeInches ? `${i.sizeInches}" × ${i.sizeInches}"` : "—",
    supplier: "Karur Mills",
    scenarioName: variant.name,
    sellingPrice: Number(totalUsd.toFixed(2)),
    cost: Number(costUsd.toFixed(2)),
    margin: Number(marginPct.toFixed(1)),
    targetPrice: targetPriceUsd,
    confidence: 86,
    commercialHealth: marginPct >= 22 ? "Strong" : marginPct >= 15 ? "Watch" : "At Risk",
    configGroups: [
      {
        label: "Material",
        items: [
          {
            label: "Front Fabric",
            value: `Cotton ${i.fabricGsm ?? 200} GSM`,
            cost: `₹${metrics.frontPc.toFixed(2)}`,
          },
          { label: "Back Fabric", value: `Solid dyed`, cost: `₹${metrics.backPc.toFixed(2)}` },
          { label: "GSM", value: String(i.fabricGsm ?? 200) },
          {
            label: "Piping",
            value: `${(i.pipingRatio * 100).toFixed(0)}%`,
            cost: `₹${metrics.pipingPc.toFixed(2)}`,
          },
        ],
      },
      {
        label: "Making",
        items: [
          { label: "Cutting", value: "Standard", cost: `₹${metrics.cuttingPc.toFixed(2)}` },
          { label: "Stitching", value: "In-house", cost: `₹${metrics.stitchingPc.toFixed(2)}` },
          {
            label: "Embroidery",
            value: i.embroidery > 0 ? "Included" : "None",
            cost: `₹${metrics.embroideryPc.toFixed(2)}`,
          },
          { label: "Packaging", value: "Retail-ready", cost: `₹${metrics.packagingPc.toFixed(2)}` },
        ],
      },
      {
        label: "Commercial",
        items: [
          { label: "MOQ", value: `${i.qty.toLocaleString()} pcs` },
          { label: "Target Margin", value: `${(i.targetMarginPct * 100).toFixed(1)}%` },
          { label: "FX Rate", value: `₹${i.fxRate.toFixed(1)} / $` },
          { label: "Overhead", value: `${(i.overheadPct * 100).toFixed(1)}%` },
        ],
      },
    ],
    costRows: [
      {
        label: "Fabric",
        cost: metrics.fabricSubtotal / i.fxRate,
        pct: pct(metrics.fabricSubtotal),
        color: "#05604d",
      },
      {
        label: "Making",
        cost: metrics.makingSubtotal / i.fxRate,
        pct: pct(metrics.makingSubtotal),
        color: "#2d8f7a",
      },
      {
        label: "Overhead",
        cost: metrics.overhead / i.fxRate,
        pct: pct(metrics.overhead),
        color: "#c69324",
      },
      {
        label: "Margin",
        cost: metrics.targetMarginRupees / i.fxRate,
        pct: (metrics.targetMarginRupees / (metrics.totalPc + metrics.targetMarginRupees)) * 100,
        color: "#0a7460",
      },
    ],
    aiSummary: {
      verdict: `Commercially ${marginPct >= 22 ? "viable" : "tight"} at ${marginPct.toFixed(1)}% margin. Suggested quote $${totalUsd.toFixed(2)} vs buyer target $${targetPriceUsd.toFixed(2)}.`,
      risks: [
        "Cotton yarn volatility could shave 1–1.5 pt margin",
        "Buyer typically pushes 2% discount at PO",
      ],
      confidence: 86,
      bestScenario: bestMargin
        ? `${bestMargin.variant.name} — ${(bestMargin.metrics.quoteMarginPct * 100).toFixed(1)}% margin`
        : variant.name,
      recommendations: [
        "Lock 90-day forward with primary mill",
        "Qualify secondary supplier to hedge lead time",
        "Trial value-tier packaging on higher MOQ tier",
      ],
    },
    history: {
      similarProducts: 7,
      previousMargin: 19.8,
      winRate: 71,
      similarBuyers: ["West Elm", "IKEA", "Marks & Spencer"],
      historicalSupplier: "Karur Mills · 12 orders",
      avgLeadTime: "44 days",
    },
  };
}

/* -------------------- Overview -------------------- */

type Entry = { variant: CushionVariant; metrics: CushionMetrics };

function OverviewTab({
  active,
  metricsByVariant,
  cheapest,
  bestMargin,
  bestValue,
  targetPriceUsd,
  productName,
  onApplySensitivity,
  promoted,
  onPromote,
}: {
  active: Entry;
  metricsByVariant: Entry[];
  cheapest: Entry;
  bestMargin: Entry;
  bestValue: Entry;
  targetPriceUsd: number;
  productName: string;
  onApplySensitivity?: (patch: Partial<CushionInputs>) => void;
  promoted: string;
  onPromote: (id: string) => void;
}) {
  const gap = active.metrics.suggestedQuoteUsd - targetPriceUsd;
  const onTarget = gap <= 0.02;

  return (
    <div className="grid grid-cols-12 gap-5">
      {/* Verdict card */}
      <section className="col-span-12 rounded-2xl border border-hairline bg-white p-5">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl",
              onTarget ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
            )}
          >
            {onTarget ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <AlertTriangle className="h-6 w-6" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
              Commercial verdict
            </div>
            <div className="mt-1 text-[20px] font-medium text-ink-900">
              {onTarget
                ? `Quotation is commercially feasible at $${active.metrics.suggestedQuoteUsd.toFixed(2)}`
                : `Quotation runs $${gap.toFixed(2)} above the buyer target`}
            </div>
            <div className="mt-1 text-[13px] text-ink-500">
              {onTarget
                ? `Recommended: proceed with ${active.variant.name} — meets $${targetPriceUsd.toFixed(2)} target with ${(active.metrics.quoteMarginPct * 100).toFixed(0)}% margin.`
                : `Consider ${bestValue.variant.name} — closes the gap to $${(bestValue.metrics.suggestedQuoteUsd - targetPriceUsd).toFixed(2)} with ${(bestValue.metrics.quoteMarginPct * 100).toFixed(0)}% margin.`}
            </div>
          </div>
          <button
            onClick={() => onPromote(bestValue.variant.id)}
            className="rounded-md border border-hairline px-3 py-1.5 text-[12px] font-medium text-ink-800 hover:bg-surface-alt"
          >
            Promote {bestValue.variant.name}
          </button>
        </div>
      </section>

      {/* KPI strip */}
      <div className="col-span-12 grid grid-cols-4 gap-3">
        <KpiCard
          label="Suggested selling price"
          value={`$${active.metrics.suggestedQuoteUsd.toFixed(2)}`}
          sub={`total ₹${active.metrics.totalPc.toFixed(0)}/pc`}
          tone={onTarget ? "good" : "warn"}
        />
        <KpiCard
          label="Target achievement"
          value={onTarget ? "Meets target" : `${gap > 0 ? "+" : ""}$${gap.toFixed(2)}`}
          sub={`buyer target $${targetPriceUsd.toFixed(2)}`}
          tone={onTarget ? "good" : "warn"}
        />
        <KpiCard
          label="Margin"
          value={`${(active.metrics.quoteMarginPct * 100).toFixed(1)}%`}
          sub={`gross · ₹${active.metrics.targetMarginRupees.toFixed(0)}/pc profit`}
          tone="good"
        />
        <KpiCard
          label="Order value"
          value={`$${(active.metrics.suggestedQuoteUsd * active.variant.inputs.qty).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub={`${active.variant.inputs.qty.toLocaleString()} pcs MOQ`}
          tone="neutral"
        />
      </div>

      {/* Recommendations */}
      <section className="col-span-8 rounded-2xl border border-hairline bg-white p-4">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-brand-700">
          <Sparkles className="h-3.5 w-3.5" /> AI recommendation
        </div>
        <div className="mt-2 grid grid-cols-3 gap-3">
          <RecommendationTile
            title="Best value"
            variant={bestValue.variant.name}
            price={bestValue.metrics.suggestedQuoteUsd}
            note="Best trade-off of target-fit and margin"
            highlight
            promoted={promoted === bestValue.variant.id}
            onPromote={() => onPromote(bestValue.variant.id)}
          />
          <RecommendationTile
            title="Cheapest"
            variant={cheapest.variant.name}
            price={cheapest.metrics.suggestedQuoteUsd}
            note={`${(cheapest.metrics.quoteMarginPct * 100).toFixed(0)}% margin — aggressive`}
            promoted={promoted === cheapest.variant.id}
            onPromote={() => onPromote(cheapest.variant.id)}
          />
          <RecommendationTile
            title="Highest margin"
            variant={bestMargin.variant.name}
            price={bestMargin.metrics.suggestedQuoteUsd}
            note={`${(bestMargin.metrics.quoteMarginPct * 100).toFixed(0)}% margin — premium`}
            promoted={promoted === bestMargin.variant.id}
            onPromote={() => onPromote(bestMargin.variant.id)}
          />
        </div>
      </section>

      {/* Decision Q&A */}
      <section className="col-span-4 rounded-2xl border border-hairline bg-white p-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
          Decision support
        </div>
        <ul className="mt-2 space-y-2 text-[12.5px]">
          <QaRow
            q="Can we meet buyer target?"
            a={onTarget ? "Yes" : "Not with current variant"}
            good={onTarget}
          />
          <QaRow
            q="Is it commercially feasible?"
            a={active.metrics.quoteMarginPct >= 0.15 ? "Yes" : "Marginal"}
            good={active.metrics.quoteMarginPct >= 0.15}
          />
          <QaRow q="Safest pricing strategy?" a={`Promote ${bestValue.variant.name}`} good />
          <QaRow q="Top cost driver?" a="Front fabric ~48%" good={false} neutral />
          <QaRow q="FX exposure?" a={`₹${active.variant.inputs.fxRate}/$`} good neutral />
        </ul>
      </section>

      {/* Sensitivity analysis — what-if drivers, below AI recommendations */}
      <div className="col-span-12">
        <SensitivityAnalysis
          active={active.variant}
          productName={productName}
          targetPriceUsd={targetPriceUsd}
          onApply={(patch) => onApplySensitivity?.(patch)}
        />
      </div>

      {/* Variant snapshot table */}
      <section className="col-span-12 rounded-2xl border border-hairline bg-white p-4">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
          <Scale className="h-3.5 w-3.5" /> Variants at a glance
        </div>
        <VariantMiniTable
          metricsByVariant={metricsByVariant}
          targetPriceUsd={targetPriceUsd}
          promoted={promoted}
          onPromote={onPromote}
        />
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "good" | "warn" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        tone === "good"
          ? "border-emerald-200 bg-emerald-50/50"
          : tone === "warn"
            ? "border-amber-200 bg-amber-50/50"
            : "border-hairline bg-white",
      )}
    >
      <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-[22px] font-semibold tabular-nums",
          tone === "good"
            ? "text-emerald-700"
            : tone === "warn"
              ? "text-amber-700"
              : "text-ink-900",
        )}
      >
        {value}
      </div>
      <div className="text-[11.5px] text-ink-500">{sub}</div>
    </div>
  );
}

function RecommendationTile({
  title,
  variant,
  price,
  note,
  highlight,
  promoted,
  onPromote,
}: {
  title: string;
  variant: string;
  price: number;
  note: string;
  highlight?: boolean;
  promoted?: boolean;
  onPromote: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        highlight ? "border-brand-300 bg-brand-50/40" : "border-hairline bg-surface-alt/40",
      )}
    >
      <div className="flex items-center gap-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-brand-700">
        <Trophy className="h-3 w-3" /> {title}
      </div>
      <div className="mt-1 text-[13.5px] font-medium text-ink-900">{variant}</div>
      <div className="text-[19px] font-semibold tabular-nums text-ink-900">${price.toFixed(2)}</div>
      <div className="text-[11.5px] text-ink-500">{note}</div>
      <button
        onClick={onPromote}
        className={cn(
          "mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium",
          promoted ? "bg-emerald-600 text-white" : "bg-brand-700 text-white hover:bg-brand-800",
        )}
      >
        {promoted ? (
          <>
            <CheckCircle2 className="h-3 w-3" /> Promoted
          </>
        ) : (
          <>Promote as final</>
        )}
      </button>
    </div>
  );
}

function QaRow({
  q,
  a,
  good,
  neutral,
}: {
  q: string;
  a: string;
  good: boolean;
  neutral?: boolean;
}) {
  return (
    <li className="flex items-start justify-between gap-3 border-b border-hairline/60 pb-1.5 last:border-0">
      <span className="text-ink-600">{q}</span>
      <span
        className={cn(
          "shrink-0 text-right font-medium",
          neutral ? "text-ink-900" : good ? "text-emerald-700" : "text-amber-700",
        )}
      >
        {a}
      </span>
    </li>
  );
}

function VariantMiniTable({
  metricsByVariant,
  targetPriceUsd,
  promoted,
  onPromote,
}: {
  metricsByVariant: Entry[];
  targetPriceUsd: number;
  promoted: string;
  onPromote: (id: string) => void;
}) {
  return (
    <table className="w-full text-[12.5px]">
      <thead>
        <tr className="border-b border-hairline text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
          <th className="py-2 text-left font-medium">Variant</th>
          <th className="py-2 text-right font-medium">MOQ</th>
          <th className="py-2 text-right font-medium">Total ₹/pc</th>
          <th className="py-2 text-right font-medium">Material cost</th>
          <th className="py-2 text-right font-medium">Quote $</th>
          <th className="py-2 text-right font-medium">vs Target</th>
          <th className="py-2 text-right font-medium">Margin</th>
          <th className="py-2 text-right font-medium">Order value</th>
          <th className="py-2 text-right font-medium"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-hairline">
        {metricsByVariant.map(({ variant: v, metrics: m }) => {
          const gap = m.suggestedQuoteUsd - targetPriceUsd;
          return (
            <tr
              key={v.id}
              className={cn("hover:bg-surface-alt/40", promoted === v.id && "bg-emerald-50/40")}
            >
              <td className="py-2">
                <div className="font-medium text-ink-900">{v.name}</div>
                <div className="text-[11px] text-ink-500">{v.tagline}</div>
              </td>
              <td className="py-2 text-right tabular-nums text-ink-800">
                {v.inputs.qty.toLocaleString()}
              </td>
              <td className="py-2 text-right tabular-nums text-ink-800">₹{m.totalPc.toFixed(0)}</td>
              <td className="py-2 text-right tabular-nums text-ink-700">
                ₹{m.materialCost.toFixed(0)}
              </td>
              <td className="py-2 text-right tabular-nums font-medium text-ink-900">
                ${m.suggestedQuoteUsd.toFixed(2)}
              </td>
              <td
                className={cn(
                  "py-2 text-right tabular-nums",
                  gap <= 0 ? "text-emerald-700" : "text-amber-700",
                )}
              >
                {gap <= 0 ? `-$${Math.abs(gap).toFixed(2)}` : `+$${gap.toFixed(2)}`}
              </td>
              <td
                className={cn(
                  "py-2 text-right tabular-nums",
                  m.quoteMarginPct >= 0.2 ? "text-emerald-700" : "text-amber-700",
                )}
              >
                {(m.quoteMarginPct * 100).toFixed(1)}%
              </td>
              <td className="py-2 text-right tabular-nums text-ink-800">
                $
                {(m.suggestedQuoteUsd * v.inputs.qty).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </td>
              <td className="py-2 text-right">
                <button
                  onClick={() => onPromote(v.id)}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[11px] font-medium",
                    promoted === v.id
                      ? "bg-emerald-600 text-white"
                      : "border border-hairline text-ink-700 hover:bg-surface-alt",
                  )}
                >
                  {promoted === v.id ? "Promoted" : "Promote"}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* -------------------- Variants tab -------------------- */

function VariantsTab({
  metricsByVariant,
  targetPriceUsd,
  promoted,
  onPromote,
  bestValue,
}: {
  metricsByVariant: Entry[];
  targetPriceUsd: number;
  promoted: string;
  onPromote: (id: string) => void;
  bestValue: Entry;
}) {
  const rows: {
    key: string;
    label: string;
    kind?: "money" | "pct" | "int" | "text";
    get: (e: Entry) => number | string;
  }[] = [
    { key: "moq", label: "MOQ (pcs)", kind: "int", get: (e) => e.variant.inputs.qty },
    {
      key: "size",
      label: "Size",
      kind: "text",
      get: (e) => `${e.variant.inputs.sizeInches ?? 18}"`,
    },
    {
      key: "fabric",
      label: "Fabric subtotal ₹/pc",
      kind: "money",
      get: (e) => e.metrics.fabricSubtotal,
    },
    {
      key: "making",
      label: "Making subtotal ₹/pc",
      kind: "money",
      get: (e) => e.metrics.makingSubtotal,
    },
    { key: "overhead", label: "Overhead ₹/pc", kind: "money", get: (e) => e.metrics.overhead },
    { key: "total", label: "Total cost ₹/pc", kind: "money", get: (e) => e.metrics.totalPc },
    {
      key: "quote",
      label: "Suggested quote $",
      kind: "money",
      get: (e) => e.metrics.suggestedQuoteUsd,
    },
    {
      key: "gap",
      label: "vs Target",
      kind: "money",
      get: (e) => e.metrics.suggestedQuoteUsd - targetPriceUsd,
    },
    { key: "margin", label: "Gross margin", kind: "pct", get: (e) => e.metrics.quoteMarginPct },
    {
      key: "profitpc",
      label: "Profit / pc (₹)",
      kind: "money",
      get: (e) => e.metrics.targetMarginRupees,
    },
    {
      key: "order",
      label: "Order revenue ($)",
      kind: "money",
      get: (e) => e.metrics.suggestedQuoteUsd * e.variant.inputs.qty,
    },
    {
      key: "orderprofit",
      label: "Order profit (₹)",
      kind: "money",
      get: (e) => e.metrics.targetMarginRupees * e.variant.inputs.qty,
    },
    {
      key: "risk",
      label: "Commercial risk",
      kind: "text",
      get: (e) =>
        e.metrics.quoteMarginPct >= 0.24
          ? "Low"
          : e.metrics.quoteMarginPct >= 0.18
            ? "Medium"
            : "High",
    },
  ];

  const fmt = (kind: string | undefined, v: number | string) => {
    if (typeof v === "string") return v;
    if (kind === "money") {
      if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
      return v.toFixed(2);
    }
    if (kind === "pct") return `${((v as number) * 100).toFixed(1)}%`;
    return (v as number).toLocaleString();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-brand-700">
          <Sparkles className="h-3.5 w-3.5" /> Best value recommendation
        </div>
        <div className="mt-1 text-[15px] text-ink-900">
          <span className="font-medium">{bestValue.variant.name}</span> offers the strongest
          commercial position — quote ${bestValue.metrics.suggestedQuoteUsd.toFixed(2)} at{" "}
          {(bestValue.metrics.quoteMarginPct * 100).toFixed(0)}% margin.
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-hairline bg-white">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-hairline">
              <th className="sticky left-0 z-10 bg-white py-2 pl-4 pr-3 text-left text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
                Metric
              </th>
              {metricsByVariant.map((e) => (
                <th
                  key={e.variant.id}
                  className={cn(
                    "min-w-[180px] py-2 px-3 text-right",
                    promoted === e.variant.id && "bg-emerald-50/50",
                  )}
                >
                  <div className="text-[12px] font-medium text-ink-900">{e.variant.name}</div>
                  <div className="text-[10.5px] text-ink-500">{e.variant.tagline}</div>
                  <button
                    onClick={() => onPromote(e.variant.id)}
                    className={cn(
                      "mt-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-medium",
                      promoted === e.variant.id
                        ? "bg-emerald-600 text-white"
                        : "border border-hairline text-ink-700 hover:bg-surface-alt",
                    )}
                  >
                    {promoted === e.variant.id ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" /> Promoted
                      </>
                    ) : (
                      "Promote"
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((r) => {
              const values = metricsByVariant.map((e) => r.get(e));
              const numerics = values.filter((v) => typeof v === "number") as number[];
              const min = Math.min(...numerics);
              const max = Math.max(...numerics);
              const bestIsHigh =
                r.key === "margin" ||
                r.key === "profitpc" ||
                r.key === "order" ||
                r.key === "orderprofit";
              return (
                <tr key={r.key}>
                  <td className="sticky left-0 z-10 bg-white py-2 pl-4 pr-3 text-ink-600">
                    {r.label}
                  </td>
                  {metricsByVariant.map((e, i) => {
                    const v = values[i];
                    const isBest = typeof v === "number" && (bestIsHigh ? v === max : v === min);
                    const isWorst = typeof v === "number" && (bestIsHigh ? v === min : v === max);
                    return (
                      <td
                        key={e.variant.id}
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          promoted === e.variant.id && "bg-emerald-50/40",
                          isBest && "text-emerald-700 font-medium",
                          isWorst && numerics.length > 1 && min !== max && "text-amber-700",
                        )}
                      >
                        {r.key === "gap" && typeof v === "number"
                          ? v <= 0
                            ? `-$${Math.abs(v).toFixed(2)}`
                            : `+$${v.toFixed(2)}`
                          : fmt(r.kind, v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* -------------------- Financial tab -------------------- */

function FinancialTab({ entry, targetPriceUsd }: { entry: Entry; targetPriceUsd: number }) {
  const { metrics: m, variant: v } = entry;
  const totalUsd = m.totalPc / v.inputs.fxRate;
  const breakEvenUsd = totalUsd;
  const floorUsd = totalUsd * 1.05; // 5% guardrail
  const recommendedUsd = m.suggestedQuoteUsd;
  const profitPerPc = m.targetMarginRupees;
  const profitOrder = profitPerPc * v.inputs.qty;
  const breakEvenQty = Math.max(
    1,
    Math.ceil(v.inputs.setup / (m.suggestedQuoteUsd * v.inputs.fxRate - (m.totalPc - m.setupPc))),
  );
  const grossMargin = m.quoteMarginPct;
  const contributionMargin =
    1 - (m.fabricSubtotal + m.makingSubtotal - m.setupPc) / (m.suggestedQuoteUsd * v.inputs.fxRate);
  const netMargin = grossMargin - 0.06; // -6pt SG&A illustrative
  const costToRevenue = m.totalPc / (m.suggestedQuoteUsd * v.inputs.fxRate);
  const gapUsd = m.suggestedQuoteUsd - targetPriceUsd;

  // Interpretation strings (deterministic, driven by numbers)
  const beInsight = [
    `Fixed setup of ₹${v.inputs.setup.toLocaleString("en-IN")} is recovered at ~${breakEvenQty.toLocaleString()} pcs, ${breakEvenQty <= v.inputs.qty ? `well within the current MOQ of ${v.inputs.qty.toLocaleString()} pcs.` : `above the current MOQ of ${v.inputs.qty.toLocaleString()} pcs — the order is unprofitable at this quantity.`}`,
    `Every additional 1,000 pcs beyond break-even adds roughly $${((m.suggestedQuoteUsd - (m.totalPc - m.setupPc) / v.inputs.fxRate) * 1000).toFixed(0)} of contribution to margin.`,
    breakEvenQty <= v.inputs.qty
      ? `Recommend locking MOQ ≥ ${Math.ceil((breakEvenQty * 1.4) / 100) * 100} pcs to keep a healthy safety cushion above break-even.`
      : `Either raise price by ~$${gapUsd.toFixed(2)}/pc, negotiate MOQ up to ${Math.ceil(breakEvenQty / 100) * 100} pcs, or absorb setup via annual volume commitment.`,
  ];
  const sankeyInsight = [
    `Materials (Yarn + Dyeing) claim ${((m.fabricSubtotal / v.inputs.fxRate / m.suggestedQuoteUsd) * 100).toFixed(0)}% of the buyer price — the single largest lever for cost reduction.`,
    `Margin retained is ${(grossMargin * 100).toFixed(1)}% of price ($${(m.suggestedQuoteUsd - m.totalPc / v.inputs.fxRate).toFixed(2)}/pc). ${grossMargin >= v.inputs.targetMarginPct ? "This meets target." : "Below target — consider value-engineering fabric or bumping MOQ."}`,
    `Overhead & Logistics is a compounding tax on every ₹ of direct cost — a 5% material cut flows through to a ~${(0.05 * 1.08 * 100).toFixed(1)}% total cost saving.`,
  ];
  const donutInsight = [
    `Top 3 drivers = Yarn & Fabric, Cut/Sew, and Dyeing — together ${(((m.fabricSubtotal + m.cuttingPc + m.stitchingPc + m.embroideryPc) / m.totalPc) * 100).toFixed(0)}% of unit cost.`,
    `Packaging and certification look small (<10% combined) but scale linearly with volume — worth reviewing only at high MOQs.`,
    `Focus AI optimisation on the top slice: a 10% cut in Yarn & Fabric alone would save ~$${((m.fabricSubtotal * 0.1) / v.inputs.fxRate).toFixed(2)}/pc.`,
  ];
  const moqInsight = [
    `Holding price at $${m.suggestedQuoteUsd.toFixed(2)}, margin climbs from setup-heavy small runs toward a natural ceiling as fixed cost per piece approaches zero.`,
    `Between MOQ ${v.inputs.qty.toLocaleString()} and 2× MOQ, margin gains ~${(((computeCushion({ ...v.inputs, qty: v.inputs.qty * 2 }).suggestedQuoteUsd * v.inputs.fxRate - computeCushion({ ...v.inputs, qty: v.inputs.qty * 2 }).totalPc) / (computeCushion({ ...v.inputs, qty: v.inputs.qty * 2 }).suggestedQuoteUsd * v.inputs.fxRate) - grossMargin) * 100).toFixed(1)}pp — a strong lever if the buyer is flexible.`,
    `Diminishing returns kick in past ~${(v.inputs.qty * 3).toLocaleString()} pcs; further quantity mostly ties working capital without unlocking margin.`,
  ];
  const tornadoInsight = [
    `Greige cotton and stitching labour are the two most volatile drivers — a ±10% swing moves margin by more than 2 percentage points each.`,
    `FX exposure is asymmetric: a ₹3 fall against the dollar erodes ~${(sensitivity(v.inputs).find((r) => r.driver.includes("FX"))?.marginImpactPts ?? 0).toFixed(1)}pp of margin without any cost changing.`,
    `MOQ ×2 is the safest lever — it improves margin without touching product spec or supplier.`,
  ];

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* KPI strip */}
      <div className="col-span-12 grid grid-cols-2 gap-3 md:grid-cols-5">
        <FinKpi
          label="Target price"
          value={`$${targetPriceUsd.toFixed(2)}`}
          sub="Buyer FOB"
          tone="neutral"
        />
        <FinKpi
          label="Est. unit cost"
          value={`$${totalUsd.toFixed(2)}`}
          sub="With overhead"
          tone="neutral"
        />
        <FinKpi
          label="Margin"
          value={`${(grossMargin * 100).toFixed(1)}%`}
          sub={
            grossMargin >= v.inputs.targetMarginPct
              ? "on target"
              : `${((grossMargin - v.inputs.targetMarginPct) * 100).toFixed(1)}pp vs target`
          }
          tone={grossMargin >= v.inputs.targetMarginPct ? "good" : "warn"}
        />
        <FinKpi
          label="Break-even qty"
          value={breakEvenQty.toLocaleString()}
          sub={`vs MOQ ${v.inputs.qty.toLocaleString()}`}
          tone={breakEvenQty <= v.inputs.qty ? "good" : "warn"}
        />
        <FinKpi
          label="Gap to target"
          value={`${gapUsd > 0 ? "+" : ""}$${gapUsd.toFixed(2)}`}
          sub="Per piece"
          tone={gapUsd <= 0 ? "good" : "warn"}
        />
      </div>

      {/* Break-even chart */}
      <section className="col-span-12 rounded-2xl border border-hairline bg-white p-4">
        <ChartHeader
          title="Break-even analysis"
          sub={`Cost vs revenue across quantity. Crossover at ~${breakEvenQty.toLocaleString()} pcs.`}
          info="Cost line = fixed setup + variable cost × qty. Revenue = price × qty. The intersection is the smallest order that recovers all cost — beyond it every piece contributes margin."
        />
        <BreakEvenChart
          setup={v.inputs.setup}
          variableInr={m.totalPc - m.setupPc}
          priceInr={m.suggestedQuoteUsd * v.inputs.fxRate}
          moq={v.inputs.qty}
          breakEvenQty={breakEvenQty}
        />
        <ChartInsight points={beInsight} />
      </section>

      {/* Cost breakdown — linked Sankey + Donut */}
      <CostBreakdownDuo entry={entry} insight={donutInsight} totalUsd={totalUsd} />

      {/* MOQ vs margin — historical trend */}
      <section className="col-span-12 rounded-2xl border border-hairline bg-white p-4">
        <ChartHeader
          title="MOQ vs margin · historical trend"
          sub="Achieved gross margin across past programmes of this product at different order quantities"
          info="Each point is a past quote or shipped order of the same article. As MOQ rises, setup gets amortised over more pieces, so historical margin trends upward until it plateaus."
        />
        <MoqMarginCurve inputs={v.inputs} />
        <ChartInsight points={moqInsight} />
      </section>

      {/* Sensitivity tornado */}
      <section className="col-span-12 rounded-2xl border border-hairline bg-white p-4 md:col-span-7">
        <ChartHeader
          title="Sensitivity — margin impact by driver"
          sub="Percentage-point swing in gross margin"
          info="Each bar shows how gross margin (in percentage points) changes when the driver is perturbed by the amount shown. Sorted by absolute impact."
        />
        <SensitivityTornado inputs={v.inputs} />
        <ChartInsight points={tornadoInsight} />
      </section>

      {/* Pricing ladder + risk */}
      <section className="col-span-12 rounded-2xl border border-hairline bg-white p-4 md:col-span-5">
        <ChartHeader
          title="Commercial pricing ladder"
          info="Ladder from break-even to buyer target. Recommended is the price at target margin. Floor sits ~5% above break-even as a negotiating guardrail."
        />
        <div className="mt-2 space-y-2">
          <PriceLadderRow
            label="Break-even price"
            value={breakEvenUsd}
            note="0% margin floor"
            tone="warn"
          />
          <PriceLadderRow label="Floor price" value={floorUsd} note="+5% safety" />
          <PriceLadderRow
            label="Recommended"
            value={recommendedUsd}
            note={`${(v.inputs.targetMarginPct * 100).toFixed(0)}% margin`}
            tone="good"
            bold
          />
          <PriceLadderRow
            label="Buyer target"
            value={targetPriceUsd}
            note="from POD"
            tone="neutral"
            dashed
          />
        </div>
      </section>

      <section className="col-span-12 rounded-2xl border border-hairline bg-white p-4 md:col-span-6">
        <ChartHeader
          title="Business feasibility"
          info="At-a-glance viability check. Green = healthy, amber = watch, red = restructuring needed."
        />
        <div className="mt-2 grid grid-cols-2 gap-3 text-[12.5px]">
          <FeasibilityStat label="MOQ" value={v.inputs.qty.toLocaleString()} sub="pcs" />
          <FeasibilityStat
            label="Break-even qty"
            value={breakEvenQty.toLocaleString()}
            sub={`vs MOQ ${v.inputs.qty.toLocaleString()}`}
            good={breakEvenQty <= v.inputs.qty}
          />
          <FeasibilityStat
            label="Profit / piece"
            value={`₹${profitPerPc.toFixed(0)}`}
            sub={`$${(profitPerPc / v.inputs.fxRate).toFixed(2)}`}
            good
          />
          <FeasibilityStat
            label="Order profit"
            value={`₹${profitOrder.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            sub={`$${(profitOrder / v.inputs.fxRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            good
          />
          <FeasibilityStat
            label="Cost-to-revenue"
            value={`${(costToRevenue * 100).toFixed(1)}%`}
            sub="lower is better"
          />
          <FeasibilityStat
            label="Contribution"
            value={`${(contributionMargin * 100).toFixed(1)}%`}
            sub="after variable cost"
          />
        </div>
      </section>

      <section className="col-span-12 rounded-2xl border border-hairline bg-white p-4 md:col-span-6">
        <ChartHeader
          title="Commercial risk flags"
          info="Qualitative watch-list — inputs come from FX, commodity, compliance and margin cushion signals."
        />
        <div className="mt-2 space-y-2">
          <RiskRow
            label="FX exposure"
            level={v.inputs.fxRate < 88 ? "medium" : "low"}
            detail={`₹${v.inputs.fxRate}/$ — 5% swing = $${(recommendedUsd * 0.05).toFixed(2)}/pc`}
          />
          <RiskRow label="Yarn volatility" level="medium" detail="cotton spot +6% QoQ" />
          <RiskRow label="Compliance" level="low" detail="OEKO-TEX in place" />
          <RiskRow
            label="Margin cushion"
            level={grossMargin >= 0.24 ? "low" : grossMargin >= 0.18 ? "medium" : "high"}
            detail={`${(grossMargin * 100).toFixed(0)}% gross`}
          />
        </div>
      </section>
    </div>
  );
}

const gapUsdBinding = 0; // unused — TypeScript happy

function FinKpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "good" | "warn" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        tone === "good"
          ? "border-emerald-200 bg-emerald-50/40"
          : tone === "warn"
            ? "border-amber-200 bg-amber-50/40"
            : "border-hairline bg-white",
      )}
    >
      <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-[22px] font-semibold tabular-nums",
          tone === "good"
            ? "text-emerald-700"
            : tone === "warn"
              ? "text-amber-700"
              : "text-ink-900",
        )}
      >
        {value}
      </div>
      <div className="text-[11px] text-ink-500">{sub}</div>
    </div>
  );
}

function InfoTip({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full text-ink-400 hover:text-ink-700"
      aria-label="More info"
    >
      <Info className="h-3.5 w-3.5" />
    </span>
  );
}

function ChartInsight({
  title = "AI interpretation",
  points,
}: {
  title?: string;
  points: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 rounded-xl border border-hairline bg-ink-50/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-ink-50/70"
      >
        <span className="flex items-center gap-2 text-[12px] font-medium text-ink-800">
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> {title}
          <span className="text-[11px] font-normal text-ink-500">· generated by AI</span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-ink-500 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul className="space-y-2 border-t border-hairline px-3 py-3 text-[12px] leading-relaxed text-ink-700">
          {points.map((p, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-indigo-500" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChartHeader({ title, sub, info }: { title: string; sub?: string; info?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink-900">
        {title}
        {info && <InfoTip text={info} />}
      </div>
      {sub && <div className="text-[11.5px] text-ink-500">{sub}</div>}
    </div>
  );
}

/* ---------- Break-even chart ---------- */
function BreakEvenChart({
  setup,
  variableInr,
  priceInr,
  moq,
  breakEvenQty,
}: {
  setup: number;
  variableInr: number;
  priceInr: number;
  moq: number;
  breakEvenQty: number;
}) {
  const W = 900,
    H = 260,
    PAD_L = 56,
    PAD_R = 24,
    PAD_T = 16,
    PAD_B = 32;
  const maxQ = Math.max(moq * 2, breakEvenQty * 1.6, 4000);
  const maxY = Math.max(setup + variableInr * maxQ, priceInr * maxQ) * 1.05;
  const xs = (q: number) => PAD_L + (q / maxQ) * (W - PAD_L - PAD_R);
  const ys = (y: number) => H - PAD_B - (y / maxY) * (H - PAD_T - PAD_B);
  const costPath = `M ${xs(0)} ${ys(setup)} L ${xs(maxQ)} ${ys(setup + variableInr * maxQ)}`;
  const revPath = `M ${xs(0)} ${ys(0)} L ${xs(maxQ)} ${ys(priceInr * maxQ)}`;
  const yTicks = 5;
  const xTicks = 6;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-[260px] w-full">
      {/* grid */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const y = PAD_T + ((H - PAD_T - PAD_B) / yTicks) * i;
        const val = maxY - (maxY / yTicks) * i;
        return (
          <g key={i}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y}
              y2={y}
              stroke="hsl(var(--hairline))"
              strokeDasharray="3 3"
              strokeWidth={0.6}
            />
            <text
              x={PAD_L - 6}
              y={y + 3}
              textAnchor="end"
              fontSize={9.5}
              fill="hsl(var(--ink-500))"
            >
              ${(val / 90 / 1000).toFixed(0)}k
            </text>
          </g>
        );
      })}
      {Array.from({ length: xTicks + 1 }).map((_, i) => {
        const x = PAD_L + ((W - PAD_L - PAD_R) / xTicks) * i;
        const val = Math.round((maxQ / xTicks) * i);
        return (
          <text
            key={i}
            x={x}
            y={H - PAD_B + 14}
            textAnchor="middle"
            fontSize={9.5}
            fill="hsl(var(--ink-500))"
          >
            {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
          </text>
        );
      })}
      {/* revenue area shade */}
      <path
        d={`${revPath} L ${xs(maxQ)} ${ys(setup + variableInr * maxQ)} L ${xs(0)} ${ys(setup)} Z`}
        fill="hsl(230 80% 60% / 0.06)"
      />
      {/* lines */}
      <path d={costPath} stroke="hsl(0 78% 60%)" strokeWidth={2} fill="none" />
      <path d={revPath} stroke="hsl(230 80% 60%)" strokeWidth={2} fill="none" />
      {/* break-even marker */}
      <line
        x1={xs(breakEvenQty)}
        x2={xs(breakEvenQty)}
        y1={PAD_T}
        y2={H - PAD_B}
        stroke="hsl(38 92% 50%)"
        strokeDasharray="4 3"
        strokeWidth={1.2}
      />
      <circle
        cx={xs(breakEvenQty)}
        cy={ys(setup + variableInr * breakEvenQty)}
        r={4}
        fill="hsl(38 92% 50%)"
      />
      {/* MOQ marker */}
      <line
        x1={xs(moq)}
        x2={xs(moq)}
        y1={PAD_T}
        y2={H - PAD_B}
        stroke="hsl(var(--ink-400))"
        strokeDasharray="2 3"
        strokeWidth={1}
      />
      {/* legend */}
      <g
        transform={`translate(${PAD_L + 8}, ${PAD_T + 6})`}
        fontSize={10}
        fill="hsl(var(--ink-700))"
      >
        <rect x={0} y={-8} width={10} height={2} fill="hsl(0 78% 60%)" />
        <text x={14} y={-4}>
          Cost
        </text>
        <rect x={54} y={-8} width={10} height={2} fill="hsl(230 80% 60%)" />
        <text x={68} y={-4}>
          Revenue
        </text>
        <rect x={124} y={-8} width={10} height={2} fill="hsl(38 92% 50%)" />
        <text x={138} y={-4}>
          Break-even
        </text>
      </g>
    </svg>
  );
}

/* ---------- Waterfall ---------- */
function MarginSankey({ entry, targetPriceUsd }: { entry: Entry; targetPriceUsd: number }) {
  const { metrics: m, variant: v } = entry;
  const fx = v.inputs.fxRate;
  const priceUsd = Math.max(targetPriceUsd, m.suggestedQuoteUsd);
  const yarnFab = (m.fabricSubtotal * 0.7) / fx;
  const dyeFin = (m.fabricSubtotal * 0.3) / fx;
  const cutSew = (m.cuttingPc + m.stitchingPc + m.embroideryPc) / fx;
  const pack = m.packagingPc / fx;
  const cert = (m.trimsPc + m.setupPc * 0.3) / fx;
  const oh = (m.overhead + m.setupPc * 0.7) / fx;
  const totalCost = yarnFab + dyeFin + cutSew + pack + cert + oh;
  const margin = Math.max(0.01, priceUsd - totalCost);
  const flows = [
    { label: "Yarn & Fabric", value: yarnFab, color: "hsl(230 80% 60%)" },
    { label: "Dyeing & Finishing", value: dyeFin, color: "hsl(268 60% 58%)" },
    { label: "Cut, Sew & Hem", value: cutSew, color: "hsl(178 62% 40%)" },
    { label: "Packing", value: pack, color: "hsl(38 92% 55%)" },
    { label: "Certification & Testing", value: cert, color: "hsl(0 78% 62%)" },
    { label: "Overhead & Logistics", value: oh, color: "hsl(340 70% 55%)" },
    { label: "Margin retained", value: margin, color: "hsl(158 64% 42%)" },
  ];
  const total = flows.reduce((s, f) => s + f.value, 0);
  const W = 820,
    H = 340,
    PAD_T = 28,
    PAD_B = 16;
  const usableH = H - PAD_T - PAD_B;
  const gap = 6;
  const totalGap = gap * (flows.length - 1);
  const scale = (usableH - totalGap) / total;
  const leftX = 50,
    leftW = 40;
  const rightX = 380,
    rightW = 26;
  let cursorL = PAD_T;
  let cursorR = PAD_T;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-[340px] w-full">
      {/* headers */}
      <text
        x={leftX + leftW / 2}
        y={PAD_T - 10}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="hsl(var(--ink-800))"
      >
        Buyer price ${priceUsd.toFixed(2)}
      </text>
      <text
        x={rightX + rightW / 2}
        y={PAD_T - 10}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="hsl(var(--ink-800))"
      >
        Where it goes
      </text>
      {/* left aggregate bar */}
      <rect
        x={leftX}
        y={PAD_T}
        width={leftW}
        height={total * scale}
        fill="hsl(230 80% 60%)"
        opacity={0.95}
        rx={3}
      >
        <title>{`Buyer price: $${priceUsd.toFixed(2)} / piece`}</title>
      </rect>
      {/* flows */}
      {flows.map((f) => {
        const h = f.value * scale;
        const y0 = cursorL;
        const y1 = cursorR;
        cursorL += h;
        cursorR += h + gap;
        const x0 = leftX + leftW;
        const x1 = rightX;
        const mx = (x0 + x1) / 2;
        const d = `M ${x0} ${y0} C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1} L ${x1} ${y1 + h} C ${mx} ${y1 + h}, ${mx} ${y0 + h}, ${x0} ${y0 + h} Z`;
        const pct = (f.value / total) * 100;
        return (
          <g key={f.label}>
            <path d={d} fill={f.color} opacity={0.28}>
              <title>{`${f.label}: $${f.value.toFixed(2)} / pc — ${pct.toFixed(1)}% of price`}</title>
            </path>
            <rect x={rightX} y={y1} width={rightW} height={Math.max(2, h)} fill={f.color} rx={2}>
              <title>{`${f.label}: $${f.value.toFixed(2)} / pc — ${pct.toFixed(1)}% of price`}</title>
            </rect>
            <text
              x={rightX + rightW + 10}
              y={y1 + h / 2 + 4}
              fontSize={11}
              fill="hsl(var(--ink-800))"
            >
              {f.label}
              <tspan dx={6} fill="hsl(var(--ink-900))" fontWeight={600}>
                ${f.value.toFixed(2)}
              </tspan>
              <tspan dx={6} fill="hsl(var(--ink-500))">
                {pct.toFixed(1)}%
              </tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ---------- Donut ---------- */
function CostDonut({ entry }: { entry: Entry }) {
  const { metrics: m, variant: v } = entry;
  const fx = v.inputs.fxRate;
  const slices = [
    { label: "Yarn & Fabric", value: (m.fabricSubtotal * 0.7) / fx, color: "hsl(230 80% 60%)" },
    {
      label: "Dyeing & Finishing",
      value: (m.fabricSubtotal * 0.3) / fx,
      color: "hsl(268 60% 58%)",
    },
    {
      label: "Cut, Sew & Hem",
      value: (m.cuttingPc + m.stitchingPc + m.embroideryPc) / fx,
      color: "hsl(178 62% 40%)",
    },
    { label: "Packing", value: m.packagingPc / fx, color: "hsl(38 92% 55%)" },
    {
      label: "Certification & Testing",
      value: (m.trimsPc + m.setupPc * 0.3) / fx,
      color: "hsl(0 78% 62%)",
    },
    {
      label: "Overhead & Logistics",
      value: (m.overhead + m.setupPc * 0.7) / fx,
      color: "hsl(158 64% 42%)",
    },
  ];
  const total = slices.reduce((s, x) => s + x.value, 0);
  const cx = 90,
    cy = 90,
    R = 78,
    r = 46;
  let angle = -Math.PI / 2;
  const paths = slices.map((s) => {
    const a0 = angle;
    const a1 = angle + (s.value / total) * Math.PI * 2;
    angle = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const x0 = cx + R * Math.cos(a0),
      y0 = cy + R * Math.sin(a0);
    const x1 = cx + R * Math.cos(a1),
      y1 = cy + R * Math.sin(a1);
    const xi1 = cx + r * Math.cos(a1),
      yi1 = cy + r * Math.sin(a1);
    const xi0 = cx + r * Math.cos(a0),
      yi0 = cy + r * Math.sin(a0);
    return {
      d: `M ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${r} ${r} 0 ${large} 0 ${xi0} ${yi0} Z`,
      color: s.color,
    };
  });
  return (
    <div className="mt-3 flex items-center gap-4">
      <svg viewBox="0 0 180 180" className="h-[180px] w-[180px] shrink-0">
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill={p.color} />
        ))}
        <text x={90} y={86} textAnchor="middle" fontSize={10} fill="hsl(var(--ink-500))">
          Total
        </text>
        <text
          x={90}
          y={104}
          textAnchor="middle"
          fontSize={16}
          fontWeight={600}
          fill="hsl(var(--ink-900))"
        >
          ${total.toFixed(2)}
        </text>
      </svg>
      <ul className="flex-1 space-y-1.5 text-[12px]">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="flex-1 text-ink-700">{s.label}</span>
            <span className="tabular-nums text-ink-900">${s.value.toFixed(2)}</span>
            <span className="w-12 shrink-0 text-right tabular-nums text-ink-500">
              {((s.value / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- MOQ vs margin curve ---------- */
function MoqMarginCurve({ inputs }: { inputs: CushionInputs }) {
  // Historical programmes of the SAME product at different MOQs.
  // Deterministic demo data — buyer/season/qty/achieved margin — anchored around
  // the current variant's economics so the trend line is comparable.
  const base = computeCushion(inputs);
  const anchor = base.quoteMarginPct * 100;
  const history: {
    q: number;
    marginPct: number;
    buyer: string;
    season: string;
    outcome: "won" | "lost" | "pending";
  }[] = [
    {
      q: 800,
      marginPct: Math.max(6, anchor - 10.5),
      buyer: "West Elm",
      season: "SS24",
      outcome: "won",
    },
    {
      q: 1200,
      marginPct: Math.max(8, anchor - 8.2),
      buyer: "Anthropologie",
      season: "AW24",
      outcome: "lost",
    },
    {
      q: 1800,
      marginPct: Math.max(10, anchor - 6.4),
      buyer: "Zara Home",
      season: "SS25",
      outcome: "won",
    },
    {
      q: 2500,
      marginPct: Math.max(12, anchor - 4.1),
      buyer: "H&M Home",
      season: "AW25",
      outcome: "won",
    },
    { q: 3500, marginPct: anchor - 1.8, buyer: "Zara Home", season: "SS26", outcome: "won" },
    { q: 5000, marginPct: anchor + 0.6, buyer: "IKEA", season: "SS26", outcome: "won" },
    { q: 7500, marginPct: anchor + 2.2, buyer: "IKEA", season: "AW26", outcome: "pending" },
    { q: 10000, marginPct: anchor + 3.1, buyer: "H&M Home", season: "AW26", outcome: "won" },
    { q: 15000, marginPct: anchor + 3.6, buyer: "IKEA", season: "SS27", outcome: "pending" },
  ];
  const pts = history;
  const W = 900,
    H = 260,
    PAD_L = 52,
    PAD_R = 24,
    PAD_T = 18,
    PAD_B = 44;
  const target = inputs.targetMarginPct * 100;
  const marginVals = pts.map((p) => p.marginPct);
  const minM = Math.min(...marginVals, target) - 2;
  const maxM = Math.max(...marginVals, target) + 2;
  const xs = (i: number) => PAD_L + (i / (pts.length - 1)) * (W - PAD_L - PAD_R);
  const ys = (v: number) => H - PAD_B - ((v - minM) / (maxM - minM)) * (H - PAD_T - PAD_B);
  const path = pts
    .map((p, i) => {
      if (i === 0) return `M ${xs(i)} ${ys(p.marginPct)}`;
      const px = xs(i - 1),
        py = ys(pts[i - 1].marginPct);
      const cx = xs(i),
        cy = ys(p.marginPct);
      const mx = (px + cx) / 2;
      return `C ${mx} ${py}, ${mx} ${cy}, ${cx} ${cy}`;
    })
    .join(" ");
  const areaPath = `${path} L ${xs(pts.length - 1)} ${ys(minM)} L ${xs(0)} ${ys(minM)} Z`;
  const currentIdx = pts.findIndex((p) => p.q >= inputs.qty);
  const yTicks = 5;
  const outcomeFill: Record<string, string> = {
    won: "hsl(158 64% 42%)",
    lost: "hsl(0 72% 55%)",
    pending: "hsl(38 92% 50%)",
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-[260px] w-full">
      <defs>
        <linearGradient id="moq-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(158 64% 42%)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="hsl(158 64% 42%)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const v = minM + ((maxM - minM) / yTicks) * i;
        const y = ys(v);
        return (
          <g key={i}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y}
              y2={y}
              stroke="hsl(var(--hairline))"
              strokeDasharray="3 3"
              strokeWidth={0.6}
            />
            <text x={PAD_L - 8} y={y + 3} textAnchor="end" fontSize={10} fill="hsl(var(--ink-500))">
              {v.toFixed(1)}%
            </text>
          </g>
        );
      })}
      {/* target line */}
      <line
        x1={PAD_L}
        x2={W - PAD_R}
        y1={ys(target)}
        y2={ys(target)}
        stroke="hsl(158 64% 42%)"
        strokeDasharray="5 3"
        strokeWidth={1.2}
      />
      <text
        x={W - PAD_R}
        y={ys(target) - 4}
        textAnchor="end"
        fontSize={10}
        fill="hsl(158 64% 42%)"
        fontWeight={600}
      >
        Target {target.toFixed(0)}%
      </text>
      {/* area + trend line */}
      <path d={areaPath} fill="url(#moq-area)" />
      <path
        d={path}
        stroke="hsl(158 64% 42%)"
        strokeWidth={2.2}
        fill="none"
        strokeLinecap="round"
      />
      {/* historical points */}
      {pts.map((p, i) => (
        <g key={p.q}>
          <circle
            cx={xs(i)}
            cy={ys(p.marginPct)}
            r={4.5}
            fill={outcomeFill[p.outcome]}
            stroke="white"
            strokeWidth={1.5}
          >
            <title>{`${p.buyer} · ${p.season}\nMOQ ${p.q.toLocaleString()} pcs · achieved margin ${p.marginPct.toFixed(1)}%\nOutcome: ${p.outcome}`}</title>
          </circle>
          <text
            x={xs(i)}
            y={H - PAD_B + 14}
            textAnchor="middle"
            fontSize={10}
            fill="hsl(var(--ink-500))"
          >
            {p.q >= 1000 ? `${(p.q / 1000).toFixed(p.q >= 10000 ? 0 : 1)}k` : p.q}
          </text>
          <text
            x={xs(i)}
            y={H - PAD_B + 26}
            textAnchor="middle"
            fontSize={9}
            fill="hsl(var(--ink-400))"
          >
            {p.season}
          </text>
        </g>
      ))}
      {/* current MOQ marker */}
      {currentIdx >= 0 && (
        <g>
          <line
            x1={xs(currentIdx)}
            x2={xs(currentIdx)}
            y1={PAD_T}
            y2={H - PAD_B}
            stroke="hsl(38 92% 50%)"
            strokeDasharray="4 3"
            strokeWidth={1.1}
          />
          <text
            x={xs(currentIdx)}
            y={PAD_T - 4}
            textAnchor="middle"
            fontSize={10}
            fontWeight={600}
            fill="hsl(38 92% 45%)"
          >
            Current MOQ
          </text>
        </g>
      )}
      {/* legend */}
      <g transform={`translate(${PAD_L}, ${H - 6})`}>
        <circle cx={4} cy={-2} r={3.5} fill="hsl(158 64% 42%)" />
        <text x={12} y={1} fontSize={10} fill="hsl(var(--ink-500))">
          won
        </text>
        <circle cx={48} cy={-2} r={3.5} fill="hsl(0 72% 55%)" />
        <text x={56} y={1} fontSize={10} fill="hsl(var(--ink-500))">
          lost
        </text>
        <circle cx={90} cy={-2} r={3.5} fill="hsl(38 92% 50%)" />
        <text x={98} y={1} fontSize={10} fill="hsl(var(--ink-500))">
          pending
        </text>
      </g>
      <text x={W / 2} y={H - 2} textAnchor="middle" fontSize={10} fill="hsl(var(--ink-500))">
        Order quantity (pcs) · past programmes of this product
      </text>
      <text
        x={14}
        y={H / 2}
        transform={`rotate(-90 14 ${H / 2})`}
        textAnchor="middle"
        fontSize={10}
        fill="hsl(var(--ink-500))"
      >
        Achieved gross margin
      </text>
    </svg>
  );
}

/* ---------- Sensitivity tornado ---------- */
function SensitivityTornado({ inputs }: { inputs: CushionInputs }) {
  const rows = sensitivity(inputs).sort(
    (a, b) => Math.abs(b.marginImpactPts) - Math.abs(a.marginImpactPts),
  );
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.marginImpactPts)), 1);
  return (
    <ul className="mt-3 space-y-1.5">
      {rows.map((r) => {
        const pct = (Math.abs(r.marginImpactPts) / maxAbs) * 50;
        const positive = r.marginImpactPts >= 0;
        return (
          <li key={r.driver} className="text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-ink-700">{r.driver}</span>
              <span
                className={cn(
                  "tabular-nums font-medium",
                  positive ? "text-emerald-700" : "text-amber-700",
                )}
              >
                {positive ? "+" : ""}
                {r.marginImpactPts.toFixed(1)}pp · {r.quoteImpact >= 0 ? "+" : ""}$
                {r.quoteImpact.toFixed(2)}
              </span>
            </div>
            <div className="relative mt-1 h-2.5 rounded-full bg-surface-alt">
              <div className="absolute inset-y-0 left-1/2 w-px bg-ink-300" />
              <div
                className={cn(
                  "absolute inset-y-0 rounded-full",
                  positive ? "bg-emerald-500" : "bg-amber-500",
                )}
                style={{
                  left: positive ? "50%" : `${50 - pct}%`,
                  width: `${pct}%`,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PriceLadderRow({
  label,
  value,
  note,
  tone,
  bold,
  dashed,
}: {
  label: string;
  value: number;
  note?: string;
  tone?: "good" | "warn" | "neutral";
  bold?: boolean;
  dashed?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border px-3 py-2",
        dashed ? "border-dashed border-hairline" : "border-hairline",
        tone === "good" && "bg-emerald-50/40 border-emerald-200",
        tone === "warn" && "bg-amber-50/40 border-amber-200",
      )}
    >
      <div>
        <div className={cn("text-[13px] text-ink-900", bold && "font-semibold")}>{label}</div>
        {note && <div className="text-[11px] text-ink-500">{note}</div>}
      </div>
      <div
        className={cn(
          "text-[18px] font-semibold tabular-nums",
          tone === "good"
            ? "text-emerald-700"
            : tone === "warn"
              ? "text-amber-700"
              : "text-ink-900",
        )}
      >
        ${value.toFixed(2)}
      </div>
    </div>
  );
}

function MarginRow({
  label,
  value,
  highlight,
  note,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  note?: string;
}) {
  const pct = value * 100;
  const width = `${Math.max(0, Math.min(100, pct * 2))}%`;
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-ink-600">{label}</span>
        <span
          className={cn(
            "font-medium tabular-nums",
            highlight ? "text-emerald-700" : "text-ink-900",
          )}
        >
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-surface-alt">
        <div
          className={cn("h-full rounded-full", highlight ? "bg-emerald-500" : "bg-ink-400")}
          style={{ width }}
        />
      </div>
      {note && <div className="text-[10.5px] text-ink-500">{note}</div>}
    </div>
  );
}

function FeasibilityStat({
  label,
  value,
  sub,
  good,
}: {
  label: string;
  value: string;
  sub: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-lg border border-hairline p-2.5">
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-[16px] font-semibold tabular-nums",
          good ? "text-emerald-700" : "text-ink-900",
        )}
      >
        {value}
      </div>
      <div className="text-[11px] text-ink-500">{sub}</div>
    </div>
  );
}

function RiskRow({
  label,
  level,
  detail,
}: {
  label: string;
  level: "low" | "medium" | "high";
  detail: string;
}) {
  const tone =
    level === "low"
      ? "text-emerald-700 bg-emerald-100"
      : level === "medium"
        ? "text-amber-700 bg-amber-100"
        : "text-red-700 bg-red-100";
  return (
    <div className="flex items-center justify-between rounded-lg border border-hairline px-3 py-2">
      <div>
        <div className="text-[13px] text-ink-900">{label}</div>
        <div className="text-[11px] text-ink-500">{detail}</div>
      </div>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
          tone,
        )}
      >
        {level}
      </span>
    </div>
  );
}

/* -------------------- Cost build-up -------------------- */

type BuildupLine = {
  label: string;
  qty: string;
  rate: string;
  cost: number; // INR/pc
  historicalRate?: string;
  rateChangePct?: number;
};

type BuildupGroup = {
  key: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  lines: BuildupLine[];
};

function CostBuildupTab({ entry }: { entry: Entry }) {
  const { metrics: m, variant: v } = entry;
  const i = v.inputs;

  // Groups are authoritative: their line-item costs sum to totalPc.
  //   fabricSubtotal + makingSubtotal + overhead = totalPc
  const groups: BuildupGroup[] = [
    {
      key: "material",
      title: "Material cost",
      icon: Layers,
      lines: [
        {
          label: "Front fabric (greige + print + finish)",
          qty: `${i.frontMeters.toFixed(2)}m`,
          rate: `₹${m.frontFabricPerM.toFixed(0)}/m`,
          cost: m.frontPc,
          historicalRate: `₹${(m.frontFabricPerM * 0.94).toFixed(0)}/m`,
          rateChangePct: 6.4,
        },
        {
          label: "Back fabric (greige + dye + finish)",
          qty: `${(i.backMeters * i.backRatio).toFixed(2)}m`,
          rate: `₹${m.backFabricPerM.toFixed(0)}/m`,
          cost: m.backPc,
          historicalRate: `₹${(m.backFabricPerM * 0.95).toFixed(0)}/m`,
          rateChangePct: 5.2,
        },
        {
          label: "Piping fabric",
          qty: `${(i.backMeters * i.pipingRatio).toFixed(2)}m`,
          rate: `₹${m.backFabricPerM.toFixed(0)}/m`,
          cost: m.pipingPc,
          rateChangePct: 5.2,
        },
      ],
    },
    {
      key: "process",
      title: "Process & making",
      icon: Zap,
      lines: [
        {
          label: "Cutting",
          qty: "1 pc",
          rate: `₹${i.cutting}/pc`,
          cost: m.cuttingPc,
          rateChangePct: 0,
        },
        {
          label: "Stitching / CMT",
          qty: "1 pc",
          rate: `₹${i.stitching}/pc`,
          cost: m.stitchingPc,
          historicalRate: `₹${(i.stitching * 0.93).toFixed(0)}/pc`,
          rateChangePct: 7.5,
        },
        {
          label: "Embroidery",
          qty: i.embroidery > 0 ? "3k stitches" : "—",
          rate: `₹${i.embroidery}/pc`,
          cost: m.embroideryPc,
          rateChangePct: i.embroidery > 0 ? 3.0 : 0,
        },
        {
          label: "Trims & labels",
          qty: "1 set",
          rate: `₹${i.trimsLabels}/pc`,
          cost: m.trimsPc,
          historicalRate: `₹${(i.trimsLabels * 0.98).toFixed(0)}/pc`,
          rateChangePct: 2.0,
        },
        {
          label: "Packaging",
          qty: "1 unit",
          rate: `₹${i.packaging}/pc`,
          cost: m.packagingPc,
          rateChangePct: 4,
        },
        {
          label: "Setup amortisation",
          qty: `${v.inputs.qty.toLocaleString()} pcs`,
          rate: `₹${v.inputs.setup.toLocaleString()} total`,
          cost: m.setupPc,
        },
      ],
    },
    {
      key: "overhead",
      title: "Overhead (compliance, logistics, factory)",
      icon: ShieldCheck,
      lines: [
        {
          label: "Compliance & testing (SGS, OEKO-TEX, audits)",
          qty: "amortised",
          rate: `~${(i.overheadPct * 0.35 * 100).toFixed(1)}% of direct`,
          cost: m.overhead * 0.35,
        },
        {
          label: "Inbound & outbound logistics (FOB)",
          qty: "amortised",
          rate: `~${(i.overheadPct * 0.4 * 100).toFixed(1)}% of direct`,
          cost: m.overhead * 0.4,
          rateChangePct: 8,
        },
        {
          label: "Factory overhead & QC",
          qty: "amortised",
          rate: `~${(i.overheadPct * 0.25 * 100).toFixed(1)}% of direct`,
          cost: m.overhead * 0.25,
        },
      ],
    },
  ];

  const groupSubtotals = groups.map((g) => ({
    key: g.key,
    title: g.title,
    value: g.lines.reduce((s, l) => s + l.cost, 0),
  }));
  const grandTotal = m.totalPc; // authoritative — matches header, waterfall, and quote derivation
  const quoteInr = m.suggestedQuoteUsd * i.fxRate;

  const palette: Record<string, string> = {
    material: "hsl(230 80% 60%)",
    process: "hsl(178 62% 40%)",
    overhead: "hsl(38 92% 55%)",
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-hairline bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
              Hierarchical cost build-up · {entry.variant.name}
            </div>
            <div className="text-[13px] text-ink-500">
              Line items below sum to total cost per piece. Commercial layer (margin + FX) is
              applied separately to derive the quote.
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
              Total cost / pc
            </div>
            <div className="text-[24px] font-semibold text-ink-900">₹{grandTotal.toFixed(2)}</div>
          </div>
        </div>

        {/* Single stacked composition bar */}
        <div className="mt-4">
          <div className="flex h-8 w-full overflow-hidden rounded-lg ring-1 ring-hairline">
            {groupSubtotals.map((g) => {
              const w = (g.value / grandTotal) * 100;
              if (w < 0.5) return null;
              return (
                <div
                  key={g.key}
                  className="group relative flex items-center justify-center text-[10.5px] font-medium text-white"
                  style={{ width: `${w}%`, background: palette[g.key] ?? "hsl(var(--ink-500))" }}
                  title={`${g.title} · ₹${g.value.toFixed(2)} · ${w.toFixed(1)}%`}
                >
                  {w > 6 ? `${w.toFixed(0)}%` : ""}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-600">
            {groupSubtotals.map((g) => (
              <span key={g.key} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: palette[g.key] ?? "hsl(var(--ink-500))" }}
                />
                <span className="text-ink-700">{g.title}</span>
                <span className="tabular-nums text-ink-500">
                  ₹{g.value.toFixed(2)} · {((g.value / grandTotal) * 100).toFixed(1)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {groups.map((g) => {
        const subtotal = g.lines.reduce((s, l) => s + l.cost, 0);
        const Icon = g.icon;
        return (
          <section key={g.key} className="rounded-2xl border border-hairline bg-white">
            <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-brand-700" />
                <div className="text-[13px] font-medium text-ink-900">{g.title}</div>
                <span className="text-[11px] text-ink-500">
                  {((subtotal / grandTotal) * 100).toFixed(1)}% of cost
                </span>
              </div>
              <div className="text-[14px] font-semibold text-ink-900 tabular-nums">
                ₹{subtotal.toFixed(2)}
              </div>
            </div>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-hairline text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
                  <th className="py-2 pl-4 text-left font-medium">Line item</th>
                  <th className="py-2 text-right font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Rate</th>
                  <th className="py-2 text-right font-medium">Historical rate</th>
                  <th className="py-2 text-right font-medium">Δ Rate</th>
                  <th className="py-2 text-right font-medium">Cost ₹/pc</th>
                  <th className="py-2 pr-4 text-right font-medium">% of total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {g.lines.map((l) => (
                  <tr key={l.label}>
                    <td className="py-2 pl-4 text-ink-800">{l.label}</td>
                    <td className="py-2 text-right tabular-nums text-ink-600">{l.qty}</td>
                    <td className="py-2 text-right tabular-nums text-ink-900">{l.rate}</td>
                    <td className="py-2 text-right tabular-nums text-ink-500">
                      {l.historicalRate ?? "—"}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right tabular-nums",
                        (l.rateChangePct ?? 0) > 0
                          ? "text-amber-700"
                          : (l.rateChangePct ?? 0) < 0
                            ? "text-emerald-700"
                            : "text-ink-400",
                      )}
                    >
                      {l.rateChangePct === undefined ? (
                        "—"
                      ) : (
                        <span className="inline-flex items-center gap-0.5">
                          {l.rateChangePct > 0 ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : l.rateChangePct < 0 ? (
                            <ArrowDownRight className="h-3 w-3" />
                          ) : null}
                          {l.rateChangePct > 0 ? "+" : ""}
                          {l.rateChangePct.toFixed(1)}%
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium text-ink-900">
                      ₹{l.cost.toFixed(2)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-ink-500">
                      {((l.cost / grandTotal) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
                <tr className="bg-ink-50/60">
                  <td
                    className="py-2 pl-4 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-600"
                    colSpan={5}
                  >
                    Subtotal
                  </td>
                  <td className="py-2 text-right tabular-nums font-semibold text-ink-900">
                    ₹{subtotal.toFixed(2)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-ink-600">
                    {((subtotal / grandTotal) * 100).toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        );
      })}

      {/* Reconciliation: subtotals must sum to totalPc */}
      <section className="rounded-2xl border border-hairline bg-ink-50/60 p-4">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
          Reconciliation
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] tabular-nums text-ink-800">
          {groupSubtotals.map((g, idx) => (
            <span key={g.key} className="inline-flex items-center gap-2">
              {idx > 0 && <span className="text-ink-400">+</span>}
              <span className="text-ink-600">{g.title.split(" ")[0]}</span>
              <span className="font-medium">₹{g.value.toFixed(2)}</span>
            </span>
          ))}
          <span className="text-ink-400">=</span>
          <span className="font-semibold text-ink-900">₹{grandTotal.toFixed(2)}</span>
          <span className="text-[11px] text-ink-500">total cost / pc</span>
        </div>
      </section>

      {/* Sensitivity analysis — per line item shock → impact on overall cost */}
      <SensitivityBuildup
        groups={groups}
        groupSubtotals={groupSubtotals}
        grandTotal={grandTotal}
        entry={entry}
      />

      {/* Commercial layer — margin + FX → suggested quote (separate from cost total) */}
      <section className="rounded-2xl border border-hairline bg-white">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-brand-700" />
            <div className="text-[13px] font-medium text-ink-900">Commercial layer</div>
            <span className="text-[11px] text-ink-500">margin + FX applied after cost</span>
          </div>
          <div className="text-[14px] font-semibold text-ink-900 tabular-nums">
            ${m.suggestedQuoteUsd.toFixed(2)}
          </div>
        </div>
        <table className="w-full text-[12.5px]">
          <tbody className="divide-y divide-hairline">
            <tr>
              <td className="py-2 pl-4 text-ink-800">Total cost / pc</td>
              <td className="py-2 pr-4 text-right tabular-nums text-ink-900">
                ₹{m.totalPc.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td className="py-2 pl-4 text-ink-800">
                Target margin ({(i.targetMarginPct * 100).toFixed(0)}% on selling price)
              </td>
              <td className="py-2 pr-4 text-right tabular-nums text-emerald-700">
                + ₹{m.targetMarginRupees.toFixed(2)}
              </td>
            </tr>
            <tr className="bg-ink-50/60">
              <td className="py-2 pl-4 text-[12px] font-medium text-ink-900">
                Selling price / pc (INR)
              </td>
              <td className="py-2 pr-4 text-right tabular-nums font-semibold text-ink-900">
                ₹{quoteInr.toFixed(2)}
              </td>
            </tr>
            <tr>
              <td className="py-2 pl-4 text-ink-800">FX conversion (÷ ₹{i.fxRate}/$)</td>
              <td className="py-2 pr-4 text-right tabular-nums text-ink-500">÷ {i.fxRate}</td>
            </tr>
            <tr className="bg-ink-50/60">
              <td className="py-2 pl-4 text-[12px] font-medium text-ink-900">
                Suggested quote (USD FOB)
              </td>
              <td className="py-2 pr-4 text-right tabular-nums font-semibold text-ink-900">
                ${m.suggestedQuoteUsd.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}

/* -------------------- Sensitivity build-up -------------------- */

// Default shock assumption per line item (e.g. cotton +12%, freight +47%).
// Keyed by label substring so it degrades gracefully if labels change.
const SHOCK_ASSUMPTIONS: { match: RegExp; shockPct: number; note: string }[] = [
  { match: /front fabric/i, shockPct: 12, note: "Cotton yarn +12%" },
  { match: /back fabric/i, shockPct: 12, note: "Cotton yarn +12%" },
  { match: /piping/i, shockPct: 12, note: "Cotton yarn +12%" },
  { match: /cutting/i, shockPct: 5, note: "Labour +5%" },
  { match: /stitching|cmt/i, shockPct: 7, note: "Labour +7%" },
  { match: /embroidery/i, shockPct: 8, note: "Embroidery +8%" },
  { match: /trims/i, shockPct: 6, note: "Trims +6%" },
  { match: /packaging/i, shockPct: 10, note: "Packaging +10%" },
  { match: /setup/i, shockPct: 0, note: "Fixed" },
  { match: /compliance/i, shockPct: 12, note: "Compliance +12%" },
  { match: /logistics|freight/i, shockPct: 47, note: "Ocean freight +47%" },
  { match: /factory|qc/i, shockPct: 5, note: "Factory OH +5%" },
];

function shockFor(label: string): { shockPct: number; note: string } {
  return (
    SHOCK_ASSUMPTIONS.find((s) => s.match.test(label)) ?? { shockPct: 10, note: "Assumed +10%" }
  );
}

function SensitivityBuildup({
  groups,
  groupSubtotals,
  grandTotal,
  entry,
}: {
  groups: BuildupGroup[];
  groupSubtotals: { key: string; title: string; value: number }[];
  grandTotal: number;
  entry: Entry;
}) {
  const { metrics: m, variant: v } = entry;
  // Flatten all lines with their sensitivity math
  const rows = groups.flatMap((g) =>
    g.lines.map((l) => {
      const { shockPct, note } = shockFor(l.label);
      const pctOfTotal = (l.cost / grandTotal) * 100;
      // Sensitivity to overall cost = (line cost × shock%) / total × 100
      const sensitivity = ((l.cost * (shockPct / 100)) / grandTotal) * 100;
      return {
        group: g.key,
        groupTitle: g.title,
        label: l.label,
        cost: l.cost,
        pctOfTotal,
        shockPct,
        note,
        sensitivity,
      };
    }),
  );

  const totalSensitivity = rows.reduce((s, r) => s + r.sensitivity, 0);
  const oldTotal = grandTotal;
  const shockedTotal = rows.reduce((s, r) => s + r.cost * (1 + r.shockPct / 100), 0);
  const totalDeltaPct = ((shockedTotal - oldTotal) / oldTotal) * 100;

  // Commercial layer view — as % of selling price (INR)
  const sellingInr = m.suggestedQuoteUsd * v.inputs.fxRate;
  const overheadCost = groupSubtotals.find((g) => g.key === "overhead")?.value ?? 0;
  const marginInr = m.targetMarginRupees;

  // Sort rows by sensitivity desc for readability
  const sortedRows = [...rows].sort((a, b) => b.sensitivity - a.sensitivity);

  const palette: Record<string, string> = {
    material: "bg-emerald-50/60",
    process: "bg-rose-50/50",
    overhead: "bg-sky-50/60",
  };
  const paletteBar: Record<string, string> = {
    material: "hsl(160 55% 45%)",
    process: "hsl(0 65% 60%)",
    overhead: "hsl(210 70% 55%)",
  };

  return (
    <section className="rounded-2xl border border-hairline bg-white">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-brand-700" />
          <div className="text-[13px] font-medium text-ink-900">Sensitivity to overall cost</div>
          <span className="text-[11px] text-ink-500">
            how each driver's shock moves the total cost / pc
          </span>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
            Aggregate exposure
          </div>
          <div className="text-[15px] font-semibold tabular-nums text-amber-700">
            +{totalSensitivity.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Table 1 — Line items as % of total cost, with shock and sensitivity */}
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-hairline text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
              <th className="py-2 pl-4 text-left font-medium">Cost driver</th>
              <th className="py-2 text-right font-medium">Cost ₹/pc</th>
              <th className="py-2 text-right font-medium">% of total cost</th>
              <th className="py-2 text-right font-medium">Assumed shock</th>
              <th className="py-2 text-left font-medium pl-4">Driver</th>
              <th className="py-2 pr-4 text-right font-medium">Sensitivity to overall cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {sortedRows.map((r) => {
              const barWidth = Math.min(
                100,
                (r.sensitivity / Math.max(...sortedRows.map((x) => x.sensitivity), 0.001)) * 100,
              );
              return (
                <tr key={r.label} className={cn(palette[r.group] ?? "")}>
                  <td className="py-2 pl-4 text-ink-800">{r.label}</td>
                  <td className="py-2 text-right tabular-nums text-ink-900">
                    ₹{r.cost.toFixed(2)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-700">
                    {r.pctOfTotal.toFixed(2)}%
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-800">
                    {r.shockPct > 0 ? `+${r.shockPct}%` : "—"}
                  </td>
                  <td className="py-2 pl-4 text-[11.5px] text-ink-500">{r.note}</td>
                  <td className="py-2 pr-4">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${barWidth}%`,
                            background: paletteBar[r.group] ?? "hsl(var(--ink-500))",
                          }}
                        />
                      </div>
                      <span
                        className={cn(
                          "tabular-nums font-medium min-w-[54px] text-right",
                          r.sensitivity > 1 ? "text-amber-700" : "text-ink-700",
                        )}
                      >
                        {r.sensitivity > 0 ? "+" : ""}
                        {r.sensitivity.toFixed(2)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
            <tr className="bg-ink-50/60">
              <td className="py-2 pl-4 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-600">
                Aggregate shocked total
              </td>
              <td className="py-2 text-right tabular-nums font-semibold text-ink-900">
                ₹{shockedTotal.toFixed(2)}
              </td>
              <td className="py-2 text-right tabular-nums text-ink-500">100.00%</td>
              <td className="py-2 text-right tabular-nums text-ink-500">blended</td>
              <td className="py-2 pl-4 text-[11.5px] text-ink-500">all drivers, additive</td>
              <td className="py-2 pr-4 text-right tabular-nums font-semibold text-amber-700">
                +{totalDeltaPct.toFixed(2)}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Table 2 — Group view expressed as % of selling price (commercial layer) */}
      <div className="border-t border-hairline">
        <div className="flex items-center justify-between px-4 py-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
            As % of selling price · shock sensitivity to landed price
          </div>
          <div className="text-[11px] text-ink-500 tabular-nums">
            Selling ₹{sellingInr.toFixed(2)} / pc
          </div>
        </div>
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-t border-hairline text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
              <th className="py-2 pl-4 text-left font-medium">Group</th>
              <th className="py-2 text-right font-medium">₹/pc</th>
              <th className="py-2 text-right font-medium">% of selling</th>
              <th className="py-2 text-right font-medium">Blended shock</th>
              <th className="py-2 pr-4 text-right font-medium">Sensitivity to price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {groupSubtotals.map((g) => {
              const groupRows = rows.filter((r) => r.group === g.key);
              const blendedShock = groupRows.reduce((s, r) => s + r.cost * (r.shockPct / 100), 0);
              const sensToPrice = (blendedShock / sellingInr) * 100;
              const pctOfSelling = (g.value / sellingInr) * 100;
              return (
                <tr key={g.key}>
                  <td className="py-2 pl-4 text-ink-800">{g.title}</td>
                  <td className="py-2 text-right tabular-nums text-ink-900">
                    ₹{g.value.toFixed(2)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-700">
                    {pctOfSelling.toFixed(2)}%
                  </td>
                  <td className="py-2 text-right tabular-nums text-ink-700">
                    +₹{blendedShock.toFixed(2)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums font-medium text-amber-700">
                    +{sensToPrice.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
            <tr>
              <td className="py-2 pl-4 text-ink-800">Overhead already in total cost</td>
              <td className="py-2 text-right tabular-nums text-ink-500">
                (₹{overheadCost.toFixed(2)})
              </td>
              <td className="py-2 text-right tabular-nums text-ink-500">—</td>
              <td className="py-2 text-right tabular-nums text-ink-500">—</td>
              <td className="py-2 pr-4 text-right tabular-nums text-ink-400">—</td>
            </tr>
            <tr>
              <td className="py-2 pl-4 text-ink-800">Margin (buffer)</td>
              <td className="py-2 text-right tabular-nums text-ink-700">₹{marginInr.toFixed(2)}</td>
              <td className="py-2 text-right tabular-nums text-ink-700">
                {((marginInr / sellingInr) * 100).toFixed(2)}%
              </td>
              <td className="py-2 text-right tabular-nums text-ink-500">—</td>
              <td className="py-2 pr-4 text-right tabular-nums text-ink-400">absorbs risk</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Old vs new comparison strip */}
      <div className="border-t border-hairline bg-ink-50/40 px-4 py-3">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-6 text-[12px]">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
              Old total cost
            </div>
            <div className="text-[15px] font-semibold tabular-nums text-ink-900">
              ₹{oldTotal.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
              New total cost
            </div>
            <div className="text-[15px] font-semibold tabular-nums text-ink-900">
              ₹{shockedTotal.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500">Δ Cost</div>
            <div className="text-[15px] font-semibold tabular-nums text-amber-700">
              +{totalDeltaPct.toFixed(2)}%
            </div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
              Old selling price
            </div>
            <div className="text-[15px] font-semibold tabular-nums text-ink-900">
              ₹{sellingInr.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
              New selling price
            </div>
            <div className="text-[15px] font-semibold tabular-nums text-ink-900">
              ₹{(shockedTotal + marginInr).toFixed(2)}
            </div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-500">Δ Price</div>
            <div className="text-[15px] font-semibold tabular-nums text-amber-700">
              +{(((shockedTotal + marginInr - sellingInr) / sellingInr) * 100).toFixed(2)}%
            </div>
          </div>
        </div>
        <div className="mt-2 text-[11.5px] text-ink-500">
          Reads like the buyer's cost-buildup sheet: each driver's shock is applied to its own line
          item, aggregated to see how much the total cost and landed selling price move.
        </div>
      </div>
    </section>
  );
}

/* -------------------- Trends & benchmarks -------------------- */

type TrendSeries = { label: string; series: number[]; unit: string; delta: number; color: string };

function TrendsTab({ entry }: { entry: Entry }) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const trends: TrendSeries[] = [
    {
      label: "Cotton yarn",
      series: [100, 102, 105, 108, 112, 115],
      unit: "index (₹/kg, base 100)",
      delta: 15,
      color: "#d97706",
    },
    {
      label: "Reactive dye",
      series: [100, 101, 103, 104, 106, 108],
      unit: "index (₹/kg, base 100)",
      delta: 8,
      color: "#0891b2",
    },
    {
      label: "Stitching labour",
      series: [100, 100, 102, 105, 107, 108],
      unit: "index (₹/pc, base 100)",
      delta: 8,
      color: "#7c3aed",
    },
    {
      label: "Ocean freight",
      series: [100, 108, 112, 118, 122, 125],
      unit: "index ($/CBM, base 100)",
      delta: 25,
      color: "#dc2626",
    },
    {
      label: "FX ₹/$",
      series: [88, 88.5, 89, 89.5, 90, 90],
      unit: "spot ₹ per $",
      delta: 2.3,
      color: "#059669",
    },
  ];

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Combined trend chart */}
      <section className="col-span-12 rounded-2xl border border-hairline bg-white p-4">
        <ChartHeader
          title="6-month cost driver trends"
          sub="Hover the chart to compare all drivers at any month. Rebased to 100 in Jan (except FX, plotted on spot)."
          info="Each line is a cost driver indexed to 100 at the start of the window. Steeper slopes = more pressure on the build-up. Toggle a series by clicking its legend chip."
        />
        <div className="mt-3">
          <TrendComboChart months={months} trends={trends} />
        </div>
        <ChartInsight
          points={[
            "Ocean freight is the fastest-moving driver (+25% in 6 months) — its share of landed cost is small but volatile; hedge with FOB terms where possible.",
            "Cotton yarn (+15%) is the highest-impact structural inflation; passing 60–70% through to buyers is typical for SS26 negotiations.",
            "Stitching labour has picked up +8% since Mar — watch Q3 wage revisions in Karur/Tirupur clusters.",
            "FX has drifted from ₹88 → ₹90 (+2.3%), giving a small tailwind to $-quoted lines.",
          ]}
        />
      </section>

      {/* Small-multiples per driver */}
      <section className="col-span-12 rounded-2xl border border-hairline bg-white p-4">
        <ChartHeader
          title="Driver detail"
          sub="One panel per driver with its own scale, latest value, and 6-month change."
        />
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {trends.map((t) => (
            <TrendCard
              key={t.label}
              label={t.label}
              series={t.series}
              unit={t.unit}
              delta={t.delta}
              months={months}
              color={t.color}
            />
          ))}
        </div>
      </section>

      {/* Table */}
      <section className="col-span-12 rounded-2xl border border-hairline bg-white p-4">
        <ChartHeader
          title="Comparable programmes"
          sub="Sorted by buyer. Δ vs current shows how the current quote lands against each baseline."
        />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-hairline text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
                <th className="py-2 pl-2 text-left font-medium">Buyer</th>
                <th className="py-2 text-left font-medium">Article</th>
                <th className="py-2 text-left font-medium">Season</th>
                <th className="py-2 text-right font-medium">Qty</th>
                <th className="py-2 text-right font-medium">Quote $</th>
                <th className="py-2 text-right font-medium">Margin</th>
                <th className="py-2 text-right font-medium">Δ vs current</th>
                <th className="py-2 pr-2 text-right font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {HISTORICAL_BASELINES.map((h) => {
                const delta = entry.metrics.suggestedQuoteUsd - h.quoteUsd;
                return (
                  <tr key={`${h.buyer}-${h.article}`} className="hover:bg-surface-alt/40">
                    <td className="py-2 pl-2 text-ink-800">{h.buyer}</td>
                    <td className="py-2 text-ink-800">{h.article}</td>
                    <td className="py-2 text-ink-600">{h.season}</td>
                    <td className="py-2 text-right tabular-nums text-ink-700">
                      {h.qty.toLocaleString()}
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium text-ink-900">
                      ${h.quoteUsd.toFixed(2)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-ink-700">
                      {h.marginPct.toFixed(1)}%
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right tabular-nums",
                        delta <= 0 ? "text-emerald-700" : "text-amber-700",
                      )}
                    >
                      {delta <= 0 ? `-$${Math.abs(delta).toFixed(2)}` : `+$${delta.toFixed(2)}`}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide",
                          h.outcome === "won"
                            ? "bg-emerald-100 text-emerald-700"
                            : h.outcome === "lost"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700",
                        )}
                      >
                        {h.outcome}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ---- combined multi-line trend chart with axes + hover tooltip ---- */
function TrendComboChart({ months, trends }: { months: string[]; trends: TrendSeries[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set(["FX ₹/$"]));
  const [hover, setHover] = useState<{ i: number; x: number } | null>(null);

  const W = 900,
    H = 300,
    PL = 48,
    PR = 24,
    PT = 20,
    PB = 36;
  const plotW = W - PL - PR;
  const plotH = H - PT - PB;

  const visible = trends.filter((t) => !hidden.has(t.label));
  const allVals = visible.flatMap((t) => t.series);
  const yMin = visible.length ? Math.min(...allVals) : 95;
  const yMax = visible.length ? Math.max(...allVals) : 130;
  const pad = (yMax - yMin) * 0.1 || 5;
  const y0 = Math.floor((yMin - pad) / 5) * 5;
  const y1 = Math.ceil((yMax + pad) / 5) * 5;

  const xFor = (i: number) => PL + (i / (months.length - 1)) * plotW;
  const yFor = (v: number) => PT + plotH - ((v - y0) / (y1 - y0)) * plotH;
  const yTicks = 5;
  const gridY = Array.from({ length: yTicks + 1 }, (_, k) => y0 + ((y1 - y0) * k) / yTicks);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cost driver trends">
        {/* grid */}
        {gridY.map((g) => (
          <g key={g}>
            <line x1={PL} x2={W - PR} y1={yFor(g)} y2={yFor(g)} stroke="#eef0f3" />
            <text x={PL - 8} y={yFor(g) + 3} textAnchor="end" fontSize={10} fill="#8a8f98">
              {g}
            </text>
          </g>
        ))}
        {/* x labels */}
        {months.map((m, i) => (
          <g key={m}>
            <line x1={xFor(i)} x2={xFor(i)} y1={PT} y2={H - PB} stroke="#f6f7f9" />
            <text x={xFor(i)} y={H - PB + 16} textAnchor="middle" fontSize={11} fill="#5b6270">
              {m}
            </text>
          </g>
        ))}
        {/* axis labels */}
        <text x={PL} y={PT - 6} fontSize={10} fill="#8a8f98">
          Index (Jan = 100)
        </text>
        <text x={W - PR} y={H - 6} textAnchor="end" fontSize={10} fill="#8a8f98">
          Month (2026)
        </text>

        {/* series */}
        {visible.map((t) => {
          const d = t.series.map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(v)}`).join(" ");
          return (
            <g key={t.label}>
              <path d={d} fill="none" stroke={t.color} strokeWidth={2} />
              {t.series.map((v, i) => (
                <circle
                  key={i}
                  cx={xFor(i)}
                  cy={yFor(v)}
                  r={hover?.i === i ? 4 : 2.5}
                  fill={t.color}
                />
              ))}
            </g>
          );
        })}

        {/* hover vertical line */}
        {hover && (
          <line
            x1={xFor(hover.i)}
            x2={xFor(hover.i)}
            y1={PT}
            y2={H - PB}
            stroke="#111827"
            strokeDasharray="3 3"
            opacity={0.35}
          />
        )}

        {/* hover overlay */}
        <rect
          x={PL}
          y={PT}
          width={plotW}
          height={plotH}
          fill="transparent"
          onMouseMove={(e) => {
            const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            const idx = Math.max(
              0,
              Math.min(months.length - 1, Math.round(((px - PL) / plotW) * (months.length - 1))),
            );
            setHover({ i: idx, x: xFor(idx) });
          }}
          onMouseLeave={() => setHover(null)}
        />
      </svg>

      {/* tooltip */}
      {hover && visible.length > 0 && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-hairline bg-white/95 px-3 py-2 shadow-lg backdrop-blur"
          style={{
            left: `${(hover.x / W) * 100}%`,
            top: 8,
            transform: `translateX(${hover.i > months.length / 2 ? "-105%" : "8px"})`,
            minWidth: 180,
          }}
        >
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-500">
            {months[hover.i]} 2026
          </div>
          <div className="mt-1 space-y-1">
            {visible.map((t) => (
              <div key={t.label} className="flex items-center justify-between gap-3 text-[11.5px]">
                <span className="flex items-center gap-1.5 text-ink-700">
                  <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                  {t.label}
                </span>
                <span className="tabular-nums font-medium text-ink-900">
                  {t.series[hover.i].toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* legend */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {trends.map((t) => {
          const off = hidden.has(t.label);
          return (
            <button
              key={t.label}
              onClick={() =>
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (next.has(t.label)) next.delete(t.label);
                  else next.add(t.label);
                  return next;
                })
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition",
                off
                  ? "border-hairline bg-white text-ink-400"
                  : "border-hairline bg-ink-50/60 text-ink-800",
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: off ? "#cbd0d6" : t.color }}
              />
              {t.label}
              <span
                className={cn(
                  "tabular-nums text-[10.5px]",
                  off ? "text-ink-400" : t.delta > 0 ? "text-amber-700" : "text-emerald-700",
                )}
              >
                {t.delta > 0 ? "+" : ""}
                {t.delta.toFixed(1)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TrendCard({
  label,
  series,
  unit,
  delta,
  months,
  color,
}: {
  label: string;
  series: number[];
  unit: string;
  delta: number;
  months: string[];
  color: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const min = Math.min(...series);
  const max = Math.max(...series);
  const W = 260,
    H = 90,
    PL = 30,
    PR = 8,
    PT = 8,
    PB = 20;
  const plotW = W - PL - PR;
  const plotH = H - PT - PB;
  const pad = (max - min) * 0.15 || 1;
  const y0 = min - pad,
    y1 = max + pad;
  const xFor = (i: number) => PL + (i / (series.length - 1)) * plotW;
  const yFor = (v: number) => PT + plotH - ((v - y0) / (y1 - y0)) * plotH;
  const d = series.map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(v)}`).join(" ");
  const areaD = `${d} L${xFor(series.length - 1)},${PT + plotH} L${xFor(0)},${PT + plotH} Z`;
  const up = delta > 0;
  const latest = series[series.length - 1];

  return (
    <div className="relative rounded-xl border border-hairline p-3">
      <div className="flex items-center justify-between">
        <div className="text-[12.5px] font-medium text-ink-900">{label}</div>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-[11.5px] font-medium",
            up ? "text-amber-700" : "text-emerald-700",
          )}
        >
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {up ? "+" : ""}
          {delta.toFixed(1)}%
        </span>
      </div>
      <div className="text-[10.5px] text-ink-500">
        Latest {latest.toFixed(1)} · {unit}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full">
        {/* y ticks */}
        {[y0, (y0 + y1) / 2, y1].map((g, k) => (
          <g key={k}>
            <line x1={PL} x2={W - PR} y1={yFor(g)} y2={yFor(g)} stroke="#f0f1f4" />
            <text x={PL - 4} y={yFor(g) + 3} textAnchor="end" fontSize={9} fill="#9aa0a8">
              {g.toFixed(0)}
            </text>
          </g>
        ))}
        <path d={areaD} fill={color} opacity={0.08} />
        <path d={d} fill="none" stroke={color} strokeWidth={1.75} />
        {series.map((v, i) => (
          <circle key={i} cx={xFor(i)} cy={yFor(v)} r={hover === i ? 3.2 : 2} fill={color} />
        ))}
        {hover !== null && (
          <line
            x1={xFor(hover)}
            x2={xFor(hover)}
            y1={PT}
            y2={PT + plotH}
            stroke="#111827"
            strokeDasharray="2 2"
            opacity={0.3}
          />
        )}
        <rect
          x={PL}
          y={PT}
          width={plotW}
          height={plotH}
          fill="transparent"
          onMouseMove={(e) => {
            const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            const idx = Math.max(
              0,
              Math.min(series.length - 1, Math.round(((px - PL) / plotW) * (series.length - 1))),
            );
            setHover(idx);
          }}
          onMouseLeave={() => setHover(null)}
        />
        {months.map((m, i) => (
          <text key={m} x={xFor(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="#9aa0a8">
            {m}
          </text>
        ))}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute right-3 top-2 rounded-md border border-hairline bg-white px-2 py-1 text-[10.5px] shadow-sm">
          <div className="font-medium text-ink-900">
            {months[hover]}: {series[hover].toFixed(1)}
          </div>
          <div className="text-ink-500">
            vs Jan {(((series[hover] - series[0]) / series[0]) * 100).toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Benchmark scatter: qty (log X) vs quote $ (Y), current highlighted ---- */
function BenchmarkScatter({ entry }: { entry: Entry }) {
  const [hover, setHover] = useState<number | null>(null);
  const points = HISTORICAL_BASELINES.map((h) => ({
    qty: h.qty,
    price: h.quoteUsd,
    margin: h.marginPct,
    outcome: h.outcome,
    label: `${h.buyer} · ${h.article}`,
    season: h.season,
  }));
  const current = {
    qty: entry.variant.inputs.qty,
    price: entry.metrics.suggestedQuoteUsd,
    margin: entry.metrics.quoteMarginPct * 100,
    label: `Current · ${entry.variant.name}`,
  };

  const W = 900,
    H = 320,
    PL = 56,
    PR = 24,
    PT = 20,
    PB = 40;
  const plotW = W - PL - PR;
  const plotH = H - PT - PB;
  const qtys = [...points.map((p) => p.qty), current.qty];
  const prices = [...points.map((p) => p.price), current.price];
  const xMin = Math.min(...qtys) * 0.8;
  const xMax = Math.max(...qtys) * 1.2;
  const yMin = Math.floor((Math.min(...prices) - 0.5) * 2) / 2;
  const yMax = Math.ceil((Math.max(...prices) + 0.5) * 2) / 2;
  const lx = (q: number) =>
    PL + ((Math.log10(q) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin))) * plotW;
  const ly = (p: number) => PT + plotH - ((p - yMin) / (yMax - yMin)) * plotH;

  const xTicks = [500, 1000, 2000, 5000, 10000].filter((v) => v >= xMin && v <= xMax);
  const yTicks = 5;
  const yGrid = Array.from({ length: yTicks + 1 }, (_, k) => yMin + ((yMax - yMin) * k) / yTicks);

  const colorFor = (o: string) => (o === "won" ? "#059669" : o === "lost" ? "#dc2626" : "#d97706");

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {yGrid.map((g) => (
          <g key={g}>
            <line x1={PL} x2={W - PR} y1={ly(g)} y2={ly(g)} stroke="#eef0f3" />
            <text x={PL - 8} y={ly(g) + 3} textAnchor="end" fontSize={10} fill="#8a8f98">
              ${g.toFixed(2)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={t}>
            <line x1={lx(t)} x2={lx(t)} y1={PT} y2={H - PB} stroke="#f6f7f9" />
            <text x={lx(t)} y={H - PB + 16} textAnchor="middle" fontSize={11} fill="#5b6270">
              {t.toLocaleString()}
            </text>
          </g>
        ))}
        <text x={PL} y={PT - 6} fontSize={10} fill="#8a8f98">
          Quote $ / pc
        </text>
        <text x={W - PR} y={H - 6} textAnchor="end" fontSize={10} fill="#8a8f98">
          Order quantity (log scale)
        </text>

        {/* trend guide line — least-squares in log space */}
        <TrendGuide
          points={points.map((p) => ({ x: Math.log10(p.qty), y: p.price }))}
          lx={lx}
          ly={ly}
          xMin={xMin}
          xMax={xMax}
        />

        {/* points */}
        {points.map((p, i) => {
          const r = 5 + Math.min(8, Math.max(0, p.margin - 20));
          const active = hover === i;
          return (
            <g key={i}>
              <circle
                cx={lx(p.qty)}
                cy={ly(p.price)}
                r={active ? r + 2 : r}
                fill={colorFor(p.outcome)}
                fillOpacity={0.28}
                stroke={colorFor(p.outcome)}
                strokeWidth={active ? 2 : 1.25}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              />
            </g>
          );
        })}

        {/* current variant — star */}
        <g>
          <circle
            cx={lx(current.qty)}
            cy={ly(current.price)}
            r={14}
            fill="#3b82f6"
            fillOpacity={0.14}
          />
          <polygon
            points={starPoints(lx(current.qty), ly(current.price), 5, 10, 4.5)}
            fill="#2563eb"
            stroke="white"
            strokeWidth={1.5}
          />
        </g>
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-hairline bg-white/95 px-3 py-2 shadow-lg"
          style={{
            left: `${(lx(points[hover].qty) / W) * 100}%`,
            top: `${(ly(points[hover].price) / H) * 100}%`,
            transform: "translate(12px, -110%)",
            minWidth: 200,
          }}
        >
          <div className="text-[11.5px] font-medium text-ink-900">{points[hover].label}</div>
          <div className="text-[10.5px] text-ink-500">{points[hover].season}</div>
          <div className="mt-1 space-y-0.5 text-[11.5px] text-ink-700">
            <div className="flex justify-between gap-3">
              <span>Qty</span>
              <span className="tabular-nums font-medium">{points[hover].qty.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Quote</span>
              <span className="tabular-nums font-medium">${points[hover].price.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Margin</span>
              <span className="tabular-nums font-medium">{points[hover].margin.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Outcome</span>
              <span
                className={cn(
                  "font-medium uppercase",
                  points[hover].outcome === "won"
                    ? "text-emerald-700"
                    : points[hover].outcome === "lost"
                      ? "text-red-700"
                      : "text-amber-700",
                )}
              >
                {points[hover].outcome}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-600">
        <LegendDot color="#059669" label="Won" />
        <LegendDot color="#dc2626" label="Lost" />
        <LegendDot color="#d97706" label="Pending" />
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="14">
            <polygon points={starPoints(7, 7, 5, 6.5, 3)} fill="#2563eb" />
          </svg>
          Current variant
        </span>
        <span className="text-ink-500">· dot size = margin %</span>
      </div>
    </div>
  );
}

function TrendGuide({
  points,
  lx,
  ly,
  xMin,
  xMax,
}: {
  points: { x: number; y: number }[];
  lx: (q: number) => number;
  ly: (p: number) => number;
  xMin: number;
  xMax: number;
}) {
  if (points.length < 2) return null;
  const n = points.length;
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);
  const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const b = (sumY - m * sumX) / n;
  const x1 = Math.log10(xMin),
    x2 = Math.log10(xMax);
  return (
    <line
      x1={lx(xMin)}
      y1={ly(m * x1 + b)}
      x2={lx(xMax)}
      y2={ly(m * x2 + b)}
      stroke="#94a3b8"
      strokeDasharray="4 4"
      strokeWidth={1.25}
    />
  );
}

function starPoints(cx: number, cy: number, spikes: number, outer: number, inner: number): string {
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  const pts: string[] = [];
  for (let i = 0; i < spikes; i++) {
    pts.push(`${cx + Math.cos(rot) * outer},${cy + Math.sin(rot) * outer}`);
    rot += step;
    pts.push(`${cx + Math.cos(rot) * inner},${cy + Math.sin(rot) * inner}`);
    rot += step;
  }
  return pts.join(" ");
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color, opacity: 0.7 }} />
      {label}
    </span>
  );
}

/* -------------------- AI insights -------------------- */

function AiInsightsTab({
  entry,
  metricsByVariant,
  targetPriceUsd,
}: {
  entry: Entry;
  metricsByVariant: Entry[];
  targetPriceUsd: number;
}) {
  const { metrics: m, variant: v } = entry;

  const recommendations = [
    {
      title: "Switch greige to Karur Mills",
      impact: "-3.4% total cost",
      detail: "Karur quotes ₹112/m for same 200TC combed (96% on-time · 18 prior orders).",
      applyLabel: "Apply supplier",
      good: true,
    },
    {
      title: `Bump MOQ to ${(v.inputs.qty * 2).toLocaleString()}`,
      impact: `−₹${(v.inputs.setup / v.inputs.qty / 2).toFixed(1)}/pc setup`,
      detail:
        "Setup ₹40,000 amortises across more units. Buyer approvals typically permit +50–100% qty.",
      applyLabel: "Apply MOQ",
      good: true,
    },
    {
      title: "Reduce embroidery density",
      impact: "-₹20/pc making",
      detail: "3k → 1.5k stitches keeps buyer-visible motif; margin +2.1pt.",
      applyLabel: "Apply value engineering",
      good: v.inputs.embroidery > 0,
    },
    {
      title: "Kraft-sleeve packaging",
      impact: "-₹1.5/pc + eco story",
      detail: "Zara Home has approved kraft-sleeve on 3 prior SS26 orders.",
      applyLabel: "Apply packaging",
      good: true,
    },
    {
      title: 'Widen fabric to 72"',
      impact: "-4% fabric ₹/pc",
      detail: "Wider width reduces consumption ~8% on this cut plan.",
      applyLabel: "Apply width",
      good: true,
    },
  ];

  const gapUsd = m.suggestedQuoteUsd - targetPriceUsd;

  return (
    <div className="grid grid-cols-12 gap-4">
      <section className="col-span-12 md:col-span-8 rounded-2xl border border-brand-200 bg-brand-50/30 p-4">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-brand-700">
          <Sparkles className="h-3.5 w-3.5" /> AI costing engineer · optimisation levers
        </div>
        <div className="mt-1 text-[13.5px] text-ink-900">
          {gapUsd > 0.02
            ? `To close the $${gapUsd.toFixed(2)} gap to the buyer target, I've ranked ${recommendations.length} levers by commercial impact.`
            : `You're already meeting target. These levers push margin further or strengthen the negotiation.`}
        </div>
        <div className="mt-3 space-y-2">
          {recommendations.map((r) => (
            <div
              key={r.title}
              className="flex items-start gap-3 rounded-xl border border-hairline bg-white p-3"
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  r.good ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                )}
              >
                <Wand2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[13px] font-medium text-ink-900">{r.title}</span>
                  <span
                    className={cn(
                      "text-[11.5px] font-medium",
                      r.good ? "text-emerald-700" : "text-amber-700",
                    )}
                  >
                    {r.impact}
                  </span>
                </div>
                <div className="text-[12px] text-ink-500">{r.detail}</div>
              </div>
              <button className="shrink-0 rounded-md bg-brand-700 px-2.5 py-1 text-[11.5px] font-medium text-white hover:bg-brand-800">
                {r.applyLabel}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="col-span-12 md:col-span-4 space-y-3">
        <div className="rounded-2xl border border-hairline bg-white p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
            Top cost drivers
          </div>
          <div className="mt-2 space-y-1.5 text-[12.5px]">
            <Driver label="Front fabric" pct={m.frontPc / m.totalPc} />
            <Driver label="Stitching" pct={m.stitchingPc / m.totalPc} />
            <Driver label="Embroidery" pct={m.embroideryPc / m.totalPc} />
            <Driver label="Back fabric + piping" pct={(m.backPc + m.pipingPc) / m.totalPc} />
            <Driver label="Overhead" pct={m.overhead / m.totalPc} />
          </div>
        </div>

        <div className="rounded-2xl border border-hairline bg-white p-4">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
            <Info className="h-3.5 w-3.5" /> Why cost changed vs history
          </div>
          <ul className="mt-2 space-y-1.5 text-[12px] text-ink-700">
            <li>• Cotton yarn +15% over 6 months → +₹6.4/pc</li>
            <li>• Ocean freight +25% → +₹0.8/pc</li>
            <li>• Stitching labour +7.5% → +₹2.5/pc</li>
            <li>• FX ₹88 → ₹{v.inputs.fxRate}/$ → −$0.04/pc</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-hairline bg-white p-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
            Variant leaderboard
          </div>
          <div className="mt-2 space-y-1 text-[12px]">
            {[...metricsByVariant]
              .sort((a, b) => b.metrics.quoteMarginPct - a.metrics.quoteMarginPct)
              .map((e, idx) => (
                <div
                  key={e.variant.id}
                  className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-surface-alt/50"
                >
                  <span className="text-ink-700">
                    <span className="mr-1 tabular-nums text-ink-400">#{idx + 1}</span>
                    {e.variant.name}
                  </span>
                  <span className="tabular-nums text-emerald-700">
                    {(e.metrics.quoteMarginPct * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Driver({ label, pct }: { label: string; pct: number }) {
  const width = `${Math.max(0, Math.min(100, pct * 100))}%`;
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-ink-700">{label}</span>
        <span className="tabular-nums text-ink-500">{(pct * 100).toFixed(1)}%</span>
      </div>
      <div className="mt-0.5 h-1.5 rounded-full bg-surface-alt">
        <div className="h-full rounded-full bg-brand-500" style={{ width }} />
      </div>
    </div>
  );
}

/* ---------- Variant context strip ---------- */
function VariantContextStrip({
  productName,
  buyer,
  srfId,
  variant,
}: {
  productName: string;
  buyer: string;
  srfId: string;
  variant: CushionVariant;
}) {
  const i = variant.inputs;
  const size = i.sizeInches ? `${i.sizeInches}" × ${i.sizeInches}"` : "—";
  const quality = i.fabricGsm ? `${i.fabricGsm} GSM` : "—";
  const moq = `${i.qty.toLocaleString()} pcs`;
  const filling =
    i.fillingWeightG && i.fillingWeightG > 0 ? `${i.fillingWeightG} g fill` : "Cover only";
  return (
    <div className="mx-auto mt-3 max-w-[1720px] rounded-xl border border-hairline bg-gradient-to-r from-brand-50/50 via-white to-white px-4 py-3">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
        <div className="min-w-[220px]">
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
            Product
          </div>
          <div className="mt-0.5 text-[15px] font-semibold leading-tight text-ink-900">
            {productName}
          </div>
          <div className="text-[11.5px] text-ink-600">
            {buyer} · <span className="tabular-nums">{srfId}</span>
          </div>
        </div>
        <VContextCell label="Variant" value={variant.name} sub={variant.tagline} accent />
        <VContextCell label="Size" value={size} />
        <VContextCell label="Quality" value={quality} />
        <VContextCell label="MOQ" value={moq} />
        <VContextCell label="Filling" value={filling} />
        <VContextCell label="Delivery" value="FOB Nhava Sheva" />
      </div>
    </div>
  );
}

function VContextCell({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-[92px]">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-[13px] font-medium leading-tight tabular-nums",
          accent ? "text-brand-700" : "text-ink-900",
        )}
      >
        {value}
      </div>
      {sub && <div className="truncate text-[11px] text-ink-500">{sub}</div>}
    </div>
  );
}

/* ---------- Cost driver donut with Sankey drill-down ---------- */
type DonutSlice = {
  key: string;
  label: string;
  value: number; // USD/pc
  color: string;
  children: { label: string; value: number; note?: string }[];
};

function buildDonutSlices(entry: Entry): DonutSlice[] {
  const { metrics: m, variant: v } = entry;
  const fx = v.inputs.fxRate;
  const gsmMult = (v.inputs.fabricGsm ?? 200) / 200;
  const shrinkWaste = (1 + v.inputs.shrinkage) * (1 + v.inputs.waste);
  // Fabric constituents per piece (INR)
  const frontMeters = v.inputs.frontMeters;
  const backMeters = v.inputs.backMeters * (v.inputs.backRatio + v.inputs.pipingRatio);
  const yarnFrontInr = v.inputs.greigeCotton * gsmMult * frontMeters * shrinkWaste;
  const yarnBackInr = v.inputs.greigeCotton * gsmMult * backMeters * shrinkWaste;
  const printInr = v.inputs.reactivePrint * frontMeters * shrinkWaste;
  const dyeInr = v.inputs.solidDyeing * backMeters * shrinkWaste;
  const finishFrontInr = v.inputs.finishTransport * frontMeters * shrinkWaste;
  const finishBackInr = v.inputs.finishTransport * backMeters * shrinkWaste;

  return [
    {
      key: "yarn-fabric",
      label: "Yarn & Fabric",
      value: (yarnFrontInr + yarnBackInr) / fx,
      color: "hsl(230 80% 60%)",
      children: [
        {
          label: "Greige cotton — front panel",
          value: yarnFrontInr / fx,
          note: `${frontMeters.toFixed(2)} m × ₹${(v.inputs.greigeCotton * gsmMult).toFixed(0)}/m`,
        },
        {
          label: "Greige cotton — back + piping",
          value: yarnBackInr / fx,
          note: `${backMeters.toFixed(2)} m × ₹${(v.inputs.greigeCotton * gsmMult).toFixed(0)}/m`,
        },
        {
          label: "Shrinkage + waste allowance",
          value: ((yarnFrontInr + yarnBackInr) * (1 - 1 / shrinkWaste)) / fx,
          note: `${((shrinkWaste - 1) * 100).toFixed(1)}% uplift`,
        },
      ],
    },
    {
      key: "dye-finish",
      label: "Dyeing & Finishing",
      value: (printInr + dyeInr + finishFrontInr + finishBackInr) / fx,
      color: "hsl(268 60% 58%)",
      children: [
        {
          label: "Reactive print — front",
          value: printInr / fx,
          note: `₹${v.inputs.reactivePrint}/m`,
        },
        { label: "Solid dyeing — back", value: dyeInr / fx, note: `₹${v.inputs.solidDyeing}/m` },
        {
          label: "Finish + transport",
          value: (finishFrontInr + finishBackInr) / fx,
          note: `₹${v.inputs.finishTransport}/m across ${(frontMeters + backMeters).toFixed(2)} m`,
        },
      ],
    },
    {
      key: "cut-sew",
      label: "Cut, Sew & Hem",
      value: (m.cuttingPc + m.stitchingPc + m.embroideryPc) / fx,
      color: "hsl(178 62% 40%)",
      children: [
        { label: "Cutting", value: m.cuttingPc / fx },
        { label: "Stitching", value: m.stitchingPc / fx },
        {
          label: "Embroidery",
          value: m.embroideryPc / fx,
          note: m.embroideryPc === 0 ? "not applied" : undefined,
        },
      ],
    },
    {
      key: "packing",
      label: "Packing",
      value: m.packagingPc / fx,
      color: "hsl(38 92% 55%)",
      children: [
        { label: "Polybag + hangtag", value: (m.packagingPc * 0.55) / fx },
        { label: "Master carton share", value: (m.packagingPc * 0.35) / fx },
        { label: "Barcode + inserts", value: (m.packagingPc * 0.1) / fx },
      ],
    },
    {
      key: "cert-test",
      label: "Certification & Testing",
      value: (m.trimsPc + m.setupPc * 0.3) / fx,
      color: "hsl(0 78% 62%)",
      children: [
        { label: "Trims & labels", value: m.trimsPc / fx },
        { label: "OEKO-TEX + lab testing", value: (m.setupPc * 0.2) / fx },
        { label: "Sampling / approval share", value: (m.setupPc * 0.1) / fx },
      ],
    },
    {
      key: "oh-logistics",
      label: "Overhead & Logistics",
      value: (m.overhead + m.setupPc * 0.7) / fx,
      color: "hsl(158 64% 42%)",
      children: [
        {
          label: `Overhead (${(v.inputs.overheadPct * 100).toFixed(0)}% of direct)`,
          value: m.overhead / fx,
        },
        {
          label: "Setup amortisation",
          value: (m.setupPc * 0.5) / fx,
          note: `₹${v.inputs.setup.toLocaleString("en-IN")} ÷ ${v.inputs.qty.toLocaleString()} pcs`,
        },
        { label: "Inland freight to port", value: (m.setupPc * 0.2) / fx },
      ],
    },
  ];
}

function CostBreakdownDuo({
  entry,
  insight,
  totalUsd,
}: {
  entry: Entry;
  insight: string[];
  totalUsd: number;
}) {
  const slices = useMemo(() => buildDonutSlices(entry), [entry]);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const [selected, setSelected] = useState<string | null>(null);
  const active = slices.find((s) => s.key === selected) ?? null;

  const sankeyInsight = active
    ? [
        `${active.label} contributes $${active.value.toFixed(2)}/pc — ${((active.value / total) * 100).toFixed(1)}% of unit cost.`,
        `Largest constituent: ${[...active.children].sort((a, b) => b.value - a.value)[0]?.label ?? "—"} at $${([...active.children].sort((a, b) => b.value - a.value)[0]?.value ?? 0).toFixed(2)}/pc.`,
        `A 10% cut across this category alone would save ~$${(active.value * 0.1).toFixed(2)}/pc.`,
      ]
    : [
        `Ribbon thickness = share of unit cost. The top driver is ${[...slices].sort((a, b) => b.value - a.value)[0]?.label}.`,
        `Click a slice on the right donut (or a legend row) to replace this sankey with a constituent-level breakdown.`,
      ];

  return (
    <section className="col-span-12 rounded-2xl border border-hairline bg-white p-5">
      <ChartHeader
        title={active ? `Cost driver breakdown — ${active.label}` : "Cost driver breakdown"}
        sub={
          active
            ? `$${active.value.toFixed(2)}/pc · ${((active.value / total) * 100).toFixed(1)}% of unit cost · constituent flow shown`
            : `6 categories · $${totalUsd.toFixed(2)}/pc · click a slice to drill down`
        }
        info="Click any slice (or legend row) on the donut to reveal a constituent-level Sankey on the right."
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-start">
        <div className={active ? "md:col-span-5" : "md:col-span-12"}>
          <div className={active ? "" : "mx-auto max-w-2xl"}>
            <CostDonutControlled
              slices={slices}
              total={total}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
        </div>
        {active && (
          <div className="md:col-span-7 md:border-l md:border-hairline md:pl-6">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <div className="text-body font-medium text-ink-900">
                  {active.label} — constituent flow
                </div>
                <div className="text-caption text-ink-500">
                  Ribbon thickness = share of category cost
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md p-1 text-ink-500 hover:bg-ink-50 hover:text-ink-900"
                aria-label="Back to overview"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <DrilldownSankey slice={active} />
          </div>
        )}
      </div>
      <ChartInsight points={active ? sankeyInsight : insight} />
    </section>
  );
}

function CostDonutControlled({
  slices,
  total,
  selected,
  onSelect,
}: {
  slices: DonutSlice[];
  total: number;
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  const active = slices.find((s) => s.key === selected) ?? null;
  const cx = 90,
    cy = 90,
    R = 78,
    r = 46;
  let angle = -Math.PI / 2;
  const paths = slices.map((s) => {
    const a0 = angle;
    const a1 = angle + (s.value / total) * Math.PI * 2;
    angle = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const isSel = selected === s.key;
    const rr = isSel ? R + 6 : R;
    const x0 = cx + rr * Math.cos(a0),
      y0 = cy + rr * Math.sin(a0);
    const x1 = cx + rr * Math.cos(a1),
      y1 = cy + rr * Math.sin(a1);
    const xi1 = cx + r * Math.cos(a1),
      yi1 = cy + r * Math.sin(a1);
    const xi0 = cx + r * Math.cos(a0),
      yi0 = cy + r * Math.sin(a0);
    return {
      key: s.key,
      d: `M ${x0} ${y0} A ${rr} ${rr} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${r} ${r} 0 ${large} 0 ${xi0} ${yi0} Z`,
      color: s.color,
      opacity: selected && !isSel ? 0.35 : 1,
    };
  });
  return (
    <div className="mt-3 flex items-center gap-4">
      <svg viewBox="0 0 180 180" className="h-[180px] w-[180px] shrink-0">
        {paths.map((p) => (
          <path
            key={p.key}
            d={p.d}
            fill={p.color}
            opacity={p.opacity}
            className="cursor-pointer transition-opacity"
            onClick={() => onSelect(selected === p.key ? null : p.key)}
          >
            <title>{`${slices.find((s) => s.key === p.key)?.label} · click to drill down`}</title>
          </path>
        ))}
        <text x={90} y={86} textAnchor="middle" fontSize={10} fill="hsl(var(--ink-500))">
          {active ? active.label : "Total"}
        </text>
        <text
          x={90}
          y={104}
          textAnchor="middle"
          fontSize={16}
          fontWeight={600}
          fill="hsl(var(--ink-900))"
        >
          ${(active ? active.value : total).toFixed(2)}
        </text>
      </svg>
      <ul className="flex-1 space-y-1.5 text-[12px]">
        {slices.map((s) => {
          const isSel = selected === s.key;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onSelect(selected === s.key ? null : s.key)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors",
                  isSel ? "bg-ink-50" : "hover:bg-surface-alt",
                )}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                <span className={cn("flex-1", isSel ? "font-medium text-ink-900" : "text-ink-700")}>
                  {s.label}
                </span>
                <span className="tabular-nums text-ink-900">${s.value.toFixed(2)}</span>
                <span className="w-12 shrink-0 text-right tabular-nums text-ink-500">
                  {((s.value / total) * 100).toFixed(1)}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function OverviewSankey({ slices, total }: { slices: DonutSlice[]; total: number }) {
  const rows = slices.filter((s) => s.value > 0);
  const W = 720,
    H = Math.max(180, 40 + rows.length * 40),
    PAD_T = 20,
    PAD_B = 12;
  const usableH = H - PAD_T - PAD_B;
  const gap = 10;
  const totalGap = gap * (rows.length - 1);
  const scale = (usableH - totalGap) / total;
  const leftX = 20,
    leftW = 32;
  const rightX = 520,
    rightW = 40;
  const labelX = leftX + leftW + 10;
  let cursorL = PAD_T;
  const laid = rows.map((s) => {
    const h = s.value * scale;
    const y = cursorL;
    cursorL += h + gap;
    return { s, h, y };
  });
  const totalH = total * scale;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      role="img"
      aria-label="Cost drivers flowing into unit cost"
    >
      {laid.map((row, i) => {
        const rightYTop = PAD_T + laid.slice(0, i).reduce((s, x) => s + x.h, 0);
        const rightYBot = rightYTop + row.h;
        const leftYTop = row.y;
        const leftYBot = row.y + row.h;
        const c1x = (leftX + leftW + rightX) / 2;
        const d = `M ${leftX + leftW} ${leftYTop} C ${c1x} ${leftYTop}, ${c1x} ${rightYTop}, ${rightX} ${rightYTop} L ${rightX} ${rightYBot} C ${c1x} ${rightYBot}, ${c1x} ${leftYBot}, ${leftX + leftW} ${leftYBot} Z`;
        return (
          <g key={row.s.key}>
            <path d={d} fill={row.s.color} opacity={0.35}>
              <title>{`${row.s.label}: $${row.s.value.toFixed(2)}/pc · ${((row.s.value / total) * 100).toFixed(1)}%`}</title>
            </path>
            <rect x={leftX} y={row.y} width={leftW} height={row.h} fill={row.s.color} rx={3}>
              <title>{`${row.s.label}: $${row.s.value.toFixed(2)}/pc`}</title>
            </rect>
            <text x={labelX} y={row.y + row.h / 2 + 3} fontSize={11} fill="hsl(var(--ink-800))">
              {row.s.label}
            </text>
            <text x={labelX} y={row.y + row.h / 2 + 16} fontSize={10} fill="hsl(var(--ink-500))">
              ${row.s.value.toFixed(2)}/pc · {((row.s.value / total) * 100).toFixed(1)}%
            </text>
          </g>
        );
      })}
      {/* Right aggregate */}
      <rect
        x={rightX}
        y={PAD_T}
        width={rightW}
        height={totalH}
        fill="hsl(var(--ink-900))"
        opacity={0.85}
        rx={4}
      >
        <title>{`Unit cost: $${total.toFixed(2)}/pc`}</title>
      </rect>
      <text
        x={rightX + rightW / 2}
        y={PAD_T - 6}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill="hsl(var(--ink-800))"
      >
        Unit cost
      </text>
      <text
        x={rightX + rightW / 2}
        y={PAD_T + totalH + 14}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="hsl(var(--ink-900))"
      >
        ${total.toFixed(2)}
      </text>
    </svg>
  );
}

function DrilldownSankey({ slice }: { slice: DonutSlice }) {
  const children = slice.children.filter((c) => c.value > 0);
  const total = children.reduce((s, c) => s + c.value, 0) || 1;
  const W = 720,
    H = Math.max(160, 40 + children.length * 44),
    PAD_T = 20,
    PAD_B = 12;
  const usableH = H - PAD_T - PAD_B;
  const gap = 10;
  const totalGap = gap * (children.length - 1);
  const scale = (usableH - totalGap) / total;
  const leftX = 20,
    leftW = 32;
  const rightX = 460,
    rightW = 22;
  const labelX = rightX + rightW + 10;
  let cursorR = PAD_T;
  const rows = children.map((c) => {
    const h = c.value * scale;
    const y = cursorR;
    cursorR += h + gap;
    return { c, h, y };
  });
  const totalH = total * scale;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      role="img"
      aria-label={`${slice.label} drill-down Sankey`}
    >
      {/* Left aggregate */}
      <rect
        x={leftX}
        y={PAD_T}
        width={leftW}
        height={totalH}
        fill={slice.color}
        opacity={0.9}
        rx={3}
      >
        <title>{`${slice.label}: $${slice.value.toFixed(2)}/pc`}</title>
      </rect>
      <text
        x={leftX + leftW / 2}
        y={PAD_T - 6}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill="hsl(var(--ink-800))"
      >
        {slice.label}
      </text>
      <text
        x={leftX + leftW / 2}
        y={PAD_T + totalH + 12}
        textAnchor="middle"
        fontSize={10}
        fill="hsl(var(--ink-600))"
      >
        ${slice.value.toFixed(2)}
      </text>

      {/* Ribbons + right stubs */}
      {rows.map((r, i) => {
        const leftYTop = PAD_T + rows.slice(0, i).reduce((s, x) => s + x.h, 0);
        const leftYBot = leftYTop + r.h;
        const rightYTop = r.y;
        const rightYBot = r.y + r.h;
        const x0 = leftX + leftW;
        const x1 = rightX;
        const cx1 = x0 + (x1 - x0) * 0.5;
        const path = `M ${x0} ${leftYTop} C ${cx1} ${leftYTop}, ${cx1} ${rightYTop}, ${x1} ${rightYTop} L ${x1} ${rightYBot} C ${cx1} ${rightYBot}, ${cx1} ${leftYBot}, ${x0} ${leftYBot} Z`;
        const pct = (r.c.value / total) * 100;
        return (
          <g key={i}>
            <path d={path} fill={slice.color} opacity={0.22}>
              <title>{`${r.c.label}: $${r.c.value.toFixed(2)}/pc · ${pct.toFixed(1)}%`}</title>
            </path>
            <rect
              x={rightX}
              y={r.y}
              width={rightW}
              height={r.h}
              fill={slice.color}
              opacity={0.9}
              rx={2}
            />
            <text
              x={labelX}
              y={r.y + r.h / 2 - 2}
              fontSize={11}
              fontWeight={500}
              fill="hsl(var(--ink-900))"
            >
              {r.c.label}
            </text>
            <text x={labelX} y={r.y + r.h / 2 + 12} fontSize={10} fill="hsl(var(--ink-500))">
              ${r.c.value.toFixed(2)}/pc · {pct.toFixed(1)}%{r.c.note ? ` · ${r.c.note}` : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
