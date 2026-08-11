/**
 * Scenarios — the level above variants.
 *
 *   Scenario  → a whole costing position ("Premium", "Low Cost", "Eco Option")
 *     Variant → a way of building the product inside that position
 *       Option → one parameter changed inside a variant
 *
 * A scenario is a named set of overrides applied on top of the base build:
 * parameter selections, a fabric swap, and commercial inputs. It stores only
 * what differs, so the base configuration stays the single source of truth and
 * a change to it flows into every scenario automatically.
 *
 * The percentage a scenario reports is its selling-price delta against the base
 * scenario — which is what a commercial team compares positions on.
 */

import type { CommercialInputs, ParameterId, Variant, VariantParameter } from "./costingModel";

export type Scenario = {
  id: string;
  name: string;
  /** one line under the name, e.g. "Base scenario" or "Sustainable" */
  subtitle: string;
  /** the base scenario is the comparison point and cannot be closed */
  isBase?: boolean;
  /** parameter id → option id */
  parameters: Partial<Record<ParameterId, string>>;
  /** swaps the body fabric's material master across the build */
  fabricMasterId?: string;
  commercial: Partial<CommercialInputs>;
};

export const SCENARIO_PRESETS: Scenario[] = [
  {
    id: "SCN-BASE",
    name: "As Enquired",
    subtitle: "Base scenario",
    isBase: true,
    parameters: {},
    commercial: {},
  },
  {
    id: "SCN-PREMIUM",
    name: "Premium",
    subtitle: "Heavier cloth, linen blend",
    parameters: { quality: "gsm-240" },
    fabricMasterId: "MAT-003",
    commercial: {},
  },
  {
    id: "SCN-LOWCOST",
    name: "Low Cost",
    subtitle: "Poly blend at volume",
    parameters: { quality: "gsm-185", moq: "moq-10000" },
    fabricMasterId: "MAT-004",
    commercial: {},
  },
  {
    id: "SCN-HIGHMARGIN",
    name: "High Margin",
    subtitle: "Same build, 35% margin",
    parameters: {},
    commercial: { targetMarginPct: 35 },
  },
  {
    id: "SCN-MOQ5000",
    name: "MOQ 5,000",
    subtitle: "Volume scenario",
    parameters: { moq: "moq-5000" },
    commercial: {},
  },
  {
    id: "SCN-ECO",
    name: "Eco Option",
    subtitle: "Sustainable",
    parameters: {},
    fabricMasterId: "MAT-005",
    commercial: {},
  },
];

/** Only the base is loaded up-front; the rest are offered by "Add Scenario". */
export const DEFAULT_SCENARIOS: Scenario[] = SCENARIO_PRESETS.slice(0, 1);

/**
 * Apply a scenario's overrides to a variant. Pure — the stored variant keeps
 * its base configuration, so switching scenarios back and forth is lossless.
 */
export function applyScenario(variant: Variant, scenario: Scenario): Variant {
  const parameters: VariantParameter[] = variant.parameters.map((p) => {
    const optionId = scenario.parameters[p.id];
    if (!optionId) return p;
    // An override naming an option that does not exist is ignored rather than
    // silently selecting the first one.
    return p.options.some((o) => o.id === optionId) ? { ...p, selectedId: optionId } : p;
  });

  const components = scenario.fabricMasterId
    ? variant.components.map((c) =>
        c.material?.relationship === "master" && c.type === "Fabric"
          ? {
              ...c,
              material: {
                ...c.material,
                materialMasterId: scenario.fabricMasterId,
                // Drop any rate override so the new master's own rate applies;
                // the quality parameter re-derives from it afterwards.
                rate: { ...c.material.rate, override: undefined },
              },
            }
          : c,
      )
    : variant.components;

  return {
    ...variant,
    parameters,
    components,
    commercial: { ...variant.commercial, ...scenario.commercial },
  };
}

/** Selling-price delta against the base scenario, as a signed percentage. */
export const scenarioDelta = (sellingUsd: number, baseSellingUsd: number): number =>
  baseSellingUsd > 0 ? Math.round(((sellingUsd - baseSellingUsd) / baseSellingUsd) * 1000) / 10 : 0;
