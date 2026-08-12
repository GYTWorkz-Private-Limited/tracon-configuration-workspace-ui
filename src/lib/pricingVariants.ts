/**
 * Pricing variants — the configurable parameters that sit above a variant's
 * component build, plus the commercial layer that turns direct cost into a
 * selling price.
 *
 * The parameters are NOT decoration. Each one is applied to the component
 * model by `applyParameters`, which returns a new priced variant:
 *
 *   MOQ     → fixed setup (screens, digitising) amortised over the order
 *   Size    → finished dimensions → consumption rule → material cost
 *   Quality → fabric GSM → rate, recorded as a traceable override
 *
 * Components always store their BASE values. `applyParameters` is pure and is
 * re-applied from that base every render, so selecting a parameter twice can
 * never compound.
 *
 * Everything below "commercial" is deliberately quarantined: the configuration
 * roll-up still ends at direct cost, and no commercial figure feeds back into
 * it.
 */

import {
  finalOf,
  sourced,
  withOverride,
  type MaterialMaster,
  type CommercialInputs,
  type ComponentDef,
  type ParameterId,
  type ParameterOption,
  type ProcessItem,
  type Variant,
  type VariantParameter,
} from "./costingModel";

// The parameter shapes live in `costingModel` so the Variant type can name
// them directly; they are re-exported here because this is where their
// behaviour lives and every caller imports from this module.
export type { CommercialInputs, ParameterId, ParameterOption, VariantParameter };

/* ------------------------------------------------------------------ *
 * Parameter definitions
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * Base configuration — matches the Placemat reference build
 * ------------------------------------------------------------------ */

/** The dimensions the component consumption rules were authored against. */
export const BASE_SIZE: [number, number] = [13, 19];
/** The GSM the base material rate belongs to. */
export const BASE_GSM = 200;

/**
 * Fixed, order-level costs that do not scale with quantity: rotary screen
 * preparation and embroidery digitising. Amortised across the order, so the
 * per-piece figure moves sharply at low MOQ — which is the entire reason the
 * costing team wants MOQ as a pricing variant.
 */
export const SETUP_COST_INR = 22_500;

/**
 * Rate for a target GSM of a given cloth.
 *
 * Scaled from the material's OWN rate and weight rather than a global table,
 * so the Quality parameter composes correctly with the fabric chosen in the
 * CONFIGURE tab: picking Linen Cotton then 240 GSM prices linen at 240 GSM,
 * not sateen.
 */
export const rateForGsm = (master: MaterialMaster, gsm: number): number => {
  const baseGsm = master.gsm ?? BASE_GSM;
  if (!baseGsm) return master.rate;
  // ₹ per metre scales close to linearly with cloth weight.
  return Math.round(master.rate * (gsm / baseGsm) * 100) / 100;
};

export const DEFAULT_PARAMETERS: VariantParameter[] = [
  {
    id: "moq",
    label: "MOQ",
    hint: "Volume tier — setup amortised",
    unit: "pcs",
    selectedId: "moq-3000",
    options: [
      { id: "moq-500", label: "500 pcs", value: 500 },
      { id: "moq-1000", label: "1,000 pcs", value: 1000 },
      { id: "moq-3000", label: "3,000 pcs", value: 3000 },
      { id: "moq-5000", label: "5,000 pcs", value: 5000 },
      { id: "moq-10000", label: "10,000 pcs", value: 10000 },
    ],
  },
  {
    id: "size",
    label: "Size",
    hint: "Geometry — drives consumption",
    unit: "inches",
    selectedId: "size-13x19",
    options: [
      { id: "size-13x19", label: '13" × 19"', value: [13, 19] },
      { id: "size-14x20", label: '14" × 20"', value: [14, 20] },
      { id: "size-16x22", label: '16" × 22"', value: [16, 22] },
      { id: "size-18x24", label: '18" × 24"', value: [18, 24] },
    ],
  },
  {
    id: "quality",
    label: "Quality",
    hint: "Fabric weight (GSM)",
    unit: "GSM",
    selectedId: "gsm-200",
    options: [
      { id: "gsm-185", label: "185 GSM", value: 185 },
      { id: "gsm-200", label: "200 GSM", value: 200 },
      { id: "gsm-240", label: "240 GSM", value: 240 },
      { id: "gsm-350", label: "350 GSM", value: 350 },
    ],
  },
];

export const DEFAULT_COMMERCIAL: CommercialInputs = {
  fxRate: 90,
  targetMarginPct: 26,
  buyerTargetUsd: 6.9,
};

/* ------------------------------------------------------------------ *
 * Reading selections
 * ------------------------------------------------------------------ */

export const selectedOption = (p: VariantParameter): ParameterOption =>
  p.options.find((o) => o.id === p.selectedId) ?? p.options[0];

export const parameterById = (params: VariantParameter[], id: ParameterId): VariantParameter =>
  params.find((p) => p.id === id) ?? DEFAULT_PARAMETERS.find((p) => p.id === id)!;

export const moqOf = (params: VariantParameter[]): number =>
  selectedOption(parameterById(params, "moq")).value as number;

export const sizeOf = (params: VariantParameter[]): [number, number] =>
  selectedOption(parameterById(params, "size")).value as [number, number];

export const gsmOf = (params: VariantParameter[]): number =>
  selectedOption(parameterById(params, "quality")).value as number;

/** Immutable selection change. */
export const selectParameter = (
  params: VariantParameter[],
  id: ParameterId,
  optionId: string,
): VariantParameter[] => params.map((p) => (p.id === id ? { ...p, selectedId: optionId } : p));

/** Append a costing-team value and select it. Duplicates are reselected, not re-added. */
export const addCustomOption = (
  params: VariantParameter[],
  id: ParameterId,
  option: ParameterOption,
): VariantParameter[] =>
  params.map((p) => {
    if (p.id !== id) return p;
    const existing = p.options.find((o) => o.label === option.label);
    if (existing) return { ...p, selectedId: existing.id };
    return { ...p, options: [...p.options, option], selectedId: option.id };
  });

/* ------------------------------------------------------------------ *
 * Applying parameters to the component model
 * ------------------------------------------------------------------ */

const SETUP_PROCESS_ID = "PARAM-SETUP";

/** Components whose consumption follows the perimeter (ties, borders, piping). */
const scalesWithPerimeter = (c: ComponentDef) => c.type === "Trim / Self Fabric";
/** Components whose consumption follows the face area (body, panels, lining). */
const scalesWithArea = (c: ComponentDef) =>
  c.type === "Fabric" ||
  c.type === "Self Fabric Panel" ||
  c.type === "Lining" ||
  c.type === "Filling";

/**
 * Components made of the SHELL cloth — the fabric the Quality parameter is a
 * decision about. A filling, wadding or interlining is deliberately excluded:
 * it carries its own weight spec, and repricing a 45 GSM fusible as though it
 * were 300 GSM sateen is not a quality choice, it is a wrong number.
 */
const isShellCloth = (c: ComponentDef) =>
  c.type === "Fabric" ||
  c.type === "Self Fabric Panel" ||
  c.type === "Trim / Self Fabric" ||
  c.type === "Lining";

/**
 * Produce the priced variant for the current parameter selection.
 *
 * Pure: `variant.components` keeps its base values and is never written to, so
 * this can be re-run on every render without compounding.
 */
export function applyParameters(
  variant: Variant,
  params: VariantParameter[],
  masters: { materials: Record<string, MaterialMaster> },
  /**
   * Fabric rates earned by the ORDER rather than by this variant — the metre
   * total across every article sharing the fabric clears a price break. Passed
   * in because that total is a POD-level fact this function cannot see, and
   * omitted wherever an article is being read on its own.
   */
  fabricRates?: Record<string, { factor: number; note: string }>,
): Variant {
  const [w, l] = sizeOf(params);
  const gsm = gsmOf(params);
  const moq = moqOf(params);

  const [baseW, baseL] = variant.baseSize ?? BASE_SIZE;
  const setupCostInr = variant.setupCostInr ?? SETUP_COST_INR;
  const areaRatio = (w * l) / (baseW * baseL);
  const perimeterRatio = (w + l) / (baseW + baseL);
  const setupPerPc = Math.round((setupCostInr / moq) * 100) / 100;

  const components = variant.components.map((c) => {
    let next = c;

    /* ---- size → consumption rule ---- */
    if (next.consumption) {
      if (next.type === "Fabric") {
        // The body carries the finished size literally.
        next = {
          ...next,
          consumption: { ...next.consumption, finishedWidth: w, finishedLength: l },
        };
      } else if (scalesWithPerimeter(next)) {
        next = {
          ...next,
          consumption: {
            ...next.consumption,
            finishedLength: round2((next.consumption.finishedLength ?? 0) * perimeterRatio),
          },
        };
      } else if (scalesWithArea(next)) {
        next = {
          ...next,
          consumption: {
            ...next.consumption,
            finishedWidth: round2((next.consumption.finishedWidth ?? 0) * Math.sqrt(areaRatio)),
            finishedLength: round2((next.consumption.finishedLength ?? 0) * Math.sqrt(areaRatio)),
          },
        };
      }
    }

    /* ---- quality → material rate, recorded as a traceable override ----
       Quality is a decision about the FACE CLOTH's weight. It is applied only
       where the component owns a master fabric: a self-fabric component
       inherits through its stored relationship (overriding it too would
       double-apply the choice), and a filling, wadding or interlining has its
       own weight that has nothing to do with the shell — repricing a 45 GSM
       fusible as if it were 133 GSM percale is not a quality choice, it is a
       wrong number. */
    if (
      isShellCloth(next) &&
      next.material?.relationship === "master" &&
      next.material.materialMasterId
    ) {
      const master = masters.materials[next.material.materialMasterId];
      if (master && gsm !== (master.gsm ?? BASE_GSM)) {
        next = {
          ...next,
          material: {
            ...next.material,
            rate: withOverride(
              next.material.rate,
              rateForGsm(master, gsm),
              `Quality parameter — ${gsm} GSM`,
            ),
          },
        };
      }
    }

    /* ---- order volume → fabric price break ----
       Applied after quality, because quality decides WHICH cloth and the tier
       only decides what that cloth costs at this volume. Recorded as an
       override like every other derived rate, so the sheet can still show the
       master's own number underneath it. */
    if (fabricRates && next.material?.materialMasterId) {
      const tier = fabricRates[next.material.materialMasterId];
      if (tier && tier.factor !== 1) {
        const discounted = Math.round(finalOf(next.material.rate) * tier.factor * 100) / 100;
        next = {
          ...next,
          material: {
            ...next.material,
            rate: withOverride(next.material.rate, discounted, tier.note),
          },
        };
      }
    }

    /* ---- MOQ → amortised setup, carried on the decoration component ---- */
    if (next.type === "Decoration") {
      const setup: ProcessItem = {
        id: `${next.id}-${SETUP_PROCESS_ID}`,
        componentId: next.id,
        type: "Order Setup",
        name: "Setup amortisation",
        sequence: 0,
        description: `Rotary screens and embroidery digitising (${inrPlain(setupCostInr)} fixed) spread across an order of ${moq.toLocaleString("en-IN")} pcs.`,
        params: [
          { label: "Fixed setup", value: inrPlain(setupCostInr) },
          { label: "Order quantity", value: `${moq.toLocaleString("en-IN")} pcs` },
        ],
        basis: "per pc",
        quantity: 1,
        rate: sourced(setupPerPc, "Costing Override", "PARAM-MOQ"),
        rateUnit: "per piece",
      };
      next = {
        ...next,
        processes: [setup, ...next.processes.filter((p) => !p.id.endsWith(SETUP_PROCESS_ID))],
      };
    }

    return next;
  });

  // Lab tests and certificates are quoted per submission, so the order
  // quantity they are spread across is the MOQ the team is pricing.
  const testing = variant.testing.map((t) => ({ ...t, lotSize: moq }));

  return { ...variant, components, testing };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const inrPlain = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/* ------------------------------------------------------------------ *
 * Commercial layer — quarantined from the direct-cost roll-up
 * ------------------------------------------------------------------ */

export type CommercialOutput = {
  /** direct manufacturing cost, ₹ per piece */
  totalCostInr: number;
  /** the same cost expressed in $ */
  costUsd: number;
  /** price that achieves the target margin, $ per piece */
  sellingUsd: number;
  marginPct: number;
  buyerTargetUsd: number;
  /** selling price is at or below what the buyer wants to pay */
  onTarget: boolean;
  /** $ per piece between the quote and the buyer's target */
  headroomUsd: number;
};

/**
 * selling = cost ÷ (1 − margin). Margin is on the selling price, which is how
 * the commercial team quotes it — not a mark-up on cost.
 */
export function commercialOutput(
  directCostInr: number,
  commercial: CommercialInputs,
): CommercialOutput {
  const fx = commercial.fxRate || 1;
  const costUsd = directCostInr / fx;
  const marginFraction = Math.min(0.95, Math.max(0, commercial.targetMarginPct / 100));
  const sellingUsd = costUsd / (1 - marginFraction);

  return {
    totalCostInr: directCostInr,
    costUsd: round2(costUsd),
    sellingUsd: round2(sellingUsd),
    marginPct: commercial.targetMarginPct,
    buyerTargetUsd: commercial.buyerTargetUsd,
    onTarget: sellingUsd <= commercial.buyerTargetUsd,
    headroomUsd: round2(commercial.buyerTargetUsd - sellingUsd),
  };
}
