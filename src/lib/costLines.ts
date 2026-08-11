/**
 * Cost lines — the rows a costing table is actually made of.
 *
 * A component is not a cost line. "Body Fabric" is a component; the lines that
 * cost money are its MATERIAL line and its DYEING, CUTTING, STITCHING and
 * HEMMING process lines. The Process tab therefore lists Dyeing / Washing /
 * Cutting / Stitching, not the components those steps happen to belong to.
 *
 * Every line is DERIVED from the resolved component it came from, so this file
 * introduces no second copy of any number — it only re-cuts the same roll-up
 * along the axis the costing team reads it on.
 *
 * Lines are configurable where the underlying variable genuinely is: a dyeing
 * line lets you pick the dyeing method, a wash line the wash type, a packaging
 * line the pack standard. Each choice writes a real rate and re-costs.
 */

import {
  accessoryCost,
  finalOf,
  packagingCost,
  processCost,
  testingCost,
  withOverride,
  type AccessoryItem,
  type PackagingItem,
  type ProcessItem,
  type ResolvedComponent,
  type TestingItem,
} from "./costingModel";
import { MATERIAL_LIBRARY_ITEMS, TRIM_LIBRARY_ITEMS, type LibraryItem } from "./library";

/* ------------------------------------------------------------------ *
 * Option catalogues — every option carries the rate it actually costs
 * ------------------------------------------------------------------ */

export type LineOption = {
  id: string;
  label: string;
  /** ₹ at this line's own basis — picking the option applies this rate */
  rate: number;
  /** what changes on the spec when this option is chosen */
  detail?: string;
};

export type OptionGroup = {
  /** the variable being chosen, e.g. "Dyeing Method" */
  label: string;
  options: LineOption[];
  selectedId?: string;
};

/**
 * Process options keyed by process master. Rates are the real per-unit charge
 * for that method, so switching from reactive exhaust dyeing to pigment dyeing
 * moves the cost the way it would on a real sheet.
 */
export const PROCESS_OPTIONS: Record<string, OptionGroup> = {
  "PRC-DYE": {
    label: "Dyeing Method",
    options: [
      {
        id: "dye-reactive-exhaust",
        label: "Reactive — exhaust",
        rate: 22.0,
        detail: "Medium shade",
      },
      { id: "dye-reactive-pad", label: "Reactive — pad-batch", rate: 18.5, detail: "Continuous" },
      { id: "dye-vat", label: "Vat", rate: 34.0, detail: "High fastness" },
      { id: "dye-pigment", label: "Pigment", rate: 12.75, detail: "Surface, low fastness" },
      { id: "dye-garment", label: "Garment dyed", rate: 26.4, detail: "Post-assembly" },
    ],
  },
  "PRC-PRT": {
    label: "Print Method",
    options: [
      { id: "prt-rotary", label: "Rotary screen — 6 colours", rate: 82.5, detail: "6 screens" },
      { id: "prt-flatbed", label: "Flat bed — 6 colours", rate: 96.0, detail: "6 screens" },
      { id: "prt-digital", label: "Digital", rate: 128.0, detail: "Unlimited colours" },
      { id: "prt-block", label: "Hand block", rate: 145.0, detail: "Artisanal" },
      { id: "prt-pigment", label: "Pigment print", rate: 64.0, detail: "4 colours" },
    ],
  },
  "PRC-EMB": {
    label: "Embroidery Type",
    options: [
      { id: "emb-flat", label: "Flat embroidery", rate: 1.44, detail: "per 1000 stitches" },
      { id: "emb-boucle", label: "Boucle", rate: 2.15, detail: "Textured loop thread" },
      { id: "emb-sequin", label: "Sequin", rate: 3.2, detail: "Sequin feed attachment" },
      { id: "emb-chain", label: "Chain stitch", rate: 1.85, detail: "Cornely" },
      { id: "emb-applique", label: "Appliqué", rate: 2.6, detail: "Cut-and-satin edge" },
    ],
  },
  "PRC-CUT": {
    label: "Cutting Method",
    options: [
      { id: "cut-straight", label: "Straight knife, 40-ply", rate: 1.0, detail: "Manual marker" },
      { id: "cut-band", label: "Band knife", rate: 1.6, detail: "Small parts" },
      { id: "cut-auto", label: "Auto CAM cutter", rate: 2.4, detail: "Optimised marker" },
      { id: "cut-die", label: "Die cutting", rate: 0.85, detail: "Repeat shapes" },
    ],
  },
  "PRC-STC": {
    label: "Stitch Type",
    options: [
      { id: "stc-snls", label: "Single needle lockstitch", rate: 3.0, detail: "SNLS" },
      { id: "stc-overlock", label: "Overlock 4-thread", rate: 3.6, detail: "O/L" },
      { id: "stc-flatlock", label: "Flatlock", rate: 4.2, detail: "Flat seam" },
      { id: "stc-twin", label: "Twin needle", rate: 3.9, detail: "Parallel topstitch" },
      { id: "stc-bartack", label: "Bar-tack", rate: 2.1, detail: "Reinforcement" },
    ],
  },
  "PRC-HEM": {
    label: "Hem Type",
    options: [
      { id: "hem-single", label: 'Single fold, 0.5"', rate: 5.2, detail: "One turn" },
      { id: "hem-double", label: 'Double fold, 0.5"', rate: 6.5, detail: "Two turns" },
      { id: "hem-mitred", label: "Mitred corner", rate: 9.4, detail: "Corner mitre" },
      { id: "hem-rolled", label: "Rolled hem", rate: 4.6, detail: "Narrow roll" },
      { id: "hem-blind", label: "Blind hem", rate: 7.1, detail: "Invisible" },
    ],
  },
  "PRC-WSH": {
    label: "Wash Type",
    options: [
      { id: "wsh-soft", label: "Soft wash", rate: 18, detail: "Softener only" },
      { id: "wsh-enzyme", label: "Enzyme wash", rate: 26.5, detail: "Peached hand" },
      { id: "wsh-silicone", label: "Silicone wash", rate: 34, detail: "Premium drape" },
      { id: "wsh-stone", label: "Stone wash", rate: 42, detail: "Heavy abrasion" },
      { id: "wsh-none", label: "No wash", rate: 0, detail: "Ship as made" },
    ],
  },
  "PRC-FIN": {
    label: "Finish Type",
    options: [
      { id: "fin-soft", label: "Enzyme soft + calendar", rate: 11, detail: "Standard" },
      { id: "fin-silicone", label: "Silicone softener", rate: 16.5, detail: "Premium hand" },
      { id: "fin-heatset", label: "Heat set", rate: 5, detail: "Synthetics" },
      { id: "fin-bio", label: "Bio-polish, low water", rate: 13.4, detail: "Sustainable" },
      { id: "fin-none", label: "No finishing", rate: 0, detail: "Loom state" },
    ],
  },
  "PRC-APQ": {
    label: "Appliqué Type",
    options: [
      { id: "apq-satin", label: "Satin edge", rate: 34, detail: "Dense satin border" },
      { id: "apq-raw", label: "Raw edge", rate: 22.5, detail: "Single-line tack" },
      { id: "apq-reverse", label: "Reverse appliqué", rate: 48, detail: "Cut-back layers" },
      { id: "apq-3d", label: "3D / padded", rate: 62, detail: "Padded motif" },
    ],
  },
  "PRC-QLT": {
    label: "Quilting Pattern",
    options: [
      { id: "pqlt-none", label: "No quilting", rate: 0, detail: "Unquilted" },
      { id: "pqlt-heart", label: "Heart", rate: 225.75, detail: "Allover · Sri Quilting Co." },
      { id: "pqlt-diamond", label: "Diamond", rate: 198.4, detail: "Allover" },
      { id: "pqlt-channel", label: "Channel", rate: 164, detail: "Parallel lines" },
      { id: "pqlt-box", label: "Box", rate: 176.5, detail: "Grid" },
      { id: "pqlt-wave", label: "Wave", rate: 212, detail: "Serpentine" },
      { id: "pqlt-custom", label: "Custom pattern", rate: 268, detail: "Buyer artwork" },
    ],
  },
  "PRC-BND": {
    label: "Bind Type",
    options: [
      { id: "pbnd-self", label: 'Self-fabric bias, 1"', rate: 12.6, detail: "Folded, topstitched" },
      { id: "pbnd-contrast", label: "Contrast bias", rate: 15.2, detail: "Contrast colour" },
      { id: "pbnd-tape", label: "Ready satin binding", rate: 9.4, detail: "Pre-folded tape" },
      { id: "pbnd-piped", label: "Corded piping", rate: 19.8, detail: "5 mm cord" },
    ],
  },
  "QPRC-QLT": {
    label: "Quilting Pattern",
    options: [
      { id: "qlt-none", label: "No quilting", rate: 0, detail: "Unquilted" },
      { id: "qlt-heart", label: "Heart", rate: 225.75, detail: "Allover" },
      { id: "qlt-diamond", label: "Diamond", rate: 198.4, detail: "Allover" },
      { id: "qlt-channel", label: "Channel", rate: 164.0, detail: "Parallel lines" },
      { id: "qlt-box", label: "Box", rate: 176.5, detail: "Grid" },
      { id: "qlt-wave", label: "Wave", rate: 212.0, detail: "Serpentine" },
    ],
  },
  "QPRC-EMB": {
    label: "Embroidery Type",
    options: [
      { id: "qemb-boucle", label: "Boucle — Love + Heart", rate: 414, detail: "Suman Emb" },
      { id: "qemb-flat", label: "Flat embroidery", rate: 286, detail: "SK Emb" },
      { id: "qemb-applique", label: "Appliqué patch", rate: 352, detail: "Cut-and-satin" },
      { id: "qemb-none", label: "No decoration", rate: 0, detail: "Plain face" },
    ],
  },
  "QPRC-CUT": {
    label: "Cutting Method",
    options: [
      { id: "qcut-straight", label: "Straight knife, 12-ply", rate: 1.85, detail: "Manual marker" },
      { id: "qcut-auto", label: "Auto CAM cutter", rate: 3.1, detail: "Optimised marker" },
    ],
  },
  "QPRC-STC": {
    label: "Stitch Type",
    options: [
      { id: "qstc-snls", label: "Single needle + O/L", rate: 18.4, detail: "Three-panel" },
      { id: "qstc-flatlock", label: "Flatlock", rate: 22.6, detail: "Flat seam" },
    ],
  },
  "QPRC-BND": {
    label: "Bind Type",
    options: [
      { id: "bnd-self", label: 'Self-fabric bias, 1"', rate: 12.6, detail: "Folded, topstitched" },
      { id: "bnd-contrast", label: "Contrast bias", rate: 15.2, detail: "Contrast colour" },
      { id: "bnd-piped", label: "Corded piping", rate: 19.8, detail: "5 mm cord" },
    ],
  },
};

/** Packaging standards — the pack level is a real commercial choice. */
export const PACKAGING_OPTIONS: OptionGroup = {
  label: "Packaging Standard",
  options: [
    { id: "pkg-standard", label: "Standard polybag", rate: 0.45, detail: "LDPE 40 micron" },
    { id: "pkg-buyer", label: "Buyer-specific", rate: 1.35, detail: "Printed to buyer artwork" },
    { id: "pkg-premium", label: "Premium — box + tissue", rate: 3.8, detail: "Rigid box, tissue" },
    {
      id: "pkg-recycled",
      label: "Recycled kraft wrap",
      rate: 0.95,
      detail: "FSC kraft, belly band",
    },
  ],
};

/** Carton lines get their own catalogue — a carton is not a polybag. */
export const CARTON_OPTIONS: OptionGroup = {
  label: "Carton Standard",
  options: [
    { id: "ctn-3ply", label: "3-ply master carton", rate: 0.28, detail: "Light export" },
    { id: "ctn-5ply", label: "5-ply master carton", rate: 0.4, detail: "Standard export" },
    { id: "ctn-7ply", label: "7-ply heavy duty", rate: 0.72, detail: "Heavy / long haul" },
    { id: "ctn-inner", label: "Inner + master carton", rate: 0.95, detail: "Two-tier pack" },
  ],
};

/** Testing scope — how much of the protocol is actually run. */
export const TESTING_OPTIONS: OptionGroup = {
  label: "Test Scope",
  options: [
    { id: "tst-full", label: "Full protocol", rate: 1, detail: "Every parameter" },
    { id: "tst-reduced", label: "Reduced protocol", rate: 0.6, detail: "Key parameters only" },
    { id: "tst-shared", label: "Shared across colourways", rate: 0.35, detail: "One submission" },
    { id: "tst-waived", label: "Waived — buyer letter", rate: 0, detail: "No submission" },
  ],
};

/* ------------------------------------------------------------------ *
 * Material and trim options — sourced from the Component Library, so the row
 * dropdown and the library browser can never offer different things.
 * ------------------------------------------------------------------ */

/** Option id used when a component keeps inheriting its parent's material. */
export const INHERIT_OPTION_ID = "material-inherit";

const libraryOption = (item: LibraryItem): LineOption => ({
  id: item.id,
  label: item.name,
  rate: item.rate,
  detail: [item.group, item.code].filter(Boolean).join(" · "),
});

/**
 * What a material row may be changed to. A row for a filling slot is offered
 * fillings, a fabric slot is offered fabrics — never the whole catalogue.
 *
 * A component with a parent is always offered "Same as <parent>", whether or
 * not it is currently inheriting: giving a slot its own cloth has to be
 * reversible, or the first click is a one-way door.
 */
function materialOptions(c: ResolvedComponent, parentName?: string): OptionGroup {
  const wantFilling = c.component.type === "Filling";
  const items = MATERIAL_LIBRARY_ITEMS.filter((i) =>
    wantFilling ? i.kind === "filling" : i.kind === "fabric",
  );
  const options = items.map(libraryOption);

  const material = c.material;
  const inheritable = parentName ?? material?.inheritedFrom;
  if (inheritable) {
    const inherits = material?.relationship === "same-as-component";
    options.unshift({
      id: INHERIT_OPTION_ID,
      label: `Same as ${inheritable}`,
      rate: inherits ? finalOf(material.rate) : 0,
      detail: "Inherited — re-costs with the parent",
    });
    if (inherits) {
      return { label: wantFilling ? "Filling" : "Fabric", options, selectedId: INHERIT_OPTION_ID };
    }
  }

  const currentId = material?.master?.id;
  const known = currentId && options.some((o) => o.id === currentId);
  if (!known && material) {
    // A product's own master is a legitimate selection even though the shared
    // library does not publish it — offer it rather than showing "Select…".
    options.unshift({
      id: currentId ?? `${c.component.id}-current`,
      label: material.name,
      rate: finalOf(material.rate),
      detail: `${material.code} · product master`,
    });
  }
  return {
    label: wantFilling ? "Filling" : "Fabric",
    options,
    selectedId: currentId ?? (material ? `${c.component.id}-current` : undefined),
  };
}

/** Trims of the same family — a zipper row offers zippers, a label row labels. */
function accessoryOptions(a: AccessoryItem): OptionGroup {
  const family = TRIM_LIBRARY_ITEMS.filter(
    (i) => i.attributes.find((x) => x.label === "Trim Type")?.value === a.accessoryType,
  );
  const items = family.length ? family : TRIM_LIBRARY_ITEMS;
  const options = items.map(libraryOption);
  const currentId = a.materialMasterId;
  if (!currentId || !options.some((o) => o.id === currentId)) {
    options.unshift({
      id: currentId ?? `${a.id}-current`,
      label: a.name,
      rate: finalOf(a.rate),
      detail: "Current sheet rate",
    });
  }
  return {
    label: a.accessoryType,
    options,
    selectedId: currentId ?? `${a.id}-current`,
  };
}

/* ------------------------------------------------------------------ *
 * The line model
 * ------------------------------------------------------------------ */

export type LineKind = "material" | "process" | "accessory" | "packaging" | "testing";

export type CostLine = {
  id: string;
  kind: LineKind;
  /** the line itself — "Dyeing", "Woven Brand Label", "Polybag" */
  name: string;
  /** where it sits — "Body Fabric", "Loop / Hanger", "Product level" */
  context: string;
  /** category label shown in the Type column */
  typeLabel: string;
  /** the selected specification, shown in Material / Detail */
  detail: string;
  required: boolean;
  quantity: string;
  consumption: string;
  wastage: string;
  rate: string;
  cost: number;
  /** the component to open in the inspector when the row is clicked */
  componentId: string;
  /** the option group this line can be reconfigured with, when it has one */
  optionGroup?: OptionGroup;
  /** identifies the target of an option change, and of removal */
  target?: { componentId: string; itemId: string };
  /**
   * Required lines are part of the style and cannot be deleted from a costing
   * instance — removing them would be a style change, not a costing decision.
   */
  removable: boolean;
  /** the library entry behind this line, when it came from one */
  libraryId?: string;
};

const money2 = (n: number) => Math.round(n * 100) / 100;

/* ---- builders, one per kind ---- */

/**
 * The row is the SLOT — "Front Fabric", "Border", "Filling" — and the fabric
 * chosen for it is the configurable value, exactly as the sheet reads. Naming
 * the row after the material instead would hide which slot was being costed.
 */
function materialLine(c: ResolvedComponent, parentName?: string): CostLine | null {
  if (!c.material || c.materialCost <= 0) return null;
  const rule = c.consumptionRule;
  const m = c.material.master;
  return {
    id: `mat-${c.component.id}`,
    kind: "material",
    name: c.component.name,
    context: [c.material.code, m?.composition, m?.gsm ? `${m.gsm} GSM` : null]
      .filter(Boolean)
      .join(" · "),
    typeLabel: c.component.type,
    detail: c.material.name,
    required: c.component.required,
    quantity: String(c.component.quantity),
    consumption: rule ? `${c.consumptionPerPiece.toFixed(3)} ${rule.unit}` : "—",
    wastage: rule ? `${rule.wastagePct}%` : "—",
    rate: `${finalOf(c.material.rate).toFixed(2)} / ${c.material.rateUnit.replace("per ", "")}`,
    cost: c.materialCost,
    componentId: c.component.id,
    optionGroup: materialOptions(c, parentName),
    target: { componentId: c.component.id, itemId: c.component.id },
    removable: true,
    libraryId: m?.id,
  };
}

/**
 * A step whose configured rate matches no catalogue entry is not "unset" — it
 * is a costing-team rate the sheet already relies on. It is offered as its own
 * selected option so the row states what is actually configured, and switching
 * away from it is still one click.
 */
function withCurrentOption(group: OptionGroup, p: ProcessItem): OptionGroup {
  const rate = finalOf(p.rate);
  if (group.options.some((o) => o.id === p.optionId || o.rate === rate)) return group;
  const current: LineOption = {
    id: `${p.id}-current`,
    label: p.params[0]?.value ?? "As configured",
    rate,
    detail: "Current sheet rate",
  };
  return { ...group, options: [current, ...group.options], selectedId: current.id };
}

function processLine(c: ResolvedComponent, p: ProcessItem): CostLine {
  const base = p.processMasterId ? PROCESS_OPTIONS[p.processMasterId] : undefined;
  const group = base ? withCurrentOption(base, p) : undefined;
  const selectedId =
    group?.selectedId ?? p.optionId ?? group?.options.find((o) => o.rate === finalOf(p.rate))?.id;
  const selected = group?.options.find((o) => o.id === selectedId);
  return {
    id: `prc-${p.id}`,
    kind: "process",
    name: p.name,
    context: c.component.name,
    typeLabel: p.type,
    detail: selected?.label ?? p.params[0]?.value ?? p.description ?? "—",
    // "Required" belongs to the slot, not to a step applied to it — a wash or
    // an embroidery is always a costing decision even on a required component.
    required: false,
    quantity: `${p.quantity} ${p.basis.replace("per ", "")}`,
    consumption: "—",
    wastage: "—",
    rate: `${finalOf(p.rate).toFixed(2)} ${p.basis === "per m" ? "/ m" : "/ pc"}`,
    cost: processCost(p),
    componentId: c.component.id,
    optionGroup: group ? { ...group, selectedId } : undefined,
    target: { componentId: c.component.id, itemId: p.id },
    removable: true,
  };
}

function accessoryLine(c: ResolvedComponent, a: AccessoryItem): CostLine {
  const group = accessoryOptions(a);
  return {
    id: `acc-${a.id}`,
    kind: "accessory",
    name: a.accessoryType,
    context: `${c.component.name} · ${a.specification}`,
    typeLabel: a.accessoryType,
    detail: a.name,
    required: false,
    quantity: String(a.quantity),
    consumption: a.consumption ? `${a.consumption} ${a.rateUnit.replace("per ", "")}` : "—",
    wastage: a.wastagePct ? `${a.wastagePct}%` : "—",
    rate: `${finalOf(a.rate).toFixed(2)} ${a.rateUnit.replace("per ", "/ ")}`,
    cost: accessoryCost(a),
    componentId: c.component.id,
    optionGroup: group,
    target: { componentId: c.component.id, itemId: a.id },
    removable: true,
    libraryId: a.materialMasterId,
  };
}

function packagingLine(p: PackagingItem): CostLine {
  const base = p.packagingType === "Carton Packing" ? CARTON_OPTIONS : PACKAGING_OPTIONS;
  // A pack standard the product quotes at its own rate is a real selection, not
  // an empty one — same rule as a process step. See `withCurrentOption`.
  const known = p.optionId ?? base.options.find((o) => o.rate === finalOf(p.rate))?.id;
  const group: OptionGroup = known
    ? base
    : {
        ...base,
        options: [
          {
            id: `${p.id}-current`,
            label: p.subtype,
            rate: finalOf(p.rate),
            detail: "Current sheet rate",
          },
          ...base.options,
        ],
      };
  const selectedId = known ?? `${p.id}-current`;
  return {
    id: `pkg-${p.id}`,
    kind: "packaging",
    name: p.subtype,
    context: p.packagingType,
    typeLabel: p.packagingType,
    detail: p.specification,
    required: false,
    quantity: String(p.quantity),
    consumption: "—",
    wastage: "—",
    rate: `${finalOf(p.rate).toFixed(2)} ${p.rateUnit.replace("per ", "/ ")}`,
    cost: packagingCost(p),
    componentId: p.id,
    optionGroup: { ...group, selectedId },
    target: { componentId: p.id, itemId: p.id },
    removable: true,
  };
}

function testingLine(t: TestingItem): CostLine {
  const selectedId = t.optionId ?? "tst-full";
  return {
    id: `tst-${t.id}`,
    kind: "testing",
    name: t.name,
    context: `${t.testType} · ${t.labName}`,
    typeLabel: t.testType,
    detail: t.specification,
    required: false,
    quantity: "1 lot",
    consumption: `${t.lotSize.toLocaleString("en-IN")} pcs / lot`,
    wastage: "—",
    rate: `${t.lotCost.toLocaleString("en-IN")} / lot`,
    cost: testingCost(t),
    componentId: t.id,
    optionGroup: { ...TESTING_OPTIONS, selectedId },
    target: { componentId: t.id, itemId: t.id },
    removable: true,
  };
}

/* ------------------------------------------------------------------ *
 * Section assembly
 * ------------------------------------------------------------------ */

export type LineSection = {
  id: LineKind;
  label: string;
  lines: CostLine[];
  total: number;
};

const sum = (lines: CostLine[]) => money2(lines.reduce((t, l) => t + l.cost, 0));

export function buildSections(
  components: ResolvedComponent[],
  packaging: PackagingItem[],
  testing: TestingItem[],
): LineSection[] {
  const nameOf = new Map(components.map((c) => [c.component.id, c.component.name]));
  const parentNameOf = (c: ResolvedComponent) => {
    const parentId = c.component.parentId ?? c.component.material?.sameAsComponentId;
    return parentId ? nameOf.get(parentId) : undefined;
  };
  const materials = components
    .map((c) => materialLine(c, parentNameOf(c)))
    .filter((l): l is CostLine => l !== null);
  const processes = components.flatMap((c) => c.processes.map((p) => processLine(c, p)));
  const accessories = components.flatMap((c) => c.accessories.map((a) => accessoryLine(c, a)));

  return [
    { id: "material", label: "Raw Material", lines: materials, total: sum(materials) },
    { id: "process", label: "Process", lines: processes, total: sum(processes) },
    {
      id: "accessory",
      label: "Accessories / Trims",
      lines: accessories,
      total: sum(accessories),
    },
    {
      id: "packaging",
      label: "Packaging",
      lines: packaging.map(packagingLine),
      total: sum(packaging.map(packagingLine)),
    },
    {
      id: "testing",
      label: "Testing & Certification",
      lines: testing.map(testingLine),
      total: sum(testing.map(testingLine)),
    },
  ];
}

/* ------------------------------------------------------------------ *
 * Applying an option — the write side
 * ------------------------------------------------------------------ */

export const optionById = (group: OptionGroup, id: string): LineOption | undefined =>
  group.options.find((o) => o.id === id);

/**
 * A picked process option becomes a real rate override plus a spec change, so
 * the chosen method is visible in the row, in the drawer's process chain and in
 * "Master Source & Overrides" — never a silent number swap.
 */
export function applyProcessOption(p: ProcessItem, optionId: string): ProcessItem {
  const base = p.processMasterId ? PROCESS_OPTIONS[p.processMasterId] : undefined;
  const group = base && withCurrentOption(base, p);
  const opt = group && optionById(group, optionId);
  if (!group || !opt) return p;
  return {
    ...p,
    optionId,
    rate: withOverride(p.rate, opt.rate, `${group.label} — ${opt.label}`),
    params: [
      { label: group.label, value: opt.label },
      ...(opt.detail ? [{ label: "Specification", value: opt.detail }] : []),
      ...p.params.filter((f) => f.label !== group.label && f.label !== "Specification"),
    ],
  };
}

/**
 * A trim swap replaces the master the line points at and re-rates it. The old
 * rate survives on `masterValue`, so the change is visible as an override
 * rather than an unexplained new number.
 */
export function applyAccessoryOption(a: AccessoryItem, optionId: string): AccessoryItem {
  const item = TRIM_LIBRARY_ITEMS.find((i) => i.id === optionId);
  if (!item) return a;
  return {
    ...a,
    name: item.name,
    materialMasterId: item.id,
    specification: item.attributes.find((x) => x.label === "Specification")?.value ?? item.summary,
    rateUnit: item.rateUnit,
    rate: withOverride(a.rate, item.rate, `${a.accessoryType} — ${item.name}`),
  };
}

export function applyPackagingOption(p: PackagingItem, optionId: string): PackagingItem {
  const group = p.packagingType === "Carton Packing" ? CARTON_OPTIONS : PACKAGING_OPTIONS;
  const opt = optionById(group, optionId);
  if (!opt) return p;
  return {
    ...p,
    optionId,
    subtype: opt.label,
    specification: opt.detail ?? p.specification,
    rate: withOverride(p.rate, opt.rate, `${group.label} — ${opt.label}`),
  };
}

/**
 * Testing options scale the lot cost rather than replace it — a reduced
 * protocol is a fraction of the full submission, not a different price list.
 */
export function applyTestingOption(t: TestingItem, optionId: string): TestingItem {
  const opt = optionById(TESTING_OPTIONS, optionId);
  if (!opt) return t;
  const base = t.baseLotCost ?? t.lotCost;
  return {
    ...t,
    optionId,
    baseLotCost: base,
    lotCost: money2(base * opt.rate),
  };
}
