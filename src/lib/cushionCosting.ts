// AI-Native Costing — cushion cover cost model.
// Pure functions; every node value + edge contribution is derived here so the
// graph can render edge thickness proportional to contribution.

export type Currency = "INR" | "USD";

export type CushionInputs = {
  // Fabric rates (INR / metre)
  greigeCotton: number;
  reactivePrint: number;
  solidDyeing: number;
  finishTransport: number;
  // Making rates (INR / piece unless noted)
  cutting: number;
  stitching: number;
  embroidery: number;
  trimsLabels: number;
  packaging: number;
  setup: number; // total setup, amortised over qty
  // Fabric geometry
  frontMeters: number; // metres of front fabric per piece
  backMeters: number; // metres of back fabric per piece (back + piping combined base)
  pipingRatio: number; // fraction of back fabric routed to piping (e.g. 0.15)
  backRatio: number; // fraction routed to back panel (e.g. 0.55) — piping + back may total < 1 for waste
  shrinkage: number; // 0.05 = 5%
  waste: number; // 0.05 = 5%
  // Commercial
  qty: number;
  overheadPct: number; // 0.08
  targetMarginPct: number; // 0.26
  fxRate: number; // ₹ per $
  // Presentation
  sizeInches?: number; // 16 / 18 / 20 / 24 — display + drives geometry
  // Quality
  fabricGsm?: number; // fabric weight (baseline 200)
  // Filling (cushion insert — optional)
  fillingWeightG?: number; // grams of filling per piece
  fillingRatePerKg?: number; // INR / kg
  // Compliance add-ons (₹ / piece) — driven by Testing & Certification modules
  testingPerPc?: number;
  certPerPc?: number;
};

export const DEFAULT_INPUTS: CushionInputs = {
  greigeCotton: 120,
  reactivePrint: 38,
  solidDyeing: 22,
  finishTransport: 7,
  cutting: 6,
  stitching: 36,
  embroidery: 48,
  trimsLabels: 8,
  packaging: 5,
  setup: 40_000,
  frontMeters: 0.5,
  backMeters: 0.55,
  pipingRatio: 0.15,
  backRatio: 0.55,
  shrinkage: 0.05,
  waste: 0.05,
  qty: 2_000,
  overheadPct: 0.08,
  targetMarginPct: 0.26,
  fxRate: 90,
  sizeInches: 18,
  fabricGsm: 200,
  fillingWeightG: 0,
  fillingRatePerKg: 180,
};

export type CushionMetrics = {
  // Column 2 — Fabric ₹ / metre
  frontFabricPerM: number;
  backFabricPerM: number;
  // Column 3 — Cost ₹ / piece
  frontPc: number;
  backPc: number;
  pipingPc: number;
  cuttingPc: number;
  stitchingPc: number;
  embroideryPc: number;
  trimsPc: number;
  packagingPc: number;
  setupPc: number;
  // Column 4 — Groups
  fabricSubtotal: number;
  makingSubtotal: number;
  // Column 5–7
  overhead: number;
  totalPc: number; // INR
  targetMarginRupees: number;
  suggestedQuoteUsd: number;
  // Meta
  quoteMarginPct: number; // realised margin (should ≈ target)
  fillingPc: number; // filling cost per piece (0 for cover-only)
  materialCost: number; // fabric + filling (direct material cost per piece)
};

export function computeCushion(i: CushionInputs): CushionMetrics {
  const shrinkWaste = (1 + i.shrinkage) * (1 + i.waste);
  // GSM scales fabric rate — heavier fabric costs more per metre.
  const gsmMult = (i.fabricGsm ?? 200) / 200;
  const frontFabricPerM =
    (i.greigeCotton * gsmMult + i.reactivePrint + i.finishTransport) * shrinkWaste;
  const backFabricPerM =
    (i.greigeCotton * gsmMult + i.solidDyeing + i.finishTransport) * shrinkWaste;
  const frontPc = frontFabricPerM * i.frontMeters;
  const backPc = backFabricPerM * i.backMeters * i.backRatio;
  const pipingPc = backFabricPerM * i.backMeters * i.pipingRatio;
  const cuttingPc = i.cutting;
  const stitchingPc = i.stitching;
  const embroideryPc = i.embroidery;
  const trimsPc = i.trimsLabels;
  const packagingPc = i.packaging;
  const setupPc = i.qty > 0 ? i.setup / i.qty : 0;
  const fillingPc = ((i.fillingWeightG ?? 0) / 1000) * (i.fillingRatePerKg ?? 0);
  const fabricSubtotal = frontPc + backPc + pipingPc;
  const makingSubtotal =
    cuttingPc +
    stitchingPc +
    embroideryPc +
    trimsPc +
    packagingPc +
    setupPc +
    fillingPc +
    (i.testingPerPc ?? 0) +
    (i.certPerPc ?? 0);

  const materialCost = fabricSubtotal + fillingPc;
  const direct = fabricSubtotal + makingSubtotal;
  const overhead = direct * i.overheadPct;
  const totalPc = direct + overhead;
  const targetMarginRupees = totalPc * (i.targetMarginPct / (1 - i.targetMarginPct));
  const suggestedQuoteUsd = (totalPc + targetMarginRupees) / i.fxRate;
  const quoteMarginPct = i.targetMarginPct;
  return {
    frontFabricPerM,
    backFabricPerM,
    frontPc,
    backPc,
    pipingPc,
    cuttingPc,
    stitchingPc,
    embroideryPc,
    trimsPc,
    packagingPc,
    setupPc,
    fabricSubtotal,
    makingSubtotal,
    materialCost,
    overhead,
    totalPc,
    targetMarginRupees,
    suggestedQuoteUsd,
    quoteMarginPct,
    fillingPc,
  };
}

// -------- Pricing variant builders --------
// Size presets — geometry & filling weight scale with cushion dimensions.
export const SIZE_PRESETS: Record<number, Partial<CushionInputs>> = {
  16: { sizeInches: 16, frontMeters: 0.44, backMeters: 0.48, fillingWeightG: 350 },
  18: { sizeInches: 18, frontMeters: 0.5, backMeters: 0.55, fillingWeightG: 450 },
  20: { sizeInches: 20, frontMeters: 0.58, backMeters: 0.62, fillingWeightG: 550 },
  24: { sizeInches: 24, frontMeters: 0.72, backMeters: 0.76, fillingWeightG: 800 },
};

// Quality (GSM) presets — heavier fabric costs more; drives greige-rate multiplier.
export const QUALITY_PRESETS: Record<number, Partial<CushionInputs>> = {
  185: { fabricGsm: 185 },
  200: { fabricGsm: 200 },
  240: { fabricGsm: 240 },
  350: { fabricGsm: 350 },
};

// MOQ presets — just quantity; setup amortises differently.
export const MOQ_PRESETS: number[] = [500, 1000, 2000, 5000, 10_000];

export function buildSizeVariant(base: CushionInputs, size: number): CushionVariant {
  const preset = SIZE_PRESETS[size];
  return {
    id: `v-size-${size}-${Date.now()}`,
    name: `Size · ${size}" × ${size}"`,
    tagline: `Geometry + filling scaled for ${size}"`,
    kind: "custom",
    inputs: { ...base, ...preset },
  };
}

export function buildMoqVariant(base: CushionInputs, qty: number): CushionVariant {
  return {
    id: `v-moq-${qty}-${Date.now()}`,
    name: `MOQ · ${qty.toLocaleString()} pcs`,
    tagline: `Setup amortised over ${qty.toLocaleString()} pieces`,
    kind: "custom",
    inputs: { ...base, qty },
  };
}

export function buildQualityVariant(base: CushionInputs, gsm: number): CushionVariant {
  return {
    id: `v-gsm-${gsm}-${Date.now()}`,
    name: `Quality · ${gsm} GSM`,
    tagline: `${gsm} GSM fabric weight`,
    kind: "custom",
    inputs: { ...base, fabricGsm: gsm },
  };
}

export type VariantKind = "enquired" | "value" | "premium";

/** Tab entry type — a Variant is a full costing version; an Option inherits
 *  from a parent Variant and only stores the values that differ. */
export type EntryType = "variant" | "option";

export type OptionType =
  "MOQ" | "Commercial" | "Packaging" | "Testing" | "Certification" | "Custom";

export type CushionVariant = {
  id: string;
  name: string;
  tagline: string;
  kind: VariantKind | "custom";
  inputs: CushionInputs;
  /** Defaults to "variant" when absent. */
  entry?: EntryType;
  /** Set when entry === "option" — the Variant this option inherits from. */
  parentId?: string;
  optionType?: OptionType;
  /** Only the fields that differ from the parent variant. */
  overrides?: Partial<CushionInputs>;
};

const patch = (base: CushionInputs, over: Partial<CushionInputs>): CushionInputs => ({
  ...base,
  ...over,
});

export const DEFAULT_VARIANTS: CushionVariant[] = [
  {
    id: "v-enquired",
    name: 'As enquired · 18"',
    tagline: 'Printed front · embroidered · 18"',
    kind: "enquired",
    inputs: DEFAULT_INPUTS,
  },
  {
    id: "v-value",
    name: 'Value · 16"',
    tagline: 'No embroidery · 16" · MOQ 5,000',
    kind: "value",
    inputs: patch(DEFAULT_INPUTS, {
      embroidery: 0,
      frontMeters: 0.44,
      backMeters: 0.48,
      qty: 5_000,
      trimsLabels: 6,
      packaging: 4,
      sizeInches: 16,
    }),
  },
  {
    id: "v-premium",
    name: 'Premium · 20"',
    tagline: 'Better cotton · full emb · 20"',
    kind: "premium",
    inputs: patch(DEFAULT_INPUTS, {
      greigeCotton: 165,
      reactivePrint: 52,
      embroidery: 78,
      frontMeters: 0.6,
      backMeters: 0.62,
      trimsLabels: 14,
      packaging: 9,
      targetMarginPct: 0.3,
      sizeInches: 20,
    }),
  },
];

// ------- Node / edge graph definitions used by the renderer -------

export type NodeKind =
  | "input-fabric"
  | "input-making"
  | "input-setup"
  | "fabric-per-m"
  | "cost-per-pc"
  | "group"
  | "overhead"
  | "fx"
  | "target-margin"
  | "total"
  | "quote";

export type GraphNode = {
  id: string;
  label: string;
  sub?: string;
  kind: NodeKind;
  column: number; // 0..6
  row: number; // integer row within column
  value: (m: CushionMetrics, i: CushionInputs) => number;
  format: (v: number) => string;
  formula?: (i: CushionInputs) => string;
};

const fmtINRm = (v: number) => `₹${v.toFixed(0)}/m`;
const fmtINRpc = (v: number) => `₹${v.toFixed(2)}`;
const fmtINR = (v: number) => `₹${v.toFixed(0)}`;
const fmtUSD = (v: number) => `$${v.toFixed(2)}`;
const fmtRate = (v: number) => `₹${v.toFixed(0)} / $`;
const fmtPct = (v: number) => `${(v * 100).toFixed(0)}%`;

export const NODES: GraphNode[] = [
  // Column 0 — INPUTS
  {
    id: "greige",
    label: "Greige Cotton",
    kind: "input-fabric",
    column: 0,
    row: 0,
    value: (_m, i) => i.greigeCotton,
    format: fmtINRm,
  },
  {
    id: "print",
    label: "Reactive Print",
    kind: "input-fabric",
    column: 0,
    row: 1,
    value: (_m, i) => i.reactivePrint,
    format: fmtINRm,
  },
  {
    id: "dye",
    label: "Solid Dyeing",
    kind: "input-fabric",
    column: 0,
    row: 2,
    value: (_m, i) => i.solidDyeing,
    format: fmtINRm,
  },
  {
    id: "finish",
    label: "Finish + Transport",
    kind: "input-fabric",
    column: 0,
    row: 3,
    value: (_m, i) => i.finishTransport,
    format: fmtINRm,
  },
  {
    id: "cutting",
    label: "Cutting",
    kind: "input-making",
    column: 0,
    row: 4,
    value: (_m, i) => i.cutting,
    format: (v) => `₹${v.toFixed(0)}/pc`,
  },
  {
    id: "stitching",
    label: "Stitching",
    kind: "input-making",
    column: 0,
    row: 5,
    value: (_m, i) => i.stitching,
    format: (v) => `₹${v.toFixed(0)}/pc`,
  },
  {
    id: "embroidery",
    label: "Embroidery",
    kind: "input-making",
    column: 0,
    row: 6,
    value: (_m, i) => i.embroidery,
    format: (v) => `₹${v.toFixed(0)}/pc`,
  },
  {
    id: "trims",
    label: "Trims & Labels",
    kind: "input-making",
    column: 0,
    row: 7,
    value: (_m, i) => i.trimsLabels,
    format: (v) => `₹${v.toFixed(0)}/pc`,
  },
  {
    id: "packaging",
    label: "Packaging",
    kind: "input-making",
    column: 0,
    row: 8,
    value: (_m, i) => i.packaging,
    format: (v) => `₹${v.toFixed(0)}/pc`,
  },
  {
    id: "setup",
    label: "Setup",
    kind: "input-setup",
    column: 0,
    row: 9,
    value: (_m, i) => i.setup,
    format: (v) => `₹${v.toLocaleString("en-IN")}`,
  },

  // Column 1 — FABRIC ₹/m
  {
    id: "front-per-m",
    label: "Front fabric ₹/m",
    sub: "greige + print + finish",
    kind: "fabric-per-m",
    column: 1,
    row: 1,
    value: (m) => m.frontFabricPerM,
    format: fmtINRm,
    formula: (i) =>
      `(₹${i.greigeCotton} + ₹${i.reactivePrint} + ₹${i.finishTransport}) × shrink ${(i.shrinkage * 100).toFixed(0)}% × waste ${(i.waste * 100).toFixed(0)}%`,
  },
  {
    id: "back-per-m",
    label: "Back fabric ₹/m",
    sub: "greige + dye + finish",
    kind: "fabric-per-m",
    column: 1,
    row: 3,
    value: (m) => m.backFabricPerM,
    format: fmtINRm,
    formula: (i) =>
      `(₹${i.greigeCotton} + ₹${i.solidDyeing} + ₹${i.finishTransport}) × shrink ${(i.shrinkage * 100).toFixed(0)}% × waste ${(i.waste * 100).toFixed(0)}%`,
  },

  // Column 2 — COST ₹/piece
  {
    id: "front-pc",
    label: "Front / pc",
    kind: "cost-per-pc",
    column: 2,
    row: 0,
    value: (m) => m.frontPc,
    format: fmtINRpc,
  },
  {
    id: "back-pc",
    label: "Back / pc",
    kind: "cost-per-pc",
    column: 2,
    row: 1,
    value: (m) => m.backPc,
    format: fmtINRpc,
  },
  {
    id: "piping-pc",
    label: "Piping / pc",
    kind: "cost-per-pc",
    column: 2,
    row: 2,
    value: (m) => m.pipingPc,
    format: fmtINRpc,
  },
  {
    id: "cutting-pc",
    label: "Cutting / pc",
    kind: "cost-per-pc",
    column: 2,
    row: 3,
    value: (m) => m.cuttingPc,
    format: fmtINRpc,
  },
  {
    id: "stitching-pc",
    label: "Stitching / pc",
    kind: "cost-per-pc",
    column: 2,
    row: 4,
    value: (m) => m.stitchingPc,
    format: fmtINRpc,
  },
  {
    id: "embroidery-pc",
    label: "Embroidery / pc",
    kind: "cost-per-pc",
    column: 2,
    row: 5,
    value: (m) => m.embroideryPc,
    format: fmtINRpc,
  },
  {
    id: "trims-pc",
    label: "Trims / pc",
    kind: "cost-per-pc",
    column: 2,
    row: 6,
    value: (m) => m.trimsPc,
    format: fmtINRpc,
  },
  {
    id: "packaging-pc",
    label: "Packaging / pc",
    kind: "cost-per-pc",
    column: 2,
    row: 7,
    value: (m) => m.packagingPc,
    format: fmtINRpc,
  },
  {
    id: "setup-pc",
    label: "Setup / pc",
    kind: "cost-per-pc",
    column: 2,
    row: 8,
    value: (m) => m.setupPc,
    format: fmtINRpc,
  },

  // Column 3 — Groups
  {
    id: "fabric-sub",
    label: "Fabric subtotal",
    kind: "group",
    column: 3,
    row: 1,
    value: (m) => m.fabricSubtotal,
    format: fmtINR,
    sub: "% of cost",
  },
  {
    id: "making-sub",
    label: "Making subtotal",
    kind: "group",
    column: 3,
    row: 5,
    value: (m) => m.makingSubtotal,
    format: fmtINR,
    sub: "% of cost",
  },

  // Column 4 — Overhead + signals
  {
    id: "overhead",
    label: "Overhead",
    sub: "of direct",
    kind: "overhead",
    column: 4,
    row: 2,
    value: (m) => m.overhead,
    format: fmtINR,
  },
  {
    id: "fx",
    label: "FX rate",
    kind: "fx",
    column: 4,
    row: 5,
    value: (_m, i) => i.fxRate,
    format: fmtRate,
  },

  // Column 5 — Total
  {
    id: "total",
    label: "Total cost / pc",
    kind: "total",
    column: 5,
    row: 2,
    value: (m) => m.totalPc,
    format: fmtINR,
  },
  {
    id: "target-margin",
    label: "Target margin",
    kind: "target-margin",
    column: 5,
    row: 5,
    value: (_m, i) => i.targetMarginPct,
    format: fmtPct,
  },

  // Column 6 — Quote
  {
    id: "quote",
    label: "Suggested quote",
    sub: "margin · FX applied",
    kind: "quote",
    column: 6,
    row: 3,
    value: (m) => m.suggestedQuoteUsd,
    format: fmtUSD,
  },
];

export type GraphEdge = {
  from: string;
  to: string;
  kind: "fabric" | "making" | "signal" | "output";
  weight: (m: CushionMetrics, i: CushionInputs) => number;
};

export const EDGES: GraphEdge[] = [
  // Inputs → fabric ₹/m
  { from: "greige", to: "front-per-m", kind: "fabric", weight: (_m, i) => i.greigeCotton },
  { from: "print", to: "front-per-m", kind: "fabric", weight: (_m, i) => i.reactivePrint },
  { from: "finish", to: "front-per-m", kind: "fabric", weight: (_m, i) => i.finishTransport },
  { from: "greige", to: "back-per-m", kind: "fabric", weight: (_m, i) => i.greigeCotton },
  { from: "dye", to: "back-per-m", kind: "fabric", weight: (_m, i) => i.solidDyeing },
  { from: "finish", to: "back-per-m", kind: "fabric", weight: (_m, i) => i.finishTransport },

  // Fabric ₹/m → Cost ₹/pc
  { from: "front-per-m", to: "front-pc", kind: "fabric", weight: (m) => m.frontPc },
  { from: "back-per-m", to: "back-pc", kind: "fabric", weight: (m) => m.backPc },
  { from: "back-per-m", to: "piping-pc", kind: "fabric", weight: (m) => m.pipingPc },

  // Making inputs → cost ₹/pc
  { from: "cutting", to: "cutting-pc", kind: "making", weight: (m) => m.cuttingPc },
  { from: "stitching", to: "stitching-pc", kind: "making", weight: (m) => m.stitchingPc },
  { from: "embroidery", to: "embroidery-pc", kind: "making", weight: (m) => m.embroideryPc },
  { from: "trims", to: "trims-pc", kind: "making", weight: (m) => m.trimsPc },
  { from: "packaging", to: "packaging-pc", kind: "making", weight: (m) => m.packagingPc },
  { from: "setup", to: "setup-pc", kind: "making", weight: (m) => m.setupPc },

  // Cost ₹/pc → groups
  { from: "front-pc", to: "fabric-sub", kind: "fabric", weight: (m) => m.frontPc },
  { from: "back-pc", to: "fabric-sub", kind: "fabric", weight: (m) => m.backPc },
  { from: "piping-pc", to: "fabric-sub", kind: "fabric", weight: (m) => m.pipingPc },
  { from: "cutting-pc", to: "making-sub", kind: "making", weight: (m) => m.cuttingPc },
  { from: "stitching-pc", to: "making-sub", kind: "making", weight: (m) => m.stitchingPc },
  { from: "embroidery-pc", to: "making-sub", kind: "making", weight: (m) => m.embroideryPc },
  { from: "trims-pc", to: "making-sub", kind: "making", weight: (m) => m.trimsPc },
  { from: "packaging-pc", to: "making-sub", kind: "making", weight: (m) => m.packagingPc },
  { from: "setup-pc", to: "making-sub", kind: "making", weight: (m) => m.setupPc },

  // Groups → total (via overhead)
  { from: "fabric-sub", to: "total", kind: "fabric", weight: (m) => m.fabricSubtotal },
  { from: "making-sub", to: "total", kind: "making", weight: (m) => m.makingSubtotal },
  { from: "fabric-sub", to: "overhead", kind: "signal", weight: (m) => m.fabricSubtotal * 0.5 },
  { from: "making-sub", to: "overhead", kind: "signal", weight: (m) => m.makingSubtotal * 0.5 },
  { from: "overhead", to: "total", kind: "signal", weight: (m) => m.overhead },

  // Signals → quote
  { from: "total", to: "quote", kind: "output", weight: (m) => m.totalPc },
  { from: "fx", to: "quote", kind: "signal", weight: () => 1 },
  { from: "target-margin", to: "quote", kind: "signal", weight: () => 1 },
];

// Historical baseline for costing analysis (deterministic demo data).
export type HistoricalBenchmark = {
  buyer: string;
  article: string;
  season: string;
  qty: number;
  quoteUsd: number;
  marginPct: number;
  outcome: "won" | "lost" | "pending";
  status: "approved" | "shipped" | "quoted";
};

export const HISTORICAL_BASELINES: HistoricalBenchmark[] = [
  {
    buyer: "Zara Home",
    article: 'Striped Cushion Cover 18"',
    season: "SS26",
    qty: 3200,
    quoteUsd: 5.22,
    marginPct: 24.8,
    outcome: "won",
    status: "shipped",
  },
  {
    buyer: "H&M Home",
    article: 'Solid Cotton Cushion 18"',
    season: "AW26",
    qty: 4500,
    quoteUsd: 4.61,
    marginPct: 22.1,
    outcome: "won",
    status: "approved",
  },
  {
    buyer: "IKEA",
    article: 'Printed Cotton Cushion 20"',
    season: "SS26",
    qty: 8000,
    quoteUsd: 4.18,
    marginPct: 19.4,
    outcome: "won",
    status: "shipped",
  },
  {
    buyer: "West Elm",
    article: 'Embroidered Cushion 18"',
    season: "AW26",
    qty: 1800,
    quoteUsd: 6.34,
    marginPct: 27.6,
    outcome: "won",
    status: "shipped",
  },
  {
    buyer: "Zara Home",
    article: 'Jacquard Cushion 20"',
    season: "AW26",
    qty: 2500,
    quoteUsd: 6.1,
    marginPct: 25.2,
    outcome: "lost",
    status: "quoted",
  },
  {
    buyer: "Anthropologie",
    article: 'Stripe Cushion 18"',
    season: "SS27",
    qty: 2000,
    quoteUsd: 5.88,
    marginPct: 26.4,
    outcome: "pending",
    status: "quoted",
  },
];

export type SensitivityRow = {
  driver: string;
  change: string;
  costImpactPct: number;
  quoteImpact: number; // USD change
  marginImpactPts: number; // percentage points
};

export function sensitivity(base: CushionInputs): SensitivityRow[] {
  const baseM = computeCushion(base);
  const scenarios: { label: string; change: string; over: Partial<CushionInputs> }[] = [
    {
      label: "Greige cotton +10%",
      change: "+10%",
      over: { greigeCotton: base.greigeCotton * 1.1 },
    },
    {
      label: "Reactive print +8%",
      change: "+8%",
      over: { reactivePrint: base.reactivePrint * 1.08 },
    },
    { label: "Stitching labour +7%", change: "+7%", over: { stitching: base.stitching * 1.07 } },
    { label: "FX rate ₹−3", change: "-₹3/$", over: { fxRate: base.fxRate - 3 } },
    { label: "MOQ ×2", change: "×2", over: { qty: base.qty * 2 } },
    { label: "Embroidery removed", change: "−100%", over: { embroidery: 0 } },
  ];
  return scenarios.map((s) => {
    const m = computeCushion({ ...base, ...s.over });
    const costImpactPct = ((m.totalPc - baseM.totalPc) / baseM.totalPc) * 100;
    const quoteImpact = m.suggestedQuoteUsd - baseM.suggestedQuoteUsd;
    const marginImpactPts = (m.quoteMarginPct - baseM.quoteMarginPct) * 100;
    return { driver: s.label, change: s.change, costImpactPct, quoteImpact, marginImpactPts };
  });
}
