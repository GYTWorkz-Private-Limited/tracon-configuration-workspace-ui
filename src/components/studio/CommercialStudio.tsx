import React, { useMemo, useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Command,
  Copy,
  Download,
  GitBranch,
  History,
  Info,
  LayoutDashboard,
  Lightbulb,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Domain model — every variable has discrete options the user picks freely.
// The studio recomputes every metric live; there is no Apply / Calculate.
// ─────────────────────────────────────────────────────────────────────────────

type CostKey =
  | "fabric"
  | "processing"
  | "packaging"
  | "testing"
  | "certification"
  | "transportation"
  | "sampling";

type Impact = "highest" | "medium" | "lower";

type Option = {
  label: string;
  // Per-piece $ deltas applied to baseline component costs
  cost?: Partial<Record<CostKey, number>>;
  leadTime?: number; // weeks delta
  acceptance?: number; // pct delta on buyer acceptance
  qty?: number; // only used by MOQ
  note?: string;
};

type VariableId =
  | "moq"
  | "fabricWidth"
  | "fabricSupplier"
  | "fabricConstruction"
  | "packaging"
  | "printing"
  | "embroidery"
  | "testing"
  | "certification"
  | "transportation"
  | "sampling"
  | "audit"
  | "courier";

type VariableDef = {
  id: VariableId;
  name: string;
  impact: Impact;
  unit?: string;
  options: Option[];
  baselineIndex: number;
  recommendedIndex: number;
  rationale: string;
};

const BASE_COSTS: Record<CostKey, number> = {
  fabric: 2.42,
  processing: 0.91,
  packaging: 0.42,
  testing: 0.28,
  certification: 0.16,
  transportation: 0.48,
  sampling: 0.11,
};

const COST_LABEL: Record<CostKey, string> = {
  fabric: "Fabric",
  processing: "Processing",
  packaging: "Packaging",
  testing: "Testing",
  certification: "Certification",
  transportation: "Transportation",
  sampling: "Sampling",
};

// Maps a cost component to the editable lever that most directly drives it.
// Clicking a waterfall / contribution row jumps the workbench into that lever's workspace.
const COST_TO_VAR: Record<CostKey, VariableId> = {
  fabric: "fabricSupplier",
  processing: "printing",
  packaging: "packaging",
  testing: "testing",
  certification: "certification",
  transportation: "transportation",
  sampling: "sampling",
};


const BASE = {
  leadTime: 14, // weeks
  acceptance: 72, // pct
  markup: 0.18, // price = cost * (1 + markup) at baseline
  fixedCost: 1500, // setup/sample fixed overhead $
  annualMultiplier: 4, // repeat orders/year for similar buyers
};

const VARIABLES: VariableDef[] = [
  {
    id: "moq",
    name: "MOQ",
    impact: "highest",
    unit: "pcs",
    baselineIndex: 0,
    recommendedIndex: 2,
    rationale:
      "150 pcs unlocks buyer discount tier and amortizes setup — per-piece cost drops ~5% vs 50 pcs.",
    options: [
      { label: "50 pcs", qty: 50, cost: {}, acceptance: 0, note: "Current PO" },
      { label: "100 pcs", qty: 100, cost: { fabric: -0.06, processing: -0.02 }, acceptance: 0, note: "Tier-2" },
      { label: "150 pcs", qty: 150, cost: { fabric: -0.12, processing: -0.04 }, acceptance: -2, note: "Tier-3 unlocked" },
    ],
  },
  {
    id: "fabricWidth",
    name: "Product",
    impact: "highest",
    baselineIndex: 0,
    recommendedIndex: 0,
    rationale: "Comforter carries the highest program value — 68% of program revenue sits in this SKU.",
    options: [
      { label: "Comforter · 66\" x 86\"", cost: {}, note: "Article 4814926" },
      { label: "Comforter · 88\" x 92\"", cost: { fabric: 0.28, processing: 0.05 } },
      { label: "Comforter · 106\" x 92\"", cost: { fabric: 0.44, processing: 0.08 } },
      { label: "Pillow Case · 20\" x 26\"", cost: { fabric: -1.62, processing: -0.42 } },
      { label: "Flat Sheet · 66\" x 86\" Twin", cost: { fabric: -0.72, processing: -0.18 } },
      { label: "Quilt · 80\" x 90\" Twin", cost: { fabric: -0.14, processing: 0.02 } },
    ],
  },
  {
    id: "fabricSupplier",
    name: "Size",
    impact: "highest",
    baselineIndex: 0,
    recommendedIndex: 0,
    rationale: "Twin size aligns with buyer's core AW26 assortment; larger sizes lift value but hurt acceptance.",
    options: [
      { label: "Twin · 66\" x 86\"", cost: {}, note: "Core size" },
      { label: "Full / Queen · 90\" x 90\"", cost: { fabric: 0.18 }, acceptance: -2 },
      { label: "King · 108\" x 90\"", cost: { fabric: 0.32 }, acceptance: -4 },
      { label: "Cal King · 108\" x 102\"", cost: { fabric: 0.36 }, acceptance: -6 },
    ],
  },
  {
    id: "fabricConstruction",
    name: "Construction",
    impact: "highest",
    baselineIndex: 0,
    recommendedIndex: 0,
    rationale: "160 x 128 / 40s × 40s is the buyer-locked construction; lighter counts flagged as risk only.",
    options: [
      { label: "160 x 128 · 40s x 40s", cost: {}, note: "Buyer-locked" },
      { label: "100 x 80 · 40s x 40s · 180 TC", cost: { fabric: -0.14 }, acceptance: -6 },
      { label: "72 x 56 · 30s x 30s", cost: { fabric: -0.22 }, acceptance: -10 },
      { label: "STF 75 H · Cotton/Flax", cost: { fabric: 0.18 }, acceptance: 5 },
    ],
  },
  {
    id: "packaging",
    name: "Packaging",
    impact: "medium",
    baselineIndex: 0,
    recommendedIndex: 1,
    rationale:
      "PVC bag + printed insert is the retail-shelf standard. Dropping the insert saves $0.07/pc with a small acceptance trade-off.",
    options: [
      { label: "PVC bag + insert card + hangtag", cost: {} },
      { label: "PVC bag + hangtag", cost: { packaging: -0.07 }, acceptance: -6 },
      { label: "Poly bag + sticker", cost: { packaging: -0.18 }, acceptance: -22 },
    ],
  },
  {
    id: "printing",
    name: "GSM",
    impact: "medium",
    baselineIndex: 0,
    recommendedIndex: 0,
    rationale: "180 GSM matches Comforter shell spec. 110 GSM only viable on Quilt lines.",
    options: [
      { label: "180 GSM · Comforter shell", cost: {} },
      { label: "115 GSM · Sheeting", cost: { fabric: -0.42, processing: -0.06 }, acceptance: -8 },
      { label: "110 GSM · Quilt shell", cost: { fabric: -0.48, processing: -0.05 }, acceptance: -6 },
    ],
  },
  {
    id: "embroidery",
    name: "Composition",
    impact: "medium",
    baselineIndex: 0,
    recommendedIndex: 0,
    rationale: "100% Cotton is buyer standard. Cotton/Flax blend adds value but raises fibre cost.",
    options: [
      { label: "100% Cotton", cost: {} },
      { label: "Cotton 85% / Flax 15%", cost: { fabric: 0.22 }, acceptance: 4 },
      { label: "Cotton 60% / Poly 40%", cost: { fabric: -0.14 }, acceptance: -12 },
    ],
  },
  {
    id: "testing",
    name: "Yarn Count",
    impact: "medium",
    baselineIndex: 0,
    recommendedIndex: 0,
    rationale: "40s × 40s hits the buyer's hand-feel spec. Coarser 30s available for quilt shells only.",
    options: [
      { label: "40s x 40s", cost: {} },
      { label: "30s x 30s", cost: { fabric: -0.11 }, acceptance: -8 },
      { label: "STF 75 H (staple flax)", cost: { fabric: 0.14 }, acceptance: 3 },
    ],
  },
  {
    id: "certification",
    name: "Certification",
    impact: "medium",
    baselineIndex: 0,
    recommendedIndex: 0,
    rationale: "OEKO-TEX + BCI is the buyer scorecard baseline; GOTS lifts acceptance but adds audit cost.",
    options: [
      { label: "OEKO-TEX + BCI Cotton", cost: {} },
      { label: "OEKO-TEX only", cost: { certification: -0.05 }, acceptance: -8 },
      { label: "OEKO + BCI + GOTS", cost: { certification: 0.04 }, acceptance: 6 },
    ],
  },
  {
    id: "transportation",
    name: "Transportation",
    impact: "lower",
    baselineIndex: 0,
    recommendedIndex: 0,
    rationale: "Sea FCL Mundra → Felixstowe holds the ex-works plan; air only if PP slips.",
    options: [
      { label: "Sea · FCL 40HQ", cost: {} },
      { label: "Sea · LCL", cost: { transportation: -0.06 }, leadTime: 1, acceptance: -3 },
      { label: "Air freight", cost: { transportation: 1.8 }, leadTime: -3 },
    ],
  },
  {
    id: "sampling",
    name: "Unit",
    impact: "lower",
    baselineIndex: 0,
    recommendedIndex: 0,
    rationale: "Piece-level costing keeps the quote comparable across sizes; Set-3 bundles apply for sheet programs.",
    options: [
      { label: "Piece (Pce)", cost: {} },
      { label: "Set-2 (Comforter + 1 PC)", cost: { sampling: 0.02 }, acceptance: 3 },
      { label: "Set-3 (Flat + Fitted + PC)", cost: { sampling: 0.04 }, acceptance: 6 },
    ],
  },
  {
    id: "audit",
    name: "Buyer Discount",
    impact: "lower",
    baselineIndex: 0,
    recommendedIndex: 1,
    rationale: "Sheet quotes -10% / -15% / -20% off buyer target. -15% wins the tier without breaking margin floor.",
    options: [
      { label: "-10% off target", cost: {} },
      { label: "-15% off target", cost: { certification: -0.05 }, acceptance: 4 },
      { label: "-20% off target", cost: { certification: -0.09 }, acceptance: 8 },
    ],
  },
  {
    id: "courier",
    name: "Design #",
    impact: "lower",
    baselineIndex: 0,
    recommendedIndex: 0,
    rationale: "Design 2293226 is the anchor print; 2293326 and 2293426 are program extensions.",
    options: [
      { label: "2293226 · Comforter anchor", cost: {} },
      { label: "2293326 · Sheet coordinates", cost: { sampling: -0.02 } },
      { label: "2293426 · Quilt extension", cost: { sampling: 0.01 } },
    ],
  },
];

// Quick map for lookups
const VAR_MAP: Record<VariableId, VariableDef> = Object.fromEntries(
  VARIABLES.map((v) => [v.id, v]),
) as Record<VariableId, VariableDef>;

type Selection = Record<VariableId, number>;

const initialSelection: Selection = Object.fromEntries(
  VARIABLES.map((v) => [v.id, v.baselineIndex]),
) as Selection;

// ─────────────────────────────────────────────────────────────────────────────
// Recompute engine — pure derivation of every commercial metric
// ─────────────────────────────────────────────────────────────────────────────

function compute(selection: Selection) {
  const costs: Record<CostKey, number> = { ...BASE_COSTS };
  let leadTime = BASE.leadTime;
  let acceptance = BASE.acceptance;

  for (const v of VARIABLES) {
    const opt = v.options[selection[v.id]];
    if (opt.cost) {
      for (const k of Object.keys(opt.cost) as CostKey[]) {
        costs[k] += opt.cost[k] ?? 0;
      }
    }
    if (opt.leadTime) leadTime += opt.leadTime;
    if (opt.acceptance) acceptance += opt.acceptance;
  }

  const unitCost = Object.values(costs).reduce((s, n) => s + n, 0);
  const qty = VAR_MAP.moq.options[selection.moq].qty ?? 2500;
  const price = unitCost * (1 + BASE.markup);
  const profitPerPc = price - unitCost;
  const margin = (profitPerPc / price) * 100;
  const orderProfit = profitPerPc * qty;
  const annualProfit = orderProfit * BASE.annualMultiplier;
  const breakEven = Math.max(1, Math.ceil(BASE.fixedCost / profitPerPc));

  return {
    costs,
    unitCost,
    qty,
    price,
    profitPerPc,
    margin,
    orderProfit,
    annualProfit,
    breakEven,
    leadTime,
    acceptance: Math.max(5, Math.min(99, Math.round(acceptance))),
  };
}

type Compute = ReturnType<typeof compute>;

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

// Currency — module-level mutable state; parent bumps a version counter to force re-render.
type CcyCode = "USD" | "EUR" | "INR" | "GBP" | "AED";
const CCY: Record<CcyCode, { symbol: string; rate: number; label: string }> = {
  USD: { symbol: "$", rate: 1, label: "US Dollar" },
  EUR: { symbol: "€", rate: 0.92, label: "Euro" },
  GBP: { symbol: "£", rate: 0.79, label: "British Pound" },
  INR: { symbol: "₹", rate: 83.2, label: "Indian Rupee" },
  AED: { symbol: "د.إ", rate: 3.67, label: "UAE Dirham" },
};
let ACTIVE_CCY: CcyCode = "USD";
const setActiveCurrency = (c: CcyCode) => { ACTIVE_CCY = c; };

const fmtUsd = (n: number, opts: { compact?: boolean } = {}) => {
  const c = CCY[ACTIVE_CCY];
  const raw = n * c.rate;
  const abs = Math.abs(raw);
  const sign = raw < 0 ? "-" : "";
  if (opts.compact && abs >= 1000) {
    const k = abs / 1000;
    return `${sign}${c.symbol}${k.toFixed(k >= 100 ? 0 : 1)}k`;
  }
  return `${sign}${c.symbol}${abs.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: abs < 10 ? 2 : 0 })}`;
};
const fmtPrice = (n: number) => {
  const c = CCY[ACTIVE_CCY];
  const v = n * c.rate;
  return `${c.symbol}${v.toFixed(v >= 100 ? 0 : 2)}`;
};
const fmtDelta = (n: number, decimals = 2) => `${n >= 0 ? "+" : ""}${(n * CCY[ACTIVE_CCY].rate).toFixed(decimals)}`;
const fmtPct = (n: number, decimals = 1) => `${n.toFixed(decimals)}%`;
const fmtSigned = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

function CurrencySelect({ value, onChange }: { value: CcyCode; onChange: (c: CcyCode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const active = CCY[value];
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white/70 backdrop-blur px-2.5 py-1.5 text-[12px] font-medium text-foreground hover:bg-white transition-colors"
      >
        <span className="text-[13px] leading-none num">{active.symbol}</span>
        <span className="tracking-wide">{value}</span>
        <ChevronDown className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 min-w-[180px] rounded-xl border border-border bg-white shadow-[0_12px_32px_rgba(15,23,42,0.10)] p-1 z-50 animate-surface-in">
          {(Object.keys(CCY) as CcyCode[]).map((code) => {
            const c = CCY[code];
            const isActive = code === value;
            return (
              <button
                key={code}
                type="button"
                onClick={() => { onChange(code); setOpen(false); }}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg text-left text-[12.5px] transition-colors",
                  isActive ? "bg-secondary/70 text-foreground" : "hover:bg-secondary/50 text-foreground",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center w-6 text-[13px] font-medium num">{c.symbol}</span>
                  <span className="font-medium">{code}</span>
                  <span className="text-muted-foreground text-[11.5px]">{c.label}</span>
                </span>
                {isActive && <Check className="size-3.5 text-foreground" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-[10.5px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        {children}
      </h3>
      {right}
    </div>
  );
}

function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "opportunity" | "success" | "warning" | "risk";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "bg-secondary text-muted-foreground ring-border",
    opportunity: "bg-opportunity-soft text-opportunity ring-opportunity/15",
    success: "bg-success-soft text-success ring-success/15",
    warning: "bg-warning-soft text-warning ring-warning/15",
    risk: "bg-risk-soft text-risk ring-risk/15",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded ring-1",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

function Bar({ value, tone = "default" }: { value: number; tone?: "default" | "success" | "risk" | "opportunity" }) {
  const color =
    tone === "success"
      ? "bg-success"
      : tone === "risk"
        ? "bg-risk"
        : tone === "opportunity"
          ? "bg-opportunity"
          : "bg-foreground/80";
  return (
    <div className="h-1.5 w-full rounded-full bg-border/60 overflow-hidden">
      <div className={cn("h-full transition-all duration-700 ease-out", color)} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

/** Briefly flashes its container when value changes. */
function useFlashKey(value: string | number) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("animate-value-flash");
    void el.offsetWidth;
    el.classList.add("animate-value-flash");
  }, [value]);
  return ref;
}

function LiveValue({ children, className }: { children: string | number; className?: string }) {
  const ref = useFlashKey(children);
  return (
    <span ref={ref} className={cn("inline-block px-1 -mx-1 rounded num", className)}>
      {children}
    </span>
  );
}

/** Smoothly tweens a numeric value over ~600ms. */
function AnimatedNumber({
  value,
  format,
  className,
  duration = 600,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    startRef.current = null;
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = from + (to - from) * eased;
      setDisplay(cur);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = to;
    };
  }, [value, duration]);

  return <span className={cn("num tabular-nums", className)}>{format(display)}</span>;
}


// ─────────────────────────────────────────────────────────────────────────────
// LEFT — Variables Studio (expandable cards with option picker + AI hint)
// ─────────────────────────────────────────────────────────────────────────────

function OptionRow({
  option,
  selected,
  recommended,
  onSelect,
}: {
  option: Option;
  selected: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors",
        selected ? "bg-primary text-primary-foreground" : "hover:bg-secondary/70",
      )}
    >
      <span
        className={cn(
          "size-3.5 rounded-full border flex items-center justify-center shrink-0",
          selected ? "border-primary-foreground bg-primary-foreground" : "border-border",
        )}
      >
        {selected && <span className="size-1.5 rounded-full bg-primary" />}
      </span>
      <span className="text-[12px] flex-1 truncate">{option.label}</span>
      {recommended && !selected && (
        <span className="inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-wider text-opportunity">
          <Sparkles className="size-2.5" /> AI
        </span>
      )}
      {recommended && selected && (
        <span className="text-[9.5px] font-semibold uppercase tracking-wider text-primary-foreground/85">AI pick</span>
      )}
    </button>
  );
}

function VariableCard({
  def,
  selectedIndex,
  focused,
  expanded,
  preview,
  onFocus,
  onToggle,
  onSelect,
}: {
  def: VariableDef;
  selectedIndex: number;
  focused: boolean;
  expanded: boolean;
  preview: { profit: number; margin: number; acceptance: number; confidence: number } | null;
  onFocus: () => void;
  onToggle: () => void;
  onSelect: (i: number) => void;
}) {
  const opt = def.options[selectedIndex];
  const showRec = selectedIndex !== def.recommendedIndex && preview;
  return (
    <div
      className={cn(
        "rounded-lg border bg-card transition-all",
        focused ? "border-foreground/30 ring-1 ring-foreground/10" : "border-border hover:border-foreground/15",
      )}
    >
      <div className="w-full flex items-start gap-1 px-1.5 py-1">
        <button
          onClick={() => { onFocus(); if (!expanded) onToggle(); }}
          className="flex-1 min-w-0 text-left px-1.5 py-1.5 rounded-md hover:bg-secondary/50 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium tracking-tight truncate">{def.name}</div>
              <div className="text-[11px] text-muted-foreground truncate mt-0.5">{opt.label}</div>
            </div>
            {showRec ? (
              <Pill tone="opportunity">+{fmtUsd(preview.profit, { compact: true })}</Pill>
            ) : selectedIndex === def.recommendedIndex ? (
              <Pill tone="success">
                <Check className="size-2.5" /> AI
              </Pill>
            ) : null}
          </div>
        </button>
        <button
          onClick={onToggle}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="shrink-0 size-7 grid place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
        >
          <ChevronRight className={cn("size-3.5 transition-transform", expanded && "rotate-90")} />
        </button>
      </div>

      {expanded && (
        <div className="px-2.5 pb-3 pt-1 border-t border-border/60 animate-surface-in space-y-1.5">
          <div className="space-y-0.5">
            {def.options.map((o, i) => (
              <OptionRow
                key={i}
                option={o}
                selected={i === selectedIndex}
                recommended={i === def.recommendedIndex}
                onSelect={() => onSelect(i)}
              />
            ))}
          </div>

          {showRec && (
            <div className="mt-2 rounded-md bg-opportunity-soft/60 ring-1 ring-opportunity/15 px-2.5 py-2 space-y-1.5">
              <div className="flex items-start gap-1.5">
                <Sparkles className="size-3 text-opportunity mt-0.5 shrink-0" />
                <div className="text-[11px] text-foreground/80 leading-snug">
                  AI suggests <span className="font-medium text-foreground">{def.options[def.recommendedIndex].label}</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-[10px]">
                <Mini k="Profit" v={`+${fmtUsd(preview.profit, { compact: true })}`} tone="success" />
                <Mini k="Margin" v={`${fmtDelta(preview.margin, 1)}pt`} tone="success" />
                <Mini k="Accept" v={`${preview.acceptance}%`} />
                <Mini k="Conf" v={`${preview.confidence}%`} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Mini({ k, v, tone }: { k: string; v: string; tone?: "success" }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{k}</div>
      <div className={cn("text-[11px] num font-semibold", tone === "success" ? "text-success" : "text-foreground")}>{v}</div>
    </div>
  );
}

type RightView = "overview" | "recommendations" | "risks" | "chat";

function RightRail({
  view,
  onView,
}: {
  view: RightView;
  onView: (v: RightView) => void;
}) {
  const items: { id: RightView; icon: typeof LayoutDashboard; label: string }[] = [
    { id: "overview", icon: LayoutDashboard, label: "Overview" },
    { id: "recommendations", icon: Lightbulb, label: "Recommendations" },
    { id: "risks", icon: ShieldAlert, label: "Risks" },
    { id: "chat", icon: MessageSquare, label: "AI Chat" },
  ];
  return (
    <div className="w-12 shrink-0 border-l border-border bg-surface flex flex-col items-center py-3 gap-1">
      {items.map((it) => {
        const active = view === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onView(it.id)}
            title={it.label}
            className={cn(
              "size-9 rounded-lg grid place-items-center transition-all",
              active
                ? "bg-brand-50 text-brand-700 ring-1 ring-brand-700/20"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <it.icon className="size-4" />
          </button>
        );
      })}
    </div>
  );
}

function ChatView() {
  const [messages, setMessages] = useState<{ from: "ai" | "you"; text: string }[]>([
    { from: "ai", text: "Hi — I'm your commercial co-pilot. Ask me about trade-offs, sensitivities, or alternate scenarios for this quote." },
  ]);
  const [input, setInput] = useState("");
  const send = () => {
    if (!input.trim()) return;
    setMessages((m) => [
      ...m,
      { from: "you", text: input.trim() },
      { from: "ai", text: "Thinking through the lever combinations…" },
    ]);
    setInput("");
  };
  return (
    <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
      {/* Ambient orb backdrop */}
      <div className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-gradient-to-br from-brand-500/25 via-brand-700/15 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-16 size-64 rounded-full bg-gradient-to-tr from-gold-500/20 via-brand-500/10 to-transparent blur-3xl" />

      {/* Orb hero */}
      <div className="relative px-4 pt-5 pb-3 flex flex-col items-center text-center">
        <div className="relative size-16 mb-2">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-500 via-brand-700 to-brand-900 shadow-[0_10px_40px_-8px_rgba(5,96,77,0.55)]" />
          <div className="absolute inset-1 rounded-full bg-gradient-to-tr from-white/60 via-white/10 to-transparent backdrop-blur-sm" />
          <div className="absolute inset-0 rounded-full ring-1 ring-white/40" />
          <div className="absolute -inset-2 rounded-full bg-brand-500/30 blur-2xl animate-pulse" />
          <div className="absolute top-2 left-3 size-3 rounded-full bg-white/70 blur-[1px]" />
        </div>
        <div className="text-[13px] font-display font-semibold tracking-tight">Tracon AI</div>
        <div className="text-[10.5px] text-muted-foreground">Live commercial reasoning</div>
      </div>

      {/* Messages */}
      <div className="relative flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[88%] rounded-2xl px-3 py-2 text-[12.5px] leading-snug backdrop-blur-md border",
              m.from === "ai"
                ? "bg-white/60 border-white/70 text-foreground shadow-[0_2px_10px_-4px_rgba(5,96,77,0.15)]"
                : "ml-auto bg-brand-700/95 border-brand-700/40 text-primary-foreground",
            )}
          >
            {m.text}
          </div>
        ))}
      </div>

      {/* Glass composer */}
      <div className="relative border-t border-white/40 p-3 bg-white/30 backdrop-blur-xl">
        <div className="flex items-center gap-2 rounded-xl border border-white/60 bg-white/70 backdrop-blur px-3 py-2 shadow-[0_4px_20px_-8px_rgba(5,96,77,0.15)] focus-within:ring-2 focus-within:ring-brand-700/30 transition">
          <div className="size-5 rounded-full bg-gradient-to-br from-brand-500 to-brand-800 shrink-0 ring-1 ring-white/60" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask the studio…"
            className="flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={send}
            className="size-7 rounded-lg bg-brand-700 hover:bg-brand-800 text-primary-foreground grid place-items-center transition"
            title="Send"
          >
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function RisksView({ selection, current }: { selection: Selection; current: Compute }) {
  const risks = buildRisks(selection, current);
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
      <SectionLabel>Active Risks</SectionLabel>
      <div className="space-y-2 pt-1">
        {risks.map((r, i) => (
          <RiskAlert key={i} {...r} />
        ))}
      </div>
    </div>
  );
}


function LeftPane({
  selection,
  focusedId,
  expandedId,
  base,
  onFocus,
  onToggle,
  onSelect,
  onCollapse,
}: {
  selection: Selection;
  focusedId: VariableId;
  expandedId: VariableId | null;
  base: Compute;
  onFocus: (id: VariableId) => void;
  onToggle: (id: VariableId) => void;
  onSelect: (id: VariableId, i: number) => void;
  onCollapse: () => void;
}) {
  // Preview for each variable: what would change if we picked AI recommended right now
  const previews = useMemo(() => {
    const map: Record<string, { profit: number; margin: number; acceptance: number; confidence: number } | null> = {};
    for (const v of VARIABLES) {
      if (v.recommendedIndex === selection[v.id]) {
        map[v.id] = null;
        continue;
      }
      const trial = { ...selection, [v.id]: v.recommendedIndex };
      const next = compute(trial);
      map[v.id] = {
        profit: next.annualProfit - base.annualProfit,
        margin: next.margin - base.margin,
        acceptance: next.acceptance,
        confidence: Math.round(80 + (next.annualProfit - base.annualProfit) / 5000),
      };
    }
    return map;
  }, [selection, base]);

  const visible = VARIABLES.filter((v) => v.id !== "fabricWidth");

  return (
    <aside className="w-[300px] shrink-0 border-r border-border bg-surface/40 flex flex-col h-full">
      <div className="px-4 h-12 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-6 rounded-md bg-brand-700 text-primary-foreground grid place-items-center shrink-0">
            <LayoutDashboard className="size-3.5" />
          </div>
          <div className="font-display font-semibold tracking-tight text-[13px] truncate">
            Variables
          </div>
        </div>
        <button
          onClick={onCollapse}
          className="size-7 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground grid place-items-center transition-colors"
          title="Collapse"
        >
          <PanelLeftClose className="size-3.5" />
        </button>
      </div>


      <div className="flex-1 overflow-y-auto px-3 py-3">
        <section className="space-y-2">
          <SectionLabel
            right={<span className="text-[10px] text-muted-foreground num">{visible.length} levers</span>}
          >
            Variables
          </SectionLabel>
          <div className="space-y-1.5">
            {visible.map((v) => (
              <VariableCard
                key={v.id}
                def={v}
                selectedIndex={selection[v.id]}
                focused={focusedId === v.id}
                expanded={expandedId === v.id}
                preview={previews[v.id]}
                onFocus={() => onFocus(v.id)}
                onToggle={() => onToggle(v.id)}
                onSelect={(i) => onSelect(v.id, i)}
              />
            ))}
          </div>
        </section>
      </div>

      <div className="px-4 py-2.5 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          Live simulation
        </span>
        <span className="num">{VARIABLES.length} variables</span>
      </div>
    </aside>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// Sticky Outcome — premium horizontal summary, animated counters
// ─────────────────────────────────────────────────────────────────────────────

function StickyOutcome({ current, baseline }: { current: Compute; baseline: Compute }) {
  const marginDelta = current.margin - baseline.margin;
  const priceDelta = current.price - baseline.price;
  const costDelta = current.unitCost - baseline.unitCost;
  const score = commercialScore(current);
  const baseScore = commercialScore(baseline);

  const orderValue = current.price * current.qty;
  const baseOrderValue = baseline.price * baseline.qty;

  const items: {
    k: string;
    value: number;
    fmt: (n: number) => string;
    delta?: number;
    deltaFmt?: (n: number) => string;
    goodIfHigh?: boolean;
  }[] = [
    { k: "Order Value", value: orderValue, fmt: (n) => fmtUsd(n, { compact: true }), delta: orderValue - baseOrderValue, deltaFmt: (n) => fmtUsd(Math.abs(n), { compact: true }), goodIfHigh: true },
    { k: "Selling Price", value: current.price, fmt: (n) => fmtPrice(n), delta: priceDelta, deltaFmt: (n) => fmtPrice(Math.abs(n)), goodIfHigh: true },
    { k: "Material Cost", value: current.unitCost, fmt: (n) => fmtPrice(n), delta: costDelta, deltaFmt: (n) => fmtPrice(Math.abs(n)), goodIfHigh: false },
    { k: "Margin", value: current.margin, fmt: (n) => `${n.toFixed(1)}%`, delta: marginDelta, deltaFmt: (n) => `${Math.abs(n).toFixed(1)}pt`, goodIfHigh: true },
    { k: "Order Profit", value: current.orderProfit, fmt: (n) => fmtUsd(n, { compact: true }), delta: current.orderProfit - baseline.orderProfit, deltaFmt: (n) => fmtUsd(Math.abs(n), { compact: true }), goodIfHigh: true },
    { k: "Break-even", value: current.breakEven, fmt: (n) => `${Math.round(n).toLocaleString()}`, delta: current.breakEven - baseline.breakEven, deltaFmt: (n) => `${Math.round(Math.abs(n)).toLocaleString()}`, goodIfHigh: false },
    { k: "Commercial Score", value: score, fmt: (n) => `${Math.round(n)}`, delta: score - baseScore, deltaFmt: (n) => `${Math.round(Math.abs(n))}`, goodIfHigh: true },
  ];

  const renderDelta = (it: (typeof items)[number]) => {
    if (it.delta === undefined || !it.deltaFmt) return null;
    const threshold = it.k === "Break-even" ? 0.5 : 0.005;
    if (Math.abs(it.delta) <= threshold) return null;
    const positive = it.goodIfHigh ? it.delta > 0 : it.delta < 0;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium num",
          positive ? "bg-success-soft text-success" : "bg-risk-soft text-risk",
        )}
      >
        {positive ? "↑" : "↓"} {it.deltaFmt(it.delta)}
      </span>
    );
  };

  return (
    <div className="border-b border-border bg-background sticky top-14 z-10">
      <div className="flex items-stretch px-6 py-3">
        {items.map((it, idx) => (
          <div
            key={it.k}
            className={cn(
              "flex-1 min-w-0 px-4 first:pl-0 last:pr-0",
              idx > 0 && "border-l border-border",
            )}
          >
            <div className="text-[9.5px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">
              {it.k}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <AnimatedNumber
                value={it.value}
                format={it.fmt}
                className={cn(
                  "font-display font-semibold tracking-tight num",
                  idx === 0 ? "text-[18px] text-brand-700" : "text-[17px] text-foreground",
                )}
              />
              {renderDelta(it)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Business Impact Flow — visual cascade graph with sequenced reveal
// ─────────────────────────────────────────────────────────────────────────────

type FlowNode = {
  id: string;
  label: string;
  detail?: string;
  value?: string;
  delta?: string;
  tone: "neutral" | "success" | "risk" | "trigger";
};

function buildImpactGraph(
  changedId: VariableId | null,
  prev: Compute,
  curr: Compute,
  selection: Selection,
): FlowNode[] {
  if (!changedId) return [];
  const def = VAR_MAP[changedId];
  const opt = def.options[selection[changedId]];
  const prevOpt = def.options[
    Object.keys(opt.cost ?? {}).length || opt.label !== def.options[def.baselineIndex].label
      ? def.baselineIndex
      : def.baselineIndex
  ];

  const nodes: FlowNode[] = [
    {
      id: "trigger",
      label: `${def.name} changed`,
      detail: `${prevOpt?.label ?? "—"} → ${opt.label}`,
      tone: "trigger",
    },
  ];

  const dCost = curr.unitCost - prev.unitCost;
  const dPrice = curr.price - prev.price;
  const dMargin = curr.margin - prev.margin;
  const dAccept = curr.acceptance - prev.acceptance;
  const dBreak = curr.breakEven - prev.breakEven;
  const dLead = curr.leadTime - prev.leadTime;
  const dProfit = curr.annualProfit - prev.annualProfit;

  // Cascade copy per variable family
  if (changedId === "moq") {
    const newQty = (opt.qty ?? 0);
    const oldQty = (prevOpt.qty ?? 0);
    if (newQty > oldQty) {
      nodes.push({ id: "tier", label: "Supplier discount tier unlocked", detail: `Yarn rate steps down past ${newQty.toLocaleString()} pcs`, tone: "success" });
    }
    nodes.push({ id: "spread", label: "Fixed costs spread across more units", detail: `Setup $${BASE.fixedCost} amortizes ${newQty > oldQty ? "wider" : "narrower"}`, tone: newQty >= oldQty ? "success" : "risk" });
  }
  if (changedId === "fabricWidth") {
    nodes.push({ id: "cons", label: "Fabric consumption recalculated", detail: `Cutting wastage shifts ${dCost <= 0 ? "down" : "up"}`, tone: dCost <= 0 ? "success" : "risk" });
  }
  if (changedId === "fabricSupplier") {
    nodes.push({ id: "rate", label: "Supplier yarn rate applied", detail: opt.label, tone: dCost <= 0 ? "success" : "risk" });
  }
  if (changedId === "packaging") {
    nodes.push({ id: "pkg", label: "Packaging spec updated", detail: opt.label, tone: dCost <= 0 ? "success" : "risk" });
  }

  if (Math.abs(dCost) > 0.001) {
    nodes.push({
      id: "cost",
      label: "Material cost",
      value: fmtPrice(curr.unitCost),
      delta: `${dCost > 0 ? "+" : "−"}${fmtPrice(Math.abs(dCost))}`,
      tone: dCost <= 0 ? "success" : "risk",
    });
  }
  if (Math.abs(dPrice) > 0.001) {
    nodes.push({
      id: "price",
      label: "Selling price",
      value: fmtPrice(curr.price),
      delta: `${dPrice > 0 ? "+" : "−"}${fmtPrice(Math.abs(dPrice))}`,
      tone: dPrice >= 0 ? "success" : "risk",
    });
  }
  if (Math.abs(dBreak) >= 1) {
    nodes.push({
      id: "be",
      label: "Break-even",
      value: `${curr.breakEven.toLocaleString()} pcs`,
      delta: `${dBreak > 0 ? "+" : "−"}${Math.abs(dBreak).toLocaleString()}`,
      tone: dBreak <= 0 ? "success" : "risk",
    });
  }
  if (Math.abs(dMargin) > 0.05) {
    nodes.push({
      id: "margin",
      label: "Margin",
      value: fmtPct(curr.margin),
      delta: `${dMargin > 0 ? "+" : "−"}${Math.abs(dMargin).toFixed(1)}pt`,
      tone: dMargin >= 0 ? "success" : "risk",
    });
  }
  if (Math.abs(dAccept) >= 1) {
    nodes.push({
      id: "accept",
      label: "Buyer acceptance",
      value: `${curr.acceptance}%`,
      delta: `${dAccept > 0 ? "+" : "−"}${Math.abs(dAccept)}pt`,
      tone: dAccept >= 0 ? "success" : "risk",
    });
  }
  if (Math.abs(dLead) >= 0.2) {
    nodes.push({
      id: "lead",
      label: "Lead time",
      value: `${curr.leadTime.toFixed(1)} wk`,
      delta: `${dLead > 0 ? "+" : "−"}${Math.abs(dLead).toFixed(1)}w`,
      tone: dLead <= 0 ? "success" : "risk",
    });
  }
  if (Math.abs(dProfit) > 50) {
    nodes.push({
      id: "profit",
      label: "Projected annual profit",
      value: fmtUsd(curr.annualProfit, { compact: true }),
      delta: `${dProfit > 0 ? "+" : "−"}${fmtUsd(Math.abs(dProfit), { compact: true })}`,
      tone: dProfit >= 0 ? "success" : "risk",
    });
  }
  return nodes;
}

function ImpactGraph({ nodes }: { nodes: FlowNode[] }) {
  if (nodes.length === 0) {
    return (
      <div className="text-[12.5px] text-muted-foreground italic">
        Adjust a variable on the left to watch the chain reaction unfold here.
      </div>
    );
  }
  return (
    <div className="space-y-0" key={nodes.map((n) => n.id).join("|")}>
      {nodes.map((n, i) => {
        const isLast = i === nodes.length - 1;
        const toneRing =
          n.tone === "success"
            ? "ring-success/25 bg-success-soft/40"
            : n.tone === "risk"
              ? "ring-risk/25 bg-risk-soft/40"
              : n.tone === "trigger"
                ? "ring-opportunity/30 bg-opportunity-soft/50"
                : "ring-border bg-card";
        const toneText =
          n.tone === "success" ? "text-success" : n.tone === "risk" ? "text-risk" : n.tone === "trigger" ? "text-opportunity" : "text-foreground";
        return (
          <div key={n.id} className="relative">
            <div
              className="animate-surface-in"
              style={{ animationDelay: `${i * 110}ms`, animationFillMode: "backwards" }}
            >
              <div className={cn("rounded-lg ring-1 px-4 py-3 flex items-center gap-4", toneRing)}>
                <div className="flex-1 min-w-0">
                  <div className={cn("text-[12.5px] font-semibold", toneText)}>{n.label}</div>
                  {n.detail && (
                    <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{n.detail}</div>
                  )}
                </div>
                {n.value && (
                  <div className="text-right">
                    <div className="text-[14px] font-display font-semibold num tracking-tight">{n.value}</div>
                    {n.delta && (
                      <div className={cn("text-[10.5px] num font-medium", toneText)}>{n.delta}</div>
                    )}
                  </div>
                )}
              </div>
              {!isLast && (
                <div className="flex justify-start pl-7 my-1">
                  <div className="w-px h-3 bg-border" />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live Impact Visualization — contextual Before/After comparison
// ─────────────────────────────────────────────────────────────────────────────

type VizMetricKey = "price" | "cost" | "margin" | "profit" | "annual" | "accept" | "lead" | "be" | "fabricShare" | "packShare" | "transportShare";

function vizMetricsForVariable(id: VariableId | null): VizMetricKey[] {
  if (!id) return ["price", "cost", "margin", "annual"];
  if (id === "moq") return ["profit", "margin", "cost", "be", "accept"];
  if (id === "fabricWidth" || id === "fabricSupplier" || id === "fabricConstruction") return ["fabricShare", "cost", "price", "margin"];
  if (id === "packaging") return ["packShare", "accept", "price", "margin"];
  if (id === "transportation") return ["transportShare", "lead", "cost", "price"];
  if (id === "testing" || id === "certification") return ["cost", "accept", "lead", "margin"];
  if (id === "sampling" || id === "audit" || id === "courier") return ["cost", "lead", "margin", "annual"];
  if (id === "printing" || id === "embroidery") return ["cost", "accept", "margin", "price"];
  return ["price", "cost", "margin", "annual"];
}

const VIZ_META: Record<
  VizMetricKey,
  { label: string; get: (c: Compute) => number; fmt: (n: number) => string; goodIfHigh: boolean }
> = {
  price: { label: "Selling Price", get: (c) => c.price, fmt: (n) => fmtPrice(n), goodIfHigh: true },
  cost: { label: "Material Cost", get: (c) => c.unitCost, fmt: (n) => fmtPrice(n), goodIfHigh: false },
  margin: { label: "Margin", get: (c) => c.margin, fmt: (n) => `${n.toFixed(1)}%`, goodIfHigh: true },
  profit: { label: "Order Profit", get: (c) => c.orderProfit, fmt: (n) => fmtUsd(n, { compact: true }), goodIfHigh: true },
  annual: { label: "Annual Profit", get: (c) => c.annualProfit, fmt: (n) => fmtUsd(n, { compact: true }), goodIfHigh: true },
  accept: { label: "Buyer Acceptance", get: (c) => c.acceptance, fmt: (n) => `${Math.round(n)}%`, goodIfHigh: true },
  lead: { label: "Lead Time", get: (c) => c.leadTime, fmt: (n) => `${n.toFixed(1)} wk`, goodIfHigh: false },
  be: { label: "Break-even", get: (c) => c.breakEven, fmt: (n) => `${Math.round(n).toLocaleString()} pcs`, goodIfHigh: false },
  fabricShare: { label: "Fabric Share", get: (c) => (c.costs.fabric / c.unitCost) * 100, fmt: (n) => `${n.toFixed(0)}%`, goodIfHigh: false },
  packShare: { label: "Packaging Share", get: (c) => (c.costs.packaging / c.unitCost) * 100, fmt: (n) => `${n.toFixed(0)}%`, goodIfHigh: false },
  transportShare: { label: "Transport Share", get: (c) => (c.costs.transportation / c.unitCost) * 100, fmt: (n) => `${n.toFixed(0)}%`, goodIfHigh: false },
};

function LiveImpactViz({
  baseline,
  current,
  focusedId,
  changedId,
}: {
  baseline: Compute;
  current: Compute;
  focusedId: VariableId;
  changedId: VariableId | null;
}) {
  const driverId = changedId ?? focusedId;
  const keys = vizMetricsForVariable(driverId);
  const def = VAR_MAP[driverId];

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Live impact · contextual to {def.name}
          </div>
          <div className="text-[13px] font-display font-semibold tracking-tight mt-0.5">
            Current vs Modified
          </div>
        </div>
        <div className="text-[10.5px] text-muted-foreground">animates while you edit</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {keys.map((k) => {
          const meta = VIZ_META[k];
          const baseVal = meta.get(baseline);
          const curVal = meta.get(current);
          const delta = curVal - baseVal;
          const better = meta.goodIfHigh ? delta > 0 : delta < 0;
          const moved = Math.abs(delta) > 0.005;
          // bars scaled relative to max of the pair
          const max = Math.max(Math.abs(baseVal), Math.abs(curVal)) || 1;
          const basePct = (Math.abs(baseVal) / max) * 100;
          const curPct = (Math.abs(curVal) / max) * 100;
          const toneCur = !moved ? "bg-foreground/30" : better ? "bg-success" : "bg-risk";
          const toneText = !moved ? "text-muted-foreground" : better ? "text-success" : "text-risk";
          return (
            <div key={k} className="rounded-lg border border-border/70 bg-background/50 p-3.5 space-y-2">
              <div className="flex items-baseline justify-between">
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">{meta.label}</div>
                {moved && (
                  <div className={cn("text-[10.5px] num font-semibold", toneText)}>
                    {better ? "↑" : "↓"} {meta.fmt(Math.abs(delta))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-12 text-[10px] uppercase tracking-wider text-muted-foreground">Current</span>
                  <div className="flex-1 h-2 bg-border/50 rounded-full overflow-hidden">
                    <div className="h-full bg-foreground/40 transition-all duration-700 ease-out" style={{ width: `${basePct}%` }} />
                  </div>
                  <span className="text-[11px] num text-muted-foreground w-16 text-right">{meta.fmt(baseVal)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-12 text-[10px] uppercase tracking-wider text-foreground/70">Modified</span>
                  <div className="flex-1 h-2 bg-border/50 rounded-full overflow-hidden">
                    <div className={cn("h-full transition-all duration-700 ease-out", toneCur)} style={{ width: `${curPct}%` }} />
                  </div>
                  <AnimatedNumber
                    value={curVal}
                    format={meta.fmt}
                    className="text-[11.5px] num font-semibold w-16 text-right text-foreground"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Business Impact Flow (existing simpler text trace used as fallback)
// ─────────────────────────────────────────────────────────────────────────────

function ImpactFlow({
  steps,
}: {
  steps: { step: string; tone: "neutral" | "success" | "risk" }[];
}) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const dot = s.tone === "success" ? "bg-success" : s.tone === "risk" ? "bg-risk" : "bg-foreground/40";
        return (
          <li
            key={i}
            className="relative pl-6 pb-3 last:pb-0 animate-surface-in"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            {i < steps.length - 1 && <span className="absolute left-[7px] top-3 bottom-0 w-px bg-border" />}
            <span className={cn("absolute left-1 top-1.5 size-2 rounded-full", dot)} />
            <div className="text-[12.5px] leading-snug text-foreground/85">{s.step}</div>
          </li>
        );
      })}
    </ol>
  );
}

function buildImpactSteps(
  changedId: VariableId | null,
  prev: Compute,
  curr: Compute,
  selection: Selection,
): { step: string; tone: "neutral" | "success" | "risk" }[] {
  if (!changedId) {
    return [
      { step: "No recent change — quotation reflects current selections.", tone: "neutral" },
      { step: `Margin ${fmtPct(curr.margin)} · break-even ${curr.breakEven.toLocaleString()} pcs`, tone: "neutral" },
    ];
  }
  const def = VAR_MAP[changedId];
  const opt = def.options[selection[changedId]];
  const dMargin = curr.margin - prev.margin;
  const dProfit = curr.annualProfit - prev.annualProfit;
  const steps: { step: string; tone: "neutral" | "success" | "risk" }[] = [
    { step: `You changed ${def.name} → ${opt.label}`, tone: "neutral" },
  ];
  if (Math.abs(dMargin) > 0.05)
    steps.push({
      step: `Margin ${dMargin >= 0 ? "lifts" : "slips"} to ${fmtPct(curr.margin)} (${fmtDelta(dMargin, 1)}pt)`,
      tone: dMargin >= 0 ? "success" : "risk",
    });
  if (Math.abs(dProfit) > 50)
    steps.push({
      step: `Projected annual profit ${dProfit >= 0 ? "rises" : "falls"} ${fmtUsd(Math.abs(dProfit), { compact: true })}`,
      tone: dProfit >= 0 ? "success" : "risk",
    });
  if (steps.length === 1) steps.push({ step: "No measurable downstream effect.", tone: "neutral" });
  return steps;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cost Contribution — highlight only changed bars
// ─────────────────────────────────────────────────────────────────────────────

function ContributionViz({
  current,
  baseline,
  onFocus,
}: {
  current: Compute;
  baseline: Compute;
  onFocus?: (id: VariableId) => void;
}) {
  const [openKey, setOpenKey] = useState<CostKey | null>(null);
  const rows = (Object.keys(current.costs) as CostKey[]).map((k) => ({
    key: k,
    label: COST_LABEL[k],
    cost: current.costs[k],
    baseCost: baseline.costs[k],
    delta: current.costs[k] - baseline.costs[k],
    pct: (current.costs[k] / current.unitCost) * 100,
  }));
  rows.sort((a, b) => b.cost - a.cost);
  return (
    <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
      {rows.map((r) => {
        const changed = Math.abs(r.delta) >= 0.005;
        const better = r.delta < 0;
        const barColor = !changed ? "bg-foreground/35" : better ? "bg-success" : "bg-risk";
        const open = openKey === r.key;
        const targetVar = COST_TO_VAR[r.key];
        return (
          <div key={r.key} className={cn("transition-colors", open && "bg-secondary/30")}>
            <button
              type="button"
              onClick={() => setOpenKey(open ? null : r.key)}
              className="w-full grid grid-cols-[150px_1fr_80px_80px_18px] items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary/40 transition-colors cursor-pointer"
            >
              <div className={cn("text-[12.5px]", changed ? "text-foreground font-medium" : "text-foreground/80")}>{r.label}</div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-full bg-border/50 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full transition-all duration-700 ease-out", barColor)}
                    style={{ width: `${Math.min(r.pct, 100)}%` }}
                  />
                </div>
                <span className="text-[11px] num text-muted-foreground w-9 text-right">{r.pct.toFixed(0)}%</span>
              </div>
              <div className="text-right text-[12px] num font-medium tabular-nums">
                <AnimatedNumber value={r.cost} format={(n) => fmtPrice(n)} />
              </div>
              <div className={cn("text-right text-[11px] num", changed ? (better ? "text-success" : "text-risk") : "text-muted-foreground")}>
                {!changed ? "—" : `${r.delta > 0 ? "+" : ""}${r.delta.toFixed(2)}`}
              </div>
              <ChevronRight className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />
            </button>
            {open && (
              <div className="px-4 pb-4 pt-1 animate-surface-in">
                <div className="grid grid-cols-4 gap-3 text-[11px]">
                  <div>
                    <div className="text-muted-foreground uppercase tracking-wider text-[9.5px] font-semibold">Current</div>
                    <div className="num font-medium text-foreground mt-0.5">{fmtPrice(r.cost)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground uppercase tracking-wider text-[9.5px] font-semibold">Baseline</div>
                    <div className="num font-medium text-foreground mt-0.5">{fmtPrice(r.baseCost)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground uppercase tracking-wider text-[9.5px] font-semibold">Contribution</div>
                    <div className="num font-medium text-foreground mt-0.5">{r.pct.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground uppercase tracking-wider text-[9.5px] font-semibold">Driver</div>
                    <div className="font-medium text-foreground mt-0.5">{VAR_MAP[targetVar].name}</div>
                  </div>
                </div>
                <div className="mt-3 text-[11.5px] text-foreground/75 leading-snug">
                  {changed
                    ? `${r.label} is ${better ? "below" : "above"} baseline by ${fmtPrice(Math.abs(r.delta))} per piece — driven by your current ${VAR_MAP[targetVar].name} selection.`
                    : `${r.label} matches baseline. Adjust ${VAR_MAP[targetVar].name} on the left to test alternatives.`}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onFocus?.(targetVar); }}
                    className="h-7 px-2.5 rounded-md text-[11px] font-medium border border-border bg-background hover:bg-secondary flex items-center gap-1.5"
                  >
                    Open {VAR_MAP[targetVar].name} workspace <ArrowRight className="size-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Commercial Explanation — every number, explained
// ─────────────────────────────────────────────────────────────────────────────

function CommercialExplanation({
  current,
  baseline,
  selection,
}: {
  current: Compute;
  baseline: Compute;
  selection: Selection;
}) {
  const reasons = changeReasons(selection, current, baseline);
  const metrics: {
    label: string;
    value: string;
    bullets: { text: string; tone: "success" | "risk" | "neutral" }[];
  }[] = [
    { label: "Selling Price", value: fmtPrice(current.price), bullets: reasons.priceReasons },
    { label: "Margin", value: fmtPct(current.margin), bullets: reasons.marginReasons },
    { label: "Break-even", value: `${current.breakEven.toLocaleString()} pcs`, bullets: reasons.breakEvenReasons },
    { label: "Buyer Acceptance", value: `${current.acceptance}%`, bullets: reasons.acceptReasons },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {metrics.map((m) => (
        <div key={m.label} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{m.label}</span>
            <LiveValue className="text-[18px] font-display font-semibold tracking-tight">{m.value}</LiveValue>
          </div>
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold mt-3">Because</div>
          <ul className="mt-1.5 space-y-1.5">
            {m.bullets.length === 0 ? (
              <li className="text-[11.5px] text-muted-foreground">No movement vs baseline.</li>
            ) : (
              m.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-[11.5px] text-foreground/85 leading-snug">
                  <span
                    className={cn(
                      "mt-1.5 size-1.5 rounded-full shrink-0",
                      b.tone === "success" ? "bg-success" : b.tone === "risk" ? "bg-risk" : "bg-foreground/40",
                    )}
                  />
                  <span>{b.text}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}

function changeReasons(selection: Selection, current: Compute, baseline: Compute) {
  const costBullets: { text: string; tone: "success" | "risk" }[] = [];
  for (const v of VARIABLES) {
    const idx = selection[v.id];
    if (idx === v.baselineIndex) continue;
    const opt = v.options[idx];
    if (!opt.cost) continue;
    const sum = Object.values(opt.cost).reduce<number>((s, n) => s + (n ?? 0), 0);
    if (Math.abs(sum) < 0.005) continue;
    costBullets.push({
      text: `${v.name} → ${opt.label} (${sum >= 0 ? "+" : ""}${sum.toFixed(2)} /pc)`,
      tone: sum <= 0 ? "success" : "risk",
    });
  }
  const priceReasons: { text: string; tone: "success" | "risk" | "neutral" }[] = costBullets.slice();
  if (priceReasons.length) {
    const dPrice = current.price - baseline.price;
    priceReasons.push({
      text: `Net price ${dPrice >= 0 ? "increase" : "decrease"} of ${fmtPrice(Math.abs(dPrice))}/pc`,
      tone: "neutral",
    });
  }
  const marginReasons: { text: string; tone: "success" | "risk" | "neutral" }[] = costBullets.slice();
  const dMargin = current.margin - baseline.margin;
  if (Math.abs(dMargin) > 0.05) {
    marginReasons.push({
      text: `${dMargin >= 0 ? "Lift" : "Drop"} of ${fmtDelta(dMargin, 1)}pt vs baseline ${fmtPct(baseline.margin)}`,
      tone: dMargin >= 0 ? "success" : "risk",
    });
  }
  const breakEvenReasons: { text: string; tone: "success" | "risk" | "neutral" }[] = [];
  const dBreak = current.breakEven - baseline.breakEven;
  if (current.profitPerPc !== baseline.profitPerPc)
    breakEvenReasons.push({
      text: `Profit per piece moved to ${fmtPrice(current.profitPerPc)} (${fmtPrice(baseline.profitPerPc)} baseline)`,
      tone: current.profitPerPc >= baseline.profitPerPc ? "success" : "risk",
    });
  if (Math.abs(dBreak) >= 1)
    breakEvenReasons.push({
      text: `Fixed overhead $${BASE.fixedCost} now clears in ${current.breakEven.toLocaleString()} pcs (${dBreak >= 0 ? "+" : ""}${dBreak})`,
      tone: dBreak <= 0 ? "success" : "risk",
    });
  const acceptReasons: { text: string; tone: "success" | "risk" | "neutral" }[] = [];
  for (const v of VARIABLES) {
    const idx = selection[v.id];
    if (idx === v.baselineIndex) continue;
    const opt = v.options[idx];
    if (!opt.acceptance) continue;
    acceptReasons.push({
      text: `${v.name} → ${opt.label} (${fmtSigned(opt.acceptance)}pt acceptance)`,
      tone: opt.acceptance >= 0 ? "success" : "risk",
    });
  }
  if (current.acceptance === baseline.acceptance && acceptReasons.length === 0) {
    acceptReasons.push({ text: "Buyer accepted similar pricing on last M&S AW programme", tone: "success" });
    acceptReasons.push({ text: "MOQ, certification, and lead time unchanged", tone: "neutral" });
  }
  return { priceReasons, marginReasons, breakEvenReasons, acceptReasons };
}

// ─────────────────────────────────────────────────────────────────────────────
// Explain Price Change — exportable price narrative
// ─────────────────────────────────────────────────────────────────────────────

function ExplainPriceChange({
  current,
  baseline,
  selection,
  onExport,
}: {
  current: Compute;
  baseline: Compute;
  selection: Selection;
  onExport: () => void;
}) {
  const dPrice = current.price - baseline.price;
  const lines: { text: string; sub?: string; sign: "up" | "down" }[] = [];
  for (const v of VARIABLES) {
    const idx = selection[v.id];
    if (idx === v.baselineIndex) continue;
    const opt = v.options[idx];
    if (!opt.cost) continue;
    const sum = Object.values(opt.cost).reduce<number>((s, n) => s + (n ?? 0), 0);
    if (Math.abs(sum) < 0.005) continue;
    lines.push({
      text: `${v.name} — ${opt.label}`,
      sub: v.rationale,
      sign: sum >= 0 ? "up" : "down",
    });
  }
  const moved = Math.abs(dPrice) > 0.005;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">Price movement</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-[22px] font-display font-semibold tracking-tight">
              {moved ? `${dPrice > 0 ? "+" : "−"}${fmtPrice(Math.abs(dPrice))}` : "No movement"}
            </span>
            {moved && <span className="text-[12px] text-muted-foreground">per unit · {fmtPrice(baseline.price)} → {fmtPrice(current.price)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onExport}
            className="h-8 px-2.5 rounded-md text-[11.5px] font-medium border border-border hover:bg-secondary flex items-center gap-1.5"
            title="Copy buyer-ready explanation"
          >
            <Copy className="size-3.5" /> Copy
          </button>
          <button
            onClick={onExport}
            className="h-8 px-2.5 rounded-md text-[11.5px] font-medium border border-border hover:bg-secondary flex items-center gap-1.5"
            title="Generate negotiation notes"
          >
            <Sparkles className="size-3.5" /> Negotiation
          </button>
          <button
            onClick={onExport}
            className="h-8 px-3 rounded-md text-[11.5px] font-medium bg-foreground text-background hover:bg-foreground/90 flex items-center gap-1.5"
          >
            <Download className="size-3.5" /> Export quote
          </button>
        </div>

      </div>
      <div className="px-5 py-4">
        {!moved && (
          <div className="text-[12.5px] text-muted-foreground">
            Quotation matches baseline price exactly. Change a variable on the left to generate a customer-ready narrative here.
          </div>
        )}
        {moved && (
          <ul className="space-y-2.5">
            {lines.map((l, i) => (
              <li key={i} className="flex items-start gap-3 animate-surface-in" style={{ animationDelay: `${i * 60}ms` }}>
                <span className={cn(
                  "mt-1 size-5 rounded-md grid place-items-center text-[11px] font-semibold shrink-0",
                  l.sign === "up" ? "bg-risk-soft text-risk" : "bg-success-soft text-success",
                )}>
                  {l.sign === "up" ? "↑" : "↓"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium">{l.text}</div>
                  {l.sub && <div className="text-[11px] text-muted-foreground leading-snug">{l.sub}</div>}
                </div>
              </li>
            ))}
            <li className="pt-3 mt-2 border-t border-border/60 flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Net commercial change</span>
              <span className={cn("text-[14px] num font-semibold", dPrice >= 0 ? "text-risk" : "text-success")}>
                {dPrice >= 0 ? "+" : "−"}{fmtPrice(Math.abs(dPrice))} /pc
              </span>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensitivity Analysis
// ─────────────────────────────────────────────────────────────────────────────

function SensitivityAnalysis({
  selection,
  current,
  onApply,
  onFocus,
}: {
  selection: Selection;
  current: Compute;
  onApply?: (id: VariableId, idx: number) => void;
  onFocus?: (id: VariableId) => void;
}) {
  const rows = useMemo(() => {
    const interesting: VariableId[] = ["moq", "fabricWidth", "fabricSupplier", "packaging", "testing", "transportation"];
    return interesting.map((id) => {
      const def = VAR_MAP[id];
      const curIdx = selection[id];
      const altIdx = curIdx === def.recommendedIndex ? (curIdx + 1) % def.options.length : def.recommendedIndex;
      const altSel = { ...selection, [id]: altIdx };
      const next = compute(altSel);
      return {
        id,
        altIdx,
        name: def.name,
        from: def.options[curIdx].label,
        to: def.options[altIdx].label,
        rationale: def.rationale,
        dPrice: next.price - current.price,
        dMargin: next.margin - current.margin,
        dProfit: next.annualProfit - current.annualProfit,
        dAccept: next.acceptance - current.acceptance,
      };
    });
  }, [selection, current]);

  // Sort by profit upside first — opportunities surface to the top.
  const ranked = rows.slice().sort((a, b) => b.dProfit - a.dProfit);

  return (
    <div className="grid grid-cols-2 gap-3">
      {ranked.map((r) => {
        const upside = r.dProfit > 50;
        const marginGood = r.dMargin > 0.05;
        const acceptHit = r.dAccept < -0.5;
        const tone: "success" | "risk" | "neutral" =
          upside || marginGood ? "success" : r.dProfit < -50 ? "risk" : "neutral";
        return (
          <div
            key={r.id}
            className={cn(
              "rounded-xl border bg-card p-4 flex flex-col gap-3 transition-colors",
              tone === "success" ? "border-success/40 hover:border-success/60" : tone === "risk" ? "border-risk/40 hover:border-risk/60" : "border-border hover:border-foreground/30",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">{r.name}</div>
                <div className="text-[13px] font-display font-semibold tracking-tight mt-0.5 truncate">{r.to}</div>
                <div className="text-[10.5px] text-muted-foreground truncate">from {r.from}</div>
              </div>
              {tone === "success" && <Pill tone="opportunity">Opportunity</Pill>}
              {tone === "risk" && <Pill tone="risk">Trade-off</Pill>}
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] num">
              <DeltaTile label="Profit" n={r.dProfit} fmt={(x) => fmtUsd(Math.abs(x), { compact: true })} />
              <DeltaTile label="Margin" n={r.dMargin} fmt={(x) => `${Math.abs(x).toFixed(1)}pt`} />
              <DeltaTile label="Accept" n={r.dAccept} fmt={(x) => `${Math.abs(Math.round(x))}pt`} />
            </div>
            <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{r.rationale}</div>
            <div className="flex items-center gap-1.5 pt-1">
              <button
                onClick={() => onApply?.(r.id, r.altIdx)}
                className={cn(
                  "h-7 px-2.5 rounded-md text-[11.5px] font-medium flex items-center gap-1.5",
                  tone === "success" ? "bg-foreground text-background hover:bg-foreground/90" : "border border-border hover:bg-secondary",
                )}
              >
                <Check className="size-3" /> Apply
              </button>
              <button
                onClick={() => onFocus?.(r.id)}
                className="h-7 px-2.5 rounded-md text-[11.5px] font-medium border border-border hover:bg-secondary flex items-center gap-1.5"
              >
                Explore <ArrowRight className="size-3" />
              </button>
              {acceptHit && (
                <span className="ml-auto text-[10px] text-risk font-medium flex items-center gap-1">
                  <span className="size-1.5 rounded-full bg-risk" /> buyer risk
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DeltaTile({ label, n, fmt }: { label: string; n: number; fmt: (n: number) => string }) {
  const negligible = Math.abs(n) < 0.05 && label !== "Profit";
  const positive = n > 0;
  return (
    <div className="rounded-md border border-border/60 px-2 py-1.5 bg-background/40">
      <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className={cn("num font-semibold mt-0.5", negligible ? "text-muted-foreground" : positive ? "text-success" : "text-risk")}>
        {negligible ? "—" : `${positive ? "+" : "−"}${fmt(n)}`}
      </div>
    </div>
  );
}


function DeltaCell({ n, fmt, invert }: { n: number; fmt: (n: number) => string; invert?: boolean }) {
  if (Math.abs(n) < 0.005) return <span className="text-right text-[11.5px] text-muted-foreground num">—</span>;
  const positive = invert ? n < 0 : n > 0;
  return (
    <span className={cn("text-right text-[11.5px] num font-medium", positive ? "text-success" : "text-risk")}>
      {n >= 0 ? "+" : "−"}
      {fmt(n)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Decision Timeline — every action recorded, undo/redo
// ─────────────────────────────────────────────────────────────────────────────

type TimelineEntry = {
  id: string;
  time: number;
  varId: VariableId;
  fromLabel: string;
  toLabel: string;
  dMargin: number;
  dProfit: number;
  dAccept: number;
};

function DecisionTimeline({
  entries,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: {
  entries: TimelineEntry[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const fmtTime = (t: number) => {
    const d = new Date(t);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
          {entries.length} {entries.length === 1 ? "decision" : "decisions"} this session
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="h-7 px-2.5 rounded-md text-[11.5px] font-medium border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            ↶ Undo
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="h-7 px-2.5 rounded-md text-[11.5px] font-medium border border-border hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            Redo ↷
          </button>
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="px-4 py-8 text-[12px] text-muted-foreground text-center">
          Decisions you make on the left will appear here as a timeline.
        </div>
      ) : (
        <ol className="divide-y divide-border/60">
          {entries.slice().reverse().map((e) => {
            const profitGood = e.dProfit >= 0;
            const marginGood = e.dMargin >= 0;
            return (
              <li key={e.id} className="px-4 py-3 flex items-start gap-4">
                <span className="text-[10.5px] font-mono text-muted-foreground w-10 mt-1">{fmtTime(e.time)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium">{VAR_MAP[e.varId].name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {e.fromLabel} → <span className="text-foreground/80">{e.toLabel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] num">
                  {Math.abs(e.dMargin) > 0.05 && (
                    <span className={cn(marginGood ? "text-success" : "text-risk")}>
                      Margin {marginGood ? "+" : "−"}{Math.abs(e.dMargin).toFixed(1)}pt
                    </span>
                  )}
                  {Math.abs(e.dProfit) > 50 && (
                    <span className={cn(profitGood ? "text-success" : "text-risk")}>
                      {profitGood ? "+" : "−"}{fmtUsd(Math.abs(e.dProfit), { compact: true })}
                    </span>
                  )}
                  {Math.abs(e.dAccept) >= 1 && (
                    <span className={cn(e.dAccept >= 0 ? "text-success" : "text-risk")}>
                      Accept {e.dAccept >= 0 ? "+" : "−"}{Math.abs(e.dAccept)}pt
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Historical Intelligence
// ─────────────────────────────────────────────────────────────────────────────

function HistoricalIntelligence() {
  const rows = [
    { customer: "IKEA AW25", similarity: 92, margin: 14.0, outcome: "Won" as const, supplier: "Vardhman", moq: "5,000", packaging: "Standard", date: "Feb 2026", note: "Won on tier-2 MOQ with standard packaging — strongest signal for this enquiry." },
    { customer: "M&S SS25", similarity: 88, margin: 13.6, outcome: "Won" as const, supplier: "Vardhman", moq: "5,000", packaging: "Premium", date: "Mar 2025", note: "Buyer paid premium for full packaging spec; reference for negotiation." },
    { customer: "Next SS25", similarity: 78, margin: 12.4, outcome: "Won" as const, supplier: "Arvind", moq: "3,500", packaging: "Premium", date: "Sep 2025", note: "Smaller MOQ accepted at higher margin — premium packaging carried the price." },
    { customer: "Primark AW25", similarity: 64, margin: 9.1, outcome: "Lost" as const, supplier: "RSWM", moq: "8,000", packaging: "Lean", date: "Aug 2025", note: "Lost on lead-time, not on price. Lean packaging acceptable for this buyer." },
  ];
  const top = rows[0];
  return (
    <div className="space-y-3">
      {/* Hero memory card */}
      <div className="rounded-xl border border-success/40 bg-success-soft/40 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Pill tone="success">Most similar order</Pill>
              <span className="text-[10.5px] text-muted-foreground">{top.date}</span>
            </div>
            <div className="text-[22px] font-display font-semibold tracking-tight mt-1.5">{top.customer}</div>
            <div className="text-[12px] text-foreground/75 mt-1 leading-snug max-w-[52ch]">{top.note}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">Similarity</div>
            <div className="text-[28px] font-display font-semibold tracking-tight num text-success">{top.similarity}%</div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-success/30">
          <Mini k="Margin" v={`${top.margin.toFixed(1)}%`} tone="success" />
          <Mini k="MOQ" v={top.moq} />
          <Mini k="Supplier" v={top.supplier} />
          <Mini k="Packaging" v={top.packaging} />
        </div>
      </div>
      {/* Other memories */}
      <div className="grid grid-cols-3 gap-3">
        {rows.slice(1).map((r) => (
          <div key={r.customer} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <div className="text-[13px] font-display font-semibold tracking-tight">{r.customer}</div>
              <span className="text-[10.5px] num text-muted-foreground">{r.similarity}%</span>
            </div>
            <div className="text-[10.5px] text-muted-foreground">{r.date}</div>
            <div className="flex items-center gap-2 mt-2.5">
              <Pill tone={r.outcome === "Won" ? "success" : "risk"}>{r.outcome}</Pill>
              <span className="text-[11px] num text-foreground/80">{r.margin.toFixed(1)}% margin</span>
            </div>
            <div className="text-[11px] text-muted-foreground leading-snug mt-2 line-clamp-3">{r.note}</div>
            <div className="grid grid-cols-3 gap-1.5 mt-3 text-[10.5px]">
              <div className="text-muted-foreground">MOQ <span className="text-foreground num">{r.moq}</span></div>
              <div className="text-muted-foreground truncate">Sup. <span className="text-foreground">{r.supplier}</span></div>
              <div className="text-muted-foreground truncate">Pkg. <span className="text-foreground">{r.packaging}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Center Pane — Live Commercial Decision Canvas
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Workspace persona — focusedId drives the entire center pane identity
// ─────────────────────────────────────────────────────────────────────────────

type WorkspacePersona = {
  title: string;
  subtitle: string;
  accent: string; // hex-ish tailwind tone class for the title eyebrow
};

function personaFor(id: VariableId): WorkspacePersona {
  switch (id) {
    case "moq":
      return {
        title: "MOQ Optimization Studio",
        subtitle: "Find the order quantity that unlocks supplier tiers without losing the buyer.",
        accent: "text-opportunity",
      };
    case "fabricWidth":
    case "fabricSupplier":
    case "fabricConstruction":
      return {
        title: "Fabric Intelligence Studio",
        subtitle: "Engineer consumption, width and supplier to bend the largest cost lever.",
        accent: "text-opportunity",
      };
    case "packaging":
      return {
        title: "Packaging Studio",
        subtitle: "Balance buyer perception against per-unit packaging cost.",
        accent: "text-opportunity",
      };
    case "printing":
    case "embroidery":
      return {
        title: "Decoration Studio",
        subtitle: "Trade-off brand polish against processing minutes and acceptance.",
        accent: "text-opportunity",
      };
    case "testing":
    case "certification":
    case "audit":
      return {
        title: "Compliance Studio",
        subtitle: "Right-size labs, certifications and audits the buyer scorecard rewards.",
        accent: "text-opportunity",
      };
    case "transportation":
    case "courier":
      return {
        title: "Logistics Studio",
        subtitle: "Route, mode and lead-time engineered against landed margin.",
        accent: "text-opportunity",
      };
    case "sampling":
      return {
        title: "Sampling Studio",
        subtitle: "Right-size the sample run so development cost doesn't eat order profit.",
        accent: "text-opportunity",
      };
  }
}

// Project per-option compute by overriding the focused variable only.
function projectOptions(focusedId: VariableId, selection: Selection) {
  const def = VAR_MAP[focusedId];
  const baseSel = selection;
  return def.options.map((opt, idx) => {
    const c = compute({ ...baseSel, [focusedId]: idx });
    return { idx, label: opt.label, note: opt.note, c };
  });
}

function WorkspaceHero({
  focusedId,
  selection,
  current,
}: {
  focusedId: VariableId;
  selection: Selection;
  current: Compute;
}) {
  const persona = personaFor(focusedId);
  const def = VAR_MAP[focusedId];
  const selectedIdx = selection[focusedId];
  const recIdx = def.recommendedIndex;
  const projections = useMemo(() => projectOptions(focusedId, selection), [focusedId, selection]);

  // metric to surface in the option strip — pick the one most relevant to this variable family
  const stripKey: VizMetricKey = (() => {
    if (focusedId === "moq") return "annual";
    if (focusedId === "packaging") return "accept";
    if (focusedId === "transportation" || focusedId === "courier") return "lead";
    if (focusedId === "testing" || focusedId === "certification" || focusedId === "audit") return "accept";
    return "margin";
  })();
  const stripMeta = VIZ_META[stripKey];
  const refVal = stripMeta.get(current);

  return (
    <section className="space-y-6 animate-surface-in" key={focusedId}>
      <div className="space-y-2">
        <div className={cn("text-[11px] uppercase tracking-[0.14em] font-semibold", persona.accent)}>
          {def.name} · live workspace
        </div>
        <h1 className="font-display text-[34px] leading-[1.04] tracking-tight font-semibold">{persona.title}</h1>
        <p className="text-[13.5px] text-muted-foreground max-w-[620px] leading-relaxed">{persona.subtitle}</p>
      </div>

      {/* Option strip — every option projected live */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
            {def.name} options · projected {stripMeta.label.toLowerCase()}
          </div>
          <div className="text-[10.5px] text-muted-foreground">{def.options.length} alternates · live</div>
        </div>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${def.options.length}, minmax(0, 1fr))` }}
        >
          {projections.map((p) => {
            const isSelected = p.idx === selectedIdx;
            const isRec = p.idx === recIdx;
            const v = stripMeta.get(p.c);
            const delta = v - refVal;
            const moved = Math.abs(delta) > (stripKey === "accept" ? 0.5 : stripKey === "annual" ? 50 : 0.05);
            const better = stripMeta.goodIfHigh ? delta > 0 : delta < 0;
            return (
              <div
                key={p.idx}
                className={cn(
                  "rounded-lg border p-3 transition-all",
                  isSelected
                    ? "border-foreground/35 bg-background ring-1 ring-foreground/10"
                    : "border-border/70 bg-background/40 hover:border-foreground/20",
                )}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  {isSelected && <span className="text-[9.5px] font-semibold text-foreground uppercase tracking-wider">Current</span>}
                  {isRec && !isSelected && (
                    <span className="text-[9.5px] font-semibold text-opportunity uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="size-2.5" /> AI pick
                    </span>
                  )}
                </div>
                <div className="text-[12px] font-medium leading-tight truncate" title={p.label}>{p.label}</div>
                <div className="mt-2 flex items-baseline justify-between">
                  <AnimatedNumber
                    value={v}
                    format={stripMeta.fmt}
                    className="text-[15px] font-display font-semibold num tracking-tight"
                  />
                  {moved && !isSelected && (
                    <span className={cn("text-[10.5px] num font-semibold", better ? "text-success" : "text-risk")}>
                      {better ? "↑" : "↓"} {stripMeta.fmt(Math.abs(delta))}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground/90 leading-snug mt-3">
          {def.rationale}
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cost Waterfall — visual buildup from components → margin → selling price
// ─────────────────────────────────────────────────────────────────────────────

function CostWaterfall({
  current,
  baseline,
  onFocus,
}: {
  current: Compute;
  baseline: Compute;
  onFocus?: (id: VariableId) => void;
}) {
  const order: CostKey[] = ["fabric", "processing", "packaging", "testing", "certification", "transportation", "sampling"];
  const max = current.price;
  const marginAmt = current.price - current.unitCost;

  let running = 0;
  const rows = order.map((k) => {
    const val = current.costs[k];
    const baseVal = baseline.costs[k];
    const start = running;
    running += val;
    const delta = val - baseVal;
    return { key: k, label: COST_LABEL[k], val, start, delta };
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-1">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
            Cost Waterfall
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            click any component to open its workspace
          </div>
        </div>
        <div className="text-[10.5px] num text-muted-foreground">
          0 → <span className="text-foreground font-semibold">{fmtPrice(current.price)}</span>
        </div>
      </div>
      {rows.map((r) => {
        const wPct = (r.val / max) * 100;
        const leftPct = (r.start / max) * 100;
        const pctOfCost = (r.val / current.unitCost) * 100;
        const dTone = r.delta < -0.001 ? "text-success" : r.delta > 0.001 ? "text-risk" : "text-muted-foreground";
        const targetVar = COST_TO_VAR[r.key];
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onFocus?.(targetVar)}
            className="group w-full grid grid-cols-[110px_minmax(0,1fr)_54px_110px] items-center gap-3 px-2 py-1.5 -mx-2 rounded-md text-left hover:bg-secondary/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-[11.5px] text-foreground/80 group-hover:text-foreground">
              {r.label}
              <ChevronRight className="size-3 opacity-0 group-hover:opacity-60 transition-opacity" />
            </div>
            <div className="relative h-5 bg-border/30 rounded">
              <div
                className="absolute top-0 h-full bg-brand-700/80 rounded transition-all duration-500 ease-out group-hover:bg-brand-700"
                style={{ left: `${leftPct}%`, width: `${wPct}%` }}
              />
            </div>
            <div className="text-right num text-[11px] text-muted-foreground tabular-nums">
              {pctOfCost.toFixed(1)}%
            </div>
            <div className="text-right num text-[11.5px] text-foreground/85">
              <AnimatedNumber value={r.val} format={(n) => `$${n.toFixed(2)}`} />
              {Math.abs(r.delta) > 0.001 && (
                <span className={cn("ml-1.5 text-[10px] font-semibold", dTone)}>
                  {r.delta > 0 ? "+" : "−"}${Math.abs(r.delta).toFixed(2)}
                </span>
              )}
            </div>
          </button>
        );
      })}
      <div className="grid grid-cols-[110px_minmax(0,1fr)_54px_110px] items-center gap-3 px-2 py-1.5">
        <div className="text-[11.5px] text-success font-medium">Margin</div>
        <div className="relative h-5 bg-border/30 rounded">
          <div
            className="absolute top-0 h-full bg-success/70 rounded transition-all duration-500 ease-out"
            style={{ left: `${(current.unitCost / max) * 100}%`, width: `${(marginAmt / max) * 100}%` }}
          />
        </div>
        <div className="text-right num text-[11px] text-muted-foreground">
          {((marginAmt / current.price) * 100).toFixed(1)}%
        </div>
        <div className="text-right num text-[11.5px] text-success font-semibold">
          <AnimatedNumber value={marginAmt} format={(n) => `$${n.toFixed(2)}`} />
        </div>
      </div>
      <div className="grid grid-cols-[110px_minmax(0,1fr)_54px_110px] items-center gap-3 px-2 pt-3 mt-1 border-t border-border/60">
        <div className="text-[12px] font-semibold">Selling Price</div>
        <div className="text-[10.5px] text-muted-foreground col-span-2">final landed quotation</div>
        <div className="text-right num text-[13px] font-display font-semibold tracking-tight text-brand-700">
          <AnimatedNumber value={current.price} format={fmtPrice} />
        </div>
      </div>
    </div>
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// COST FLOW CANVAS — the primary "how the quotation is built" workspace
// ─────────────────────────────────────────────────────────────────────────────

type FlowNodeSpec =
  | { kind: "input"; varId: VariableId; stage: number }
  | { kind: "subtotal"; costKey: CostKey; label: string; stage: number }
  | { kind: "stageCost"; costKey: CostKey; stage: number }
  | { kind: "overheads"; stage: number }
  | { kind: "margin"; stage: number }
  | { kind: "sellingPrice"; stage: number };

type FlowRow = { merge: boolean; nodes: FlowNodeSpec[]; stage: number };

const FLOW_ROWS: FlowRow[] = [
  { merge: false, stage: 1, nodes: [
    { kind: "input", varId: "fabricConstruction", stage: 1 },
    { kind: "input", varId: "fabricWidth", stage: 1 },
    { kind: "input", varId: "fabricSupplier", stage: 1 },
  ]},
  { merge: true, stage: 2, nodes: [{ kind: "subtotal", costKey: "fabric", label: "Material Cost", stage: 2 }] },
  { merge: false, stage: 3, nodes: [
    { kind: "input", varId: "printing", stage: 3 },
    { kind: "input", varId: "embroidery", stage: 3 },
  ]},
  { merge: true, stage: 4, nodes: [{ kind: "subtotal", costKey: "processing", label: "Making Cost", stage: 4 }] },
  { merge: false, stage: 5, nodes: [{ kind: "stageCost", costKey: "packaging", stage: 5 }] },
  { merge: false, stage: 6, nodes: [{ kind: "stageCost", costKey: "testing", stage: 6 }] },
  { merge: false, stage: 7, nodes: [{ kind: "stageCost", costKey: "certification", stage: 7 }] },
  { merge: false, stage: 8, nodes: [{ kind: "stageCost", costKey: "transportation", stage: 8 }] },
  { merge: false, stage: 9, nodes: [{ kind: "overheads", stage: 9 }] },
  { merge: false, stage: 10, nodes: [{ kind: "margin", stage: 10 }] },
  { merge: false, stage: 11, nodes: [{ kind: "sellingPrice", stage: 11 }] },
];

const VAR_STAGE: Partial<Record<VariableId, number>> = {
  fabricConstruction: 1, fabricWidth: 1, fabricSupplier: 1,
  printing: 3, embroidery: 3,
  packaging: 5, testing: 6, certification: 7, transportation: 8,
  moq: 0, sampling: 9, audit: 9, courier: 9,
};

// ─────────────────────────────────────────────────────────────────────────────
// Cost-flow palette — one hue per commercial "path" (matches legend below)
// ─────────────────────────────────────────────────────────────────────────────

type FlowPath = "fabric" | "making" | "overhead" | "output";

const PATH_COLOR: Record<FlowPath, { stroke: string; dot: string; ring: string; soft: string; text: string }> = {
  fabric:   { stroke: "#14b8a6", dot: "#14b8a6", ring: "rgba(20,184,166,0.28)", soft: "rgba(20,184,166,0.10)", text: "#0f766e" },
  making:   { stroke: "#7c6df0", dot: "#7c6df0", ring: "rgba(124,109,240,0.28)", soft: "rgba(124,109,240,0.10)", text: "#4f46e5" },
  overhead: { stroke: "#f59e0b", dot: "#f59e0b", ring: "rgba(245,158,11,0.30)", soft: "rgba(245,158,11,0.10)", text: "#b45309" },
  output:   { stroke: "#16a34a", dot: "#16a34a", ring: "rgba(22,163,74,0.30)", soft: "rgba(22,163,74,0.10)", text: "#166534" },
};

const STAGE_PATH: Record<number, FlowPath> = {
  1: "fabric", 2: "fabric",
  3: "making", 4: "making", 5: "making", 6: "making", 7: "making", 8: "making",
  9: "overhead", 10: "overhead",
  11: "output",
};

const STAGE_LABELS: Record<number, { n: number; label: string }> = {
  1:  { n: 1, label: "Inputs · Rates + Techpack" },
  2:  { n: 2, label: "Fabric ₹ / metre" },
  3:  { n: 3, label: "Processing / piece" },
  4:  { n: 4, label: "Cost groups" },
  5:  { n: 5, label: "Packaging" },
  6:  { n: 6, label: "Testing" },
  7:  { n: 7, label: "Certification" },
  8:  { n: 8, label: "Transport" },
  9:  { n: 9, label: "Overhead" },
  10: { n: 10, label: "Target margin" },
  11: { n: 11, label: "Quote (output)" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Node primitives — pill card, dot on left, small caption, big value
// ─────────────────────────────────────────────────────────────────────────────

const NODE_W = 178;
const NODE_H = 58;
const ROW_STRIDE = 72;
const COL_GAP = 96;   // horizontal space between columns (connector width)
const COL_PAD_Y = 40;

function NodePill({
  path, caption, value, sub, aiPick, highlighted, dim, changed, onClick, onHover, onLeave, dataAttr,
}: {
  path: FlowPath;
  caption: string;
  value: string;
  sub?: string;
  aiPick?: boolean;
  highlighted?: boolean;
  dim?: boolean;
  changed?: boolean;
  onClick?: () => void;
  onHover?: () => void;
  onLeave?: () => void;
  dataAttr?: Record<string, string>;
}) {
  const c = PATH_COLOR[path];
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      {...dataAttr}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-2xl border bg-white/95 backdrop-blur-sm text-left transition-all duration-300",
        "shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)]",
        "px-3 py-2",
        dim && "opacity-35",
        changed && "animate-value-flash",
      )}
      style={{
        width: NODE_W,
        minHeight: NODE_H,
        borderColor: highlighted ? c.stroke : "rgba(15,23,42,0.09)",
        boxShadow: highlighted ? `0 0 0 3px ${c.ring}` : undefined,
      }}
    >
      <span
        className="shrink-0 rounded-full"
        style={{ width: 8, height: 8, background: c.dot, boxShadow: `0 0 0 3px ${c.soft}` }}
      />
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground truncate">{caption}</span>
          {aiPick && <Sparkles className="size-2.5 shrink-0" style={{ color: PATH_COLOR.overhead.stroke }} />}
        </span>
        <span className="block text-[14px] font-semibold text-foreground num leading-tight truncate">{value}</span>
        {sub && <span className="block text-[10px] text-muted-foreground truncate mt-0.5">{sub}</span>}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG connectors — Bezier curves colored by target path, animated dashes
// ─────────────────────────────────────────────────────────────────────────────

type Edge = { x1: number; y1: number; x2: number; y2: number; path: FlowPath; active: boolean; width: number };

function FlowEdges({ edges, width, height }: { edges: Edge[]; width: number; height: number }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 0 }}
    >
      {edges.map((e, i) => {
        const c = PATH_COLOR[e.path];
        const midX = (e.x1 + e.x2) / 2;
        const d = `M ${e.x1} ${e.y1} C ${midX} ${e.y1}, ${midX} ${e.y2}, ${e.x2} ${e.y2}`;
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={c.stroke}
            strokeOpacity={e.active ? 0.95 : 0.42}
            strokeWidth={e.width}
            strokeDasharray={e.active ? "6 6" : "0"}
            className={e.active ? "animate-flow-dash" : ""}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CostFlowCanvas — horizontal Sankey-ish node editor
// ─────────────────────────────────────────────────────────────────────────────

function CostFlowCanvas({
  selection, current, baseline, lastChanged, onFocus,
}: {
  selection: Selection; current: Compute; baseline: Compute;
  lastChanged: VariableId | null; onFocus: (id: VariableId) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoverStage, setHoverStage] = useState<number | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const changedStage = lastChanged ? (VAR_STAGE[lastChanged] ?? 0) : 0;

  // Auto-scroll to the changed node card whenever the user edits a variable
  useEffect(() => {
    if (!lastChanged) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-varid="${lastChanged}"]`);
    if (el && scrollRef.current) {
      const container = scrollRef.current;
      const target = el.offsetLeft - container.clientWidth / 2 + el.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    }
  }, [lastChanged, selection]);

  const updateScrollState = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };
  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", updateScrollState); ro.disconnect(); };
  }, []);

  const scrollBy = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(520, el.clientWidth * 0.7), behavior: "smooth" });
  };

  const overheads = BASE.fixedCost / current.qty;
  const marginAmt = current.price - current.unitCost;

  // Build columns; each cell carries its position for connector wiring
  type Cell = {
    key: string;
    caption: string;
    value: string;
    sub?: string;
    path: FlowPath;
    varId?: VariableId;
    stage: number;
    aiPick?: boolean;
    onClick?: () => void;
  };

  const columns: Cell[][] = FLOW_ROWS.map((row) => {
    return row.nodes.map((n, i): Cell => {
      const path = STAGE_PATH[row.stage] ?? "making";
      if (n.kind === "input") {
        const v = VAR_MAP[n.varId];
        const opt = v.options[selection[n.varId]];
        const primaryKey = (Object.keys(opt.cost ?? {})[0] ?? "fabric") as CostKey;
        const delta = (current.costs[primaryKey] ?? 0) - (baseline.costs[primaryKey] ?? 0);
        const sub = Math.abs(delta) > 0.001 ? `${delta < 0 ? "−" : "+"}${fmtPrice(Math.abs(delta))}` : undefined;
        return {
          key: `in-${n.varId}`,
          caption: v.name,
          value: opt.label,
          sub,
          path,
          varId: n.varId,
          stage: row.stage,
          aiPick: v.recommendedIndex !== selection[n.varId],
          onClick: () => onFocus(n.varId),
        };
      }
      if (n.kind === "subtotal") {
        return {
          key: `sub-${n.costKey}-${i}`,
          caption: n.label,
          value: fmtPrice(current.costs[n.costKey]),
          sub: `${((current.costs[n.costKey] / current.price) * 100).toFixed(0)}% of quote`,
          path,
          stage: row.stage,
        };
      }
      if (n.kind === "stageCost") {
        const varId = COST_TO_VAR[n.costKey];
        const v = VAR_MAP[varId];
        return {
          key: `st-${n.costKey}`,
          caption: COST_LABEL[n.costKey],
          value: fmtPrice(current.costs[n.costKey]),
          sub: v.options[selection[varId]].label,
          path,
          varId,
          stage: row.stage,
          aiPick: v.recommendedIndex !== selection[varId],
          onClick: () => onFocus(varId),
        };
      }
      if (n.kind === "overheads") {
        return {
          key: "overheads",
          caption: "Overheads",
          value: fmtPrice(overheads),
          sub: `${fmtPrice(BASE.fixedCost)} ÷ ${current.qty.toLocaleString()} pcs`,
          path: "overhead",
          stage: row.stage,
        };
      }
      if (n.kind === "margin") {
        return {
          key: "margin",
          caption: "Target margin",
          value: `${current.margin.toFixed(1)}%`,
          sub: `${fmtPrice(marginAmt)} / pc`,
          path: "overhead",
          stage: row.stage,
        };
      }
      return {
        key: "quote",
        caption: "Suggested quote",
        value: fmtPrice(current.price),
        sub: `${current.margin.toFixed(0)}% margin`,
        path: "output",
        stage: row.stage,
      };
    });
  });

  // Column layout math
  const colCount = columns.length;
  const maxRows = Math.max(...columns.map((c) => c.length));
  const canvasH = maxRows * ROW_STRIDE + COL_PAD_Y * 2;
  const canvasW = colCount * NODE_W + (colCount - 1) * COL_GAP;

  // Compute each cell's x/y center
  const positions = columns.map((col, ci) => {
    const colX = ci * (NODE_W + COL_GAP);
    const startY = (canvasH - col.length * ROW_STRIDE) / 2 + ROW_STRIDE / 2;
    return col.map((_, ri) => ({ x: colX, y: startY + ri * ROW_STRIDE }));
  });

  // Build edges from each column to the next
  const edges: Edge[] = [];
  for (let ci = 0; ci < columns.length - 1; ci++) {
    const src = columns[ci];
    const tgt = columns[ci + 1];
    const srcPos = positions[ci];
    const tgtPos = positions[ci + 1];
    const tgtStage = tgt[0]?.stage ?? 0;
    const targetPath = STAGE_PATH[tgtStage] ?? "making";
    const active = changedStage > 0 && tgtStage > changedStage;
    src.forEach((_, si) => {
      tgt.forEach((_, ti) => {
        edges.push({
          x1: srcPos[si].x + NODE_W,
          y1: srcPos[si].y,
          x2: tgtPos[ti].x,
          y2: tgtPos[ti].y,
          path: targetPath,
          active,
          width: active ? 2 : 1.25,
        });
      });
    });
  }

  const totalEdges = edges.length;
  const totalNodes = columns.reduce((a, c) => a + c.length, 0);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/70 bg-white">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/70 px-2.5 py-1 text-[11px] font-semibold text-foreground">
            Forward pass
          </span>
          <span className="text-[11px] text-muted-foreground num">{totalNodes} nodes · {totalEdges} edges</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="size-3" /> hover any node to trace its downstream
        </div>
      </div>

      {/* Scrollable canvas + glassmorphism chevrons */}
      <div className="relative bg-[linear-gradient(180deg,#fbfaf7_0%,#faf9f6_100%)]">
        {/* Left chevron */}
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollBy(-1)}
          className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 z-20 size-10 rounded-full flex items-center justify-center",
            "backdrop-blur-md bg-white/55 border border-white/70 shadow-[0_8px_24px_rgba(15,23,42,0.10)]",
            "transition-all duration-200 hover:bg-white/80 hover:scale-105",
            !canScrollLeft && "opacity-0 pointer-events-none",
          )}
        >
          <ChevronLeft className="size-5 text-foreground" />
        </button>
        {/* Right chevron */}
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollBy(1)}
          className={cn(
            "absolute right-3 top-1/2 -translate-y-1/2 z-20 size-10 rounded-full flex items-center justify-center",
            "backdrop-blur-md bg-white/55 border border-white/70 shadow-[0_8px_24px_rgba(15,23,42,0.10)]",
            "transition-all duration-200 hover:bg-white/80 hover:scale-105",
            !canScrollRight && "opacity-0 pointer-events-none",
          )}
        >
          <ChevronRight className="size-5 text-foreground" />
        </button>

        {/* Edge-fade masks */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-16 z-10 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-16 z-10 bg-gradient-to-l from-white to-transparent" />

        <div
          ref={scrollRef}
          className="overflow-x-auto overflow-y-hidden overscroll-x-contain px-8 py-6"
          style={{ scrollBehavior: "smooth", scrollbarGutter: "stable" }}
        >
          {/* Column headers */}
          <div className="flex mb-4" style={{ minWidth: canvasW }}>
            {columns.map((_, ci) => {
              const stage = FLOW_ROWS[ci].stage;
              const meta = STAGE_LABELS[stage];
              const path = STAGE_PATH[stage] ?? "making";
              const c = PATH_COLOR[path];
              return (
                <div key={ci} className="flex items-center gap-1.5 shrink-0" style={{ width: NODE_W, marginRight: ci < columns.length - 1 ? COL_GAP : 0 }}>
                  <span
                    className="inline-flex items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ width: 18, height: 18, background: c.dot }}
                  >
                    {meta?.n ?? ci + 1}
                  </span>
                  <span className="text-[9.5px] uppercase tracking-[0.14em] font-semibold text-muted-foreground truncate">
                    {meta?.label ?? `Stage ${stage}`}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Canvas — nodes + SVG edges layered */}
          <div className="relative" style={{ width: canvasW, height: canvasH }}>
            <FlowEdges edges={edges} width={canvasW} height={canvasH} />
            {columns.map((col, ci) =>
              col.map((cell, ri) => {
                const pos = positions[ci][ri];
                const isChanged = cell.varId === lastChanged || cell.stage === changedStage;
                const highlighted =
                  isChanged ||
                  (hoverStage !== null && cell.stage >= hoverStage);
                const dim = hoverStage !== null && cell.stage < hoverStage;
                return (
                  <div
                    key={cell.key}
                    className="absolute"
                    style={{ left: pos.x, top: pos.y - NODE_H / 2, zIndex: 1 }}
                  >
                    <NodePill
                      path={cell.path}
                      caption={cell.caption}
                      value={cell.value}
                      sub={cell.sub}
                      aiPick={cell.aiPick}
                      highlighted={highlighted}
                      dim={dim}
                      changed={cell.varId === lastChanged}
                      onClick={cell.onClick}
                      onHover={() => setHoverStage(cell.stage)}
                      onLeave={() => setHoverStage(null)}
                      dataAttr={cell.varId ? { "data-varid": cell.varId } : undefined}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 py-3 border-t border-border/60 bg-white/60 text-[10.5px] text-muted-foreground">
          {(["fabric","making","overhead","output"] as FlowPath[]).map((p) => (
            <span key={p} className="inline-flex items-center gap-1.5">
              <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: PATH_COLOR[p].dot }} />
              <span className="capitalize">{p === "output" ? "output (quote)" : `${p} path`}</span>
            </span>
          ))}
          <span className="ml-auto hidden md:inline">edge thickness · contribution &nbsp;·&nbsp; animated dashes = signal flowing forward</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const CONTRIB_ORDER: (CostKey | "margin")[] = [
  "fabric", "processing", "packaging", "testing", "certification", "transportation", "sampling", "margin",
];
const CONTRIB_COLOR: Record<string, string> = {
  fabric: "oklch(0.55 0.13 245)",
  processing: "oklch(0.62 0.12 210)",
  packaging: "oklch(0.68 0.11 175)",
  testing: "oklch(0.72 0.11 140)",
  certification: "oklch(0.75 0.13 95)",
  transportation: "oklch(0.7 0.14 55)",
  sampling: "oklch(0.65 0.12 30)",
  margin: "oklch(0.55 0.1 160)",
};
const CONTRIB_LABEL: Record<string, string> = { ...COST_LABEL, margin: "Margin" };

function CompositionBar({ current }: { current: Compute }) {
  const total = current.price;
  const parts = CONTRIB_ORDER.map(k => {
    const val = k === "margin" ? current.price - current.unitCost : current.costs[k as CostKey];
    return { k, val, pct: (val / total) * 100 };
  });
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Cost Composition</div>
        <div className="text-[10.5px] text-muted-foreground num">total {fmtPrice(total)}</div>
      </div>
      <div className="flex h-9 w-full rounded-lg overflow-hidden ring-1 ring-border/70">
        {parts.map(p => (
          <div
            key={p.k}
            onMouseEnter={() => setHover(p.k)}
            onMouseLeave={() => setHover(null)}
            className="transition-opacity duration-200 cursor-pointer"
            style={{
              width: `${p.pct}%`,
              background: CONTRIB_COLOR[p.k],
              opacity: hover && hover !== p.k ? 0.35 : 1,
            }}
            title={`${CONTRIB_LABEL[p.k]} · ${p.pct.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {parts.map(p => (
          <div key={p.k}
            onMouseEnter={() => setHover(p.k)}
            onMouseLeave={() => setHover(null)}
            className={cn(
              "flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors",
              hover === p.k ? "bg-secondary" : "",
            )}
          >
            <span className="size-2 rounded-sm" style={{ background: CONTRIB_COLOR[p.k] }} />
            <span className="text-[10.5px] text-muted-foreground truncate">{CONTRIB_LABEL[p.k]}</span>
            <span className="ml-auto text-[10.5px] num text-foreground/80">{p.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ current }: { current: Compute }) {
  const total = current.price;
  const parts = CONTRIB_ORDER.map(k => {
    const val = k === "margin" ? current.price - current.unitCost : current.costs[k as CostKey];
    return { k, val, pct: (val / total) * 100 };
  });
  const R = 62, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-3">Contribution %</div>
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 160 160" className="w-[150px] h-[150px] shrink-0 -rotate-90">
          <circle cx="80" cy="80" r={R} fill="none" stroke="var(--border)" strokeWidth="16" />
          {parts.map(p => {
            const len = (p.pct / 100) * C;
            const el = (
              <circle
                key={p.k}
                cx="80" cy="80" r={R}
                fill="none"
                stroke={CONTRIB_COLOR[p.k]}
                strokeWidth="16"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
                className="transition-all duration-500"
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="flex-1 min-w-0 space-y-1">
          {parts.map(p => (
            <div key={p.k} className="flex items-center gap-2 text-[11px]">
              <span className="size-2 rounded-sm shrink-0" style={{ background: CONTRIB_COLOR[p.k] }} />
              <span className="truncate text-muted-foreground">{CONTRIB_LABEL[p.k]}</span>
              <span className="ml-auto num text-foreground/85">{p.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CostTrend({ current, baseline }: { current: Compute; baseline: Compute }) {
  const diff = current.price - baseline.price;
  const pct = baseline.price === 0 ? 0 : (diff / baseline.price) * 100;
  const positive = diff > 0.001;
  const negative = diff < -0.001;
  const tone = positive ? "success" : negative ? "risk" : "neutral";
  const toneText =
    tone === "success" ? "text-success" : tone === "risk" ? "text-risk" : "text-muted-foreground";
  const toneBg =
    tone === "success" ? "bg-success-soft" : tone === "risk" ? "bg-risk-soft" : "bg-secondary";
  const Arrow = positive ? TrendingUp : negative ? ArrowDown : ArrowRight;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
            Cost Trend
          </div>
          <div className="text-[13px] font-display font-semibold tracking-tight mt-0.5">
            vs baseline quote
          </div>
        </div>
        <div
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium num",
            toneBg,
            toneText,
          )}
        >
          <Arrow className="size-3" />
          {diff >= 0 ? "+" : "−"}${Math.abs(diff).toFixed(2)}
          <span className="opacity-70">
            ({diff >= 0 ? "+" : ""}
            {pct.toFixed(1)}%)
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="rounded-xl bg-secondary/40 px-3 py-3">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Baseline</div>
          <div className="text-[22px] font-display font-semibold num tracking-tight">
            {fmtPrice(baseline.price)}
          </div>
          <div className="text-[10.5px] text-muted-foreground num">
            margin {baseline.margin.toFixed(1)}%
          </div>
        </div>
        <div className="flex flex-col items-center">
          <div className="relative h-10 w-10 rounded-full grid place-items-center bg-brand-50">
            <ChevronRight className="size-4 text-brand-700" />
          </div>
        </div>
        <div className={cn("rounded-xl px-3 py-3", toneBg)}>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Current</div>
          <div className={cn("text-[22px] font-display font-semibold num tracking-tight", toneText)}>
            <AnimatedNumber value={current.price} format={fmtPrice} />
          </div>
          <div className="text-[10.5px] text-muted-foreground num">
            margin {current.margin.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Top Cost Drivers — clickable lever cards ────────────────────────────────
function TopCostDrivers({
  current, baseline, onFocus,
}: { current: Compute; baseline: Compute; onFocus: (id: VariableId) => void }) {
  const rows = (Object.keys(current.costs) as CostKey[])
    .map((k) => ({
      k,
      val: current.costs[k],
      delta: current.costs[k] - baseline.costs[k],
      pct: (current.costs[k] / current.unitCost) * 100,
    }))
    .sort((a, b) => b.val - a.val)
    .slice(0, 3);
  const maxPct = rows[0]?.pct ?? 1;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
            Top Cost Drivers
          </div>
          <div className="text-[13px] font-display font-semibold tracking-tight mt-0.5">
            Where the money is concentrated
          </div>
        </div>
        <div className="text-[10.5px] text-muted-foreground num">
          unit cost {fmtPrice(current.unitCost)}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {rows.map((r, i) => {
          const tone = r.delta < -0.001 ? "success" : r.delta > 0.001 ? "risk" : "neutral";
          const barW = (r.pct / maxPct) * 100;
          return (
            <button
              key={r.k}
              onClick={() => onFocus(COST_TO_VAR[r.k])}
              className="text-left rounded-xl border border-border bg-background hover:border-brand-700/30 hover:shadow-[0_6px_24px_-14px_rgba(5,96,77,0.35)] transition-all p-4 cursor-pointer group"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="grid place-items-center size-5 rounded-full bg-brand-50 text-brand-700 text-[9.5px] font-semibold num">
                  {i + 1}
                </span>
                <span className="text-[11.5px] font-medium text-foreground truncate">
                  {COST_LABEL[r.k]}
                </span>
                <ArrowUpRight className="ml-auto size-3 text-muted-foreground/60 group-hover:text-brand-700 transition-colors" />
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-[22px] font-display font-semibold num tracking-tight text-brand-700">
                  ${r.val.toFixed(2)}
                </div>
                <div className="text-[11px] text-muted-foreground num">{r.pct.toFixed(1)}%</div>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-brand-700 transition-all"
                  style={{ width: `${barW}%` }}
                />
              </div>
              {Math.abs(r.delta) > 0.001 && (
                <div className="flex items-center justify-end mt-2">
                  <span className={cn(
                    "inline-flex items-center gap-0.5 text-[10.5px] num font-semibold px-1.5 py-0.5 rounded-full",
                    tone === "success" ? "bg-success-soft text-success" : "bg-risk-soft text-risk",
                  )}>
                    {r.delta < 0 ? "↓" : "↑"} ${Math.abs(r.delta).toFixed(2)} vs baseline
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}


// ─── Benchmark vs similar past programs ──────────────────────────────────────
function BenchmarkVsPrograms({ current }: { current: Compute }) {
  const rows = [
    { name: "AW-25 · Heavy Terry · M&S", price: 3.94, margin: 17.8, accept: 76, outcome: "Won" as const },
    { name: "AW-25 · French Terry · Next", price: 4.12, margin: 16.2, accept: 68, outcome: "Won" as const },
    { name: "SS-25 · Fleece · Primark", price: 3.71, margin: 12.9, accept: 61, outcome: "Lost" as const },
  ];
  const avgPrice = rows.reduce((a, r) => a + r.price, 0) / rows.length;
  const avgMargin = rows.reduce((a, r) => a + r.margin, 0) / rows.length;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Benchmark</div>
          <div className="text-[13px] font-display font-semibold tracking-tight mt-0.5">Similar past programs</div>
        </div>
        <div className="flex items-center gap-4 text-[10.5px] text-muted-foreground">
          <span className="num">avg price ${avgPrice.toFixed(2)}</span>
          <span className="num">avg margin {avgMargin.toFixed(1)}%</span>
        </div>
      </div>
      <div className="divide-y divide-border/70">
        {rows.map((r) => {
          const dPrice = current.price - r.price;
          return (
            <div key={r.name} className="grid grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,auto))] items-center gap-4 py-2.5">
              <div className="min-w-0">
                <div className="text-[12px] font-medium truncate">{r.name}</div>
                <div className="text-[10px] text-muted-foreground">closed {r.outcome === "Won" ? "sold" : "lost"}</div>
              </div>
              <div className="text-right">
                <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground">Price</div>
                <div className="text-[12px] num font-semibold">${r.price.toFixed(2)}</div>
              </div>
              <div className="text-right">
                <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground">Margin</div>
                <div className="text-[12px] num font-semibold">{r.margin.toFixed(1)}%</div>
              </div>
              <div className="text-right">
                <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground">Accept</div>
                <div className="text-[12px] num font-semibold">{r.accept}%</div>
              </div>
              <div className="text-right min-w-[64px]">
                <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground">Δ Price</div>
                <div className={cn(
                  "text-[12px] num font-semibold",
                  dPrice > 0 ? "text-risk" : dPrice < 0 ? "text-success" : "text-foreground",
                )}>
                  {dPrice >= 0 ? "+" : "−"}${Math.abs(dPrice).toFixed(2)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 rounded-lg bg-secondary/50 px-3 py-2 text-[11px] text-muted-foreground leading-snug">
        Current quote is <span className={cn("num font-semibold", current.price < avgPrice ? "text-success" : "text-risk")}>{fmtPrice(current.price)}</span> — {current.price < avgPrice ? "below" : "above"} the average of similar programs at{" "}
        <span className="num font-semibold text-foreground">{current.margin.toFixed(1)}%</span> margin.
      </div>
    </div>
  );
}

function CostBreakdownView({
  current, baseline, onFocus,
}: { current: Compute; baseline: Compute; onFocus: (id: VariableId) => void }) {
  return (
    <div className="space-y-4">
      <BreakEvenChart current={current} />
      <CostWaterfall current={current} baseline={baseline} onFocus={onFocus} />
      <TopCostDrivers current={current} baseline={baseline} onFocus={onFocus} />
      <CostTrend current={current} baseline={baseline} />
      <BenchmarkVsPrograms current={current} />
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS IMPACT — "what happens if I change something?"
// ─────────────────────────────────────────────────────────────────────────────

function SimCard({
  title, sub, chain, confidence, onApply,
}: {
  title: string;
  sub: string;
  chain: { label: string; value: string; tone: "success" | "risk" | "neutral" }[];
  confidence: number;
  onApply?: () => void;
}) {
  const toneClass = (t: string) =>
    t === "success" ? "text-success" : t === "risk" ? "text-risk" : "text-foreground/80";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div>
        <div className="text-[13px] font-display font-semibold tracking-tight">{title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
      </div>
      <div className="flex flex-col gap-1.5">
        {chain.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            {i > 0 && <ArrowDown className="size-3 text-muted-foreground/50 shrink-0 -my-1" />}
            <div className="flex items-center justify-between w-full rounded-md bg-secondary/50 px-2.5 py-1.5">
              <span className="text-[11px] text-muted-foreground">{s.label}</span>
              <span className={cn("text-[11.5px] num font-semibold", toneClass(s.tone))}>{s.value}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-border/60">
        <div className="text-[10.5px] text-muted-foreground">
          Confidence <span className="num text-foreground/80 font-semibold">{confidence}%</span>
        </div>
        {onApply && (
          <button
            onClick={onApply}
            className="text-[11px] font-semibold text-opportunity hover:underline cursor-pointer inline-flex items-center gap-1"
          >
            Apply <ArrowUpRight className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function BusinessImpactView({
  selection, current, onApply,
}: { selection: Selection; current: Compute; onApply: (id: VariableId, idx: number) => void }) {
  const sims: {
    id: string; title: string; sub: string; confidence: number;
    apply?: () => void;
    chain: { label: string; value: string; tone: "success" | "risk" | "neutral" }[];
  }[] = [];

  // MOQ scenario
  if (selection.moq < VAR_MAP.moq.options.length - 1) {
    const targetIdx = 2;
    const nextOpt = VAR_MAP.moq.options[targetIdx];
    sims.push({
      id: "moq",
      title: "Increase MOQ → 5,000 pcs",
      sub: "Unlocks tier-2 yarn rate at Vardhman and amortizes setup across 2× units",
      confidence: 91,
      apply: () => onApply("moq", targetIdx),
      chain: [
        { label: "Material Cost", value: "−8%", tone: "success" },
        { label: "Break-even", value: "−15%", tone: "success" },
        { label: "Margin", value: "+2.4 pts", tone: "success" },
        { label: "Buyer Acceptance", value: "−3%", tone: "risk" },
      ],
    });
  }

  // Fabric supplier
  if (selection.fabricSupplier !== VAR_MAP.fabricSupplier.recommendedIndex) {
    sims.push({
      id: "supplier",
      title: "Switch Supplier → Vardhman",
      sub: "Identical construction, 6% lower rate, OEKO-TEX coverage, reliability A",
      confidence: 84,
      apply: () => onApply("fabricSupplier", VAR_MAP.fabricSupplier.recommendedIndex),
      chain: [
        { label: "Fabric Cost", value: "−$0.14/pc", tone: "success" },
        { label: "Lead Time", value: "+0 wks", tone: "neutral" },
        { label: "Annual Profit", value: `+${fmtUsd(0.14 * current.qty * BASE.annualMultiplier, { compact: true })}`, tone: "success" },
        { label: "Buyer Acceptance", value: "+1 pt", tone: "success" },
      ],
    });
  }

  // Packaging
  if (selection.packaging === 0) {
    sims.push({
      id: "pack",
      title: "Standard Packaging",
      sub: "Drop ribbon, keep hang-tag & header. Standard for AW programmes.",
      confidence: 78,
      apply: () => onApply("packaging", 1),
      chain: [
        { label: "Packaging Cost", value: "−$0.07/pc", tone: "success" },
        { label: "Margin", value: "+0.9 pts", tone: "success" },
        { label: "Buyer Acceptance", value: "−6 pts", tone: "risk" },
      ],
    });
  }

  // Fabric width
  if (selection.fabricWidth !== VAR_MAP.fabricWidth.recommendedIndex) {
    sims.push({
      id: "width",
      title: 'Wider 72" tubular fabric',
      sub: "Cuts consumption 1.42m → 1.28m and trims 4% wastage at cutting",
      confidence: 88,
      apply: () => onApply("fabricWidth", VAR_MAP.fabricWidth.recommendedIndex),
      chain: [
        { label: "Fabric Cost", value: "−$0.11/pc", tone: "success" },
        { label: "Wastage", value: "−4%", tone: "success" },
        { label: "Margin", value: "+1.3 pts", tone: "success" },
      ],
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-1">Live commercial state</div>
        <div className="flex items-baseline gap-6">
          <div>
            <div className="text-[24px] font-display font-semibold num tracking-tight">
              <AnimatedNumber value={current.price} format={fmtPrice} />
            </div>
            <div className="text-[10.5px] text-muted-foreground">selling price</div>
          </div>
          <div>
            <div className="text-[16px] font-display font-semibold num tracking-tight">{current.margin.toFixed(1)}%</div>
            <div className="text-[10.5px] text-muted-foreground">margin</div>
          </div>
          <div>
            <div className="text-[16px] font-display font-semibold num tracking-tight">{current.acceptance}%</div>
            <div className="text-[10.5px] text-muted-foreground">buyer acceptance</div>
          </div>
          <div>
            <div className="text-[16px] font-display font-semibold num tracking-tight">{fmtUsd(current.annualProfit, { compact: true })}</div>
            <div className="text-[10.5px] text-muted-foreground">annual profit</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {sims.map(s => <SimCard key={s.id} {...s} onApply={s.apply} />)}
        {sims.length === 0 && (
          <div className="col-span-2 rounded-2xl border border-dashed border-border bg-card p-8 text-center text-[12px] text-muted-foreground">
            Every lever is at its recommended setting. Change a variable to explore simulations.
          </div>
        )}
      </div>

      <ImpactTradeoffMatrix selection={selection} current={current} />
      <BuyerNegotiationRadar current={current} />
    </div>
  );
}

// ─── Impact tradeoff matrix — every lever's directional pull ─────────────────
function ImpactTradeoffMatrix({ selection, current }: { selection: Selection; current: Compute }) {
  const rows = VARIABLES.map((v) => {
    const trial = { ...selection, [v.id]: v.recommendedIndex };
    const next = compute(trial);
    return {
      v,
      dMargin: next.margin - current.margin,
      dAccept: next.acceptance - current.acceptance,
      dLead: next.leadTime - current.leadTime,
      dProfit: next.annualProfit - current.annualProfit,
      atRec: selection[v.id] === v.recommendedIndex,
    };
  }).sort((a, b) => Math.abs(b.dProfit) - Math.abs(a.dProfit));

  const bar = (val: number, max: number, tone: "profit" | "accept" | "lead") => {
    const pct = Math.min(100, (Math.abs(val) / max) * 100);
    const positive = tone === "lead" ? val < 0 : val > 0;
    return (
      <div className="flex items-center gap-2">
        <div className="relative w-14 h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className={cn("absolute top-0 h-full rounded-full transition-all", positive ? "bg-success" : val === 0 ? "bg-muted-foreground/30" : "bg-risk")}
            style={{ width: `${pct}%`, [val >= 0 ? "left" : "right"]: 0 } as React.CSSProperties}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Tradeoff Matrix</div>
          <div className="text-[13px] font-display font-semibold tracking-tight mt-0.5">Every lever if moved to its AI recommendation</div>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,auto))] gap-x-5 gap-y-1 text-[10.5px] items-center">
        <div className="text-muted-foreground uppercase tracking-wider">Lever</div>
        <div className="text-muted-foreground uppercase tracking-wider text-right">Δ Profit</div>
        <div className="text-muted-foreground uppercase tracking-wider text-right">Δ Margin</div>
        <div className="text-muted-foreground uppercase tracking-wider text-right">Δ Accept</div>
        <div className="text-muted-foreground uppercase tracking-wider text-right">Δ Lead</div>
        {rows.map((r) => (
          <React.Fragment key={r.v.id}>
            <div className="py-1.5 border-t border-border/50 flex items-center gap-2 min-w-0">
              <span className={cn("size-1.5 rounded-full", r.atRec ? "bg-success" : "bg-muted-foreground/40")} />
              <span className="text-[11.5px] truncate">{r.v.name}</span>
            </div>
            <div className="py-1.5 border-t border-border/50 flex items-center justify-end gap-2">
              {bar(r.dProfit, 20000, "profit")}
              <span className={cn("num text-[11px] font-semibold w-14 text-right", r.dProfit > 0 ? "text-success" : r.dProfit < 0 ? "text-risk" : "text-muted-foreground")}>
                {r.dProfit === 0 ? "—" : `${r.dProfit > 0 ? "+" : "−"}${fmtUsd(Math.abs(r.dProfit), { compact: true })}`}
              </span>
            </div>
            <div className="py-1.5 border-t border-border/50 text-right">
              <span className={cn("num text-[11px] font-semibold", r.dMargin > 0 ? "text-success" : r.dMargin < 0 ? "text-risk" : "text-muted-foreground")}>
                {r.dMargin === 0 ? "—" : `${r.dMargin > 0 ? "+" : ""}${r.dMargin.toFixed(1)}pt`}
              </span>
            </div>
            <div className="py-1.5 border-t border-border/50 text-right">
              <span className={cn("num text-[11px] font-semibold", r.dAccept > 0 ? "text-success" : r.dAccept < 0 ? "text-risk" : "text-muted-foreground")}>
                {r.dAccept === 0 ? "—" : `${r.dAccept > 0 ? "+" : ""}${r.dAccept}pt`}
              </span>
            </div>
            <div className="py-1.5 border-t border-border/50 text-right">
              <span className={cn("num text-[11px] font-semibold", r.dLead < 0 ? "text-success" : r.dLead > 0 ? "text-risk" : "text-muted-foreground")}>
                {r.dLead === 0 ? "—" : `${r.dLead > 0 ? "+" : ""}${r.dLead.toFixed(1)}w`}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div className="mt-3 text-[10.5px] text-muted-foreground flex items-center gap-4">
        <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-success" />at AI recommendation</span>
        <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-muted-foreground/40" />opportunity available</span>
      </div>
    </div>
  );
}

// ─── Buyer Negotiation Radar — where the risk sits ───────────────────────────
function BuyerNegotiationRadar({ current }: { current: Compute }) {
  const signals = [
    { label: "Price vs Target", score: Math.max(0, Math.min(100, 100 - Math.abs(current.margin - 18) * 6)), hint: current.margin < 15 ? "Below buyer's expected margin band" : current.margin > 22 ? "Above the price band M&S typically challenges" : "Inside comfortable buyer band" },
    { label: "Lead-time fit", score: Math.max(0, Math.min(100, 110 - current.leadTime * 4)), hint: `${current.leadTime.toFixed(0)}w vs 14w programme window` },
    { label: "Cert coverage", score: 88, hint: "GOTS + OEKO-TEX on buyer scorecard" },
    { label: "Supplier reliability", score: 82, hint: "Vardhman A-grade, on-time 94%" },
    { label: "Fabric spec match", score: 91, hint: "GSM & construction match last approved PP" },
    { label: "Volume confidence", score: current.qty >= 5000 ? 84 : 68, hint: `${current.qty.toLocaleString()} pcs booked` },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Buyer Negotiation Radar</div>
          <div className="text-[13px] font-display font-semibold tracking-tight mt-0.5">Where negotiation pressure will land</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {signals.map((s) => {
          const tone = s.score >= 80 ? "success" : s.score >= 65 ? "neutral" : "risk";
          return (
            <div key={s.label} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <div className="text-[11.5px] font-medium">{s.label}</div>
                <div className={cn(
                  "text-[11px] num font-semibold",
                  tone === "success" ? "text-success" : tone === "risk" ? "text-risk" : "text-foreground/80",
                )}>{s.score}</div>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    tone === "success" ? "bg-success" : tone === "risk" ? "bg-risk" : "bg-foreground/50",
                  )}
                  style={{ width: `${s.score}%` }}
                />
              </div>
              <div className="text-[10.5px] text-muted-foreground mt-1.5 leading-snug">{s.hint}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPLAIN QUOTE — narrated buyer-ready sections
// ─────────────────────────────────────────────────────────────────────────────

function ExplainSection({
  title, body, tone = "neutral",
}: { title: string; body: React.ReactNode; tone?: "neutral" | "success" | "risk" }) {
  const bar = tone === "success" ? "bg-success" : tone === "risk" ? "bg-risk" : "bg-foreground/30";
  return (
    <div className="grid grid-cols-[3px_minmax(0,1fr)] gap-4">
      <div className={cn("rounded-full", bar)} />
      <div>
        <div className="text-[12.5px] font-display font-semibold tracking-tight">{title}</div>
        <div className="text-[12px] text-muted-foreground leading-relaxed mt-1">{body}</div>
      </div>
    </div>
  );
}

// ─── Executive Summary — one-glance verdict ─────────────────────────────────
function ExecutiveSummary({
  current, baseline, selection, onExport,
}: { current: Compute; baseline: Compute; selection: Selection; onExport: () => void }) {
  const dPrice = current.price - baseline.price;
  const dMargin = current.margin - baseline.margin;
  const verdict = current.margin >= 18
    ? { label: "Commercially strong", tone: "success" as const }
    : current.margin >= 14
      ? { label: "Defensible", tone: "neutral" as const }
      : { label: "Margin at risk", tone: "risk" as const };
  const moq = VAR_MAP.moq.options[selection.moq];
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Executive summary</div>
            <Pill tone={verdict.tone === "success" ? "success" : verdict.tone === "risk" ? "risk" : "opportunity"}>{verdict.label}</Pill>
          </div>
          <div className="text-[18px] font-display font-semibold tracking-tight mt-1.5 leading-snug">
            {fmtPrice(current.price)} FOB at {moq.qty?.toLocaleString()} pcs, holding {current.margin.toFixed(1)}% margin with {current.acceptance}% expected buyer acceptance.
          </div>
          <div className="text-[12px] text-muted-foreground leading-relaxed mt-2">
            {dPrice < 0
              ? `We have moved the quote down ${fmtPrice(Math.abs(dPrice))} vs baseline while ${dMargin >= 0 ? "protecting" : "trading"} margin.`
              : dPrice > 0
                ? `The quote is ${fmtPrice(Math.abs(dPrice))} above baseline — driven by construction and pack choices, not fixed cost.`
                : "The quote sits at the baseline configuration."}
            {" "}Every input on this quotation is benchmarked against the last three POs for this buyer.
          </div>
        </div>
        <button
          onClick={onExport}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-md bg-foreground text-background text-[12px] font-semibold hover:bg-foreground/90 cursor-pointer"
        >
          Export quote <ArrowUpRight className="size-3" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-border">
        {[
          { k: "Price", v: fmtPrice(current.price), d: dPrice, fmt: (x: number) => `${x >= 0 ? "+" : "−"}$${Math.abs(x).toFixed(2)}`, invert: true },
          { k: "Margin", v: `${current.margin.toFixed(1)}%`, d: dMargin, fmt: (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(1)}pt`, invert: false },
          { k: "Annual Profit", v: fmtUsd(current.annualProfit, { compact: true }), d: current.annualProfit - baseline.annualProfit, fmt: (x: number) => `${x >= 0 ? "+" : "−"}${fmtUsd(Math.abs(x), { compact: true })}`, invert: false },
          { k: "Acceptance", v: `${current.acceptance}%`, d: current.acceptance - baseline.acceptance, fmt: (x: number) => `${x >= 0 ? "+" : ""}${x}pt`, invert: false },
        ].map((s) => {
          const good = s.invert ? s.d < 0 : s.d > 0;
          return (
            <div key={s.k}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.k}</div>
              <div className="text-[22px] font-display font-semibold num tracking-tight">{s.v}</div>
              {Math.abs(s.d) > 0.001 && (
                <div className={cn("text-[10.5px] num font-semibold", good ? "text-success" : "text-risk")}>
                  {s.fmt(s.d)} vs baseline
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Change Log — what shifted since baseline ────────────────────────────────
function ChangeLogSinceBaseline({
  current, baseline, selection,
}: { current: Compute; baseline: Compute; selection: Selection }) {
  const changes = VARIABLES.filter((v) => selection[v.id] !== initialSelection[v.id]).map((v) => {
    const from = v.options[initialSelection[v.id]];
    const to = v.options[selection[v.id]];
    return { v, from, to };
  });
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Change log</div>
          <div className="text-[13px] font-display font-semibold tracking-tight mt-0.5">
            {changes.length === 0 ? "No changes vs baseline configuration" : `${changes.length} decision${changes.length === 1 ? "" : "s"} moved this quote`}
          </div>
        </div>
        <div className={cn(
          "text-[11px] num font-semibold",
          current.price - baseline.price < 0 ? "text-success" : current.price - baseline.price > 0 ? "text-risk" : "text-muted-foreground",
        )}>
          net Δ {current.price - baseline.price >= 0 ? "+" : "−"}${Math.abs(current.price - baseline.price).toFixed(2)}
        </div>
      </div>
      {changes.length === 0 ? (
        <div className="text-[11.5px] text-muted-foreground py-6 text-center rounded-lg bg-secondary/40">
          Baseline configuration. Change a lever on the left to see it recorded here.
        </div>
      ) : (
        <div className="space-y-1.5">
          {changes.map(({ v, from, to }) => (
            <div key={v.id} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 rounded-lg bg-secondary/40 px-3 py-2">
              <div className="text-[11px] text-muted-foreground truncate">{v.name}</div>
              <div className="text-[11.5px] truncate line-through opacity-60">{from.label}</div>
              <ArrowRight className="size-3 text-muted-foreground" />
              <div className="text-[11.5px] truncate font-medium">{to.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Risks & Mitigations ─────────────────────────────────────────────────────
function RisksMitigations({ current, selection }: { current: Compute; selection: Selection }) {
  const risks: { title: string; body: string; mitigation: string; severity: "high" | "med" | "low" }[] = [];
  if (current.margin < 15) risks.push({
    title: "Margin below buyer band",
    body: `Margin sits at ${current.margin.toFixed(1)}%, under the 15% floor typically defended on this programme.`,
    mitigation: "Move MOQ to 5,000 pcs or switch to 72\" tubular fabric to recover ~2pt.",
    severity: "high",
  });
  if (current.acceptance < 70) risks.push({
    title: "Buyer acceptance drift",
    body: `Predicted acceptance ${current.acceptance}%, below the 70% comfort line for M&S AW quotes.`,
    mitigation: "Keep full packaging spec, or offer a 60-day payment option to lift acceptance ~4pt.",
    severity: "med",
  });
  if (current.leadTime > 14) risks.push({
    title: "Lead time overrun",
    body: `Current plan ships at ${current.leadTime.toFixed(0)} weeks vs 14-week programme window.`,
    mitigation: "Air-freight top-up on first 20% or switch to Vardhman for inland-stocked yarn.",
    severity: "med",
  });
  if (selection.fabricSupplier !== VAR_MAP.fabricSupplier.recommendedIndex) risks.push({
    title: "Supplier rate expiring",
    body: "Current supplier rate card expires Sep 28 — a 3–5% uplift is expected on renewal.",
    mitigation: "Lock the yarn PO by Sep 20 or move to the AI-recommended supplier.",
    severity: "low",
  });
  if (risks.length === 0) risks.push({
    title: "No structural risks detected",
    body: "Margin, acceptance and lead-time all sit inside comfort bands for this buyer.",
    mitigation: "Proceed to buyer with current configuration.",
    severity: "low",
  });
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Risks &amp; mitigations</div>
          <div className="text-[13px] font-display font-semibold tracking-tight mt-0.5">What could go wrong and how to defuse it</div>
        </div>
      </div>
      <div className="space-y-2">
        {risks.map((r, i) => (
          <div key={i} className="rounded-xl border border-border bg-background p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn(
                "text-[9.5px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded",
                r.severity === "high" ? "bg-risk/12 text-risk" : r.severity === "med" ? "bg-opportunity-soft text-opportunity" : "bg-secondary text-muted-foreground",
              )}>{r.severity}</span>
              <span className="text-[12.5px] font-display font-semibold tracking-tight">{r.title}</span>
            </div>
            <div className="text-[11.5px] text-muted-foreground leading-relaxed">{r.body}</div>
            <div className="text-[11.5px] mt-1.5 leading-relaxed">
              <span className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold mr-1.5">Mitigation</span>
              {r.mitigation}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



function ExplainQuoteView({
  selection, current, baseline, onExport,
}: { selection: Selection; current: Compute; baseline: Compute; onExport: () => void }) {
  const fabricDelta = current.costs.fabric - baseline.costs.fabric;
  const packDelta = current.costs.packaging - baseline.costs.packaging;
  const moq = VAR_MAP.moq.options[selection.moq];
  const cert = VAR_MAP.certification.options[selection.certification];
  const transport = VAR_MAP.transportation.options[selection.transportation];

  return (
    <div className="space-y-6">
      <ExecutiveSummary current={current} baseline={baseline} selection={selection} onExport={onExport} />
      <ExplainPriceChange current={current} baseline={baseline} selection={selection} onExport={onExport} />
      <ChangeLogSinceBaseline current={current} baseline={baseline} selection={selection} />


      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">Audit trail</div>
            <div className="text-[15px] font-display font-semibold tracking-tight mt-0.5">Why the quote reads the way it does</div>
          </div>
        </div>

        <ExplainSection
          title="Why Fabric Cost is where it is"
          tone={fabricDelta < 0 ? "success" : fabricDelta > 0 ? "risk" : "neutral"}
          body={
            <>
              <span className="font-medium text-foreground">{VAR_MAP.fabricConstruction.options[selection.fabricConstruction].label}</span> at{" "}
              <span className="font-medium text-foreground">{VAR_MAP.fabricWidth.options[selection.fabricWidth].label}</span> from{" "}
              <span className="font-medium text-foreground">{VAR_MAP.fabricSupplier.options[selection.fabricSupplier].label}</span> lands at{" "}
              <span className="num font-medium text-foreground">${current.costs.fabric.toFixed(2)}/pc</span>.
              {Math.abs(fabricDelta) > 0.001 && (
                <> That is <span className={cn("num font-medium", fabricDelta < 0 ? "text-success" : "text-risk")}>
                  {fabricDelta < 0 ? "−" : "+"}${Math.abs(fabricDelta).toFixed(2)}
                </span> vs baseline construction.</>
              )}
            </>
          }
        />

        <ExplainSection
          title="Why MOQ matters at this price"
          body={
            <>
              This quotation is priced against <span className="num font-medium text-foreground">{moq.qty?.toLocaleString()} pcs</span>. Fixed setup of{" "}
              <span className="num font-medium text-foreground">${BASE.fixedCost.toLocaleString()}</span> is spread over that quantity, so overheads carry{" "}
              <span className="num font-medium text-foreground">${(BASE.fixedCost / current.qty).toFixed(2)}/pc</span>. Larger MOQs unlock tier-2 yarn rates that drop material cost 6–9%.
            </>
          }
        />

        <ExplainSection
          title="Why Packaging Cost is where it is"
          tone={packDelta < 0 ? "success" : packDelta > 0 ? "risk" : "neutral"}
          body={
            <>
              Packaging is <span className="font-medium text-foreground">{VAR_MAP.packaging.options[selection.packaging].label}</span>, priced at{" "}
              <span className="num font-medium text-foreground">${current.costs.packaging.toFixed(2)}/pc</span>. Trims match the AW-25 pack spec you approved on the last two POs.
            </>
          }
        />

        <ExplainSection
          title="Certification costs"
          body={
            <>
              <span className="font-medium text-foreground">{cert.label}</span> costs{" "}
              <span className="num font-medium text-foreground">${current.costs.certification.toFixed(2)}/pc</span>. These certifications are on your buyer scorecard as required rather than optional.
            </>
          }
        />

        <ExplainSection
          title="Transportation costs"
          body={
            <>
              <span className="font-medium text-foreground">{transport.label}</span> from Tirupur → Felixstowe adds{" "}
              <span className="num font-medium text-foreground">${current.costs.transportation.toFixed(2)}/pc</span> at an expected{" "}
              <span className="num font-medium text-foreground">{current.leadTime.toFixed(0)} weeks</span> transit.
            </>
          }
        />

        <ExplainSection
          title="Historical comparison"
          body={
            <>
              The last similar PO on this construction with a comparable buyer closed at{" "}
              <span className="num font-medium text-foreground">$3.94/pc</span> with a{" "}
              <span className="num font-medium text-foreground">17.8% margin</span>. Current quote is{" "}
              <span className={cn("num font-medium", current.price < 3.94 ? "text-success" : "text-risk")}>{fmtPrice(current.price)}</span>{" "}
              at <span className="num font-medium text-foreground">{current.margin.toFixed(1)}%</span> margin.
            </>
          }
        />

        <ExplainSection
          title="Buyer-ready explanation"
          body={
            <div className="rounded-lg border border-border bg-secondary/40 px-4 py-3 mt-1 text-foreground/90 leading-relaxed">
              &ldquo;This quotation reflects <span className="font-medium">{VAR_MAP.fabricConstruction.options[selection.fabricConstruction].label}</span> at{" "}
              <span className="font-medium">{moq.qty?.toLocaleString()} pcs</span>, with{" "}
              <span className="font-medium">{cert.label}</span> and{" "}
              <span className="font-medium">{transport.label}</span>. Every input has been benchmarked against the last three POs for this buyer.
              At <span className="num font-medium">{fmtPrice(current.price)}</span> we hold a{" "}
              <span className="num font-medium">{current.margin.toFixed(1)}%</span> margin with{" "}
              <span className="num font-medium">{current.acceptance}%</span> expected buyer acceptance.&rdquo;
            </div>
          }
        />
      </div>

      <RisksMitigations current={current} selection={selection} />

      <div>
        <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-3">Commercial memory · similar past quotes</div>
        <HistoricalIntelligence />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CENTER PANE — 4 focused tabs
// ─────────────────────────────────────────────────────────────────────────────

type CanvasTab = "flow" | "breakdown" | "impact" | "explain";

function CenterPane({
  selection,
  current,
  baseline,
  lastChanged,
  focusedId: _focusedId,
  onExportPrice,
  onFocus,
  onApply,
}: {
  selection: Selection;
  current: Compute;
  baseline: Compute;
  lastChanged: VariableId | null;
  prevCompute: Compute;
  focusedId: VariableId;
  timeline: TimelineEntry[];
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExportPrice: () => void;
  onFocus: (id: VariableId) => void;
  onApply: (id: VariableId, idx: number) => void;
}) {
  const [tab, setTab] = useState<CanvasTab>("flow");

  const tabs: { id: CanvasTab; label: string; sub: string }[] = [
    { id: "flow", label: "Cost Flow", sub: "how the quote is built" },
    { id: "breakdown", label: "Cost Breakdown", sub: "where the money goes" },
    { id: "explain", label: "Explain Quote", sub: "buyer-ready narrative" },
  ];

  return (
    <main className="flex-1 min-w-0 flex flex-col h-full bg-background">
      <StickyOutcome current={current} baseline={baseline} />

      {/* Tab bar */}
      <div className="border-b border-border bg-background">
        <div className="max-w-[1080px] mx-auto px-8 flex items-end gap-6">
          {tabs.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative h-12 flex flex-col items-start justify-center text-left transition-colors cursor-pointer",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <div className="text-[12.5px] font-semibold tracking-tight">{t.label}</div>
                <div className="text-[9.5px] uppercase tracking-[0.14em] opacity-70">{t.sub}</div>
                {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-brand-700" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1080px] mx-auto px-8 py-8 animate-surface-in" key={tab}>
          {tab === "flow" && (
            <CostFlowCanvas
              selection={selection}
              current={current}
              baseline={baseline}
              lastChanged={lastChanged}
              onFocus={onFocus}
            />
          )}
          {tab === "breakdown" && (
            <CostBreakdownView current={current} baseline={baseline} onFocus={onFocus} />
          )}
          {tab === "impact" && null}
          {tab === "explain" && (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-16 text-center">
              <div className="text-[13px] font-semibold text-foreground">Explain Quote</div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                Buyer-ready narrative — coming soon.
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}








// ─────────────────────────────────────────────────────────────────────────────
// RIGHT — Contextual Commercial Intelligence
// ─────────────────────────────────────────────────────────────────────────────

function rankOpportunities(selection: Selection, base: Compute) {
  return VARIABLES.filter((v) => v.recommendedIndex !== selection[v.id])
    .map((v) => {
      const trial = { ...selection, [v.id]: v.recommendedIndex };
      const next = compute(trial);
      return {
        v,
        deltaProfit: next.annualProfit - base.annualProfit,
        deltaMargin: next.margin - base.margin,
        acceptance: next.acceptance,
        nextLabel: v.options[v.recommendedIndex].label,
      };
    })
    .filter((o) => o.deltaProfit > 0)
    .sort((a, b) => b.deltaProfit - a.deltaProfit);
}

function RightPane({
  selection,
  current,
  baseline,
  focusedId,
  scenarios,
  activeScenarioId,
  view,
  onViewChange,
  onSelectScenario,
  onScenarioMenu,
  onCompareToggle,
  compareMode,
  onApply,
  onExplain,
  onCollapse,
}: {
  selection: Selection;
  current: Compute;
  baseline: Compute;
  focusedId: VariableId;
  scenarios: Scenario[];
  activeScenarioId: ScenarioId;
  view: RightView;
  onViewChange: (v: RightView) => void;
  onSelectScenario: (id: ScenarioId) => void;
  onScenarioMenu: (id: ScenarioId) => void;
  onCompareToggle: () => void;
  compareMode: boolean;
  onApply: (id: VariableId) => void;
  onExplain: () => void;
  onCollapse: () => void;
}) {
  const opportunities = useMemo(() => rankOpportunities(selection, current), [selection, current]);
  const focusedDef = VAR_MAP[focusedId];
  const focusedOption = focusedDef.options[selection[focusedId]];
  const isOnRecommendation = selection[focusedId] === focusedDef.recommendedIndex;
  const focusedOpp = opportunities.find((o) => o.v.id === focusedId) ?? opportunities[0];
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const visibleScenarios = scenarios.filter((s) => !s.archived);
  const costEntries = (Object.keys(current.costs) as CostKey[])
    .map((k) => ({ key: k, label: COST_LABEL[k], value: current.costs[k] }))
    .sort((a, b) => b.value - a.value);

  const titles: Record<RightView, string> = {
    overview: "Overview",
    recommendations: "Recommendations",
    risks: "Risks & Mitigations",
    chat: "AI Chat",
  };

  return (
    <div className="w-[340px] shrink-0 border-l border-border bg-surface/40 flex flex-col h-full">
      <div className="h-12 px-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-6 rounded-md bg-brand-50 text-brand-700 grid place-items-center shrink-0">
            {view === "overview" ? (
              <LayoutDashboard className="size-3.5" />
            ) : view === "recommendations" ? (
              <Lightbulb className="size-3.5" />
            ) : view === "risks" ? (
              <ShieldAlert className="size-3.5" />
            ) : (
              <MessageSquare className="size-3.5" />
            )}
          </div>
          <span className="text-[13px] font-display font-semibold tracking-tight truncate">
            {titles[view]}
          </span>
        </div>
        <button
          onClick={onCollapse}
          className="size-7 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground grid place-items-center transition-colors"
          title="Collapse"
        >
          <PanelRightClose className="size-3.5" />
        </button>
      </div>

      {view === "overview" && (
        <div className="flex-1 overflow-y-auto">
          {/* Total Cost & Breakdown */}
          <section className="px-4 py-4 border-b border-border space-y-2">
            <button
              onClick={() => setBreakdownOpen((o) => !o)}
              className="w-full flex items-center justify-between text-left"
            >
              <SectionLabel>Total Cost</SectionLabel>
              <ChevronDown
                className={cn(
                  "size-3.5 text-muted-foreground transition-transform",
                  breakdownOpen && "rotate-180",
                )}
              />
            </button>
            <div className="rounded-lg border border-border bg-card p-3.5 space-y-2">
              <div className="flex items-baseline justify-between">
                <LiveValue className="text-[24px] font-display font-semibold text-brand-700 num">
                  {fmtPrice(current.unitCost)}
                </LiveValue>
                <span className="text-[10.5px] text-muted-foreground">per piece</span>
              </div>
              {breakdownOpen && (
                <div className="pt-2 space-y-1.5 border-t border-border">
                  {costEntries.map((c) => {
                    const pct = (c.value / current.unitCost) * 100;
                    return (
                      <div key={c.key} className="space-y-0.5">
                        <div className="flex items-baseline justify-between text-[11.5px]">
                          <span className="text-foreground/80">{c.label}</span>
                          <span className="num font-medium">
                            {fmtPrice(c.value)}
                            <span className="ml-1 text-muted-foreground text-[10.5px]">
                              {pct.toFixed(0)}%
                            </span>
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-brand-700"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {breakdownOpen && (
              <div className="pt-1 -mx-4 -mb-4">
                <CommercialSummary current={current} baseline={baseline} />
              </div>
            )}
          </section>


          {/* Enquiry Details */}
          <section className="px-4 py-4 border-b border-border space-y-2">
            <SectionLabel>Enquiry Details</SectionLabel>
            <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
              {[
                ["Buyer", "GD-BEDDING"],
                ["Article", "4814926"],
                ["Product", "Comforter · 66\" x 86\""],
                ["Composition", "100% Cotton"],
                ["Quantity", `${current.qty.toLocaleString()} pcs`],
                ["Lead time", `${current.leadTime} weeks`],
                ["Ship window", "Print Part · 17.12.2025"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 text-[11.5px]">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-foreground num text-right truncate">{v}</span>
                </div>
              ))}
            </div>
          </section>


          {/* Scenarios */}
          <section className="px-4 py-4 border-b border-border space-y-2">

              <div className="flex items-center justify-between">
                <SectionLabel>Scenarios</SectionLabel>
                <button
                  onClick={onCompareToggle}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium transition-colors",
                    compareMode
                      ? "bg-brand-700 text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  )}
                >
                  <Columns3 className="size-3" />
                  {compareMode ? "Exit" : "Compare"}
                </button>
              </div>
              <div className="space-y-1">
                {visibleScenarios.map((s) => {
                  const active = !compareMode && s.id === activeScenarioId;
                  const isCurrent = s.id === "current";
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "group flex items-center rounded-md border transition-colors",
                        active
                          ? "border-brand-700/30 bg-brand-50"
                          : "border-transparent hover:border-border hover:bg-secondary/60",
                      )}
                    >
                      <button
                        onClick={() => onSelectScenario(s.id)}
                        className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2 text-left"
                      >
                        <GitBranch
                          className={cn(
                            "size-3 shrink-0",
                            active ? "text-brand-700" : "text-muted-foreground",
                          )}
                        />
                        <span
                          className={cn(
                            "text-[12px] font-medium truncate",
                            active ? "text-brand-700" : "text-foreground",
                          )}
                        >
                          {s.name}
                        </span>
                        {isCurrent && (
                          <span className="ml-auto text-[9.5px] font-semibold tracking-wider uppercase text-brand-700/80 bg-brand-100/70 px-1.5 py-0.5 rounded-full">
                            Default
                          </span>
                        )}
                        {!isCurrent && s.aiObjective && (
                          <Sparkles className="size-2.5 text-brand-700 shrink-0" />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onScenarioMenu(s.id);
                        }}
                        className="p-1.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                      >
                        <MoreHorizontal className="size-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Contextual focus */}
            <section className="px-4 py-4 border-b border-border space-y-2 animate-surface-in" key={focusedId}>
              <div className="flex items-center justify-between">
                <SectionLabel>In Focus</SectionLabel>
                <span className="text-[10.5px] text-muted-foreground">follows cursor</span>
              </div>
              <div>
                <div className="text-[15px] font-display font-semibold tracking-tight">{focusedDef.name}</div>
                <div className="text-[11.5px] text-muted-foreground">Selected · {focusedOption.label}</div>
              </div>
              <p className="text-[11.5px] text-foreground/75 leading-snug">{focusedDef.rationale}</p>
            </section>

            {/* Biggest Opportunity */}
            {focusedOpp && (
              <section className="px-4 py-4 border-b border-border space-y-2">
                <SectionLabel right={<TrendingUp className="size-3 text-muted-foreground" />}>
                  Biggest Opportunity
                </SectionLabel>
                <div className="rounded-lg border border-brand-700/20 bg-brand-50 p-3 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <Sparkles className="size-3.5 text-brand-700 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-[12.5px] font-medium">
                        {focusedOpp.v.name} → {focusedOpp.nextLabel}
                      </div>
                      <div className="text-[11.5px] text-foreground/70 leading-snug mt-0.5">
                        {focusedOpp.v.rationale}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                    <Stat k="Annual" v={`+${fmtUsd(focusedOpp.deltaProfit, { compact: true })}`} tone="success" />
                    <Stat k="Margin" v={`${fmtDelta(focusedOpp.deltaMargin, 1)}pt`} tone="success" />
                  </div>
                  <button
                    onClick={() => onApply(focusedOpp.v.id)}
                    className="w-full py-2 rounded-md text-[12px] font-medium bg-brand-700 text-primary-foreground hover:bg-brand-800 transition-colors flex items-center justify-center gap-1.5"
                  >
                    Switch to AI pick <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </section>
            )}

            {/* Explain This Quote */}
            <section className="px-4 py-4 space-y-2">
              <SectionLabel>Explain This Quote</SectionLabel>
              <button
                onClick={onExplain}
                className="w-full h-9 rounded-md text-[12px] font-medium border border-border bg-card hover:bg-secondary transition-colors flex items-center justify-center gap-1.5"
              >
                <Sparkles className="size-3.5 text-brand-700" />
                Generate explanation
              </button>
            </section>
          </div>
        )}

        {view === "recommendations" && (
          <RecommendationsView selection={selection} current={current} onApply={onApply} />
        )}
        {view === "risks" && <RisksView selection={selection} current={current} />}
        {view === "chat" && <ChatView />}

        {view === "overview" && !isOnRecommendation && (
          <div className="px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground flex items-center gap-2">
            <ArrowDown className="size-3" />
            You have overridden the AI on {focusedDef.name}.
          </div>
        )}
    </div>
  );
}



function buildAcceptanceReasons(
  selection: Selection,
  current: Compute,
): { text: string; tone: "success" | "risk" | "neutral" }[] {
  const out: { text: string; tone: "success" | "risk" | "neutral" }[] = [];
  for (const v of VARIABLES) {
    const opt = v.options[selection[v.id]];
    if (!opt.acceptance) continue;
    out.push({
      text: `${v.name} (${opt.label}) ${opt.acceptance >= 0 ? "lifts" : "lowers"} acceptance by ${Math.abs(opt.acceptance)}pt`,
      tone: opt.acceptance >= 0 ? "success" : "risk",
    });
  }
  if (current.acceptance >= 75) out.push({ text: "Buyer accepted similar pricing on last M&S AW programme", tone: "success" });
  if (current.leadTime <= BASE.leadTime) out.push({ text: "Lead time on plan — no expediting needed", tone: "success" });
  if (out.length === 0) out.push({ text: "All selections sit inside buyer's historical comfort range", tone: "success" });
  return out.slice(0, 5);
}

function buildRisks(
  selection: Selection,
  current: Compute,
): { tone: "risk" | "warning"; title: string; body: string }[] {
  const out: { tone: "risk" | "warning"; title: string; body: string }[] = [];
  // Supplier Risk
  if (selection.fabricSupplier === 0)
    out.push({ tone: "warning", title: "Supplier Risk", body: "Primary supplier rate aged 14 days — refresh before quote release." });
  // Material Availability
  if (selection.embroidery > 0)
    out.push({ tone: "warning", title: "Material Availability", body: "Cotton/Flax blend has 4-week fibre lead time; confirm stock before commit." });
  // Pricing Volatility
  out.push({ tone: "warning", title: "Pricing Volatility", body: "Cotton index moved +6% over last 30 days; hedge or shorten quote validity." });
  // MOQ below Break-even
  if (current.qty < current.breakEven)
    out.push({ tone: "risk", title: "MOQ below Break-even", body: `Order qty ${current.qty.toLocaleString()} pcs is under break-even of ${current.breakEven.toLocaleString()} pcs.` });
  // Margin below Target
  if (current.margin < 14)
    out.push({ tone: "risk", title: "Margin below Target", body: `Currently ${fmtPct(current.margin)} vs 14% commercial floor.` });
  // Delivery Risk
  if (current.leadTime > BASE.leadTime)
    out.push({ tone: "risk", title: "Delivery Risk", body: `Plan ships at ${current.leadTime.toFixed(0)} weeks vs 14-week programme window.` });
  else if (selection.transportation === 1)
    out.push({ tone: "warning", title: "Delivery Risk", body: "LCL adds a week; mixed-container routing risks PP slip." });
  // Certification Pending
  if (selection.certification === 2)
    out.push({ tone: "warning", title: "Certification Pending", body: "GOTS audit window is 6 weeks — sequence audit before PP approval." });
  // Production Constraints
  if (selection.moq === 2)
    out.push({ tone: "warning", title: "Production Constraints", body: "Tier-3 volume exceeds one weekly production slot; may need split shipment." });
  // Buyer Dependencies
  if (selection.packaging > 0)
    out.push({ tone: "warning", title: "Buyer Dependencies", body: "M&S rejected ribbon removal twice in the last 12 months." });
  if (current.acceptance < 60)
    out.push({ tone: "risk", title: "Buyer Dependencies", body: "Current configuration drops buyer acceptance below negotiate threshold." });
  // Exchange Rate Risk
  out.push({ tone: "warning", title: "Exchange Rate Risk", body: "USD/INR moved 1.4% this month; margin exposure ~0.6pt on unhedged position." });
  if (out.length === 0) out.push({ tone: "warning", title: "No active risks", body: "All exposure indicators inside tolerance." });
  return out;
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: "success" }) {
  return (
    <div className="rounded-md bg-card/70 px-2.5 py-1.5 ring-1 ring-border">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{k}</div>
      <div className={cn("text-[12px] num font-semibold", tone === "success" ? "text-success" : "text-foreground")}>
        {v}
      </div>
    </div>
  );
}

function RiskAlert({ tone, title, body }: { tone: "risk" | "warning"; title: string; body: string }) {
  const ring = tone === "risk" ? "border-risk/20 bg-risk-soft/40" : "border-warning/20 bg-warning-soft/40";
  const dot = tone === "risk" ? "bg-risk" : "bg-warning";
  return (
    <div className={cn("rounded-lg border p-3 flex items-start gap-2.5", ring)}>
      <span className={cn("size-1.5 rounded-full mt-1.5", dot)} />
      <div>
        <div className="text-[12px] font-medium">{title}</div>
        <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">{body}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Explain modal
// ─────────────────────────────────────────────────────────────────────────────

function ExplainModal({
  selection,
  current,
  baseline,
  onClose,
}: {
  selection: Selection;
  current: Compute;
  baseline: Compute;
  onClose: () => void;
}) {
  const text = useMemo(() => buildExplanationText(selection, current, baseline), [selection, current, baseline]);
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 backdrop-blur-sm p-6 animate-surface-in" onClick={onClose}>
      <div
        className="w-full max-w-[640px] max-h-[80vh] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">Customer Communication</div>
            <div className="text-[16px] font-display font-semibold tracking-tight mt-0.5">Why this quotation reads as it does</div>
          </div>
          <button onClick={onClose} className="text-[12px] text-muted-foreground hover:text-foreground">Close</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <pre className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground/85 font-sans">{text}</pre>
        </div>
        <div className="px-6 py-3 border-t border-border flex items-center justify-end gap-2">
          <button
            onClick={() => {
              navigator.clipboard?.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="h-8 px-3 rounded-md text-[12px] font-medium border border-border hover:bg-secondary flex items-center gap-1.5"
          >
            <Copy className="size-3.5" />
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={() => {
              const blob = new Blob([text], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "ENQ-2841-explanation.txt";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="h-8 px-3 rounded-md text-[12px] font-medium bg-foreground text-background hover:bg-foreground/90 flex items-center gap-1.5"
          >
            <Download className="size-3.5" />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

function buildExplanationText(selection: Selection, current: Compute, baseline: Compute) {
  const changes: string[] = [];
  for (const v of VARIABLES) {
    const idx = selection[v.id];
    if (idx === v.baselineIndex) continue;
    const opt = v.options[idx];
    const sum = Object.values(opt.cost ?? {}).reduce<number>((s, n) => s + (n ?? 0), 0);
    const fragments: string[] = [`${v.name} → ${opt.label}`];
    if (Math.abs(sum) >= 0.005) fragments.push(`${sum >= 0 ? "+" : ""}$${sum.toFixed(2)}/pc`);
    if (opt.acceptance) fragments.push(`${fmtSigned(opt.acceptance)}pt buyer acceptance`);
    if (opt.leadTime) fragments.push(`${fmtDelta(opt.leadTime, 1)}wk lead time`);
    changes.push("• " + fragments.join(" · "));
  }
  const dPrice = current.price - baseline.price;
  const dMargin = current.margin - baseline.margin;
  const lines = [
    "ENQ-2841 — Oversized Heavy Jersey · AW26",
    "Customer: Marks & Spencer · UK",
    "",
    `Quoted FOB: ${fmtPrice(current.price)} (vs baseline ${fmtPrice(baseline.price)} → ${dPrice >= 0 ? "+" : ""}${fmtPrice(dPrice)} /pc)`,
    `Margin: ${fmtPct(current.margin)} (${fmtDelta(dMargin, 1)}pt vs baseline)`,
    `MOQ: ${current.qty.toLocaleString()} pcs · Lead time: ${current.leadTime.toFixed(1)} wk · Buyer acceptance: ${current.acceptance}%`,
    "",
    "Why the quotation moved:",
    ...(changes.length ? changes : ["• No commercial movement vs baseline configuration."]),
    "",
    `Net result: per-unit ${dPrice >= 0 ? "increase" : "decrease"} of ${fmtPrice(Math.abs(dPrice))} translates to ${
      current.annualProfit - baseline.annualProfit >= 0 ? "+" : "−"
    }${fmtUsd(Math.abs(current.annualProfit - baseline.annualProfit), { compact: true })} projected annual profit.`,
    "",
    "Prepared by Tracon Commercial Decision Studio.",
  ];
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenarios — independent commercial workspaces for the same enquiry
// ─────────────────────────────────────────────────────────────────────────────

type ScenarioId = string;

type Scenario = {
  id: ScenarioId;
  name: string;
  selection: Selection;
  baseId: ScenarioId | null; // scenario this one was branched from (for diff)
  archived: boolean;
  aiObjective?: string; // when generated by AI
};

type AiObjective =
  | "profit"
  | "cost"
  | "delivery"
  | "acceptance"
  | "sustainability"
  | "premium"
  | "auto";

const AI_OBJECTIVES: { id: AiObjective; label: string; sub: string }[] = [
  { id: "profit", label: "Highest Profit", sub: "Maximize annual contribution" },
  { id: "cost", label: "Lowest Cost", sub: "Squeeze every $/pc lever" },
  { id: "delivery", label: "Fastest Delivery", sub: "Shortest lead time" },
  { id: "acceptance", label: "Highest Buyer Acceptance", sub: "Win-rate optimised" },
  { id: "sustainability", label: "Sustainability", sub: "GRS, OEKO, GOTS coverage" },
  { id: "premium", label: "Premium Quality", sub: "Top-tier finish & spec" },
  { id: "auto", label: "Let AI Generate Best Option", sub: "Balanced optimum" },
];

const seedSelection = (overrides: Partial<Selection>): Selection =>
  ({ ...initialSelection, ...overrides }) as Selection;

const SEED_SCENARIOS: Scenario[] = [
  { id: "current", name: "Current", selection: initialSelection, baseId: null, archived: false },
  {
    id: "lowestCost",
    name: "Lowest Cost",
    selection: seedSelection({ packaging: 2, certification: 1, transportation: 1, courier: 1 }),
    baseId: "current",
    archived: false,
    aiObjective: "cost",
  },
  {
    id: "premium",
    name: "Premium",
    selection: seedSelection({ certification: 2, embroidery: 1, packaging: 0, fabricConstruction: 3 }),
    baseId: "current",
    archived: false,
    aiObjective: "premium",
  },
  {
    id: "valueEng",
    name: "Value Engineered",
    selection: seedSelection({ fabricConstruction: 3, embroidery: 1, certification: 2, testing: 2 }),
    baseId: "current",
    archived: false,
    aiObjective: "premium",
  },
  {
    id: "highMoq",
    name: "Highest MOQ",
    selection: seedSelection({ moq: 2, packaging: 1 }),
    baseId: "current",
    archived: false,
    aiObjective: "profit",
  },
];

// Presets shown in the "Add Scenario" dropdown
const SCENARIO_PRESETS: { id: string; label: string; objective: AiObjective }[] = [
  { id: "margin", label: "Highest Margin", objective: "profit" },
  { id: "delivery", label: "Fastest Delivery", objective: "delivery" },
  { id: "sustain", label: "Sustainable Materials", objective: "sustainability" },
  { id: "buyer", label: "Buyer Preferred", objective: "acceptance" },
];



function generateAiSelection(base: Selection, obj: AiObjective): Selection {
  const trial: Selection = { ...base };
  for (const v of VARIABLES) {
    let bestIdx = trial[v.id];
    let bestScore = -Infinity;
    v.options.forEach((opt, i) => {
      const test = { ...trial, [v.id]: i };
      const c = compute(test);
      let score = 0;
      if (obj === "profit") score = c.annualProfit;
      else if (obj === "cost") score = -c.unitCost;
      else if (obj === "delivery") score = -c.leadTime;
      else if (obj === "acceptance") score = c.acceptance;
      else if (obj === "premium") score = c.acceptance + (c.unitCost > 4 ? 5 : 0);
      else if (obj === "sustainability")
        score =
          (v.id === "certification" && opt.label.includes("GOTS") ? 30 : 0) +
          (v.id === "transportation" && opt.label.includes("Sea") ? 10 : 0) +
          (v.id === "fabricConstruction" && opt.label.includes("BCI") ? 20 : 0) +
          c.acceptance * 0.1;
      else if (obj === "auto") score = c.annualProfit * 0.6 + c.acceptance * 200 - c.leadTime * 800;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    });
    trial[v.id] = bestIdx;
  }
  return trial;
}

function commercialScore(c: Compute): number {
  // Composite 0-100 score: margin (40), acceptance (35), profit (25)
  const mNorm = Math.max(0, Math.min(1, (c.margin - 5) / 20));
  const aNorm = c.acceptance / 100;
  const pNorm = Math.max(0, Math.min(1, c.annualProfit / 200000));
  return Math.round((mNorm * 40 + aNorm * 35 + pNorm * 25));
}

function riskLevel(c: Compute): { label: string; tone: "success" | "warning" | "risk" } {
  if (c.margin < 10 || c.acceptance < 55) return { label: "High", tone: "risk" };
  if (c.margin < 14 || c.acceptance < 70) return { label: "Medium", tone: "warning" };
  return { label: "Low", tone: "success" };
}

function changedVariables(scenario: Scenario, baseSelection: Selection) {
  const out: { v: VariableDef; from: string; to: string }[] = [];
  for (const v of VARIABLES) {
    const a = baseSelection[v.id];
    const b = scenario.selection[v.id];
    if (a !== b) {
      out.push({ v, from: v.options[a].label, to: v.options[b].label });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario top bar — tabs, compare, new
// ─────────────────────────────────────────────────────────────────────────────

function ScenarioTabs({
  scenarios,
  activeId,
  compareMode,
  onSelect,
  onMenuOpen,
  onCompareToggle,
}: {
  scenarios: Scenario[];
  activeId: ScenarioId;
  compareMode: boolean;
  onSelect: (id: ScenarioId) => void;
  onMenuOpen: (id: ScenarioId) => void;
  onCompareToggle: () => void;
}) {
  const visible = scenarios.filter((s) => !s.archived);
  return (
    <div className="h-14 border-b border-border flex items-center px-4 gap-3 bg-background/80 backdrop-blur sticky top-0 z-20">
      <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground pr-2 border-r border-border/60 mr-1">
        <span className="hover:text-foreground cursor-pointer">Enquiries</span>
        <span className="opacity-40">/</span>
        <span className="text-foreground font-medium">ENQ-2841</span>
      </div>

      <div className="flex items-center gap-0.5 min-w-0 overflow-x-auto">
        {visible.map((s) => {
          const active = !compareMode && s.id === activeId;
          return (
            <div
              key={s.id}
              className={cn(
                "group h-8 flex items-center rounded-md transition-colors",
                active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
              )}
            >
              <button
                onClick={() => onSelect(s.id)}
                className="h-full pl-2.5 pr-1.5 flex items-center gap-1.5 text-[12px] font-medium"
              >
                <GitBranch className="size-3 opacity-60" />
                {s.name}
                {s.aiObjective && <Sparkles className="size-2.5 text-opportunity" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onMenuOpen(s.id); }}
                className="h-full px-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreHorizontal className="size-3" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onCompareToggle}
          className={cn(
            "h-8 px-3 rounded-md text-[12px] font-medium flex items-center gap-1.5 transition-colors",
            compareMode
              ? "bg-foreground text-background"
              : "border border-border text-foreground hover:bg-secondary",
          )}
        >
          <Columns3 className="size-3.5" />
          {compareMode ? "Exit Compare" : "Compare"}
        </button>
        <span className="hidden md:flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          Live
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Scenario modal
// ─────────────────────────────────────────────────────────────────────────────

function CreateScenarioModal({
  scenarios,
  defaultBaseId,
  onClose,
  onCreate,
}: {
  scenarios: Scenario[];
  defaultBaseId: ScenarioId;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    baseId: ScenarioId;
    mode: "empty" | "duplicate" | "ai";
    aiObjective?: AiObjective;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [baseId, setBaseId] = useState<ScenarioId>(defaultBaseId);
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [manualKind, setManualKind] = useState<"empty" | "duplicate">("duplicate");
  const [aiObj, setAiObj] = useState<AiObjective>("profit");

  const submit = () => {
    const finalName =
      name.trim() ||
      (mode === "ai"
        ? AI_OBJECTIVES.find((o) => o.id === aiObj)?.label ?? "AI Scenario"
        : manualKind === "empty"
          ? "New Scenario"
          : `${scenarios.find((s) => s.id === baseId)?.name ?? "Scenario"} copy`);
    onCreate({
      name: finalName,
      baseId,
      mode: mode === "ai" ? "ai" : manualKind,
      aiObjective: mode === "ai" ? aiObj : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 backdrop-blur-sm p-6 animate-surface-in" onClick={onClose}>
      <div
        className="w-full max-w-[560px] max-h-[88vh] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[10.5px] font-semibold tracking-[0.16em] uppercase text-muted-foreground">Scenario</div>
            <div className="text-[17px] font-display font-semibold tracking-tight mt-0.5">Create New Scenario</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10.5px] font-semibold tracking-wider uppercase text-muted-foreground">
              Scenario Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vardhman 5k offer"
              className="w-full h-10 px-3 rounded-md border border-border bg-background text-[13px] focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-foreground/30"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10.5px] font-semibold tracking-wider uppercase text-muted-foreground">
              Base Scenario
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {scenarios.filter((s) => !s.archived).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setBaseId(s.id)}
                  className={cn(
                    "flex items-center gap-2 h-9 px-3 rounded-md border text-[12.5px] text-left transition-colors",
                    baseId === s.id ? "border-foreground bg-secondary" : "border-border hover:bg-secondary/60",
                  )}
                >
                  <span className={cn("size-3 rounded-full border grid place-items-center", baseId === s.id ? "border-foreground" : "border-border")}>
                    {baseId === s.id && <span className="size-1.5 rounded-full bg-foreground" />}
                  </span>
                  <span className="truncate">{s.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10.5px] font-semibold tracking-wider uppercase text-muted-foreground">
              How would you like to create it?
            </label>
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {(["manual", "ai"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "h-9 rounded-md border text-[12.5px] font-medium transition-colors flex items-center justify-center gap-1.5",
                    mode === m ? "border-foreground bg-foreground text-background" : "border-border hover:bg-secondary/60",
                  )}
                >
                  {m === "ai" && <Sparkles className="size-3.5" />}
                  {m === "manual" ? "Manual" : "AI Assisted"}
                </button>
              ))}
            </div>

            {mode === "manual" ? (
              <div className="space-y-1">
                {([
                  { id: "empty", label: "Create Empty Scenario", sub: "Start from baseline defaults" },
                  { id: "duplicate", label: "Duplicate Existing Scenario", sub: "Copy all selections from base" },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setManualKind(opt.id)}
                    className={cn(
                      "w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-md border transition-colors",
                      manualKind === opt.id ? "border-foreground bg-secondary/70" : "border-border hover:bg-secondary/40",
                    )}
                  >
                    <span className={cn("mt-0.5 size-3.5 rounded-full border grid place-items-center shrink-0", manualKind === opt.id ? "border-foreground" : "border-border")}>
                      {manualKind === opt.id && <span className="size-1.5 rounded-full bg-foreground" />}
                    </span>
                    <div>
                      <div className="text-[12.5px] font-medium">{opt.label}</div>
                      <div className="text-[11px] text-muted-foreground">{opt.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {AI_OBJECTIVES.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setAiObj(opt.id)}
                    className={cn(
                      "w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-md border transition-colors",
                      aiObj === opt.id ? "border-opportunity bg-opportunity-soft/40" : "border-border hover:bg-secondary/40",
                    )}
                  >
                    <span className={cn("mt-0.5 size-3.5 rounded-full border grid place-items-center shrink-0", aiObj === opt.id ? "border-opportunity" : "border-border")}>
                      {aiObj === opt.id && <span className="size-1.5 rounded-full bg-opportunity" />}
                    </span>
                    <div className="flex-1">
                      <div className="text-[12.5px] font-medium flex items-center gap-1.5">
                        <Sparkles className="size-3 text-opportunity" />
                        {opt.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{opt.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-border flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-9 px-3.5 rounded-md text-[12.5px] font-medium border border-border hover:bg-secondary">
            Cancel
          </button>
          <button
            onClick={submit}
            className="h-9 px-4 rounded-md text-[12.5px] font-medium bg-foreground text-background hover:bg-foreground/90 flex items-center gap-1.5"
          >
            {mode === "ai" && <Sparkles className="size-3.5" />}
            Create Scenario
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario action menu
// ─────────────────────────────────────────────────────────────────────────────

function ScenarioActionMenu({
  scenario,
  isCurrent,
  onClose,
  onRename,
  onDuplicate,
  onArchive,
  onDelete,
  onPromote,
  onExport,
  onBuyerExplain,
  onInternalSummary,
}: {
  scenario: Scenario;
  isCurrent: boolean;
  onClose: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onPromote: () => void;
  onExport: () => void;
  onBuyerExplain: () => void;
  onInternalSummary: () => void;
}) {
  const items = [
    { label: "Promote as Current", icon: Star, fn: onPromote, hide: isCurrent },
    { label: "Rename", icon: ChevronRight, fn: onRename },
    { label: "Duplicate", icon: Copy, fn: onDuplicate },
    { label: "Export Quote", icon: Download, fn: onExport },
    { label: "Generate Buyer Explanation", icon: Sparkles, fn: onBuyerExplain },
    { label: "Generate Internal Summary", icon: Sparkles, fn: onInternalSummary },
    { label: "Archive", icon: ArrowDown, fn: onArchive, hide: isCurrent },
    { label: "Delete", icon: X, fn: onDelete, danger: true, hide: scenario.id === "current" },
  ];
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div
        className="absolute top-14 left-1/2 -translate-x-1/2 w-[260px] bg-card border border-border rounded-lg shadow-xl py-1 animate-surface-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-border">
          <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">Scenario</div>
          <div className="text-[12.5px] font-medium truncate">{scenario.name}</div>
        </div>
        {items.filter((i) => !i.hide).map((it) => (
          <button
            key={it.label}
            onClick={() => { it.fn(); onClose(); }}
            className={cn(
              "w-full text-left px-3 py-2 text-[12.5px] flex items-center gap-2 hover:bg-secondary",
              it.danger && "text-risk hover:bg-risk-soft/40",
            )}
          >
            <it.icon className="size-3.5 opacity-70" />
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compare view — Apple-style side-by-side
// ─────────────────────────────────────────────────────────────────────────────

function CompareView({
  scenarios,
  selectedIds,
  baseSelection,
  onChangeColumn,
  onPromote,
  marginOverrides,
  setMarginOverrides,
  onExit,
}: {
  scenarios: Scenario[];
  selectedIds: ScenarioId[];
  baseSelection: Selection;
  onChangeColumn: (idx: number, id: ScenarioId | null) => void;
  onPromote: (id: ScenarioId) => void;
  marginOverrides: Record<string, number>;
  setMarginOverrides: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onExit: () => void;
}) {
  const available = scenarios.filter((s) => !s.archived);
  const cols = selectedIds.map((id) => available.find((s) => s.id === id) ?? null);
  const baseComputes = cols.map((s) => (s ? compute(s.selection) : null));

  const marginFor = (idx: number) => {
    const s = cols[idx];
    const c = baseComputes[idx];
    if (!s || !c) return 0;
    return marginOverrides[s.id] ?? c.margin;
  };
  const setMarginFor = (idx: number, value: number) => {
    const s = cols[idx];
    if (!s) return;
    setMarginOverrides((m) => ({ ...m, [s.id]: value }));
  };
  const resetMargin = (idx: number) => {
    const s = cols[idx];
    if (!s) return;
    setMarginOverrides((m) => {
      const { [s.id]: _drop, ...rest } = m;
      return rest;
    });
  };


  // Derive an effective compute per column using overridden margin.
  // price = unitCost / (1 - margin/100)
  const derive = (idx: number) => {
    const c = baseComputes[idx];
    if (!c) return null;
    const mg = marginFor(idx);
    const clamped = Math.min(60, Math.max(3, mg));
    const price = c.unitCost / (1 - clamped / 100);
    const profitPerPc = price - c.unitCost;
    const orderProfit = profitPerPc * c.qty;
    const annualProfit = orderProfit * BASE.annualMultiplier;
    const breakEven = Math.max(1, Math.ceil(BASE.fixedCost / Math.max(0.01, profitPerPc)));
    return { ...c, margin: clamped, price, profitPerPc, orderProfit, annualProfit, breakEven };
  };
  const computes = cols.map((_, i) => derive(i));

  // Per-column "select for quote" checkboxes
  const [quoteSel, setQuoteSel] = useState<Record<string, boolean>>({});
  const toggleQuote = (id: string) => setQuoteSel((q) => ({ ...q, [id]: !q[id] }));

  // Overhead / setup allocation per column
  const overheadFor = (c: NonNullable<ReturnType<typeof compute>>) => BASE.fixedCost / c.qty;

  // Cost row definitions (read-only)
  const fabricRows: { key: CostKey; label: string }[] = [
    { key: "fabric", label: "Fabric" },
  ];
  const makingRows: { key: CostKey; label: string }[] = [
    { key: "processing", label: "Processing (print + emb.)" },
    { key: "packaging", label: "Packaging" },
    { key: "testing", label: "Testing" },
  ];
  const overheadRows: { key: CostKey; label: string }[] = [
    { key: "certification", label: "Certification" },
    { key: "transportation", label: "Transportation" },
    { key: "sampling", label: "Sampling" },
  ];

  // Best highlight helpers
  const bestIdx = (vals: (number | null)[], goodIfHigh: boolean) => {
    const valid = vals.map((v, i) => ({ v, i })).filter((x): x is { v: number; i: number } => x.v !== null);
    if (valid.length < 2) return -1;
    const target = goodIfHigh ? Math.max(...valid.map((x) => x.v)) : Math.min(...valid.map((x) => x.v));
    return valid.find((x) => Math.abs(x.v - target) < 0.001)?.i ?? -1;
  };

  // AI verdict — highest annual profit at overridden margin
  const verdictIdx = computes.reduce<{ i: number; v: number }>(
    (acc, c, i) => (c && c.annualProfit > acc.v ? { i, v: c.annualProfit } : acc),
    { i: -1, v: -Infinity },
  ).i;
  const verdictScenario = verdictIdx >= 0 ? cols[verdictIdx] : null;
  const verdictCompute = verdictIdx >= 0 ? computes[verdictIdx] : null;
  const baseCompute = computes[0];

  const gridCols = cols.length === 3
    ? "grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
    : "grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]";

  // Only the winning ("AI Pick") column is tinted — all others stay clean white,
  // Webflow-style: one clearly highlighted column, everything else calm.
  const HIGHLIGHT = {
    bg:     "#F4FBFF",  // soft primary wash
    head:   "#EAF6FF",   // slightly deeper header band
    strong: "#F0FAFF",   // subtotal / hero band
  };
  const NEUTRAL = { bg: "transparent", head: "transparent", strong: "oklch(0.985 0.003 250)" };
  const tintFor = (i: number) => (i === verdictIdx ? HIGHLIGHT : NEUTRAL);


  const RowShell = ({
    label, sub, tone, children,
  }: { label: string; sub?: string; tone?: "muted" | "strong" | "hero"; children: React.ReactNode }) => (
    <div className={cn(
      "grid items-stretch px-0",
      gridCols,
      "border-t border-border/50",
    )}>
      <div className={cn(
        "text-[12px] font-medium px-5 py-3 flex items-center",
        tone === "hero" ? "text-foreground bg-secondary/40" :
        tone === "strong" ? "text-foreground bg-secondary/25" : "text-muted-foreground",
      )}>
        {label}
        {sub && <span className="ml-1.5 text-[10.5px] text-muted-foreground/70">{sub}</span>}
      </div>
      {children}
    </div>
  );

  const GroupHeader = ({ label }: { label: string }) => (
    <div className={cn("grid items-stretch border-t border-border/70", gridCols)}>
      <div className="px-5 py-2 bg-secondary/60 text-[10.5px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">{label}</div>
      {cols.map((_, i) => (
        <div key={i} className="border-l border-border/40" style={{ background: tintFor(i).head }} />
      ))}
    </div>
  );


  const Cell = ({
    value, format, tone, best, showDelta, baseVal, goodIfHigh, subtle, colIdx,
  }: {
    value: number | null;
    format: (n: number) => string;
    tone?: "hero" | "strong" | "default";
    best?: boolean;
    showDelta?: boolean;
    baseVal?: number | null;
    goodIfHigh?: boolean;
    subtle?: string;
    colIdx: number;
  }) => {
    const t = tintFor(colIdx);
    const bg = tone === "hero" || tone === "strong" ? t.strong : t.bg;
    if (value === null) {
      return (
        <div className="flex items-center justify-end border-l border-border/40 px-6 py-3 text-[12.5px] text-muted-foreground/40" style={{ background: bg }}>—</div>
      );
    }
    const delta = showDelta && baseVal !== undefined && baseVal !== null ? value - baseVal : 0;
    const better = goodIfHigh ? delta > 0 : delta < 0;
    return (
      <div
        className={cn(
          "flex items-baseline justify-end gap-2 pr-6 pl-4 border-l border-border/40",
          tone === "hero" ? "py-4" : "py-3",
        )}
        style={{ background: bg }}
      >
        <span className={cn(
          "num tabular-nums",
          tone === "hero" ? "text-[18px] font-display font-semibold tracking-tight" :
          tone === "strong" ? "text-[14px] font-display font-semibold" :
          "text-[13px] text-foreground/85",
          best && tone !== "hero" && "text-success font-semibold",
        )}>
          {format(value)}
        </span>
        {subtle && (
          <span className="text-[10px] text-muted-foreground">{subtle}</span>
        )}
        {best && tone !== "hero" && (
          <span className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-success uppercase tracking-wider">
            <Check className="size-2.5" /> best
          </span>
        )}
        {showDelta && Math.abs(delta) > 0.005 && (
          <span className={cn("text-[10px] num", better ? "text-success" : "text-risk")}>
            {better ? "↑" : "↓"}{format(Math.abs(delta))}
          </span>
        )}
      </div>
    );
  };


  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1280px] mx-auto px-8 py-6 space-y-5">
        {/* Title strip */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Pill tone="opportunity">Compare</Pill>
              <span className="text-[11.5px] text-muted-foreground">
                Read-only trade-offs · adjust only Target Margin to see the commercial swing
              </span>
            </div>
            <h1 className="mt-1 font-display text-[22px] leading-tight tracking-tight font-semibold">
              Cost Comparison · {cols.filter(Boolean).length} scenarios
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onExit}
              className="h-8 px-3 rounded-md border border-border bg-card text-[12px] font-medium flex items-center gap-1.5 hover:bg-secondary/60"
            >
              <X className="size-3.5" /> Exit Compare
            </button>
            <button className="h-8 px-3 rounded-md border border-border bg-card text-[12px] font-medium flex items-center gap-1.5 hover:bg-secondary/60">
              <Download className="size-3.5" /> Export
            </button>
            <button className="h-8 px-3 rounded-md bg-foreground text-background text-[12px] font-medium flex items-center gap-1.5 hover:bg-foreground/90">
              <ArrowUpRight className="size-3.5" /> Quote Selected
            </button>
          </div>
        </div>

        {/* The comparison table — full-height, no floating cards */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          {/* Column headers — dark navy */}
          <div className={cn("grid", gridCols)}>
            <div className="bg-card" />
            {cols.map((s, idx) => {
              if (!s) {
                return (
                  <div
                    key={idx}
                    className="h-full min-h-[88px] border-l border-border bg-secondary/20"
                  />
                );
              }
              const isVerdict = idx === verdictIdx;
              const t = tintFor(idx);
              return (
                <div
                  key={idx}
                  className={cn(
                    "relative px-4 py-4 border-l border-border/40 text-foreground",
                    isVerdict && "shadow-[inset_0_3px_0_0_#F4FBFF]",
                  )}
                  style={{ background: t.head }}
                >
                  {isVerdict && (
                    <div className="absolute -top-0 right-3 translate-y-[-50%] flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-foreground bg-[#F4FBFF] rounded-full px-2 py-0.5 shadow-sm">
                      <Sparkles className="size-2.5" /> AI Pick
                    </div>
                  )}
                  <select
                    value={s.id}
                    onChange={(e) => onChangeColumn(idx, e.target.value || null)}
                    className={cn(
                      "bg-transparent text-[15px] font-display font-semibold tracking-tight w-full focus:outline-none cursor-pointer appearance-none",
                      isVerdict ? "text-[oklch(0.45_0.19_255)]" : "text-foreground",
                    )}
                  >
                    {idx > 0 && <option value="">— None —</option>}
                    {available.map((sc) => (
                      <option
                        key={sc.id}
                        value={sc.id}
                        disabled={selectedIds.includes(sc.id) && sc.id !== s.id}
                      >
                        {sc.name}
                      </option>
                    ))}
                  </select>

                  <div className="text-[11px] text-foreground/60 mt-0.5">
                    {(() => {
                      const diffs = changedVariables(s, baseSelection);
                      if (diffs.length === 0) return "Baseline · no overrides";
                      return diffs.slice(0, 2).map((d) => d.to).join(" · ")
                        + (diffs.length > 2 ? ` · +${diffs.length - 2} more` : "");
                    })()}
                  </div>
                </div>
              );
            })}
          </div>



          {/* FABRIC */}
          <GroupHeader label="Fabric (per pc)" />
          {fabricRows.map((r) => {
            const vals = computes.map((c) => (c ? c.costs[r.key] : null));
            const bi = bestIdx(vals, false);
            return (
              <RowShell key={r.key} label={r.label}>
                {vals.map((v, i) => (
                  <Cell key={i} colIdx={i} value={v} format={(n) => `$${n.toFixed(2)}`} best={i === bi} />
                ))}
              </RowShell>
            );
          })}

          {/* MAKING */}
          <GroupHeader label="Making (per pc)" />
          {makingRows.map((r) => {
            const vals = computes.map((c) => (c ? c.costs[r.key] : null));
            const bi = bestIdx(vals, false);
            return (
              <RowShell key={r.key} label={r.label}>
                {vals.map((v, i) => (
                  <Cell key={i} colIdx={i} value={v} format={(n) => `$${n.toFixed(2)}`} best={i === bi} />
                ))}
              </RowShell>
            );
          })}
          <RowShell label="Subtotal Making" tone="strong">
            {computes.map((c, i) => {
              const v = c ? makingRows.reduce((s, r) => s + c.costs[r.key], 0) : null;
              const vals = computes.map((cc) => cc ? makingRows.reduce((s, r) => s + cc.costs[r.key], 0) : null);
              const bi = bestIdx(vals, false);
              return <Cell key={i} colIdx={i} value={v} format={(n) => `$${n.toFixed(2)}`} tone="strong" best={i === bi} />;
            })}
          </RowShell>

          {/* OVERHEADS */}
          <GroupHeader label="Overheads (per pc)" />
          {overheadRows.map((r) => {
            const vals = computes.map((c) => (c ? c.costs[r.key] : null));
            const bi = bestIdx(vals, false);
            return (
              <RowShell key={r.key} label={r.label}>
                {vals.map((v, i) => (
                  <Cell key={i} colIdx={i} value={v} format={(n) => `$${n.toFixed(2)}`} best={i === bi} />
                ))}
              </RowShell>
            );
          })}
          <RowShell label="Setup / MOQ amortization">
            {computes.map((c, i) => {
              const v = c ? overheadFor(c) : null;
              const vals = computes.map((cc) => cc ? overheadFor(cc) : null);
              const bi = bestIdx(vals, false);
              return (
                <Cell
                  key={i} colIdx={i}

                  value={v}
                  format={(n) => `$${n.toFixed(2)}`}
                  best={i === bi}
                  subtle={c ? `${c.qty.toLocaleString()} pcs` : undefined}
                />
              );
            })}
          </RowShell>

          {/* PRICING SUMMARY */}
          <GroupHeader label="Pricing summary" />
          <RowShell label="Unit Cost" tone="strong">
            {computes.map((c, i) => {
              const vals = computes.map((cc) => cc?.unitCost ?? null);
              const bi = bestIdx(vals, false);
              return <Cell key={i} colIdx={i} value={c?.unitCost ?? null} format={(n) => `$${n.toFixed(2)}`} tone="strong" best={i === bi} />;
            })}
          </RowShell>

          {/* EDITABLE — Target Margin */}
          <div className={cn("grid items-stretch border-t border-border/50", gridCols)}>
            <div className="flex items-center gap-1.5 px-5 py-4">
              <span className="text-[12px] font-medium text-foreground">Target Margin</span>
              <span className="text-[9px] font-semibold uppercase tracking-wider text-opportunity bg-opportunity/10 rounded px-1.5 py-0.5">
                editable
              </span>
            </div>
            {computes.map((c, i) => {
              const s = cols[i];
              const t = tintFor(i);
              if (!c || !s) return <div key={i} className="border-l border-border/40" style={{ background: t.strong }} />;
              const mg = marginFor(i);
              const isOverridden = marginOverrides[s.id] !== undefined;
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 px-4 py-4 border-l border-border/40"
                  style={{ background: t.strong }}
                >
                  <input
                    type="range"
                    min={5}
                    max={45}
                    step={0.5}
                    value={mg}
                    onChange={(e) => setMarginFor(i, Number(e.target.value))}
                    className="flex-1 accent-foreground h-1 cursor-pointer"
                  />
                  <div className="flex items-baseline gap-1 w-[86px] justify-end">
                    <span className="text-[15px] num font-display font-semibold tabular-nums">{mg.toFixed(1)}</span>
                    <span className="text-[10.5px] text-muted-foreground">%</span>
                    {isOverridden && (
                      <button
                        onClick={() => resetMargin(i)}
                        className="ml-1 text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                      >
                        reset
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>


          <RowShell label="Selling Price" tone="hero">
            {computes.map((c, i) => (
              <Cell key={i} colIdx={i} value={c?.price ?? null} format={fmtPrice} tone="hero" />
            ))}
          </RowShell>
          <RowShell label="Order Profit" sub={cols[0] ? `× ${baseComputes[0]?.qty.toLocaleString()} pcs` : undefined}>
            {computes.map((c, i) => {
              const vals = computes.map((cc) => cc?.orderProfit ?? null);
              const bi = bestIdx(vals, true);
              return <Cell key={i} colIdx={i} value={c?.orderProfit ?? null} format={(n) => fmtUsd(n, { compact: true })} best={i === bi} tone="strong" />;
            })}
          </RowShell>
          <RowShell label="Annual Profit" sub={`× ${BASE.annualMultiplier} repeat`}>
            {computes.map((c, i) => {
              const vals = computes.map((cc) => cc?.annualProfit ?? null);
              const bi = bestIdx(vals, true);
              return <Cell key={i} colIdx={i} value={c?.annualProfit ?? null} format={(n) => fmtUsd(n, { compact: true })} best={i === bi} tone="strong" showDelta baseVal={vals[0]} goodIfHigh />;
            })}
          </RowShell>
          <RowShell label="Buyer Acceptance">
            {computes.map((c, i) => {
              const vals = computes.map((cc) => cc?.acceptance ?? null);
              const bi = bestIdx(vals, true);
              return <Cell key={i} colIdx={i} value={c?.acceptance ?? null} format={(n) => `${Math.round(n)}%`} best={i === bi} />;
            })}
          </RowShell>
          <RowShell label="Break-even">
            {computes.map((c, i) => {
              const vals = computes.map((cc) => cc?.breakEven ?? null);
              const bi = bestIdx(vals, false);
              return <Cell key={i} colIdx={i} value={c?.breakEven ?? null} format={(n) => `${Math.round(n).toLocaleString()} pcs`} best={i === bi} />;
            })}
          </RowShell>
          <RowShell label="Lead Time">
            {computes.map((c, i) => {
              const vals = computes.map((cc) => cc?.leadTime ?? null);
              const bi = bestIdx(vals, false);
              return <Cell key={i} colIdx={i} value={c?.leadTime ?? null} format={(n) => `${n.toFixed(1)} wk`} best={i === bi} />;
            })}
          </RowShell>

          {/* Quote selection footer */}
          <div className={cn("grid items-stretch border-t border-border", gridCols)}>
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider bg-secondary/40 px-5 py-4 flex items-center">Include in quote</div>
            {cols.map((s, i) => {
              const c = computes[i];
              const t = tintFor(i);
              if (!s || !c) return <div key={i} className="border-l border-border/40" style={{ background: t.head }} />;
              const on = !!quoteSel[s.id];
              return (
                <label
                  key={i}
                  className="flex items-center gap-2 px-4 py-4 justify-end cursor-pointer group border-l border-border/40"
                  style={{ background: t.head }}
                >
                  <span className={cn("text-[12px]", on ? "text-foreground font-medium" : "text-foreground/70")}>
                    {fmtPrice(c.price)}
                  </span>
                  <span
                    onClick={(e) => { e.preventDefault(); toggleQuote(s.id); }}
                    className={cn(
                      "size-4 rounded border-2 grid place-items-center transition",
                      on ? "bg-foreground border-foreground" : "border-border group-hover:border-foreground/50",
                    )}
                  >
                    {on && <Check className="size-2.5 text-background" strokeWidth={3} />}
                  </span>
                </label>
              );
            })}
          </div>

        </div>

      </div>
    </div>
  );
}

// Right-side intelligence panel shown while in Compare mode.
function CompareIntelligencePanel({
  scenarios,
  selectedIds,
  baseSelection,
  marginOverrides,
  onPromote,
  onExit,
}: {
  scenarios: Scenario[];
  selectedIds: ScenarioId[];
  baseSelection: Selection;
  marginOverrides: Record<string, number>;
  onPromote: (id: ScenarioId) => void;
  onExit: () => void;
}) {
  const available = scenarios.filter((s) => !s.archived);
  const cols = selectedIds.map((id) => available.find((s) => s.id === id) ?? null);
  const rows = cols.map((s) => {
    if (!s) return null;
    const c = compute(s.selection);
    const mg = Math.min(60, Math.max(3, marginOverrides[s.id] ?? c.margin));
    const price = c.unitCost / (1 - mg / 100);
    const profitPerPc = price - c.unitCost;
    const orderProfit = profitPerPc * c.qty;
    const annualProfit = orderProfit * BASE.annualMultiplier;
    return { s, c, mg, price, profitPerPc, orderProfit, annualProfit };
  });

  const valid = rows.filter((r): r is NonNullable<typeof r> => r !== null);
  const winner = valid.reduce<typeof valid[number] | null>(
    (acc, r) => (!acc || r.annualProfit > acc.annualProfit ? r : acc),
    null,
  );
  const base = rows[0];

  const reasons: string[] = [];
  if (winner && base && winner.s.id !== base.s.id) {
    const uplift = winner.annualProfit - base.annualProfit;
    if (uplift > 0) reasons.push(`+${fmtUsd(uplift, { compact: true })} annual profit vs ${base.s.name}`);
    if (winner.mg > base.mg) reasons.push(`Holds a stronger ${winner.mg.toFixed(1)}% margin`);
    else if (winner.mg < base.mg) reasons.push(`Wins even at a leaner ${winner.mg.toFixed(1)}% margin`);
    if (winner.c.unitCost < base.c.unitCost) reasons.push(`Unit cost trimmed by ${fmtUsd(base.c.unitCost - winner.c.unitCost)}`);
    if (winner.c.acceptance >= base.c.acceptance) reasons.push(`Buyer acceptance ${Math.round(winner.c.acceptance)}%`);
    const diffs = changedVariables(winner.s, baseSelection);
    if (diffs.length) reasons.push(`Levers: ${diffs.slice(0, 2).map((d) => d.to).join(" · ")}`);
  } else if (winner) {
    reasons.push(`Baseline scenario leads at ${fmtUsd(winner.annualProfit, { compact: true })} annual profit`);
  }

  return (
    <aside className="w-[380px] shrink-0 border-l border-border bg-surface/40 flex flex-col h-full">
      <div className="h-14 px-5 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-opportunity-soft text-opportunity grid place-items-center">
            <Sparkles className="size-3.5" />
          </div>
          <span className="text-[13px] font-display font-semibold tracking-tight">Compare Intelligence</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Pill tone="opportunity">AI Verdict</Pill>
          <button
            onClick={onExit}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11.5px] font-medium border border-border text-foreground hover:bg-secondary transition-colors"
          >
            <X className="size-3" /> Exit Compare
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {winner && (
          <section className="px-5 py-5 border-b border-border animate-surface-in" key={winner.s.id}>
            <SectionLabel>Best Scenario</SectionLabel>
            <div className="mt-2 text-[18px] font-display font-semibold tracking-tight">{winner.s.name}</div>
            <div className="mt-0.5 text-[11.5px] text-muted-foreground">
              Highest annual profit across selected scenarios
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Annual Profit</div>
                <div className="text-[16px] font-display font-semibold num mt-0.5">{fmtUsd(winner.annualProfit, { compact: true })}</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Margin</div>
                <div className="text-[16px] font-display font-semibold num mt-0.5">{winner.mg.toFixed(1)}%</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Selling Price</div>
                <div className="text-[16px] font-display font-semibold num mt-0.5">{fmtPrice(winner.price)}</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Acceptance</div>
                <div className="text-[16px] font-display font-semibold num mt-0.5">{Math.round(winner.c.acceptance)}%</div>
              </div>
            </div>

            <button
              onClick={() => onPromote(winner.s.id)}
              className="mt-4 w-full h-9 rounded-md text-[12.5px] font-medium bg-foreground text-background hover:bg-foreground/90 flex items-center justify-center gap-1.5"
            >
              <Star className="size-3.5" /> Promote to Current
            </button>
          </section>
        )}

        {reasons.length > 0 && (
          <section className="px-5 py-5 border-b border-border">
            <SectionLabel>Why it wins</SectionLabel>
            <ul className="mt-2 space-y-2">
              {reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px] text-foreground/85">
                  <Check className="size-3.5 mt-0.5 text-success shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="px-5 py-5">
          <SectionLabel>Ranking</SectionLabel>
          <div className="mt-2 space-y-2">
            {[...valid]
              .sort((a, b) => b.annualProfit - a.annualProfit)
              .map((r, i) => {
                const isWin = winner && r.s.id === winner.s.id;
                const delta = base ? r.annualProfit - base.annualProfit : 0;
                return (
                  <div
                    key={r.s.id}
                    className={cn(
                      "rounded-lg border p-3 flex items-center justify-between gap-3",
                      isWin ? "border-opportunity/40 bg-opportunity-soft/25" : "border-border bg-card",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium truncate">
                        <span className="text-muted-foreground mr-1.5 num">#{i + 1}</span>
                        {r.s.name}
                      </div>
                      <div className="text-[10.5px] text-muted-foreground mt-0.5">
                        {r.mg.toFixed(1)}% margin · {Math.round(r.c.acceptance)}% accept
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[13px] font-display font-semibold num">{fmtUsd(r.annualProfit, { compact: true })}</div>
                      {base && r.s.id !== base.s.id && (
                        <div className={cn("text-[10px] num", delta >= 0 ? "text-success" : "text-risk")}>
                          {delta >= 0 ? "+" : "−"}{fmtUsd(Math.abs(delta), { compact: true })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      </div>
    </aside>
  );
}




// ─────────────────────────────────────────────────────────────────────────────
// Shell
// ─────────────────────────────────────────────────────────────────────────────

export function CommercialStudio({ products }: { products?: { id: string; name: string }[] } = {}) {
  const seededScenarios = useMemo<Scenario[]>(() => {
    if (!products || products.length === 0) return SEED_SCENARIOS;
    // Rename the default "Current" scenario to the first product name so the
    // context is clear, but keep the strategy-based scenario set intact.
    return SEED_SCENARIOS.map((s) =>
      s.id === "current" ? { ...s, name: products[0].name } : s,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [scenarios, setScenarios] = useState<Scenario[]>(seededScenarios);
  const [activeId, setActiveId] = useState<ScenarioId>(seededScenarios[0].id);
  const [focusedId, setFocusedId] = useState<VariableId>("moq");
  const [expandedId, setExpandedId] = useState<VariableId | null>("moq");
  const [lastChanged, setLastChanged] = useState<VariableId | null>(null);
  const [prevSelection, setPrevSelection] = useState<Selection>(initialSelection);
  const [explainOpen, setExplainOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<ScenarioId | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<ScenarioId[]>(["current", "highMoq"]);
  const [compareMarginOverrides, setCompareMarginOverrides] = useState<Record<string, number>>({});

  // Per-scenario decision timeline + redo stack
  const [timelines, setTimelines] = useState<Record<ScenarioId, TimelineEntry[]>>({});
  const [redoStacks, setRedoStacks] = useState<Record<ScenarioId, { entry: TimelineEntry; selection: Selection }[]>>({});

  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0];
  const selection = active.selection;

  const current = useMemo(() => compute(selection), [selection]);
  const baseline = useMemo(() => compute(initialSelection), []);
  const prevCompute = useMemo(() => compute(prevSelection), [prevSelection]);

  const updateActiveSelection = (next: Selection) => {
    setScenarios((all) => all.map((s) => (s.id === activeId ? { ...s, selection: next } : s)));
  };

  const selectOption = (id: VariableId, i: number) => {
    const prevSel = selection;
    const nextSel = { ...selection, [id]: i };
    const prevC = compute(prevSel);
    const nextC = compute(nextSel);
    const def = VAR_MAP[id];
    const entry: TimelineEntry = {
      id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time: Date.now(),
      varId: id,
      fromLabel: def.options[prevSel[id]].label,
      toLabel: def.options[i].label,
      dMargin: nextC.margin - prevC.margin,
      dProfit: nextC.annualProfit - prevC.annualProfit,
      dAccept: nextC.acceptance - prevC.acceptance,
    };
    setPrevSelection(prevSel);
    updateActiveSelection(nextSel);
    setLastChanged(id);
    setFocusedId(id);
    setTimelines((t) => ({ ...t, [activeId]: [...(t[activeId] ?? []), entry] }));
    setRedoStacks((r) => ({ ...r, [activeId]: [] }));
  };

  const applyRecommendation = (id: VariableId) => {
    selectOption(id, VAR_MAP[id].recommendedIndex);
    setExpandedId(id);
  };

  const undo = () => {
    const list = timelines[activeId] ?? [];
    if (list.length === 0) return;
    const last = list[list.length - 1];
    // Reconstruct the prior selection by reversing this single change
    const def = VAR_MAP[last.varId];
    const fromIdx = def.options.findIndex((o) => o.label === last.fromLabel);
    if (fromIdx < 0) return;
    const restored = { ...selection, [last.varId]: fromIdx };
    setPrevSelection(selection);
    updateActiveSelection(restored);
    setLastChanged(last.varId);
    setTimelines((t) => ({ ...t, [activeId]: list.slice(0, -1) }));
    setRedoStacks((r) => ({ ...r, [activeId]: [...(r[activeId] ?? []), { entry: last, selection }] }));
  };

  const redo = () => {
    const stack = redoStacks[activeId] ?? [];
    if (stack.length === 0) return;
    const top = stack[stack.length - 1];
    setPrevSelection(selection);
    updateActiveSelection(top.selection);
    setLastChanged(top.entry.varId);
    setRedoStacks((r) => ({ ...r, [activeId]: stack.slice(0, -1) }));
    setTimelines((t) => ({ ...t, [activeId]: [...(t[activeId] ?? []), top.entry] }));
  };

  const toggleExpand = (id: VariableId) => setExpandedId((cur) => (cur === id ? null : id));


  // ── Scenario actions
  const createScenario = (input: {
    name: string;
    baseId: ScenarioId;
    mode: "empty" | "duplicate" | "ai";
    aiObjective?: AiObjective;
  }) => {
    const base = scenarios.find((s) => s.id === input.baseId) ?? scenarios[0];
    let sel: Selection;
    if (input.mode === "empty") sel = { ...initialSelection };
    else if (input.mode === "duplicate") sel = { ...base.selection };
    else sel = generateAiSelection(base.selection, input.aiObjective ?? "auto");
    const id = `s-${Date.now()}`;
    const sc: Scenario = {
      id,
      name: input.name,
      selection: sel,
      baseId: base.id,
      archived: false,
      aiObjective: input.aiObjective,
    };
    setScenarios((all) => [...all, sc]);
    setActiveId(id);
    setCreateOpen(false);
    setCompareMode(false);
  };

  const renameScenario = (id: ScenarioId) => {
    const sc = scenarios.find((s) => s.id === id);
    if (!sc) return;
    const name = window.prompt("Rename scenario", sc.name);
    if (name && name.trim()) {
      setScenarios((all) => all.map((s) => (s.id === id ? { ...s, name: name.trim() } : s)));
    }
  };

  const duplicateScenario = (id: ScenarioId) => {
    const sc = scenarios.find((s) => s.id === id);
    if (!sc) return;
    const newId = `s-${Date.now()}`;
    setScenarios((all) => [...all, { ...sc, id: newId, name: `${sc.name} copy`, baseId: sc.id }]);
    setActiveId(newId);
  };

  const archiveScenario = (id: ScenarioId) => {
    setScenarios((all) => all.map((s) => (s.id === id ? { ...s, archived: true } : s)));
    if (activeId === id) setActiveId("current");
  };

  const deleteScenario = (id: ScenarioId) => {
    if (id === "current") return;
    setScenarios((all) => all.filter((s) => s.id !== id));
    if (activeId === id) setActiveId("current");
    setCompareIds((ids) => ids.filter((x) => x !== id));
  };

  const promoteScenario = (id: ScenarioId) => {
    const promoted = scenarios.find((s) => s.id === id);
    if (!promoted) return;
    setScenarios((all) =>
      all.map((s) => {
        if (s.id === "current") return { ...s, selection: promoted.selection, name: "Current" };
        if (s.id === id) return { ...s, archived: true };
        return s;
      }),
    );
    setActiveId("current");
    setCompareMode(false);
  };

  const setCompareColumn = (idx: number, id: ScenarioId | null) => {
    setCompareIds((ids) => {
      const next = [...ids];
      if (id === null) next.splice(idx, 1);
      else next[idx] = id;
      // dedupe
      const seen = new Set<string>();
      return next.filter((x) => {
        if (seen.has(x)) return false;
        seen.add(x);
        return true;
      }).slice(0, 3);
    });
  };

  const toggleCompare = () => {
    setCompareMode((m) => {
      const next = !m;
      if (next) {
        const others = scenarios.filter((s) => !s.archived && s.id !== "current");
        const seed = ["current", ...others.slice(0, 2).map((s) => s.id)];
        setCompareIds(seed.length >= 2 ? seed : ["current"]);
      }
      return next;
    });
  };

  const menuScenario = menuFor ? scenarios.find((s) => s.id === menuFor) : null;

  const [currency, setCurrency] = useState<CcyCode>("USD");
  const changeCurrency = (c: CcyCode) => { setActiveCurrency(c); setCurrency(c); };

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [rightView, setRightView] = useState<RightView>("overview");

  const topBar = (
    <div className="h-14 shrink-0 border-b border-border flex items-center px-4 gap-3 bg-background/85 backdrop-blur-md z-30">
      {leftCollapsed && (
        <button
          onClick={() => setLeftCollapsed(false)}
          className="size-8 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground grid place-items-center"
          title="Expand left panel"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}
      <div className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground pr-2 border-r border-border/60 mr-1">
        <span className="hover:text-foreground cursor-pointer">Enquiries</span>
        <span className="opacity-40">/</span>
        <span className="text-foreground font-medium">ENQ-2841</span>
      </div>
      <div className="flex items-center gap-1.5 text-[12px] text-foreground/85 truncate">
        <GitBranch className="size-3 text-muted-foreground" />
        <span className="font-medium truncate">
          {scenarios.find((s) => s.id === activeId)?.name ?? "Current"}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden md:flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          Live
        </span>
        <CurrencySelect value={currency} onChange={changeCurrency} />
        {rightCollapsed && (
          <button
            onClick={() => setRightCollapsed(false)}
            className="size-8 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground grid place-items-center"
            title="Expand right panel"
          >
            <PanelRightOpen className="size-4" />
          </button>
        )}
      </div>
    </div>
  );


  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      {topBar}
      <div className="flex-1 min-h-0 flex">
        {!compareMode && !leftCollapsed && (
          <LeftPane
            selection={selection}
            focusedId={focusedId}
            expandedId={expandedId}
            base={current}
            onFocus={setFocusedId}
            onToggle={toggleExpand}
            onSelect={selectOption}
            onCollapse={() => setLeftCollapsed(true)}
          />
        )}
        {compareMode ? (
          <main className="flex-1 min-w-0 flex flex-col h-full bg-background">
            <CompareView
              scenarios={scenarios}
              selectedIds={compareIds}
              baseSelection={scenarios.find((s) => s.id === "current")?.selection ?? initialSelection}
              onChangeColumn={setCompareColumn}
              onPromote={promoteScenario}
              marginOverrides={compareMarginOverrides}
              setMarginOverrides={setCompareMarginOverrides}
              onExit={() => setCompareMode(false)}
            />
          </main>
        ) : (
          <CenterPane
            selection={selection}
            current={current}
            baseline={baseline}
            lastChanged={lastChanged}
            prevCompute={prevCompute}
            focusedId={focusedId}
            timeline={timelines[activeId] ?? []}
            canUndo={(timelines[activeId] ?? []).length > 0}
            canRedo={(redoStacks[activeId] ?? []).length > 0}
            onUndo={undo}
            onRedo={redo}
            onExportPrice={() => setExplainOpen(true)}
            onFocus={(id) => { setFocusedId(id); setExpandedId(id); }}
            onApply={selectOption}
          />
        )}
        {compareMode ? (
          <CompareIntelligencePanel
            scenarios={scenarios}
            selectedIds={compareIds}
            baseSelection={scenarios.find((s) => s.id === "current")?.selection ?? initialSelection}
            marginOverrides={compareMarginOverrides}
            onPromote={promoteScenario}
            onExit={() => setCompareMode(false)}
          />
        ) : (
          <>
            {!rightCollapsed && (
              <RightPane
                selection={selection}
                current={current}
                baseline={baseline}
                focusedId={focusedId}
                scenarios={scenarios}
                activeScenarioId={activeId}
                view={rightView}
                onViewChange={setRightView}
                onSelectScenario={(id) => { setActiveId(id); setCompareMode(false); }}
                onScenarioMenu={(id) => setMenuFor(id)}
                onCompareToggle={toggleCompare}
                compareMode={compareMode}
                onApply={applyRecommendation}
                onExplain={() => setExplainOpen(true)}
                onCollapse={() => setRightCollapsed(true)}
              />
            )}
            <RightRail
              view={rightView}
              onView={(v) => { setRightView(v); if (rightCollapsed) setRightCollapsed(false); }}
            />
          </>
        )}

      </div>

      {explainOpen && (
        <ExplainModal
          selection={selection}
          current={current}
          baseline={baseline}
          onClose={() => setExplainOpen(false)}
        />
      )}
      {createOpen && (
        <CreateScenarioModal
          scenarios={scenarios}
          defaultBaseId={activeId}
          onClose={() => setCreateOpen(false)}
          onCreate={createScenario}
        />
      )}
      {menuScenario && (
        <ScenarioActionMenu
          scenario={menuScenario}
          isCurrent={menuScenario.id === "current"}
          onClose={() => setMenuFor(null)}
          onRename={() => renameScenario(menuScenario.id)}
          onDuplicate={() => duplicateScenario(menuScenario.id)}
          onArchive={() => archiveScenario(menuScenario.id)}
          onDelete={() => deleteScenario(menuScenario.id)}
          onPromote={() => promoteScenario(menuScenario.id)}
          onExport={() => setExplainOpen(true)}
          onBuyerExplain={() => setExplainOpen(true)}
          onInternalSummary={() => setExplainOpen(true)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Commercial Summary — top of Overview
// ─────────────────────────────────────────────────────────────────────────────

function CommercialSummary({ current, baseline }: { current: Compute; baseline: Compute }) {
  const targetCost = baseline.unitCost * 0.96;
  const budgetTotal = baseline.unitCost * baseline.qty * 1.05;
  const budgetUsed = current.unitCost * current.qty;
  const budgetRemainingPct = Math.max(0, Math.min(100, ((budgetTotal - budgetUsed) / budgetTotal) * 100));
  const confidence = Math.max(30, Math.min(98, Math.round(60 + current.margin * 1.4 + (current.acceptance - 65) * 0.3)));
  const leadFit = current.leadTime <= BASE.leadTime;
  const readiness =
    current.margin >= 14 && current.acceptance >= 65 && leadFit
      ? { label: "Ready to quote", tone: "success" as const }
      : current.margin >= 10 && current.acceptance >= 55
        ? { label: "Needs review", tone: "warning" as const }
        : { label: "Not ready", tone: "risk" as const };

  const tint = (t: "success" | "warning" | "risk") =>
    t === "success" ? "text-success" : t === "warning" ? "text-warning" : "text-risk";
  const marginTone: "success" | "warning" | "risk" =
    current.margin >= 14 ? "success" : current.margin >= 10 ? "warning" : "risk";
  const costTone: "success" | "warning" | "risk" =
    current.unitCost <= targetCost ? "success" : current.unitCost <= targetCost * 1.05 ? "warning" : "risk";

  const items: { k: string; v: string; sub?: string; hint: string; tone?: "success" | "warning" | "risk" }[] = [
    { k: "Live Cost", v: fmtPrice(current.unitCost), sub: "per piece", hint: "Sum of every cost lever at the current scenario.", tone: costTone },
    { k: "Target Cost", v: fmtPrice(targetCost), sub: "per piece", hint: "Buyer-anchored target derived from the baseline programme." },
    { k: "Margin", v: `${current.margin.toFixed(1)}%`, sub: `floor 14%`, hint: "Gross margin at current sell price. 14% is the commercial floor.", tone: marginTone },
    { k: "Budget Remaining", v: `${budgetRemainingPct.toFixed(0)}%`, sub: "of programme", hint: "Share of the buyer's programme budget still available at this cost." },
    { k: "Confidence", v: `${confidence}%`, sub: "model", hint: "Composite confidence from margin, acceptance and supplier data freshness." },
    { k: "Lead Time", v: `${current.leadTime.toFixed(0)} wk`, sub: `plan ${BASE.leadTime}w`, hint: "Total weeks from PO to on-water shipment.", tone: leadFit ? "success" : "risk" },
  ];

  return (
    <section className="px-4 py-4 border-b border-border space-y-2">
      <SectionLabel>Commercial Summary</SectionLabel>
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2.5">
          {items.map((it) => (
            <div
              key={it.k}
              title={it.hint}
              className="rounded-md border border-border/60 bg-background/60 px-2.5 py-2 hover:border-brand-700/30 hover:bg-brand-50/40 transition-colors"
            >
              <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                {it.k}
                <Info className="size-2.5 opacity-60" />
              </div>
              <div className={cn("text-[13px] num font-semibold mt-0.5", it.tone ? tint(it.tone) : "text-foreground")}>
                {it.v}
              </div>
              {it.sub && <div className="text-[9.5px] text-muted-foreground mt-0.5">{it.sub}</div>}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-md bg-background/60 border border-border/60 px-3 py-2">
          <div>
            <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold">Commercial Readiness</div>
            <div className={cn("text-[12.5px] font-semibold mt-0.5", tint(readiness.tone))}>{readiness.label}</div>
          </div>
          <span
            className={cn(
              "size-2 rounded-full",
              readiness.tone === "success" ? "bg-success" : readiness.tone === "warning" ? "bg-warning" : "bg-risk",
            )}
          />
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recommendations view — right panel
// ─────────────────────────────────────────────────────────────────────────────

function RecommendationsView({
  selection,
  current,
  onApply,
}: {
  selection: Selection;
  current: Compute;
  onApply: (id: VariableId) => void;
}) {
  const opps = useMemo(() => rankOpportunities(selection, current), [selection, current]);
  if (opps.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-6 text-center">
        <Lightbulb className="size-6 text-brand-700 mx-auto mb-2" />
        <div className="text-[12.5px] font-medium">No open recommendations</div>
        <div className="text-[11px] text-muted-foreground mt-1">
          Every lever sits on the AI pick for this scenario.
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
      <SectionLabel>AI Recommendations</SectionLabel>
      <div className="space-y-2 pt-1">
        {opps.map((o, i) => {
          const confidence = Math.max(55, Math.min(96, Math.round(70 + o.deltaMargin * 2)));
          return (
            <div
              key={o.v.id}
              title={o.v.rationale}
              className="rounded-lg border border-border bg-card p-3 hover:border-brand-700/30 hover:shadow-[0_4px_20px_-8px_rgba(5,96,77,0.15)] transition-all"
            >
              <div className="flex items-start gap-2">
                <div className="size-5 rounded-md bg-brand-50 text-brand-700 grid place-items-center shrink-0 text-[10px] font-semibold">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-medium truncate">
                    {o.v.name} → {o.nextLabel}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
                    {o.v.rationale}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                <div className="rounded-md bg-success-soft/50 px-2 py-1">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Annual</div>
                  <div className="text-[11px] num font-semibold text-success">
                    +{fmtUsd(o.deltaProfit, { compact: true })}
                  </div>
                </div>
                <div className="rounded-md bg-secondary/60 px-2 py-1">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Margin</div>
                  <div className="text-[11px] num font-semibold text-foreground">
                    {fmtDelta(o.deltaMargin, 1)}pt
                  </div>
                </div>
                <div className="rounded-md bg-secondary/60 px-2 py-1">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Conf</div>
                  <div className="text-[11px] num font-semibold text-foreground">{confidence}%</div>
                </div>
              </div>
              <button
                onClick={() => onApply(o.v.id)}
                className="mt-2.5 w-full py-1.5 rounded-md text-[11.5px] font-medium bg-brand-700 text-primary-foreground hover:bg-brand-800 transition-colors flex items-center justify-center gap-1"
              >
                Apply <ArrowRight className="size-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cost Allocation Ribbon — segmented bar of the sell price
// ─────────────────────────────────────────────────────────────────────────────

const RIBBON_CATEGORIES: {
  key: string;
  label: string;
  color: string;
  breakdown: { label: string; hint?: string }[];
  optimisation?: string;
  costKeys?: CostKey[];
}[] = [
  {
    key: "material",
    label: "Material",
    color: "var(--color-brand-700)",
    breakdown: [
      { label: "Front Fabric" },
      { label: "Construction" },
      { label: "Supplier Premium" },
      { label: "Waste Allowance" },
      { label: "Shrinkage" },
    ],
    optimisation: "Switching to Supplier B could reduce material cost by ~$0.18 per unit.",
    costKeys: ["fabric"],
  },
  {
    key: "making",
    label: "Making",
    color: "var(--color-brand-500)",
    breakdown: [
      { label: "Cutting" },
      { label: "Stitching" },
      { label: "Finishing" },
      { label: "QC" },
    ],
    optimisation: "Batching with programme #2293326 saves ~4% on making cost.",
    costKeys: ["processing"],
  },
  {
    key: "packaging",
    label: "Packaging",
    color: "var(--color-gold-500)",
    breakdown: [
      { label: "PVC Bag" },
      { label: "Insert Card" },
      { label: "Hangtag" },
    ],
    optimisation: "Drop insert card for -$0.07/pc; acceptance impact −6pt.",
    costKeys: ["packaging"],
  },
  {
    key: "testing",
    label: "Testing",
    color: "var(--color-gold-600)",
    breakdown: [
      { label: "Physical Tests" },
      { label: "Chemical Compliance" },
      { label: "Certification Audits" },
    ],
    costKeys: ["testing", "certification"],
  },
  {
    key: "transport",
    label: "Transport",
    color: "var(--color-brand-800)",
    breakdown: [
      { label: "Inland Haul" },
      { label: "Sea Freight" },
      { label: "Port Handling" },
    ],
    optimisation: "Consolidate with Q2 shipment for shared FCL — save ~$0.05/pc.",
    costKeys: ["transportation", "sampling"],
  },
  {
    key: "margin",
    label: "Margin",
    color: "var(--color-brand-900)",
    breakdown: [
      { label: "Gross Margin" },
      { label: "Contingency" },
    ],
    optimisation: "Move MOQ to Tier-3 to lift margin ~1.4pt at same sell price.",
  },
];

function CostAllocationRibbon({ current }: { current: Compute }) {
  const [hover, setHover] = useState<string | null>(null);
  const marginValue = current.price - current.unitCost;

  const segments = RIBBON_CATEGORIES.map((cat) => {
    const value =
      cat.key === "margin"
        ? marginValue
        : (cat.costKeys ?? []).reduce((s, k) => s + (current.costs[k] ?? 0), 0);
    return { ...cat, value };
  });
  const total = segments.reduce((s, seg) => s + seg.value, 0) || current.price;
  const withPct = segments.map((s) => ({ ...s, pct: (s.value / total) * 100 }));
  const active = hover ? withPct.find((s) => s.key === hover) : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[13px] font-display font-semibold tracking-tight">Cost Allocation</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Where the selling price of {fmtPrice(current.price)} is spent
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground">Hover a segment</div>
      </div>

      {/* Ribbon */}
      <div
        className="flex h-9 w-full overflow-hidden rounded-md ring-1 ring-border transition-all"
        onMouseLeave={() => setHover(null)}
      >
        {withPct.map((seg) => (
          <button
            key={seg.key}
            onMouseEnter={() => setHover(seg.key)}
            onClick={() => setHover(seg.key === hover ? null : seg.key)}
            className={cn(
              "h-full transition-all duration-500 relative group first:rounded-l-md last:rounded-r-md focus:outline-none",
              hover && hover !== seg.key && "opacity-40",
            )}
            style={{ width: `${seg.pct}%`, background: seg.color }}
            title={`${seg.label} — ${fmtPrice(seg.value)} (${seg.pct.toFixed(0)}%)`}
          >
            {seg.pct >= 6 && (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white/95 tracking-wide">
                {seg.label} · {seg.pct.toFixed(0)}%
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-3 gap-1.5">
        {withPct.map((seg) => (
          <div
            key={seg.key}
            onMouseEnter={() => setHover(seg.key)}
            onMouseLeave={() => setHover(null)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2 py-1 border border-transparent hover:border-border cursor-default transition-colors",
              hover === seg.key && "bg-secondary border-border",
            )}
          >
            <span className="size-2 rounded-full shrink-0" style={{ background: seg.color }} />
            <span className="text-[11px] text-foreground/80 flex-1 truncate">{seg.label}</span>
            <span className="text-[10.5px] num font-semibold text-foreground">{seg.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>

      {/* Detail panel */}
      {active ? (
        <div className="rounded-lg border border-border bg-background/70 p-3.5 animate-surface-in" key={active.key}>
          <div className="flex items-baseline justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: active.color }} />
              <span className="text-[12.5px] font-semibold">{active.label}</span>
            </div>
            <div className="text-[12.5px] num font-semibold">
              {fmtPrice(active.value)} <span className="text-muted-foreground text-[11px]">({active.pct.toFixed(0)}%)</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {active.breakdown.map((b) => (
              <span key={b.label} className="text-[10.5px] rounded-full px-2 py-0.5 bg-secondary/70 text-foreground/80 border border-border/60">
                {b.label}
              </span>
            ))}
          </div>
          {active.optimisation && (
            <div className="mt-2.5 flex items-start gap-1.5 rounded-md bg-brand-50 border border-brand-700/15 px-2.5 py-1.5">
              <Sparkles className="size-3 text-brand-700 mt-0.5 shrink-0" />
              <div className="text-[11px] text-foreground/85 leading-snug">
                <span className="font-semibold text-brand-700">Optimization: </span>
                {active.optimisation}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground italic">
          Hover any segment to see its breakdown and optimisation options.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Break-even analysis chart — visualises fixed vs total cost vs revenue
// ─────────────────────────────────────────────────────────────────────────────

function BreakEvenChart({ current }: { current: Compute }) {
  const profitPerPc = Math.max(0.01, current.price - current.unitCost);
  const beQty = Math.max(1, Math.ceil(BASE.fixedCost / profitPerPc));
  const orderQty = current.qty;
  const maxQty = Math.max(beQty * 1.8, orderQty * 1.15, beQty + 500);

  // chart geometry
  const W = 640;
  const H = 220;
  const padL = 44;
  const padR = 16;
  const padT = 12;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const revenueMax = current.price * maxQty;
  const totalCostMax = BASE.fixedCost + current.unitCost * maxQty;
  const yMax = Math.max(revenueMax, totalCostMax) * 1.05;

  const x = (q: number) => padL + (q / maxQty) * innerW;
  const y = (v: number) => padT + innerH - (v / yMax) * innerH;

  const revenuePath = `M ${x(0)} ${y(0)} L ${x(maxQty)} ${y(revenueMax)}`;
  const totalCostPath = `M ${x(0)} ${y(BASE.fixedCost)} L ${x(maxQty)} ${y(totalCostMax)}`;
  const fixedPath = `M ${x(0)} ${y(BASE.fixedCost)} L ${x(maxQty)} ${y(BASE.fixedCost)}`;

  // shaded profit region (from BE to end, revenue > total cost)
  const profitRegion = `M ${x(beQty)} ${y(current.price * beQty)}
    L ${x(maxQty)} ${y(revenueMax)}
    L ${x(maxQty)} ${y(totalCostMax)}
    L ${x(beQty)} ${y(BASE.fixedCost + current.unitCost * beQty)} Z`;

  // shaded loss region (0 → BE, total cost > revenue)
  const lossRegion = `M ${x(0)} ${y(0)}
    L ${x(beQty)} ${y(current.price * beQty)}
    L ${x(beQty)} ${y(BASE.fixedCost + current.unitCost * beQty)}
    L ${x(0)} ${y(BASE.fixedCost)} Z`;

  const orderProfit = (current.price - current.unitCost) * orderQty - BASE.fixedCost;
  const safetyMargin = ((orderQty - beQty) / Math.max(1, orderQty)) * 100;
  const inProfit = orderQty >= beQty;

  // x-axis ticks
  const ticks = 5;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => Math.round((maxQty / ticks) * i));

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[13px] font-display font-semibold tracking-tight">Break-Even Analysis</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            Order clears fixed overhead at{" "}
            <span className="num font-semibold text-foreground">{beQty.toLocaleString()} pcs</span> — current order at{" "}
            <span className="num font-semibold text-foreground">{orderQty.toLocaleString()} pcs</span>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
            inProfit ? "bg-success-soft text-success" : "bg-risk-soft text-risk",
          )}
        >
          {inProfit ? "↑" : "↓"} {Math.abs(safetyMargin).toFixed(0)}% {inProfit ? "safety" : "shortfall"}
        </span>
      </div>

      <div className="w-full overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="none">
          {/* grid */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={padL}
              x2={W - padR}
              y1={padT + innerH * (1 - f)}
              y2={padT + innerH * (1 - f)}
              stroke="var(--color-border)"
              strokeWidth={0.5}
              strokeDasharray="2 3"
            />
          ))}

          {/* shaded regions */}
          <path d={lossRegion} fill="var(--color-risk)" fillOpacity={0.08} />
          <path d={profitRegion} fill="var(--color-success)" fillOpacity={0.1} />

          {/* fixed cost line */}
          <path d={fixedPath} stroke="var(--color-muted-foreground)" strokeWidth={1} strokeDasharray="4 4" fill="none" />
          {/* total cost line */}
          <path d={totalCostPath} stroke="var(--color-risk)" strokeWidth={1.5} fill="none" />
          {/* revenue line */}
          <path d={revenuePath} stroke="var(--color-brand-700)" strokeWidth={1.75} fill="none" />

          {/* BE marker */}
          <line
            x1={x(beQty)}
            x2={x(beQty)}
            y1={padT}
            y2={padT + innerH}
            stroke="var(--color-foreground)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.5}
          />
          <circle cx={x(beQty)} cy={y(current.price * beQty)} r={4} fill="var(--color-foreground)" />
          <text
            x={x(beQty) + 6}
            y={y(current.price * beQty) - 6}
            fontSize={10}
            fill="var(--color-foreground)"
            className="font-semibold"
          >
            BE · {beQty.toLocaleString()}
          </text>

          {/* order qty marker */}
          <circle
            cx={x(orderQty)}
            cy={y(current.price * orderQty)}
            r={4}
            fill={inProfit ? "var(--color-success)" : "var(--color-risk)"}
          />
          <text
            x={x(orderQty) + 6}
            y={y(current.price * orderQty) + 12}
            fontSize={10}
            fill={inProfit ? "var(--color-success)" : "var(--color-risk)"}
            className="font-semibold"
          >
            Order · {orderQty.toLocaleString()}
          </text>

          {/* x-axis */}
          {tickVals.map((v) => (
            <g key={v}>
              <text x={x(v)} y={H - 8} fontSize={9} fill="var(--color-muted-foreground)" textAnchor="middle">
                {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
              </text>
            </g>
          ))}
          {/* y-axis labels */}
          {[0, 0.5, 1].map((f) => (
            <text
              key={f}
              x={padL - 6}
              y={padT + innerH * (1 - f) + 3}
              fontSize={9}
              fill="var(--color-muted-foreground)"
              textAnchor="end"
            >
              ${((yMax * f) / 1000).toFixed(0)}k
            </text>
          ))}
        </svg>
      </div>

      {/* Legend + stats */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-[2px] rounded-full bg-[var(--color-brand-700)]" />
          <span className="text-muted-foreground">Revenue</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-[2px] rounded-full bg-[var(--color-risk)]" />
          <span className="text-muted-foreground">Total cost</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-[2px] rounded-full bg-[var(--color-muted-foreground)] opacity-70" style={{ backgroundImage: "repeating-linear-gradient(90deg, currentColor 0 3px, transparent 3px 6px)" }} />
          <span className="text-muted-foreground">Fixed cost ${BASE.fixedCost.toLocaleString()}</span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1">
        <div className="rounded-lg border border-border bg-background/60 p-2.5">
          <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold">Break-even</div>
          <div className="text-[13px] num font-semibold mt-0.5">{beQty.toLocaleString()} pcs</div>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-2.5">
          <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold">Contribution / pc</div>
          <div className="text-[13px] num font-semibold mt-0.5">{fmtPrice(profitPerPc)}</div>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-2.5">
          <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold">Order profit</div>
          <div className={cn("text-[13px] num font-semibold mt-0.5", orderProfit >= 0 ? "text-success" : "text-risk")}>
            {orderProfit >= 0 ? "+" : "−"}{fmtUsd(Math.abs(orderProfit), { compact: true })}
          </div>
        </div>
      </div>
    </div>
  );
}

