/**
 * The one bridge from Configuration & Costing into Quotation.
 *
 * Quotation quotes the commercially selected version of a costing. It does not
 * hold cost data and it does not compute cost differently — every figure it
 * shows comes out of this module, which runs the SAME pipeline the
 * Configuration workspace runs:
 *
 *   resolveCostingModel → applyScenario → pins → applyParameters
 *     → rollupVariant            (direct cost — manufacturing, unchanged)
 *     → computeCommercials       (provisions, selling price, margin)
 *
 * Because the quote is re-costed from the scenario/variant/option DEFINITION
 * rather than from a stored number, changing a scenario in Configuration moves
 * the quotation. There is no second copy of the truth to fall out of date.
 */

import { resolveCostingModel } from "./costingModels";
import { rollupVariant, type CostRollup, type Variant } from "./costingModel";
import {
  addCustomOption,
  applyParameters,
  gsmOf,
  moqOf,
  sizeOf,
  type CommercialInputs,
} from "./pricingVariants";
import { applyScenario, SCENARIO_PRESETS, type Scenario } from "./scenarios";
import {
  computeCommercials,
  computeKitCommercials,
  DEFAULT_PROVISIONS,
  type CommercialResult,
  type ProvisionRates,
} from "./commercialProvisions";
import { BASE_BUILD, type BuildRef } from "./costingSelectionStore";

/** Everything needed to price one configured line. */
export type PricingRequest = {
  /** the article's costing reference — picks the product's costing model */
  srfRef: string | undefined;
  scenario: Scenario;
  build: BuildRef;
  /**
   * The article's own geometry and volume, from its POD record.
   *
   * Several articles can share a costing model — a runner and a placemat are
   * both flat printed table linen — but they are not the same product. These
   * seed the size and MOQ parameters so each article is costed at its OWN
   * dimensions instead of silently inheriting the model's reference build.
   * A scenario or a variant still overrides them.
   */
  defaults?: { size?: [number, number]; moq?: number };
  /** commercial overrides captured on the quote line */
  rates?: Partial<ProvisionRates>;
  targetMarginPct?: number;
  /** quantity actually being quoted, when it differs from the build's MOQ */
  moqOverride?: number;
};

/**
 * Read finished dimensions off an article's size string.
 * Handles `13" × 19"`, `70×140 cm` and `108" × 96" (King)`; returns undefined
 * for sizes that are not dimensional ("Std", "Set of 2").
 */
export function parseSize(size?: string): [number, number] | undefined {
  if (!size) return undefined;
  const cm = /(\d+(?:\.\d+)?)\s*(?:×|x|\*)\s*(\d+(?:\.\d+)?)\s*cm/i.exec(size);
  if (cm) return [round1(Number(cm[1]) / 2.54), round1(Number(cm[2]) / 2.54)];
  const inches = /(\d+(?:\.\d+)?)\s*(?:"|”|in)?\s*(?:×|x|\*)\s*(\d+(?:\.\d+)?)/.exec(size);
  if (inches) return [Number(inches[1]), Number(inches[2])];
  return undefined;
}

/** `"3,000 pcs"` → 3000. Undefined when the string carries no quantity. */
export function parseMoq(moq?: string): number | undefined {
  if (!moq) return undefined;
  const n = Number(String(moq).replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export type PricedLine = {
  scenario: Scenario;
  build: BuildRef;
  /** the priced variant the numbers were produced from */
  variant: Variant;
  /** manufacturing roll-up — identical to what the costing sheet shows */
  rollup: CostRollup;
  /** direct manufacturing cost, ₹ / pc */
  directCostInr: number;
  directCostUsd: number;
  /** full commercial stack on top of direct cost */
  commercial: CommercialResult;
  /* ---- configuration context, read back off the priced variant ---- */
  moq: number;
  sizeLabel: string;
  gsm: number;
  fxRate: number;
  /** selling price × quoted quantity, $ */
  orderValueUsd: number;
};

const SIZE_LABEL = (size: [number, number]) => `${size[0]}" × ${size[1]}"`;

/**
 * Rebuild the exact variant a scenario + build describes.
 *
 * Pure and re-runnable: the stored base variant is never written to, so
 * pricing the same request twice always produces the same numbers.
 */
export function buildPricedVariant(req: PricingRequest): {
  variant: Variant;
  masters: ReturnType<typeof resolveCostingModel>["masters"];
} {
  const bundle = resolveCostingModel(req.srfRef);

  // 0 — the article's own size and volume, so two articles sharing a costing
  //     model are still costed as the different products they are.
  let base = bundle.defaultVariant;
  const d = req.defaults;
  if (d?.size || d?.moq) {
    let params = base.parameters;
    if (d.size) {
      params = addCustomOption(params, "size", {
        id: `size-${d.size[0]}x${d.size[1]}`,
        label: `${d.size[0]}" × ${d.size[1]}"`,
        value: d.size,
      });
    }
    if (d.moq) {
      params = addCustomOption(params, "moq", {
        id: `moq-${d.moq}`,
        label: `${d.moq.toLocaleString("en-IN")} pcs`,
        value: d.moq,
      });
    }
    base = { ...base, parameters: params };
  }

  // 1 — the scenario's overrides (parameters, fabric swap, commercials)
  const scoped = applyScenario(base, req.scenario);

  // 2 — what this variant/option pins on top. The whole option travels, so a
  //     hand-typed value rebuilds the same way a preset tier does.
  let parameters = req.build.pins.reduce(
    (params, pin) => addCustomOption(params, pin.parameterId, pin.option),
    scoped.parameters,
  );

  // 3 — a quantity chosen on the quote line, when the commercial team is
  //     quoting a different break to the one costing worked on.
  if (req.moqOverride && req.moqOverride > 0) {
    parameters = addCustomOption(parameters, "moq", {
      id: `moq-quote-${req.moqOverride}`,
      label: `${req.moqOverride.toLocaleString("en-IN")} pcs`,
      value: req.moqOverride,
      custom: true,
    });
  }

  // 4 — apply them to the component model
  return {
    variant: applyParameters({ ...scoped, parameters }, parameters, bundle.masters),
    masters: bundle.masters,
  };
}

/** Price one configured line, end to end. */
export function priceLine(req: PricingRequest): PricedLine {
  const { variant, masters } = buildPricedVariant(req);
  const rollup = rollupVariant(variant, masters);

  const commercialInputs: CommercialInputs = variant.commercial;
  const fxRate = commercialInputs.fxRate > 0 ? commercialInputs.fxRate : 1;
  const marginPct = req.targetMarginPct ?? commercialInputs.targetMarginPct;

  const commercial = computeCommercials(rollup.directCost, {
    rates: { ...DEFAULT_PROVISIONS, ...req.rates },
    fxRate,
    targetMarginPct: marginPct,
    buyerTargetUsd: commercialInputs.buyerTargetUsd,
  });

  const moq = moqOf(variant.parameters);

  return {
    scenario: req.scenario,
    build: req.build,
    variant,
    rollup,
    directCostInr: rollup.directCost,
    directCostUsd: Math.round((rollup.directCost / fxRate) * 100) / 100,
    commercial,
    moq,
    sizeLabel: SIZE_LABEL(sizeOf(variant.parameters)),
    gsm: gsmOf(variant.parameters),
    fxRate,
    orderValueUsd: Math.round(commercial.sellingUsd * moq * 100) / 100,
  };
}

/* ------------------------------------------------------------------ *
 * Kits
 * ------------------------------------------------------------------ */

export type KitMemberRequest = PricingRequest & {
  /** how many of this article go into one set */
  unitsPerSet: number;
  name: string;
  articleId: string;
  image?: string;
};

export type PricedKit = {
  members: (PricedLine & {
    unitsPerSet: number;
    name: string;
    articleId: string;
    image?: string;
  })[];
  /** every member's direct cost × its units, summed — ₹ per SET */
  setDirectCostInr: number;
  setDirectCostUsd: number;
  /** the commercial stack applied ONCE to the set, not per member */
  commercial: CommercialResult;
  /** sets being quoted */
  sets: number;
  fxRate: number;
  orderValueUsd: number;
};

/**
 * Price a kit as one commercial position.
 *
 * The members are costed individually — each keeps its own scenario, variant,
 * option and MOQ — but the provisions and margin are applied once, to the set.
 * A kit price is a combined quotation, not two unrelated quotes side by side.
 */
export function priceKit(
  members: KitMemberRequest[],
  opts: { rates?: Partial<ProvisionRates>; targetMarginPct?: number; sets?: number },
): PricedKit {
  const priced = members.map((m) => ({
    ...priceLine(m),
    unitsPerSet: m.unitsPerSet > 0 ? m.unitsPerSet : 1,
    name: m.name,
    articleId: m.articleId,
    image: m.image,
  }));

  const fxRate = priced[0]?.fxRate ?? 90;
  const marginPct = opts.targetMarginPct ?? priced[0]?.variant.commercial.targetMarginPct ?? 26;
  const buyerTargetUsd = priced.reduce(
    (t, m) => t + m.variant.commercial.buyerTargetUsd * m.unitsPerSet,
    0,
  );

  const commercial = computeKitCommercials(
    priced.map((m) => ({ directCostInr: m.directCostInr, unitsPerSet: m.unitsPerSet })),
    {
      rates: { ...DEFAULT_PROVISIONS, ...opts.rates },
      fxRate,
      targetMarginPct: marginPct,
      buyerTargetUsd: Math.round(buyerTargetUsd * 100) / 100,
    },
  );

  // Sets default to the smallest member MOQ — you cannot ship more sets than
  // the scarcest component in them allows.
  const sets = opts.sets ?? Math.min(...priced.map((m) => Math.floor(m.moq / m.unitsPerSet)));

  return {
    members: priced,
    setDirectCostInr: commercial.directCostInr,
    setDirectCostUsd: commercial.directCostInr / fxRate,
    commercial,
    sets: Number.isFinite(sets) && sets > 0 ? sets : 0,
    fxRate,
    orderValueUsd: Math.round(commercial.sellingUsd * (sets > 0 ? sets : 0) * 100) / 100,
  };
}

/* ------------------------------------------------------------------ *
 * Lookups
 * ------------------------------------------------------------------ */

export const scenarioById = (scenarios: Scenario[], id: string): Scenario =>
  scenarios.find((s) => s.id === id) ??
  SCENARIO_PRESETS.find((s) => s.id === id) ??
  SCENARIO_PRESETS[0];

export const buildById = (builds: BuildRef[], id: string): BuildRef =>
  builds.find((b) => b.id === id) ?? builds[0] ?? BASE_BUILD;

/** Category totals a kit summary reports per member. */
export const categoryTotals = (rollup: CostRollup) => [
  { key: "rawMaterial", label: "Raw material", amount: rollup.rawMaterial },
  { key: "process", label: "Process", amount: rollup.process },
  { key: "accessories", label: "Accessories / trims", amount: rollup.accessories },
  { key: "packaging", label: "Packaging", amount: rollup.packaging },
  { key: "testing", label: "Testing & certification", amount: rollup.testing },
];
