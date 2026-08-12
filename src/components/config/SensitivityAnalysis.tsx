// SensitivityAnalysis — interactive what-if tool embedded in the Costing report.
// Reads the same calculation engine (buildCostingSheet) as the Costing workspace;
// driver changes are temporary until "Apply changes" commits them upstream.

import { useMemo, useState } from "react";
import { Activity, RotateCcw, Sparkles, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildCostingSheet, inr } from "@/lib/costingSheet";
import type { CushionInputs, CushionVariant } from "@/lib/cushionCosting";

type Props = {
  active: CushionVariant;
  productName: string;
  targetPriceUsd: number;
  onApply: (patch: Partial<CushionInputs>) => void;
};

const PACKAGING: { key: string; label: string; rate: number }[] = [
  { key: "basic", label: "Basic", rate: 4 },
  { key: "standard", label: "Standard", rate: 6 },
  { key: "premium", label: "Premium", rate: 14 },
];
const TESTING: { key: string; label: string; rate: number }[] = [
  { key: "none", label: "None", rate: 0 },
  { key: "standard", label: "Standard", rate: 4 },
  { key: "full", label: "Full protocol", rate: 11 },
];
const CERTIFICATION: { key: string; label: string; rate: number }[] = [
  { key: "none", label: "None", rate: 0 },
  { key: "oeko", label: "OEKO-TEX", rate: 5 },
  { key: "gots", label: "GOTS", rate: 11 },
];

type Drivers = {
  qty: number;
  marginPct: number;
  fxRate: number;
  fabricPct: number;
  printingPct: number;
  mfgPct: number;
  packaging: string;
  testing: string;
  certification: string;
};

const nearestKey = (list: { key: string; rate: number }[], rate: number) =>
  list.reduce((a, b) => (Math.abs(b.rate - rate) < Math.abs(a.rate - rate) ? b : a)).key;

const rateOf = (list: { key: string; rate: number }[], key: string) =>
  list.find((x) => x.key === key)?.rate ?? 0;

type Pill = { id: string; label: string; recipe: (base: Drivers) => Partial<Drivers> };

const PILLS: Pill[] = [
  {
    id: "margin30",
    label: "Reach 30% margin",
    recipe: () => ({
      marginPct: 30,
      qty: 5000,
      fabricPct: -3,
      packaging: "standard",
      testing: "standard",
    }),
  },
  {
    id: "reduce-price",
    label: "Reduce selling price",
    recipe: (b) => ({
      marginPct: Math.max(18, b.marginPct - 4),
      qty: 5000,
      fabricPct: -5,
      printingPct: -4,
      packaging: "basic",
    }),
  },
  {
    id: "buyer-target",
    label: "Match buyer target",
    recipe: () => ({
      qty: 5000,
      fabricPct: -4,
      printingPct: -3,
      mfgPct: -2,
      packaging: "standard",
      testing: "standard",
    }),
  },
  {
    id: "lowest-cost",
    label: "Lowest cost",
    recipe: () => ({
      qty: 10000,
      fabricPct: -8,
      printingPct: -8,
      mfgPct: -6,
      packaging: "basic",
      testing: "none",
      certification: "none",
    }),
  },
  {
    id: "highest-profit",
    label: "Highest profit",
    recipe: () => ({
      marginPct: 34,
      qty: 5000,
      fabricPct: -2,
      packaging: "premium",
      certification: "oeko",
    }),
  },
];

export function SensitivityAnalysis({ active, productName, targetPriceUsd, onApply }: Props) {
  const base = active.inputs;

  const baseDrivers: Drivers = useMemo(
    () => ({
      qty: base.qty,
      marginPct: Math.round(base.targetMarginPct * 100),
      fxRate: base.fxRate,
      fabricPct: 0,
      printingPct: 0,
      mfgPct: 0,
      packaging: nearestKey(PACKAGING, base.packaging),
      testing: nearestKey(TESTING, base.testingPerPc ?? 0),
      certification: nearestKey(CERTIFICATION, base.certPerPc ?? 0),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      base.qty,
      base.targetMarginPct,
      base.fxRate,
      base.packaging,
      base.testingPerPc,
      base.certPerPc,
    ],
  );

  const [d, setD] = useState<Drivers>(baseDrivers);
  const [recipe, setRecipe] = useState<{ pill: string; rows: string[] } | null>(null);
  const set = <K extends keyof Drivers>(k: K, v: Drivers[K]) => {
    setD((p) => ({ ...p, [k]: v }));
    setRecipe(null);
  };

  const patch = useMemo<Partial<CushionInputs>>(
    () => ({
      qty: d.qty,
      targetMarginPct: d.marginPct / 100,
      fxRate: d.fxRate,
      greigeCotton: base.greigeCotton * (1 + d.fabricPct / 100),
      reactivePrint: base.reactivePrint * (1 + d.printingPct / 100),
      cutting: base.cutting * (1 + d.mfgPct / 100),
      stitching: base.stitching * (1 + d.mfgPct / 100),
      packaging: rateOf(PACKAGING, d.packaging),
      testingPerPc: rateOf(TESTING, d.testing),
      certPerPc: rateOf(CERTIFICATION, d.certification),
    }),
    [d, base],
  );

  const opts = { productName, variantName: active.name };
  const baseSheet = useMemo(() => buildCostingSheet(base, opts), [base, productName, active.name]);
  const sheet = useMemo(
    () => buildCostingSheet({ ...base, ...patch }, opts),
    [base, patch, productName, active.name],
  );

  const dirty = JSON.stringify(d) !== JSON.stringify(baseDrivers);
  const targetMet = sheet.spUsd <= targetPriceUsd;

  const applyPill = (p: Pill) => {
    const next = { ...baseDrivers, ...p.recipe(baseDrivers) };
    setD(next);
    const rows: string[] = [];
    if (next.qty !== baseDrivers.qty) rows.push(`MOQ → ${next.qty.toLocaleString("en-IN")} pcs`);
    if (next.marginPct !== baseDrivers.marginPct) rows.push(`Target margin → ${next.marginPct}%`);
    if (next.fabricPct)
      rows.push(`Fabric cost → ${next.fabricPct > 0 ? "+" : ""}${next.fabricPct}%`);
    if (next.printingPct)
      rows.push(`Printing cost → ${next.printingPct > 0 ? "+" : ""}${next.printingPct}%`);
    if (next.mfgPct) rows.push(`Manufacturing → ${next.mfgPct > 0 ? "+" : ""}${next.mfgPct}%`);
    if (next.packaging !== baseDrivers.packaging)
      rows.push(`Packaging → ${PACKAGING.find((x) => x.key === next.packaging)!.label}`);
    if (next.testing !== baseDrivers.testing)
      rows.push(`Testing → ${TESTING.find((x) => x.key === next.testing)!.label}`);
    if (next.certification !== baseDrivers.certification)
      rows.push(
        `Certification → ${CERTIFICATION.find((x) => x.key === next.certification)!.label}`,
      );
    setRecipe({
      pill: p.label,
      rows: rows.length ? rows : ["No change needed — drivers already optimal"],
    });
  };

  const reset = () => {
    setD(baseDrivers);
    setRecipe(null);
  };

  return (
    <section className="rounded-xl border border-hairline bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold text-ink-900">Sensitivity analysis</h3>
          <p className="mt-0.5 text-[11.5px] text-ink-500">
            Adjust key pricing drivers and instantly see their impact on profitability and
            quotation.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2 py-[3px] text-[10px] font-semibold uppercase tracking-[0.06em] text-brand-700">
          <Activity className="h-3 w-3" /> Live
        </span>
      </div>

      {/* AI quick actions */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-500">
          <Sparkles className="h-3.5 w-3.5 text-brand-700" /> Quick AI actions
        </span>
        {PILLS.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPill(p)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
              recipe?.pill === p.label
                ? "border-brand-600 bg-brand-50 text-brand-800"
                : "border-line-200 bg-white text-ink-700 hover:border-ink-300",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {recipe && (
        <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3">
          <div className="text-[12px] font-semibold text-brand-800">
            AI recommendation applied · {recipe.pill}
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {recipe.rows.map((r) => (
              <li key={r} className="text-[12px] text-ink-800">
                {r}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[11px] text-ink-500">
            Sliders moved to the suggested values — fine-tune manually before applying.
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Drivers */}
        <div className="space-y-2">
          <DriverGroup title="Commercial">
            <SliderRow
              label="MOQ"
              raw={d.qty}
              ticks={[500, 1000, 2000, 3000, 5000, 7500, 10000]}
              format={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
              onChange={(v) => set("qty", v)}
            />
            <SliderRow
              label="Target margin"
              raw={d.marginPct}
              ticks={[12, 16, 20, 24, 26, 30, 34, 40]}
              format={(v) => `${v}%`}
              onChange={(v) => set("marginPct", v)}
            />
            <SliderRow
              label="FX rate"
              raw={d.fxRate}
              ticks={[78, 82, 86, 88, 90, 92, 95, 98]}
              format={(v) => `₹${v}`}
              onChange={(v) => set("fxRate", v)}
            />
          </DriverGroup>

          <DriverGroup title="Material">
            <SliderRow
              label="Fabric cost"
              raw={d.fabricPct}
              ticks={PCT_TICKS}
              format={pct}
              onChange={(v) => set("fabricPct", v)}
            />
            <SliderRow
              label="Printing cost"
              raw={d.printingPct}
              ticks={PCT_TICKS}
              format={pct}
              onChange={(v) => set("printingPct", v)}
            />
            <SliderRow
              label="Manufacturing cost"
              raw={d.mfgPct}
              ticks={PCT_TICKS}
              format={pct}
              onChange={(v) => set("mfgPct", v)}
            />
          </DriverGroup>

          <DriverGroup title="Commercial charges">
            <div className="grid gap-3 sm:grid-cols-3">
              <ChipRow
                label="Packaging"
                options={PACKAGING}
                value={d.packaging}
                onChange={(v) => set("packaging", v)}
              />
              <ChipRow
                label="Testing"
                options={TESTING}
                value={d.testing}
                onChange={(v) => set("testing", v)}
              />
              <ChipRow
                label="Certification"
                options={CERTIFICATION}
                value={d.certification}
                onChange={(v) => set("certification", v)}
              />
            </div>
          </DriverGroup>
        </div>

        {/* Live impact */}
        <aside className="h-fit rounded-xl border border-hairline bg-surface-alt/50 p-3 lg:sticky lg:top-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-500">
              Live impact
            </span>
            {dirty && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-amber-700">
                <AlertTriangle className="h-3 w-3" /> Unsaved changes
              </span>
            )}
          </div>

          <div className="mt-2.5 space-y-1.5">
            <Impact
              label="Adjusted product cost"
              value={inr(sheet.grandTotal)}
              delta={sheet.grandTotal - baseSheet.grandTotal}
              invert
            />
            <Impact
              label="Selling price (INR)"
              value={inr(sheet.spInr)}
              delta={sheet.spInr - baseSheet.spInr}
            />
            <Impact
              label="Selling price (USD)"
              value={`$${sheet.spUsd.toFixed(2)}`}
              delta={sheet.spUsd - baseSheet.spUsd}
            />
            <Impact
              label="Margin %"
              value={`${(sheet.marginPct * 100).toFixed(1)}%`}
              delta={(sheet.marginPct - baseSheet.marginPct) * 100}
            />
          </div>

          <div className="mt-3 rounded-lg border border-hairline bg-white p-3">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-500">
              Suggested quotation
            </div>
            <div className="mt-0.5 text-[22px] font-semibold tabular-nums text-ink-900 transition-all duration-300">
              ${sheet.spUsd.toFixed(2)}
            </div>
            <div
              className={cn(
                "mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10.5px] font-semibold",
                targetMet ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700",
              )}
            >
              {targetMet ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              Buyer target ${targetPriceUsd.toFixed(2)} · {targetMet ? "Met" : "Not met"}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => {
                onApply(patch);
                setRecipe(null);
              }}
              disabled={!dirty}
              className="flex-1 rounded-md bg-brand-700 px-3 py-2 text-[12.5px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-800 disabled:opacity-40"
            >
              Apply changes
            </button>
            <button
              onClick={reset}
              className="inline-flex items-center gap-1 rounded-md border border-line-200 bg-white px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>
          <p className="mt-2 text-[10.5px] text-ink-500">
            Changes are temporary — Apply updates the costing configuration and report.
          </p>
        </aside>
      </div>
    </section>
  );
}

const pct = (v: number) => `${v > 0 ? "+" : ""}${v}%`;
const PCT_TICKS = [-15, -10, -5, -2, 0, 2, 5, 10, 15];

function DriverGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline p-3">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-500">
        {title}
      </div>
      <div className="mt-3 space-y-5">{children}</div>
    </div>
  );
}

/** Label · discrete tick slider · editable value field, all on one line. */
function SliderRow({
  label,
  raw,
  ticks,
  format,
  onChange,
}: {
  label: string;
  raw: number;
  ticks: number[];
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const idx = ticks.reduce((a, v, i) => (Math.abs(v - raw) < Math.abs(ticks[a] - raw) ? i : a), 0);
  const last = ticks.length - 1;
  const pctPos = (i: number) => (last === 0 ? 0 : (i / last) * 100);

  // interpolated position so typed values land between ticks
  const min = ticks[0];
  const max = ticks[last];
  const clamped = Math.min(Math.max(raw, Math.min(min, max)), Math.max(min, max));
  let thumbPos = pctPos(idx);
  for (let i = 0; i < last; i++) {
    const a = ticks[i];
    const b = ticks[i + 1];
    if ((clamped >= a && clamped <= b) || (clamped <= a && clamped >= b)) {
      const t = b === a ? 0 : (clamped - a) / (b - a);
      thumbPos = pctPos(i) + t * (pctPos(i + 1) - pctPos(i));
      break;
    }
  }

  const commit = () => {
    if (draft !== null) {
      const n = Number(draft.replace(/[^0-9.-]/g, ""));
      if (!Number.isNaN(n) && draft.trim() !== "") onChange(n);
    }
    setDraft(null);
  };

  return (
    <div className="flex items-center gap-5">
      <span className="w-[132px] shrink-0 text-[12px] text-ink-700">{label}</span>

      <div className="relative min-w-0 flex-1 px-1">
        {/* tick labels */}
        <div className="relative mb-1.5 h-[14px]">
          {ticks.map((v, i) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              style={{ left: `${pctPos(i)}%` }}
              className={cn(
                "absolute -translate-x-1/2 whitespace-nowrap text-[10.5px] tabular-nums transition-colors",
                i === idx ? "font-semibold text-ink-900" : "text-ink-400 hover:text-ink-600",
              )}
            >
              {format(v)}
            </button>
          ))}
        </div>

        {/* track */}
        <div className="relative h-4">
          <div className="absolute left-0 right-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-hairline" />
          <div
            className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-brand-700 transition-all duration-200"
            style={{ width: `${thumbPos}%` }}
          />
          {ticks.map((v, i) => (
            <span
              key={v}
              style={{ left: `${pctPos(i)}%` }}
              className={cn(
                "absolute top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full",
                pctPos(i) < thumbPos ? "bg-brand-700" : "bg-ink-400/40",
              )}
            />
          ))}
          <span
            style={{ left: `${thumbPos}%` }}
            className="pointer-events-none absolute top-1/2 h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-brand-700 bg-white shadow-sm transition-all duration-200"
          />
          <input
            type="range"
            min={0}
            max={last}
            step={1}
            value={idx}
            onChange={(e) => onChange(ticks[Number(e.target.value)])}
            aria-label={label}
            aria-valuetext={format(ticks[idx])}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0"
          />
        </div>
      </div>

      <input
        type="text"
        value={draft ?? format(raw)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => setDraft(String(raw))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraft(null);
        }}
        aria-label={`${label} value`}
        className="ml-5 w-[74px] shrink-0 rounded-md border border-line-200 bg-white px-2 py-1 text-right text-[12px] tabular-nums text-ink-900 outline-none focus:border-brand-600"
      />
    </div>
  );
}

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; label: string; rate: number }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[12px] text-ink-700">{label}</div>
      <div className="mt-1 inline-flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
              value === o.key
                ? "border-ink-900 bg-ink-900 text-white"
                : "border-line-200 bg-white text-ink-700 hover:border-ink-300",
            )}
          >
            {o.label}
            {o.rate > 0 && <span className="ml-1 text-[10px] opacity-70">₹{o.rate}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function Impact({
  label,
  value,
  delta,
  invert,
}: {
  label: string;
  value: string;
  delta: number;
  invert?: boolean;
}) {
  const flat = Math.abs(delta) < 0.005;
  const good = invert ? delta < 0 : delta > 0;
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11.5px] text-ink-600">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-[13px] font-semibold tabular-nums text-ink-900 transition-all duration-300">
          {value}
        </span>
        {!flat && (
          <span
            className={cn(
              "text-[10.5px] font-medium tabular-nums",
              good ? "text-brand-700" : "text-amber-700",
            )}
          >
            {delta > 0 ? "▲" : "▼"}
            {Math.abs(delta) < 10 ? Math.abs(delta).toFixed(2) : Math.abs(delta).toFixed(0)}
          </span>
        )}
      </span>
    </div>
  );
}
