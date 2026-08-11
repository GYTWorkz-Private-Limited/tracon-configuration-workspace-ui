import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FileText, Search, ArrowUpRight, Plus, AlertTriangle, Filter } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { StatusPill } from "@/components/quotation/QuotationHeaderBand";
import { cn } from "@/lib/utils";
import {
  activeLines,
  blendedMargin,
  driftFor,
  orderValueUsd,
  useQuotations,
  type Quotation,
  type QuotationStatus,
} from "@/lib/quotationsStore";

export const Route = createFileRoute("/quotations/")({
  head: () => ({
    meta: [
      { title: "Quotations · Tracon" },
      {
        name: "description",
        content:
          "Every buyer quotation from draft through approval, buyer response and order — with live cost-drift risk.",
      },
    ],
  }),
  component: QuotationsDashboard,
});

const TABS: { key: "all" | QuotationStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "pending_approval", label: "Pending approval" },
  { key: "sent", label: "Sent" },
  { key: "needs_revision", label: "Needs revision" },
  { key: "accepted", label: "Accepted" },
  { key: "converted_to_order", label: "Converted" },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function fmtAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

function QuotationsDashboard() {
  const all = useQuotations();
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const [buyer, setBuyer] = useState("all");

  const buyers = useMemo(() => Array.from(new Set(all.map((q) => q.buyer))), [all]);

  const list = useMemo(
    () =>
      all.filter((q) => {
        if (tab !== "all" && q.status !== tab) return false;
        if (buyer !== "all" && q.buyer !== buyer) return false;
        if (query) {
          const hay =
            `${q.id} ${q.buyer} ${q.buyerRef} ${q.lines.map((l) => l.name).join(" ")}`.toLowerCase();
          if (!hay.includes(query.toLowerCase())) return false;
        }
        return true;
      }),
    [all, tab, buyer, query],
  );

  const counts = useMemo(
    () => ({
      draft: all.filter((q) => q.status === "draft" || q.status === "needs_revision").length,
      approval: all.filter((q) => q.status === "pending_approval").length,
      market: all.filter((q) => q.status === "sent").length,
      accepted: all.filter((q) => q.status === "accepted" || q.status === "converted_to_order")
        .length,
      risk: all.filter((q) => driftFor(q) && !q.riskAcceptedAt).length,
    }),
    [all],
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-ink-400">
              <FileText className="h-3 w-3" /> Commercial layer
            </div>
            <h1 className="text-[30px] leading-[1.05] tracking-[-0.02em] text-ink-900">
              Quotations
            </h1>
            <p className="mt-1 max-w-[680px] text-[13px] text-ink-500">
              Price, approve, send and requote — in one place. Cost is always pulled live from
              Costing; every version and override is kept.
            </p>
          </div>
          <button
            onClick={() => navigate({ to: "/quotations/new" })}
            className="inline-flex items-center gap-2 self-start rounded-md bg-ink-900 px-3 py-2 text-[12.5px] font-medium text-white hover:bg-ink-700"
          >
            <Plus className="h-3.5 w-3.5" /> New quotation
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Kpi label="Drafts & revisions" value={counts.draft} />
          <Kpi label="Pending approval" value={counts.approval} tone="amber" />
          <Kpi label="In market" value={counts.market} tone="sky" />
          <Kpi label="Accepted" value={counts.accepted} tone="emerald" />
          <Kpi
            label="Cost risk"
            value={counts.risk}
            tone="rose"
            icon={<AlertTriangle className="h-3 w-3" />}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
                tab === t.key
                  ? "bg-ink-900 text-white"
                  : "border border-hairline bg-surface text-ink-600 hover:bg-surface-alt",
              )}
            >
              {t.label}
            </button>
          ))}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1.5">
              <Filter className="h-3.5 w-3.5 text-ink-400" aria-hidden />
              <label htmlFor="buyer-filter" className="sr-only">
                Filter by buyer
              </label>
              <select
                id="buyer-filter"
                value={buyer}
                onChange={(e) => setBuyer(e.target.value)}
                className="bg-transparent text-[12px] text-ink-700 focus:outline-none"
              >
                <option value="all">All buyers</option>
                {buyers.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-ink-400" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search quotations"
                placeholder="Search quote, buyer, article…"
                className="w-56 bg-transparent text-[12px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-lg border border-hairline bg-surface">
          <table className="w-full min-w-[980px] border-collapse">
            <thead>
              <tr className="border-b border-hairline bg-surface-alt/60 text-left text-[10.5px] uppercase tracking-[0.12em] text-ink-500">
                <th className="px-4 py-2.5 font-medium">Quotation</th>
                <th className="px-4 py-2.5 font-medium">Buyer</th>
                <th className="px-4 py-2.5 font-medium">Lines</th>
                <th className="px-4 py-2.5 text-right font-medium">Order value</th>
                <th className="px-4 py-2.5 text-right font-medium">Margin</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Valid until</th>
                <th className="px-4 py-2.5 font-medium">Updated</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {list.map((q) => (
                <QuoteRow key={q.id} quotation={q} />
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[13px] text-ink-500">
                    No quotations match those filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function QuoteRow({ quotation: q }: { quotation: Quotation }) {
  const drift = driftFor(q);
  const margin = blendedMargin(q);
  const value = orderValueUsd(q);

  return (
    <tr className="group border-b border-hairline/70 last:border-b-0 hover:bg-surface-alt/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Link
            to="/quotations/$id"
            params={{ id: q.id }}
            className="text-[13px] font-medium text-ink-900 hover:text-brand-700"
          >
            {q.id}
          </Link>
          <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-600">
            v{q.version}
          </span>
          {drift && !q.riskAcceptedAt && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                drift.severity === "critical"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-amber-50 text-amber-700",
              )}
              title={`Costs moved ${drift.costDeltaPct.toFixed(1)}% since this quote was sent`}
            >
              <AlertTriangle className="h-2.5 w-2.5" /> Cost risk
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-ink-400">
          {q.buyerRef} · {q.podId}
        </div>
      </td>
      <td className="px-4 py-3 text-[13px] text-ink-900">{q.buyer}</td>
      <td className="px-4 py-3">
        <div className="text-[13px] text-ink-900">{activeLines(q).length}</div>
        <div className="text-[11px] text-ink-400">
          {q.lines.filter((l) => l.status === "rejected").length > 0
            ? `${q.lines.filter((l) => l.status === "rejected").length} sent back`
            : q.lines.filter((l) => l.kind === "variant").length > 0
              ? `${q.lines.filter((l) => l.kind === "variant").length} alt tiers`
              : "—"}
        </div>
      </td>
      <td className="px-4 py-3 text-right text-[13px] font-medium tabular-nums text-ink-900">
        ${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
      </td>
      <td
        className={cn(
          "px-4 py-3 text-right text-[13px] tabular-nums",
          margin < 12 ? "text-rose-600" : "text-ink-700",
        )}
      >
        {margin.toFixed(1)}%
      </td>
      <td className="px-4 py-3">
        <StatusPill status={q.status} className="px-2 py-0.5 text-[11px] font-medium" />
      </td>
      <td className="px-4 py-3 text-[12px] text-ink-500">{fmtDate(q.validUntil)}</td>
      <td className="px-4 py-3 text-[12px] text-ink-500">{fmtAgo(q.updatedAt)}</td>
      <td className="px-4 py-3 text-right">
        <Link
          to="/quotations/$id"
          params={{ id: q.id }}
          className="inline-flex items-center gap-1 text-[12px] text-ink-500 opacity-0 transition group-hover:opacity-100 hover:text-ink-900 focus-visible:opacity-100"
        >
          Open <ArrowUpRight className="h-3 w-3" />
        </Link>
      </td>
    </tr>
  );
}

function Kpi({
  label,
  value,
  tone = "ink",
  icon,
}: {
  label: string;
  value: number;
  tone?: "ink" | "sky" | "emerald" | "amber" | "rose";
  icon?: React.ReactNode;
}) {
  const map: Record<string, string> = {
    ink: "text-ink-900",
    sky: "text-sky-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
  };
  return (
    <div className="rounded-lg border border-hairline bg-surface p-3">
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] text-ink-400">
        {icon}
        {label}
      </div>
      <div className={cn("mt-2 text-[24px] font-semibold tabular-nums", map[tone])}>{value}</div>
    </div>
  );
}
