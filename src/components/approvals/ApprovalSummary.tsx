import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Lightbulb,
  ShieldAlert,
  TrendingUp,
  History,
  ChevronDown,
  Paperclip,
  FileText,
  Package,
  Layers,
  DollarSign,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { podRefFor, type ApprovalSnapshot, type ApprovalAttachment } from "@/lib/approvalsStore";

/* ---------------- Product Summary ---------------- */
export function ProductSummary({ snapshot }: { snapshot: ApprovalSnapshot }) {
  return (
    <section className="rounded-xl border border-hairline bg-surface p-4">
      <SectionEyebrow icon={Package} label="Product Summary" />
      <div className="mt-3 flex items-start gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-hairline bg-surface-alt">
          {snapshot.productImage ? (
            <img src={snapshot.productImage} alt={snapshot.productName} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-ink-400">
              {snapshot.articleCode}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-ink-900">{snapshot.productName}</div>
          <div className="mt-0.5 text-[12px] text-ink-500">
            {snapshot.buyer} · {snapshot.articleCode} · POD {podRefFor(snapshot)}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            <Pill label="MOQ" value={snapshot.moq} />
            <Pill label="Size" value={snapshot.size} />
            <Pill label="Supplier" value={snapshot.supplier} />
            <Pill label="Scenario" value={snapshot.scenarioName} tone="brand" />
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiTile label="Selling Price" value={`$${snapshot.sellingPrice.toFixed(2)}`} tone="brand" />
        <KpiTile label="Cost" value={`$${snapshot.cost.toFixed(2)}`} tone="neutral" icon={DollarSign} />
        <KpiTile
          label="Margin"
          value={`${snapshot.margin.toFixed(1)}%`}
          tone={snapshot.margin >= 20 ? "success" : snapshot.margin >= 10 ? "warning" : "danger"}
        />
        <KpiTile label="Target Price" value={`$${snapshot.targetPrice.toFixed(2)}`} tone="neutral" />
        <KpiTile label="Confidence" value={`${snapshot.confidence}%`} tone="brand" icon={Activity} />
        <KpiTile
          label="Commercial Health"
          value={snapshot.commercialHealth}
          tone={
            snapshot.commercialHealth === "Strong"
              ? "success"
              : snapshot.commercialHealth === "Watch"
                ? "warning"
                : "danger"
          }
          icon={ShieldCheck}
        />
      </div>
    </section>
  );
}

/* ---------------- Configuration Summary ---------------- */
export function ConfigurationSummary({ snapshot }: { snapshot: ApprovalSnapshot }) {
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(snapshot.configGroups.map((g, i) => [g.label, i === 0])),
  );
  return (
    <section className="rounded-xl border border-hairline bg-surface p-4">
      <SectionEyebrow icon={Layers} label="Configuration Summary" />
      <div className="mt-3 space-y-2">
        {snapshot.configGroups.map((g) => {
          const isOpen = !!open[g.label];
          return (
            <div key={g.label} className="overflow-hidden rounded-lg border border-hairline">
              <button
                onClick={() => setOpen((o) => ({ ...o, [g.label]: !isOpen }))}
                className="flex w-full items-center gap-2 bg-surface px-3 py-2.5 text-left hover:bg-surface-alt/40"
              >
                <span className="text-[12.5px] font-semibold text-ink-900">{g.label}</span>
                <span className="rounded-full bg-surface-alt px-1.5 py-0.5 text-[10px] font-semibold text-ink-500">
                  {g.items.length}
                </span>
                <ChevronDown
                  className={cn("ml-auto h-3.5 w-3.5 text-ink-400 transition-transform", isOpen && "rotate-180")}
                />
              </button>
              {isOpen && (
                <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 border-t border-hairline bg-surface p-3 sm:grid-cols-2">
                  {g.items.map((it) => (
                    <div key={it.label} className="flex items-center gap-2 text-[12px]">
                      <span className="w-28 shrink-0 text-[10.5px] uppercase tracking-wider text-ink-500">
                        {it.label}
                      </span>
                      <span className="flex-1 truncate text-ink-900">{it.value}</span>
                      {it.cost && <span className="tabular-nums text-[11px] text-ink-500">{it.cost}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------- Cost Summary ---------------- */
export function CostSummary({ snapshot }: { snapshot: ApprovalSnapshot }) {
  const totalCost = snapshot.cost;
  const margin = snapshot.margin;
  return (
    <section className="rounded-xl border border-hairline bg-surface p-4">
      <SectionEyebrow icon={TrendingUp} label="Cost Summary" />
      <div className="mt-3">
        <div className="mb-2 flex items-center justify-between text-[11.5px]">
          <span className="text-ink-500">Cost Contribution</span>
          <span className="tabular-nums font-semibold text-ink-900">${totalCost.toFixed(2)} / pc</span>
        </div>
        <div className="flex h-10 w-full overflow-hidden rounded-lg border border-hairline">
          {snapshot.costRows.map((r, i) => (
            <div
              key={r.label}
              title={`${r.label} · $${r.cost.toFixed(2)} · ${r.pct.toFixed(1)}%`}
              className={cn("flex items-center justify-center", i > 0 && "border-l border-surface")}
              style={{ width: `${r.pct}%`, background: r.color }}
            >
              {r.pct > 8 && (
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-white/95">
                  {r.pct.toFixed(0)}%
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
          {snapshot.costRows.map((r) => (
            <div key={r.label} className="flex items-center gap-2 text-[11px]">
              <span className="h-2 w-2 rounded-sm" style={{ background: r.color }} />
              <span className="flex-1 truncate text-ink-700">{r.label}</span>
              <span className="tabular-nums font-medium text-ink-900">{r.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <MiniStat label="Selling Price" value={`$${snapshot.sellingPrice.toFixed(2)}`} tone="brand" />
        <MiniStat
          label="Margin"
          value={`${margin.toFixed(1)}%`}
          tone={margin >= 20 ? "success" : "warning"}
        />
        <MiniStat
          label="Δ vs Target"
          value={`$${(snapshot.sellingPrice - snapshot.targetPrice).toFixed(2)}`}
          tone={snapshot.sellingPrice >= snapshot.targetPrice ? "warning" : "success"}
        />
      </div>

      <div className="mt-4">
        <div className="mb-2 text-[10.5px] uppercase tracking-wider text-ink-500">Margin distribution</div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-alt">
          <div
            className="h-full bg-brand-700"
            style={{ width: `${Math.min(100, Math.max(0, margin))}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-ink-400">
          <span>0%</span>
          <span>Target 20%</span>
          <span>50%</span>
        </div>
      </div>
    </section>
  );
}

/* ---------------- AI Summary ---------------- */
export function AISummary({ snapshot }: { snapshot: ApprovalSnapshot }) {
  const s = snapshot.aiSummary;
  return (
    <section className="rounded-xl border border-brand-700/20 bg-gradient-to-br from-brand-50/60 to-transparent p-4">
      <div className="flex items-center gap-2">
        <div className="relative h-7 w-7">
          <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,#0a7460_0%,#2d8f7a_25%,#c69324_50%,#05604d_75%,#0a7460_100%)]" />
          <div className="absolute inset-[2px] rounded-full bg-gradient-to-br from-ink-900 via-brand-900 to-brand-700" />
          <div className="absolute inset-[3px] rounded-full bg-gradient-to-tr from-white/50 via-white/10 to-transparent" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-ink-900">Tracon AI Summary</span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-brand-50 to-brand-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand-700 ring-1 ring-brand-700/10">
              <Sparkles className="h-2 w-2" /> Confidence {s.confidence}%
            </span>
          </div>
          <div className="text-[10.5px] text-ink-500">Commercial viability review</div>
        </div>
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-ink-900">{s.verdict}</p>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-hairline bg-surface p-2.5">
          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-red-700">
            <ShieldAlert className="h-2.5 w-2.5" /> Risks
          </div>
          <ul className="space-y-1 text-[11.5px] text-ink-700">
            {s.risks.map((r) => (
              <li key={r} className="flex gap-1.5">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-red-500" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border border-hairline bg-surface p-2.5">
          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-brand-700">
            <Lightbulb className="h-2.5 w-2.5" /> Recommendations
          </div>
          <ul className="space-y-1 text-[11.5px] text-ink-700">
            {s.recommendations.map((r) => (
              <li key={r} className="flex gap-1.5">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-brand-700" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-brand-700/20 bg-surface px-3 py-2">
        <div className="text-[10px] uppercase tracking-wider text-brand-700">Best Scenario</div>
        <div className="text-[12px] font-medium text-ink-900">{s.bestScenario}</div>
      </div>
    </section>
  );
}

/* ---------------- Historical Comparison ---------------- */
export function HistoricalComparison({ snapshot }: { snapshot: ApprovalSnapshot }) {
  const h = snapshot.history;
  return (
    <section className="rounded-xl border border-hairline bg-surface p-4">
      <SectionEyebrow icon={History} label="Historical Comparison" />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <HistStat label="Similar products" value={String(h.similarProducts)} sub="quoted last 12 mo" />
        <HistStat label="Previous margin" value={`${h.previousMargin.toFixed(1)}%`} sub="avg on similar" />
        <HistStat label="Win rate" value={`${h.winRate}%`} sub="orders converted" />
        <HistStat label="Avg lead time" value={h.avgLeadTime} sub="sample → ship" />
        <HistStat label="Historical supplier" value={h.historicalSupplier} sub="proven track" />
        <HistStat label="Similar buyers" value={h.similarBuyers.slice(0, 2).join(", ")} sub={`+${Math.max(0, h.similarBuyers.length - 2)} more`} />
      </div>
    </section>
  );
}

/* ---------------- Attachments ---------------- */
export function AttachmentsList({
  items,
  onRemove,
}: {
  items: ApprovalAttachment[];
  onRemove?: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-hairline bg-surface-alt/40 p-4 text-center text-[11.5px] text-ink-500">
        No attachments
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map((a) => (
        <li
          key={a.id}
          className="flex items-center gap-2 rounded-md border border-hairline bg-surface px-2.5 py-2 text-[12px]"
        >
          <FileText className="h-3.5 w-3.5 text-ink-500" />
          <span className="flex-1 truncate text-ink-900">{a.name}</span>
          {a.size && <span className="text-[10.5px] text-ink-500">{a.size}</span>}
          {onRemove && (
            <button
              onClick={() => onRemove(a.id)}
              className="text-[10.5px] text-ink-500 hover:text-red-700"
            >
              Remove
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ---------------- primitives ---------------- */
function SectionEyebrow({ icon: Icon, label }: { icon: typeof Sparkles; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-brand-700">
      <Icon className="h-3 w-3" />
      {label}
    </div>
  );
}

function Pill({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "brand" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px]",
        tone === "brand"
          ? "border-brand-700/30 bg-brand-50 text-brand-700"
          : "border-hairline bg-surface-alt/60 text-ink-700",
      )}
    >
      <span className="text-ink-500">{label}</span>
      <span className="font-medium text-ink-900">{value}</span>
    </span>
  );
}

function KpiTile({
  label,
  value,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger";
  icon?: typeof Sparkles;
}) {
  const toneCls = {
    neutral: "bg-surface",
    brand: "bg-brand-50/60",
    success: "bg-brand-50/60",
    warning: "bg-gold-50",
    danger: "bg-red-50",
  }[tone];
  return (
    <div className={cn("rounded-lg border border-hairline p-2.5", toneCls)}>
      <div className="flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3 text-ink-400" />}
        <span className="text-[9.5px] uppercase tracking-wider text-ink-500">{label}</span>
      </div>
      <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink-900">{value}</div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "neutral" | "brand" | "success" | "warning" }) {
  const cls = {
    neutral: "text-ink-900",
    brand: "text-brand-700",
    success: "text-brand-700",
    warning: "text-gold-700",
  }[tone];
  return (
    <div className="rounded-md border border-hairline bg-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-500">{label}</div>
      <div className={cn("mt-0.5 text-[14px] font-semibold tabular-nums", cls)}>{value}</div>
    </div>
  );
}

function HistStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md border border-hairline bg-surface-alt/40 p-2.5">
      <div className="text-[9.5px] uppercase tracking-wider text-ink-500">{label}</div>
      <div className="mt-0.5 truncate text-[13px] font-semibold text-ink-900">{value}</div>
      <div className="text-[10px] text-ink-500">{sub}</div>
    </div>
  );
}

export { Paperclip };
