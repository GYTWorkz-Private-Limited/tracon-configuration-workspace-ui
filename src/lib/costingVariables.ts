/**
 * The costing variable dictionary.
 *
 * One row per meaningful field in `fabricConfig.ts`, ordered the way a costing
 * team walks a sheet (0..7 spine sections). Every `read` returns a display
 * string and falls back to an em-dash when the field does not apply.
 */

import { ALL_CARDS, FABRIC_CARDS, computeConfig, inr, type ConfigState } from "./fabricConfig";
import {
  componentCost,
  componentsCost,
  deriveMainComponent,
  fabricComponents,
  rollupPhases,
  routeOf,
  type RouteId,
} from "./configTree";
import type { SpineCtx, SpineSectionId, VarDef, VarInput } from "./costingSpine";

const DASH = "—";

const toNum = (s?: string) => {
  const n = parseFloat((s ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const cardOf = (id: string) => ALL_CARDS.find((c) => c.id === id);

const unitOf = (id: string): string | undefined => {
  const c = cardOf(id);
  if (!c) return undefined;
  if (c.suffix) return c.suffix === "₹" ? "rupees" : c.suffix;
  if (c.unit === "perM") return "rupees per m";
  if (c.unit === "perPc") return "rupees per pc";
  if (c.unit === "perDot") return "rupees per dot";
  if (c.unit === "perKg") return "rupees per kg";
  return undefined;
};

const inputOf = (id: string): VarInput => {
  const c = cardOf(id);
  if (!c) return "derived";
  if (c.kind === "options") return "master";
  if (c.kind === "readonly") return "derived";
  return "entry";
};

const costBearingOf = (id: string): boolean => {
  const c = cardOf(id);
  return Boolean(c && (c.unit || c.accessory));
};

/** plain value read, suffixed with the card's unit when it has one */
const show = (s: ConfigState, id: string): string => {
  const v = s[id]?.value;
  if (v === undefined || v.trim() === "") return DASH;
  const c = cardOf(id);
  return c?.suffix && c.suffix !== "₹" ? `${v} ${c.suffix}` : v;
};

/** value plus the selected option's rate, when the option carries one */
const showRate = (s: ConfigState, id: string): string => {
  const v = s[id];
  if (!v || v.value.trim() === "") return DASH;
  if (v.rate === undefined || v.rate === 0) return v.value;
  return `${v.value} · ${inr(v.rate)}`;
};

/** typed rupee entry */
const showMoney = (s: ConfigState, id: string): string => {
  const v = s[id]?.value;
  if (v === undefined || v.trim() === "") return DASH;
  return inr(toNum(v));
};

const gate =
  (
    routes: RouteId[],
    read: (s: ConfigState, ctx: SpineCtx) => string,
  ): ((s: ConfigState, ctx: SpineCtx) => string) =>
  (s, ctx) =>
    routes.includes(routeOf(s)) ? read(s, ctx) : DASH;

type VarOpts = {
  unit?: string;
  input?: VarInput;
  costBearing?: boolean;
  quantitySensitive?: boolean;
  read?: (s: ConfigState, ctx: SpineCtx) => string;
};

/** build a card-backed variable row, deriving unit / input / cost flags from the card */
const mk =
  (section: SpineSectionId, group: string) =>
  (id: string, label: string, o: VarOpts = {}): VarDef => ({
    id,
    label,
    section,
    group,
    unit: o.unit ?? unitOf(id),
    input: o.input ?? inputOf(id),
    costBearing: o.costBearing ?? costBearingOf(id),
    quantitySensitive: o.quantitySensitive ?? false,
    read: o.read ?? ((s) => show(s, id)),
  });

/** build a synthetic (derived) variable row that has no card behind it */
const der = (
  section: SpineSectionId,
  group: string,
  id: string,
  label: string,
  read: (s: ConfigState, ctx: SpineCtx) => string,
  o: { unit?: string; costBearing?: boolean; quantitySensitive?: boolean } = {},
): VarDef => ({
  id,
  label,
  section,
  group,
  unit: o.unit,
  input: "derived",
  costBearing: o.costBearing ?? false,
  quantitySensitive: o.quantitySensitive ?? false,
  read,
});

/* ------------------------------------------------------------------ *
 * 0 · Context
 * ------------------------------------------------------------------ */

const ctxArticle = mk("context", "Article");
const ctxBasis = mk("context", "Commercial Basis");
const ctxRoute = mk("context", "Route Basis");
const ctxComply = mk("context", "Compliance");

const CONTEXT_VARS: VarDef[] = [
  ctxArticle("articleStyle", "Article / Style"),
  ctxArticle("buyerName", "Buyer"),
  ctxArticle("productCategory", "Product Category"),
  ctxArticle("sizeSpec", "Finished Size"),
  ctxArticle("unitType", "Unit Type"),
  ctxBasis("orderQty", "Order Quantity", { unit: "pcs", quantitySensitive: true }),
  der(
    "context",
    "Commercial Basis",
    "moq",
    "Minimum Order Quantity",
    (s) =>
      s.moq?.value
        ? `${s.moq.value} pcs`
        : show(s, "orderQty") === DASH
          ? DASH
          : `${s.orderQty?.value} pcs`,
    { unit: "pcs", quantitySensitive: true },
  ),
  der(
    "context",
    "Commercial Basis",
    "quotedMoq",
    "Quoted MOQ",
    (s) => (s.quotedMoq?.value ? `${s.quotedMoq.value} pcs` : DASH),
    { unit: "pcs", quantitySensitive: true },
  ),
  ctxRoute("mfgRoute", "Manufacturing Route"),
  ctxRoute("fabricSource", "Fabric Source"),
  der("context", "Route Basis", "derivedRoute", "Derived Route", (s) => {
    const r = routeOf(s);
    return r === "ready"
      ? "Ready Fabric route"
      : r === "greige"
        ? "Greige Fabric route"
        : "Yarn route";
  }),
  ctxComply("certRequirement", "Certification Requirement"),
];

/* ------------------------------------------------------------------ *
 * 1 · Material specification
 * ------------------------------------------------------------------ */

const matId = mk("material", "Fabric Identification");
const matCon = mk("material", "Construction");
const matComp = mk("material", "Composition");
const matW = mk("material", "Widths");
const matCol = mk("material", "Colour");

const MATERIAL_VARS: VarDef[] = [
  matId("fabricCode", "Fabric Code"),
  matId("supplier", "Fabric Supplier", {
    quantitySensitive: true,
    read: (s) => showRate(s, "supplier"),
  }),
  matId("fabricQuality", "Fabric Quality", {
    quantitySensitive: true,
    read: (s) => showRate(s, "fabricQuality"),
  }),
  matId("fabricType", "Fabric Type", { read: (s) => showRate(s, "fabricType") }),
  matId("construction", "Fabric Construction", { read: (s) => showRate(s, "construction") }),
  matId("weaving", "Weave Type", { read: gate(["yarn"], (s) => show(s, "weaving")) }),
  matCon("count", "Yarn Count"),
  matCon("warp", "Warp"),
  matCon("weft", "Weft"),
  matCon("ply", "Ply"),
  matCon("reedPick", "Reed / Pick"),
  matCon("gsm", "GSM", { read: (s) => showRate(s, "gsm") }),
  matCon("twisting", "Twisting", { read: gate(["yarn"], (s) => show(s, "twisting")) }),
  matCon("hankWeight", "Hank Weight", {
    read: gate(["greige", "yarn"], (s) => show(s, "hankWeight")),
  }),
  matCon("bundleWeight", "Bundle Weight", {
    read: gate(["greige", "yarn"], (s) => show(s, "bundleWeight")),
  }),
  matComp("fibreType", "Fibre Type"),
  matComp("composition", "Composition", { read: (s) => showRate(s, "composition") }),
  matComp("blendPct", "Blend %", { unit: "%" }),
  matComp("organicRecycled", "Organic / Recycled"),
  matW("greigeWidth", "Greige Width"),
  matW("finishedWidth", "Finished Width"),
  matW("fabricWidth", "Fabric Width"),
  matW("usableWidth", "Usable Width"),
  matW("costingWidth", "Costing Width"),
  matCol("colour", "Colour"),
  matCol("pantone", "Pantone"),
  matCol("buyerColourCode", "Buyer Colour Code"),
  matCol("labDip", "Lab Dip"),
  matCol("colourway", "Solid / Multi-Colour"),
  matCol("contrastColour", "Contrast Colour"),
  der(
    "material",
    "Rates",
    "fabricRate",
    "Fabric Rate / Metre",
    (s) => inr(computeConfig(s, FABRIC_CARDS).fabricPerM),
    { unit: "rupees per m", costBearing: true, quantitySensitive: true },
  ),
  der(
    "material",
    "Rates",
    "fabricCostPerPiece",
    "Fabric Cost / Piece",
    (s) => inr(computeConfig(s, FABRIC_CARDS).costPerPiece),
    { unit: "rupees per pc", costBearing: true, quantitySensitive: true },
  ),
];

/* ------------------------------------------------------------------ *
 * 2 · Component breakdown
 * ------------------------------------------------------------------ */

const COMPONENT_VARS: VarDef[] = [
  der("components", "Component Breakdown", "compCount", "Components", (s, ctx) =>
    String(fabricComponents(s, ctx.fabricExtras).length),
  ),
  der(
    "components",
    "Component Breakdown",
    "compTotal",
    "Components Cost",
    (s, ctx) => inr(componentsCost(fabricComponents(s, ctx.fabricExtras))),
    { unit: "rupees per pc", costBearing: true, quantitySensitive: true },
  ),
  der(
    "components",
    "Component Breakdown",
    "compMainSpec",
    "Main Body Spec",
    (s) => deriveMainComponent(s).spec,
  ),
  der(
    "components",
    "Component Breakdown",
    "compMainConsumption",
    "Main Body Consumption",
    (s) => `${deriveMainComponent(s).consumption.toFixed(3)} m`,
    { unit: "m" },
  ),
  der(
    "components",
    "Component Breakdown",
    "compMainRate",
    "Main Body Rate",
    (s) => inr(deriveMainComponent(s).rate),
    { unit: "rupees per m", costBearing: true, quantitySensitive: true },
  ),
  der(
    "components",
    "Component Breakdown",
    "compMainWidth",
    "Main Body Width",
    (s) => (deriveMainComponent(s).width ? `${deriveMainComponent(s).width} in` : DASH),
    { unit: "in" },
  ),
  der(
    "components",
    "Component Breakdown",
    "compExtras",
    "Additional Components Cost",
    (s, ctx) => (ctx.fabricExtras.length ? inr(componentsCost(ctx.fabricExtras)) : DASH),
    { unit: "rupees per pc", costBearing: true },
  ),
  der(
    "components",
    "Component Breakdown",
    "compFilling",
    "Filling",
    (s, ctx) => {
      const c = ctx.fabricExtras.find((e) => e.name === "Filling");
      return c && componentCost(c) > 0 ? inr(componentCost(c)) : DASH;
    },
    { unit: "rupees per pc", costBearing: true },
  ),
  der(
    "components",
    "Component Breakdown",
    "compInterlining",
    "Interlining / Fusing",
    (s, ctx) => {
      const c = ctx.fabricExtras.find((e) => e.name === "Interlining / Fusing");
      return c && componentCost(c) > 0 ? inr(componentCost(c)) : DASH;
    },
    { unit: "rupees per pc", costBearing: true },
  ),
];

/* ------------------------------------------------------------------ *
 * 3 · Process configuration
 * ------------------------------------------------------------------ */

const prDye = mk("process", "Dyeing");
const prPrint = mk("process", "Printing");
const prEmb = mk("process", "Embroidery");
const prWash = mk("process", "Washing");
const prFin = mk("process", "Finishing & Special");
const prAsm = mk("process", "Assembly");
const prComply = mk("process", "Testing & Certification");

const PROCESS_VARS: VarDef[] = [
  prDye("dyeing", "Dyeing Method", {
    quantitySensitive: true,
    read: gate(["greige", "yarn"], (s) => showRate(s, "dyeing")),
  }),
  der(
    "process",
    "Dyeing",
    "dyeLot",
    "Dye Lot Basis",
    gate(["greige", "yarn"], (s) => `${s.orderQty?.value ?? "0"} pcs lot`),
    { quantitySensitive: true },
  ),
  prPrint("printVendor", "Print Vendor", {
    quantitySensitive: true,
    read: (s) => showRate(s, "printVendor"),
  }),
  prPrint("printTech", "Print Technique", {
    quantitySensitive: true,
    read: (s) => showRate(s, "printTech"),
  }),
  prPrint("printingMethod", "Fabric Printing Method", {
    read: (s) => showRate(s, "printingMethod"),
  }),
  prPrint("printingType", "Printing Type", { read: (s) => showRate(s, "printingType") }),
  prPrint("screenDigital", "Screen / Digital"),
  prPrint("printInk", "Ink Type", { read: (s) => showRate(s, "printInk") }),
  prPrint("printColours", "No. of Colours"),
  prPrint("printScreens", "Number of Screens"),
  prPrint("designRef", "Design Reference", { read: (s) => showRate(s, "designRef") }),
  prPrint("printDesign", "Print Design"),
  prPrint("repeatSize", "Repeat Size"),
  prPrint("coverage", "Coverage %"),
  prPrint("placement", "Print Placement"),
  prPrint("curing", "Curing / Fixation", { read: (s) => showRate(s, "curing") }),
  prPrint("postWash", "Post-print Wash", { read: (s) => showRate(s, "postWash") }),
  prPrint("softener", "Softener Finish", { read: (s) => showRate(s, "softener") }),
  prPrint("strikeOff", "Strike-off / Sampling", { read: (s) => showRate(s, "strikeOff") }),
  prPrint("screenCost", "Screen Cost", {
    unit: "rupees",
    costBearing: true,
    quantitySensitive: true,
    read: (s) => showMoney(s, "screenCost"),
  }),
  prPrint("printWastage", "Print Wastage %", { quantitySensitive: true }),
  prEmb("embSupplier", "Embroidery Supplier", {
    quantitySensitive: true,
    read: (s) => showRate(s, "embSupplier"),
  }),
  prEmb("embType", "Embroidery Type", { read: (s) => showRate(s, "embType") }),
  prEmb("embDots", "Number of Dots"),
  prEmb("embPerDot", "Per Dot Cost", {
    unit: "rupees per dot",
    costBearing: true,
    quantitySensitive: true,
    read: (s) => showMoney(s, "embPerDot"),
  }),
  prEmb("embWastage", "Embroidery Wastage %", { quantitySensitive: true }),
  prEmb("embroideryDesign", "Embroidery Design"),
  prEmb("embroideryPlacement", "Embroidery Placement"),
  prWash("washSupplier", "Washing Supplier", { read: (s) => showRate(s, "washSupplier") }),
  prWash("washType", "Washing Type", { read: (s) => showRate(s, "washType") }),
  prWash("washRecipe", "Washing Recipe", { read: (s) => showRate(s, "washRecipe") }),
  prWash("washPerKg", "Wash Cost / KG", {
    unit: "rupees per kg",
    costBearing: true,
    read: (s) => showMoney(s, "washPerKg"),
  }),
  prWash("washWeightPerPcs", "Weight Per Piece"),
  prFin("specialProcess", "Special Process", { read: (s) => showRate(s, "specialProcess") }),
  prFin("handProcess", "Hand Process", { read: (s) => showRate(s, "handProcess") }),
  prFin("tubWash", "Tub Wash", { read: (s) => showRate(s, "tubWash") }),
  prFin("transport", "Transport Required", { read: (s) => showRate(s, "transport") }),
  prFin("accFusingProcess", "Fusing Process Cost"),
  prFin("accHandQuilting", "Hand Quilting"),
  prFin("accHandTucking", "Hand Tucking"),
  prAsm("mfgCutting", "Cutting Cost", { read: (s) => showMoney(s, "mfgCutting") }),
  prAsm("mfgStitching", "Stitching Cost", { read: (s) => showMoney(s, "mfgStitching") }),
  prAsm("mfgHemming", "Hemming / Edge Finish", { read: (s) => showMoney(s, "mfgHemming") }),
  prComply("testRequired", "Testing Required"),
  prComply("testType", "Test Type", { read: (s) => showRate(s, "testType") }),
  prComply("testLab", "Testing Laboratory", { read: (s) => showRate(s, "testLab") }),
  prComply("certType", "Certification Type", { read: (s) => showRate(s, "certType") }),
];

/* ------------------------------------------------------------------ *
 * 4 · Consumption, wastage & shrinkage
 * ------------------------------------------------------------------ */

const cnCut = mk("consumption", "Cut Size");
const cnLoss = mk("consumption", "Losses");

const CONSUMPTION_VARS: VarDef[] = [
  cnCut("cutWidth", "Cut Width"),
  cnCut("cutLength", "Cut Length"),
  cnCut("bitsMarker", "Bits / Marker", { quantitySensitive: true }),
  cnCut("widthUsed", "Fabric Width Used"),
  cnLoss("shrinkage", "Shrinkage %"),
  cnLoss("wastage", "Wastage %", { quantitySensitive: true }),
  der(
    "consumption",
    "Derived",
    "consumptionM",
    "Consumption",
    (s) => `${computeConfig(s, FABRIC_CARDS).consumption.toFixed(3)} m`,
    { unit: "m" },
  ),
  der(
    "consumption",
    "Derived",
    "requiredMeterM",
    "Required Meter",
    (s) => `${computeConfig(s, FABRIC_CARDS).requiredMeter.toFixed(3)} m`,
    { unit: "m" },
  ),
];

/* ------------------------------------------------------------------ *
 * 5 · Accessories & trims
 * ------------------------------------------------------------------ */

const trClose = mk("trims", "Closures");
const trHard = mk("trims", "Hardware & Board");

const TRIM_VARS: VarDef[] = [
  trClose("accZipper", "Zipper", { quantitySensitive: true }),
  trClose("accButton", "Button", { quantitySensitive: true }),
  trClose("accPressButtons", "Press Buttons", { quantitySensitive: true }),
  trHard("accEyelet", "Eyelet + Fixing", { quantitySensitive: true }),
  trHard("accORing", "O-Ring", { quantitySensitive: true }),
  trHard("accCardboard", "Cardboard", { quantitySensitive: true }),
];

/* ------------------------------------------------------------------ *
 * 6 · Packaging
 * ------------------------------------------------------------------ */

const pkPrimary = mk("packaging", "Primary Packing");
const pkLabels = mk("packaging", "Labels");
const pkCarton = mk("packaging", "Carton");
const pkNotes = mk("packaging", "Notes");

const PACKAGING_VARS: VarDef[] = [
  pkPrimary("pkgType", "Packaging Type", {
    quantitySensitive: true,
    read: (s) => showRate(s, "pkgType"),
  }),
  pkPrimary("pkgPolyBag", "Poly Bag", {
    quantitySensitive: true,
    read: (s) => showRate(s, "pkgPolyBag"),
  }),
  pkPrimary("pkgInner", "Inner Packing"),
  pkLabels("pkgBarcode", "Barcode Label", { quantitySensitive: true }),
  pkLabels("pkgHangTag", "Hang Tag", {
    quantitySensitive: true,
    read: (s) => showRate(s, "pkgHangTag"),
  }),
  pkCarton("pkgCarton", "Carton Type", {
    quantitySensitive: true,
    read: (s) => showRate(s, "pkgCarton"),
  }),
  pkNotes("pkgNotes", "Packing Notes"),
];

/* ------------------------------------------------------------------ *
 * 7 · Direct cost roll-up
 * ------------------------------------------------------------------ */

const phaseAmount = (s: ConfigState, ctx: SpineCtx, id: string) =>
  rollupPhases(s, ctx).phases.find((p) => p.id === id)?.amount ?? 0;

const ROLLUP_VARS: VarDef[] = [
  der(
    "rollup",
    "Roll-Up",
    "rollRaw",
    "Raw Material Total",
    (s, ctx) => inr(phaseAmount(s, ctx, "raw")),
    { unit: "rupees per pc", costBearing: true, quantitySensitive: true },
  ),
  der(
    "rollup",
    "Roll-Up",
    "rollProcess",
    "Process Total",
    (s, ctx) => inr(phaseAmount(s, ctx, "process")),
    { unit: "rupees per pc", costBearing: true, quantitySensitive: true },
  ),
  der(
    "rollup",
    "Roll-Up",
    "rollPackaging",
    "Packaging Total",
    (s, ctx) => inr(phaseAmount(s, ctx, "packaging")),
    { unit: "rupees per pc", costBearing: true, quantitySensitive: true },
  ),
  der(
    "rollup",
    "Roll-Up",
    "rollDirect",
    "Direct Cost / Piece",
    (s, ctx) => inr(rollupPhases(s, ctx).directTotal),
    { unit: "rupees per pc", costBearing: true, quantitySensitive: true },
  ),
  der("rollup", "Roll-Up", "rollFabricShare", "Fabric Share of Direct", (s, ctx) => {
    const total = rollupPhases(s, ctx).directTotal;
    if (total <= 0) return DASH;
    const fabric = componentCost(deriveMainComponent(s));
    return `${((fabric / total) * 100).toFixed(1)} %`;
  }),
  der(
    "rollup",
    "Roll-Up",
    "rollOrderValue",
    "Direct Cost × Order Qty",
    (s, ctx) => {
      const qty = toNum(s.orderQty?.value);
      if (qty <= 0) return DASH;
      return inr(rollupPhases(s, ctx).directTotal * qty, 0);
    },
    { unit: "rupees", costBearing: true, quantitySensitive: true },
  ),
];

export const VARIABLES: VarDef[] = [
  ...CONTEXT_VARS,
  ...MATERIAL_VARS,
  ...COMPONENT_VARS,
  ...PROCESS_VARS,
  ...CONSUMPTION_VARS,
  ...TRIM_VARS,
  ...PACKAGING_VARS,
  ...ROLLUP_VARS,
];
