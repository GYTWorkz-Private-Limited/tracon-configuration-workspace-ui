/**
 * Component Library — the master list behind every row on the costing sheet.
 *
 * One catalogue holds every fabric, filling, process, trim, packaging and test
 * the costing team can put on a sheet. A library entry is a MASTER: it states
 * what the thing is, what it costs, and — crucially — how its consumption is
 * derived. Adding it to the sheet builds a real costed object from that master;
 * browsing it changes nothing.
 *
 * Material-ish entries (fabric, filling, trim) carry a real `MaterialMaster`,
 * so the library is not a second copy of the material data — it IS the material
 * data, merged into the product masters in `costingModels.ts`.
 */

import type { MaterialMaster, ProcessBasis, SpecField } from "../costingModel";

export type LibraryKind = "fabric" | "filling" | "process" | "trim" | "packaging" | "testing";

export type LibraryAttr = { label: string; value: string };

/**
 * How much of this item a piece consumes, and what drives it. This is the
 * "consumption logic" a merchandiser browses the library to check — stated in
 * the same terms the engine computes it (`calculateConsumption`).
 */
export type ConsumptionLogic = {
  /** matches a ConsumptionMethod where the item is a material */
  method: string;
  /** the unit the consumption comes out in, per piece */
  basis: string;
  formula: string;
  /** the inputs the formula actually reads */
  drivers: string[];
  note?: string;
};

/**
 * The three ways a fabric reaches a final rate. Which path an entry follows
 * decides which variables matter for it — a Ready Fabric has none of the
 * weaving inputs, a Yarn-Dyed Woven is costed from yarn upward.
 */
export type FabricPathId = "ready" | "greige" | "ydw";

export type FabricPath = {
  id: FabricPathId;
  label: string;
  /** the chain, in cost order */
  chain: string[];
  /** the variables that must be filled for this path, grouped by stage */
  stages: { stage: string; variables: string[] }[];
};

/** A process entry's own configurable variables, e.g. dyeing type / shade. */
export type ProcessSpec = {
  processMasterId: string;
  category: string;
  basis: ProcessBasis;
  rateUnit: string;
  defaultParams: SpecField[];
};

export type LibraryItem = {
  id: string;
  kind: LibraryKind;
  /** section within the kind, e.g. "Ready Fabric" or "Wet Processing" */
  group: string;
  name: string;
  code: string;
  summary: string;
  /** ₹ at `rateUnit` */
  rate: number;
  rateUnit: string;
  supplier?: string;
  certification?: string;
  /** the full master attribute sheet shown when the entry is inspected */
  attributes: LibraryAttr[];
  consumption: ConsumptionLogic;
  /** component slots this entry is valid for — drives what a slot can offer */
  slots: string[];
  tags?: string[];
  /** fabric only — which of the three costing paths it follows */
  pathId?: FabricPathId;
  /** fabric / filling / trim — the real master this entry publishes */
  master?: MaterialMaster;
  /** process only */
  process?: ProcessSpec;
};

/** Case-insensitive match across everything a user would think to type. */
export function matchesQuery(item: LibraryItem, q: string): boolean {
  if (!q.trim()) return true;
  const needle = q.trim().toLowerCase();
  const hay = [
    item.name,
    item.code,
    item.group,
    item.summary,
    item.supplier ?? "",
    item.certification ?? "",
    ...(item.tags ?? []),
    ...item.slots,
    ...item.attributes.map((a) => `${a.label} ${a.value}`),
  ]
    .join(" ")
    .toLowerCase();
  return needle.split(/\s+/).every((word) => hay.includes(word));
}
