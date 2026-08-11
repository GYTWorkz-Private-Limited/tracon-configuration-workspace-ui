/**
 * The Component Library — one catalogue, and the builders that turn a library
 * entry into a real costed object on the variant.
 *
 * Browsing the library changes nothing. Adding from it constructs a genuine
 * `ComponentDef` / `ProcessItem` / `AccessoryItem` / `PackagingItem` /
 * `TestingItem` from the master's own numbers, so a row added here is costed by
 * exactly the same engine as a row that shipped with the product.
 */

import {
  sourced,
  type AccessoryItem,
  type ComponentDef,
  type MaterialMaster,
  type PackagingItem,
  type ProcessItem,
  type TestingItem,
} from "../costingModel";
import { LIBRARY_FABRICS, LIBRARY_FILLINGS } from "./fabrics";
import { LIBRARY_PROCESSES } from "./processes";
import { LIBRARY_PACKAGING, LIBRARY_TESTING, LIBRARY_TRIMS } from "./trims";
import type { LibraryItem, LibraryKind } from "./types";

export * from "./types";
export * from "./slots";
export { LIBRARY_FABRICS, LIBRARY_FILLINGS } from "./fabrics";
export { LIBRARY_PROCESSES } from "./processes";
export { LIBRARY_PACKAGING, LIBRARY_TESTING, LIBRARY_TRIMS } from "./trims";

export const LIBRARY: LibraryItem[] = [
  ...LIBRARY_FABRICS,
  ...LIBRARY_FILLINGS,
  ...LIBRARY_PROCESSES,
  ...LIBRARY_TRIMS,
  ...LIBRARY_PACKAGING,
  ...LIBRARY_TESTING,
];

export const KIND_LABEL: Record<LibraryKind, string> = {
  fabric: "Fabrics",
  filling: "Filling & Wadding",
  process: "Process",
  trim: "Trims & Accessories",
  packaging: "Packaging",
  testing: "Testing",
};

/** Which library kinds a cost-sheet section can be fed from. */
export const SECTION_KINDS: Record<string, LibraryKind[]> = {
  material: ["fabric", "filling"],
  process: ["process"],
  accessory: ["trim"],
  packaging: ["packaging"],
  testing: ["testing"],
};

const BY_ID = new Map(LIBRARY.map((i) => [i.id, i]));

export const libraryItem = (id: string): LibraryItem | undefined => BY_ID.get(id);

/**
 * Every material master the library publishes, merged into a product's masters
 * so a library fabric resolves exactly like a product's own fabric.
 */
export const LIBRARY_MATERIALS: Record<string, MaterialMaster> = Object.fromEntries(
  LIBRARY.filter((i) => i.master).map((i) => [i.id, i.master as MaterialMaster]),
);

/** Fabric and filling entries, offered as the option list on a material row. */
export const MATERIAL_LIBRARY_ITEMS: LibraryItem[] = LIBRARY.filter(
  (i) => i.kind === "fabric" || i.kind === "filling",
);

export const TRIM_LIBRARY_ITEMS: LibraryItem[] = LIBRARY_TRIMS;

/* ------------------------------------------------------------------ *
 * Builders — library entry → real costed object
 * ------------------------------------------------------------------ */

const numberFrom = (item: LibraryItem, label: string, fallback: number): number => {
  const raw = item.attributes.find((a) => a.label === label)?.value ?? "";
  const n = Number.parseFloat(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export type NewComponentInput = {
  id: string;
  productId: string;
  sequence: number;
  /** the slot being filled, e.g. "Back Fabric" — becomes the component name */
  slot: string;
  /** finished size the consumption rule is built against, inches */
  finishedWidth: number;
  finishedLength: number;
};

/**
 * A fabric or filling picked from the library becomes a fully costed component:
 * material assignment to the library master, plus a consumption rule built from
 * that master's own costing width, shrinkage and wastage. Nothing lands blank.
 */
export function componentFromLibrary(item: LibraryItem, input: NewComponentInput): ComponentDef {
  const master = item.master;
  const costingWidth = master?.costingWidth ?? master?.width ?? 58;
  const shrinkagePct = numberFrom(item, "Shrinkage %", 3);
  const wastagePct = numberFrom(item, "Wastage %", 6);
  const isFilling = item.kind === "filling";

  return {
    id: input.id,
    productId: input.productId,
    name: input.slot,
    type: isFilling ? "Filling" : "Fabric",
    description: item.summary,
    usage: input.slot,
    required: false,
    quantity: 1,
    sequence: input.sequence,
    relatedComponentIds: [],
    active: true,
    material: {
      id: `CM-${input.id}`,
      relationship: "master",
      materialMasterId: item.id,
      rate: sourced(item.rate, "Rate Master", master?.rateMasterId ?? item.code),
      rateUnit: "per metre",
    },
    makingSpec: {
      id: `MS-${input.id}`,
      source: "Material Master",
      masterId: item.id,
      fields: [
        { label: "Material Code", value: item.code, source: "Material Master" },
        ...(master?.composition
          ? [
              {
                label: "Composition",
                value: master.composition,
                source: "Material Master" as const,
              },
            ]
          : []),
        ...(master?.gsm
          ? [
              {
                label: "GSM",
                value: String(master.gsm),
                source: "Material Master" as const,
              },
            ]
          : []),
        { label: "Costing Width", value: `${costingWidth}"`, source: "Material Master" },
        {
          label: "Shrinkage Allowance",
          value: String(shrinkagePct),
          unit: "%",
          source: "Material Master",
        },
        {
          label: "Fabric Wastage",
          value: String(wastagePct),
          unit: "%",
          source: "Consumption Rule",
        },
      ],
    },
    consumption: {
      id: `CR-${input.id}`,
      method: isFilling ? "Area-Based" : "Formula-Based",
      formula: item.consumption.formula,
      formulaVersion: "v2.1",
      unit: "mtr",
      finishedWidth: input.finishedWidth,
      finishedLength: input.finishedLength,
      seamAllowance: isFilling ? 0 : 1,
      hemAllowance: isFilling ? 0 : 1,
      shrinkagePct,
      wastagePct,
      fabricWidth: costingWidth,
      markerEfficiency: isFilling ? 0.95 : 0.82,
      plies: 1,
      quantity: 1,
      source: "Consumption Rule",
    },
    processes: [],
    accessories: [],
  };
}

/**
 * A process picked from the library lands on a component as a real step, with
 * its master rate and its configurable variable already set. `quantity` is the
 * basis units the component consumes — metres for a per-metre step, one
 * operation for a per-piece step.
 */
export function processFromLibrary(
  item: LibraryItem,
  componentId: string,
  sequence: number,
  quantity: number,
): ProcessItem | null {
  const spec = item.process;
  if (!spec) return null;
  return {
    id: `${componentId}-${item.id}-${sequence}`,
    componentId,
    processMasterId: spec.processMasterId,
    type: spec.category,
    name: item.name,
    sequence,
    description: item.summary,
    params: spec.defaultParams,
    basis: spec.basis,
    quantity,
    rate: sourced(item.rate, "Process Master", item.code),
    rateUnit: spec.rateUnit,
    rateMasterId: item.code,
  };
}

export function accessoryFromLibrary(
  item: LibraryItem,
  id: string,
  componentId: string,
): AccessoryItem {
  const perMetre = item.rateUnit === "per metre";
  return {
    id,
    componentId,
    accessoryType: item.attributes.find((a) => a.label === "Trim Type")?.value ?? "Other Trim",
    name: item.name,
    materialMasterId: item.id,
    specification: item.attributes.find((a) => a.label === "Specification")?.value ?? item.summary,
    quantity: 1,
    // a tape or cord is consumed by length; a zipper or label is one unit
    consumption: perMetre ? 1.2 : 1,
    wastagePct: perMetre ? 5 : 2,
    rate: sourced(item.rate, "Rate Master", item.code),
    rateUnit: item.rateUnit,
    source: "Rate Master",
  };
}

export function packagingFromLibrary(item: LibraryItem, id: string): PackagingItem {
  const type = item.group as PackagingItem["packagingType"];
  return {
    id,
    packagingType: type,
    subtype: item.name,
    specification: item.attributes.find((a) => a.label === "Specification")?.value ?? item.summary,
    quantity: 1,
    rate: sourced(item.rate, "Rate Master", item.code),
    rateUnit: "per piece",
    source: "Rate Master",
  };
}

export function testingFromLibrary(item: LibraryItem, id: string, lotSize: number): TestingItem {
  return {
    id,
    testType: item.group as TestingItem["testType"],
    name: item.name,
    specification: item.attributes.find((a) => a.label === "Specification")?.value ?? item.summary,
    labName: item.supplier ?? "—",
    lotCost: item.rate,
    lotSize: lotSize > 0 ? lotSize : 3000,
    source: "Buyer Template",
  };
}
