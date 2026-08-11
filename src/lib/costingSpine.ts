/**
 * The costing spine — single source of truth for the Configuration Workspace.
 *
 * Everything (network diagram, comparison table, option basis) reads its numbers
 * from `fabricConfig.computeConfig` / `configTree.componentsCost` / `rollupPhases`,
 * so no two surfaces can ever disagree. Pure functions only.
 */

import type { ConfigState } from "./fabricConfig";
import {
  componentsCost,
  fabricComponents,
  rollupPhases,
  visibleGroups,
  routeOf,
  PHASES,
  type FabricComponent,
  type PhaseId,
} from "./configTree";
import { VARIABLES } from "./costingVariables";

export type SpineCtx = { fabricExtras: FabricComponent[] };

const toNum = (s?: string) => {
  const n = parseFloat((s ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/* ------------------------------------------------------------------ *
 * 0..7 costing spine
 * ------------------------------------------------------------------ */

export type SpineSectionId =
  | "context"
  | "material"
  | "components"
  | "process"
  | "consumption"
  | "trims"
  | "packaging"
  | "rollup";

export type SpineSection = {
  id: SpineSectionId;
  index: number;
  label: string;
  question: string;
  phase: PhaseId;
  groupIds: string[];
};

export const SPINE: SpineSection[] = [
  {
    id: "context",
    index: 0,
    label: "Article & Order Context",
    question: "What are we costing, for whom, how many?",
    phase: "input",
    groupIds: ["drivers", "fabricSpec", "colourDesign"],
  },
  {
    id: "material",
    index: 1,
    label: "Fabric & Material Specification",
    question: "What is the base material?",
    phase: "raw",
    groupIds: ["fabric", "yarn"],
  },
  {
    id: "components",
    index: 2,
    label: "Component Breakdown",
    question: "Where is each material used?",
    phase: "raw",
    groupIds: ["fabric"],
  },
  {
    id: "process",
    index: 3,
    label: "Process Configuration",
    question: "How is it processed?",
    phase: "process",
    groupIds: [
      "yarnPrep",
      "dyeing",
      "weaving",
      "printing",
      "embroidery",
      "washing",
      "finishing",
      "cutting",
      "stitching",
      "hemming",
      "special",
      "compliance",
    ],
  },
  {
    id: "consumption",
    index: 4,
    label: "Consumption, Wastage & Shrinkage",
    question: "How much is actually required?",
    phase: "process",
    groupIds: ["consumption"],
  },
  {
    id: "trims",
    index: 5,
    label: "Accessories & Trims",
    question: "What else goes into it?",
    phase: "raw",
    groupIds: ["trims"],
  },
  {
    id: "packaging",
    index: 6,
    label: "Packaging",
    question: "How does it leave the factory?",
    phase: "packaging",
    groupIds: ["labels", "standard", "special", "carton"],
  },
  {
    id: "rollup",
    index: 7,
    label: "Direct Cost Roll-Up",
    question: "What does it cost?",
    phase: "direct",
    groupIds: [],
  },
];

/* --- derived manufacturing route lives in costingRoute.ts --- */
export {
  deriveRoute,
  type Availability,
  type DerivedStep,
  type DerivedRoute,
} from "./costingRoute";

/* ------------------------------------------------------------------ *
 * Variable dictionary
 * ------------------------------------------------------------------ */

export type VarInput = "master" | "entry" | "derived";

export type VarDef = {
  id: string;
  label: string;
  section: SpineSectionId;
  group: string;
  unit?: string;
  input: VarInput;
  costBearing: boolean;
  quantitySensitive: boolean;
  read: (s: ConfigState, ctx: SpineCtx) => string;
};

export { VARIABLES } from "./costingVariables";

export const QUANTITY_SENSITIVE: { id: string; label: string }[] = [
  { id: "fabricRate", label: "Fabric & yarn rate breaks" },
  { id: "dyeMinLot", label: "Dyeing minimum lot charge" },
  { id: "printSetup", label: "Printing screen / plate amortisation" },
  { id: "embSetup", label: "Embroidery setup amortisation" },
  { id: "trimMoq", label: "Trim and label MOQ effects" },
  { id: "cartonFill", label: "Carton fill efficiency" },
  { id: "wastageBand", label: "Wastage percentage bands" },
];

/* ------------------------------------------------------------------ *
 * Option basis — MOQ driven recalculation
 * ------------------------------------------------------------------ */

export type OptionBasis = {
  orderQty: number;
  moq: number;
  quotedMoq: number;
  recalc: Record<string, boolean>;
};

/** volume rate break on fabric / yarn rates — step function by quantity band */
const FABRIC_BAND: [number, number][] = [
  // [max qty, multiplier]
  [1000, 1.06],
  [2500, 1.03],
  [5000, 1.0],
  [10000, 0.975],
  [Infinity, 0.95],
];

/** trim & label MOQ effect — small parts carry a steeper small-lot penalty */
const TRIM_BAND: [number, number][] = [
  [1000, 1.1],
  [2500, 1.05],
  [5000, 1.0],
  [10000, 0.97],
  [Infinity, 0.94],
];

/** carton fill efficiency — a fuller container allocates less carton per piece */
const CARTON_BAND: [number, number][] = [
  [1000, 1.12],
  [2500, 1.05],
  [5000, 1.0],
  [10000, 0.96],
  [Infinity, 0.92],
];

/** wastage easing, in percentage points added to the entered wastage % */
const WASTAGE_BAND: [number, number][] = [
  [1000, 1.5],
  [2500, 0.75],
  [5000, 0.0],
  [10000, -0.5],
  [Infinity, -1.0],
];

/** one-time charges amortised over the order quantity (rupees) */
const DYE_MIN_LOT = 9000;
const DEFAULT_SCREEN_COST = 1200;
const EMB_SETUP = 2500;

const bandValue = (bands: [number, number][], qty: number): number => {
  for (const [max, value] of bands) if (qty < max) return value;
  return bands[bands.length - 1][1];
};

const FABRIC_RATE_IDS = [
  "supplier",
  "fabricQuality",
  "fabricType",
  "construction",
  "gsm",
  "composition",
];
const TRIM_IDS = [
  "accZipper",
  "accButton",
  "accPressButtons",
  "accEyelet",
  "accORing",
  "accCardboard",
];

const scaleRates = (state: ConfigState, ids: string[], factor: number): ConfigState => {
  const next: ConfigState = { ...state };
  for (const id of ids) {
    const v = next[id];
    if (!v || v.rate === undefined) continue;
    next[id] = { ...v, rate: Math.round(v.rate * factor * 100) / 100 };
  }
  return next;
};

const scaleNumbers = (state: ConfigState, ids: string[], factor: number): ConfigState => {
  const next: ConfigState = { ...state };
  for (const id of ids) {
    const v = next[id];
    if (!v) continue;
    const n = toNum(v.value);
    if (n === 0) continue;
    next[id] = { ...v, value: (Math.round(n * factor * 100) / 100).toFixed(2) };
  }
  return next;
};

/** shift a per-piece rate by re-amortising a one-time charge from baseQty to newQty */
const reamortise = (rate: number, charge: number, baseQty: number, newQty: number) =>
  Math.round((rate - charge / baseQty + charge / newQty) * 100) / 100;

export function applyOptionBasis(base: ConfigState, basis: OptionBasis): ConfigState {
  const baseQty = Math.max(1, toNum(base.orderQty?.value));
  const newQty = Math.max(1, basis.orderQty);

  let next: ConfigState = {
    ...base,
    orderQty: { value: String(newQty) },
    moq: { value: String(Math.max(0, basis.moq)) },
    quotedMoq: { value: String(Math.max(0, basis.quotedMoq)) },
  };

  const on = (key: string) => basis.recalc[key] === true;

  // Fabric & yarn rate breaks — FABRIC_BAND multiplier, applied as a ratio.
  if (on("fabricRate")) {
    const factor = bandValue(FABRIC_BAND, newQty) / bandValue(FABRIC_BAND, baseQty);
    next = scaleRates(next, FABRIC_RATE_IDS, factor);
  }

  // Dyeing minimum lot charge — DYE_MIN_LOT spread across the order.
  if (on("dyeMinLot") && next.dyeing?.rate !== undefined) {
    next = {
      ...next,
      dyeing: {
        ...next.dyeing,
        rate: Math.max(0, reamortise(next.dyeing.rate, DYE_MIN_LOT, baseQty, newQty)),
      },
    };
  }

  // Printing screen / plate amortisation — the entered screen cost, or a ₹1,200 default.
  if (on("printSetup") && next.printTech?.rate !== undefined) {
    const screens = toNum(next.screenCost?.value) || DEFAULT_SCREEN_COST;
    next = {
      ...next,
      printTech: {
        ...next.printTech,
        rate: Math.max(0, reamortise(next.printTech.rate, screens, baseQty, newQty)),
      },
    };
  }

  // Embroidery setup amortisation — EMB_SETUP spread across qty, then across dots.
  if (on("embSetup")) {
    const dots = Math.max(1, toNum(next.embDots?.value));
    const perDot = toNum(next.embPerDot?.value);
    const shifted = perDot + (EMB_SETUP / newQty - EMB_SETUP / baseQty) / dots;
    next = { ...next, embPerDot: { value: Math.max(0, shifted).toFixed(2) } };
  }

  // Trim and label MOQ effects — TRIM_BAND multiplier on every trim line.
  if (on("trimMoq")) {
    const factor = bandValue(TRIM_BAND, newQty) / bandValue(TRIM_BAND, baseQty);
    next = scaleNumbers(next, TRIM_IDS, factor);
    if (next.pkgHangTag?.rate !== undefined) {
      next = {
        ...next,
        pkgHangTag: {
          ...next.pkgHangTag,
          rate: Math.round(next.pkgHangTag.rate * factor * 100) / 100,
        },
      };
    }
  }

  // Carton fill efficiency — CARTON_BAND multiplier on carton and primary pack rates.
  if (on("cartonFill")) {
    const factor = bandValue(CARTON_BAND, newQty) / bandValue(CARTON_BAND, baseQty);
    next = scaleRates(next, ["pkgCarton", "pkgType"], factor);
  }

  // Wastage percentage bands — WASTAGE_BAND points, re-based from baseQty to newQty.
  if (on("wastageBand")) {
    const shift = bandValue(WASTAGE_BAND, newQty) - bandValue(WASTAGE_BAND, baseQty);
    const current = toNum(next.wastage?.value);
    next = { ...next, wastage: { value: Math.max(0, current + shift).toFixed(2) } };
  }

  return next;
}

export function basisDelta(
  base: ConfigState,
  next: ConfigState,
  ctx: SpineCtx,
): {
  baseTotal: number;
  nextTotal: number;
  delta: number;
  deltaPct: number;
  movers: { label: string; delta: number }[];
} {
  const a = rollupPhases(base, ctx);
  const b = rollupPhases(next, ctx);
  const baseTotal = a.directTotal;
  const nextTotal = b.directTotal;
  const delta = nextTotal - baseTotal;

  const before = new Map<string, { label: string; amount: number }>();
  for (const p of a.phases) for (const g of p.groups) before.set(`${p.id}:${g.id}`, g);

  const movers = b.phases
    .flatMap((p) =>
      p.groups.map((g) => ({
        label: g.label,
        delta: g.amount - (before.get(`${p.id}:${g.id}`)?.amount ?? 0),
      })),
    )
    .filter((m) => Math.abs(m.delta) > 0.0001)
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, 4);

  return {
    baseTotal,
    nextTotal,
    delta,
    deltaPct: baseTotal > 0 ? delta / baseTotal : 0,
    movers,
  };
}

/* --- the network diagram model lives in costingGraph.ts --- */
export {
  buildCostGraph,
  COST_LANES,
  type NodeKind,
  type CostNode,
  type CostEdge,
  type CostLane,
  type CostGraph,
} from "./costingGraph";

/* ------------------------------------------------------------------ *
 * Comparison table
 * ------------------------------------------------------------------ */

export type CompareCell = { text: string; numeric?: number; overridden?: boolean };

export type CompareRow = {
  varId: string;
  label: string;
  unit?: string;
  input: VarInput;
  section: SpineSectionId;
  group: string;
  costBearing: boolean;
  quantitySensitive: boolean;
  cells: CompareCell[];
  differs: boolean;
};

export type CompareColumn = {
  id: string;
  variantName: string;
  optionName?: string;
  kind: "variant" | "option";
  total: number;
};

const numericOf = (text: string): number | undefined => {
  const n = parseFloat(text.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

export function buildCompareRows(
  cols: { id: string; state: ConfigState; ctx: SpineCtx }[],
): CompareRow[] {
  return VARIABLES.map((v) => {
    const texts = cols.map((c) => v.read(c.state, c.ctx));
    const differs = texts.some((t) => t !== texts[0]);
    const cells: CompareCell[] = texts.map((text, i) => ({
      text,
      numeric: numericOf(text),
      overridden: i > 0 && text !== texts[0],
    }));
    return {
      varId: v.id,
      label: v.label,
      unit: v.unit,
      input: v.input,
      section: v.section,
      group: v.group,
      costBearing: v.costBearing,
      quantitySensitive: v.quantitySensitive,
      cells,
      differs,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Navigation helper — where a variable lives on the canvas
 * ------------------------------------------------------------------ */

/** phase + group that owns a given card id, so a click can navigate to it */
export function locateCard(
  state: ConfigState,
  cardId: string,
): { phase: PhaseId; group: string } | undefined {
  const route = routeOf(state);
  for (const phase of PHASES) {
    for (const group of visibleGroups(phase, route)) {
      if (group.cards.some((c) => c.id === cardId)) return { phase: phase.id, group: group.id };
    }
  }
  return undefined;
}

/** total across every fabric component — kept here so callers never re-implement it */
export const spineComponentsTotal = (state: ConfigState, ctx: SpineCtx) =>
  componentsCost(fabricComponents(state, ctx.fabricExtras));
