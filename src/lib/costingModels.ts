/**
 * Costing model registry — resolves an article to its product-specific
 * costing bundle (masters, default variant, fabric options, add-component
 * presets) by srfRef.
 *
 * Every article not explicitly listed here falls back to the Placemat
 * reference build, matching the workspace's previous single-product
 * behaviour. Adding a new product means adding one entry, never touching the
 * route.
 */

import type { ComponentDef, MaterialMaster, ProcessMaster, Variant, Product } from "./costingModel";
import {
  DEFAULT_VARIANT,
  FABRIC_OPTIONS,
  MASTERS,
  PLACEMAT_PRODUCT,
  COMPONENT_PRESETS,
  componentFromPreset,
  type ComponentPreset,
  type FabricOption,
} from "./costingModelData";
import {
  QUILT_DEFAULT_VARIANT,
  QUILT_FABRIC_OPTIONS,
  QUILT_MASTERS,
  QUILT_PRODUCT,
  QUILT_SRF_REF,
  QUILT_COMPONENT_PRESETS,
  quiltComponentFromPreset,
} from "./quiltModel";
import { LIBRARY_MATERIALS } from "./library";

export type MasterLookup = {
  materials: Record<string, MaterialMaster>;
  processes: Record<string, ProcessMaster>;
};

export type CostingModelBundle = {
  product: Product;
  defaultVariant: Variant;
  masters: MasterLookup;
  fabricOptions: FabricOption[];
  presets: ComponentPreset[];
  componentFromPreset: (preset: ComponentPreset, id: string, sequence: number) => ComponentDef;
};

/**
 * Every product can reach the shared Component Library, so a fabric added from
 * the library resolves exactly like one the product shipped with. The product's
 * own masters win on an id clash — a style-specific record is more specific
 * than a catalogue entry.
 */
const withLibrary = (masters: MasterLookup): MasterLookup => ({
  ...masters,
  materials: { ...LIBRARY_MATERIALS, ...masters.materials },
});

const PLACEMAT_BUNDLE: CostingModelBundle = {
  product: PLACEMAT_PRODUCT,
  defaultVariant: DEFAULT_VARIANT,
  masters: withLibrary(MASTERS),
  fabricOptions: FABRIC_OPTIONS,
  presets: COMPONENT_PRESETS,
  componentFromPreset,
};

const QUILT_BUNDLE: CostingModelBundle = {
  product: QUILT_PRODUCT,
  defaultVariant: QUILT_DEFAULT_VARIANT,
  masters: withLibrary(QUILT_MASTERS),
  fabricOptions: QUILT_FABRIC_OPTIONS,
  presets: QUILT_COMPONENT_PRESETS,
  componentFromPreset: quiltComponentFromPreset,
};

/** Keyed by the article's srfRef — the one stable id every article carries. */
const REGISTRY: Record<string, CostingModelBundle> = {
  [QUILT_SRF_REF]: QUILT_BUNDLE,
};

export function resolveCostingModel(srfRef: string | undefined): CostingModelBundle {
  if (srfRef && REGISTRY[srfRef]) return REGISTRY[srfRef];
  return PLACEMAT_BUNDLE;
}
