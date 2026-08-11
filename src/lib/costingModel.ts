/**
 * Costing configuration data model — the single source of truth behind the
 * Configuration Workspace.
 *
 * The traceability chain this model exists to make explicit:
 *
 *   PRODUCT → COMPONENT → MATERIAL → MAKING SPECIFICATION
 *           → CONSUMPTION RULE → PROCESS → RATE → COST
 *
 * One consolidated component object powers the component table, the component
 * inspector, the cost strip and the roll-up. Nothing here is display-specific,
 * and no screen is allowed to keep a second copy of a costed value.
 *
 * The model stops at DIRECT COST. Commercial overheads, supplier margin,
 * duty drawback and pricing live outside configuration by design.
 *
 * Mock data lives in `costingModelData.ts`; this file is pure structure + math.
 */

/* ------------------------------------------------------------------ *
 * Source / override model
 * ------------------------------------------------------------------ */

export type SourceType =
  | "Style Master"
  | "Material Master"
  | "Rate Master"
  | "Process Master"
  | "Consumption Rule"
  | "Buyer Template"
  | "Costing Override";

/**
 * A master-driven value. `masterValue` is never mutated — an override is
 * recorded alongside it so the workspace can always show
 * master → override → final without losing provenance.
 */
export type Sourced<T> = {
  masterValue: T;
  override?: T;
  source: SourceType;
  sourceId?: string;
  overrideReason?: string;
};

export const sourced = <T>(masterValue: T, source: SourceType, sourceId?: string): Sourced<T> => ({
  masterValue,
  source,
  sourceId,
});

/** The value that actually costs. Always determinable. */
export const finalOf = <T>(f: Sourced<T>): T =>
  f.override === undefined ? f.masterValue : f.override;

export const isOverridden = <T>(f: Sourced<T>): boolean => f.override !== undefined;

/** Immutable override — the master value survives untouched. */
export const withOverride = <T>(
  f: Sourced<T>,
  override: T | undefined,
  reason?: string,
): Sourced<T> =>
  override === undefined
    ? { masterValue: f.masterValue, source: f.source, sourceId: f.sourceId }
    : { ...f, override, overrideReason: reason, source: "Costing Override" };

/** Label/value pair used by the component-aware specification blocks. */
export type SpecField = {
  label: string;
  value: string;
  /** shown as a small suffix, e.g. "mins/pc" */
  unit?: string;
  source?: SourceType;
};

/* ------------------------------------------------------------------ *
 * Masters
 * ------------------------------------------------------------------ */

export type MaterialType = "Fabric" | "Trim" | "Thread" | "Packaging" | "Other";

export type MaterialMaster = {
  id: string;
  code: string;
  name: string;
  materialType: MaterialType;
  fabricType?: string;
  availability?: string;
  composition?: string;
  yarnCount?: string;
  construction?: string;
  gsm?: number;
  /** actual roll width, inches */
  width?: number;
  /** usable width used for costing, inches */
  costingWidth?: number;
  colour?: string;
  pantone?: string;
  certification?: string;
  supplier?: string;
  rateMasterId: string;
  rate: number;
  rateUnit: string;
  description?: string;
  status: "Active" | "Inactive";
};

export type ProcessMaster = {
  id: string;
  name: string;
  category: string;
  description: string;
  defaultParams: SpecField[];
  standardRate: number;
  rateUnit: string;
  rateMasterId: string;
  status: "Active" | "Inactive";
};

/* ------------------------------------------------------------------ *
 * Material assignment
 * ------------------------------------------------------------------ */

/**
 * How a component gets its material. "same-as-component" stores the
 * relationship rather than duplicating the material, so a change to the body
 * fabric flows to every self-fabric component automatically.
 */
export type MaterialRelationship = "master" | "same-as-component" | "custom";

export type MaterialAssignment = {
  id: string;
  relationship: MaterialRelationship;
  materialMasterId?: string;
  sameAsComponentId?: string;
  /** rate carried through from the rate master, overridable by costing */
  rate: Sourced<number>;
  rateUnit: string;
  /** only for relationship: "custom" */
  custom?: Partial<MaterialMaster>;
};

/* ------------------------------------------------------------------ *
 * Making specification — component-aware, never a fixed field set
 * ------------------------------------------------------------------ */

export type MakingSpec = {
  id: string;
  /** only the fields that mean something for this component type */
  fields: SpecField[];
  source: SourceType;
  masterId?: string;
};

/* ------------------------------------------------------------------ *
 * Consumption rule
 * ------------------------------------------------------------------ */

export type ConsumptionMethod =
  | "Fixed"
  | "Width-Based"
  | "Length-Based"
  | "Area-Based"
  | "Marker-Based"
  | "Formula-Based"
  | "Component-Based";

export type ConsumptionRule = {
  id: string;
  method: ConsumptionMethod;
  /** human-readable formula shown to the costing team */
  formula: string;
  formulaVersion: string;
  unit: string;
  /** inputs — only those the method actually reads are populated */
  finishedWidth?: number;
  finishedLength?: number;
  seamAllowance?: number;
  hemAllowance?: number;
  shrinkagePct?: number;
  wastagePct: number;
  fabricWidth?: number;
  markerEfficiency?: number;
  /** layers / plies / panels the finished piece needs */
  plies?: number;
  /** for Fixed — consumption straight from the spec, per occurrence */
  fixedConsumption?: number;
  /** occurrences of this component per finished piece */
  quantity: number;
  overrideConsumption?: number;
  overrideReason?: string;
  source: SourceType;
};

/** inches per metre — the only unit bridge in the consumption math */
const INCH_PER_M = 39.37;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Consumption per occurrence, in the rule's unit.
 *
 * This function IS the calculation — the `formula` string on the rule is its
 * readable mirror for the costing team. A displayed consumption that was not
 * produced here would be an untraceable number, which the model forbids.
 */
export function calculateConsumption(rule: ConsumptionRule): number {
  if (rule.overrideConsumption !== undefined) return rule.overrideConsumption;

  const shrink = 1 + (rule.shrinkagePct ?? 0) / 100;
  const waste = 1 + rule.wastagePct / 100;
  const width = rule.fabricWidth ?? 0;
  const marker = rule.markerEfficiency ?? 1;
  const plies = rule.plies ?? 1;

  switch (rule.method) {
    case "Fixed":
      return round3((rule.fixedConsumption ?? 0) * shrink * waste);

    case "Length-Based":
      return round3(
        (((rule.finishedLength ?? 0) + (rule.hemAllowance ?? 0)) * shrink * waste) / INCH_PER_M,
      );

    case "Width-Based":
      return round3(
        (((rule.finishedWidth ?? 0) + (rule.seamAllowance ?? 0)) * shrink * waste) / INCH_PER_M,
      );

    case "Area-Based":
    case "Marker-Based":
    case "Formula-Based": {
      if (!width || !marker) return 0;
      const cutW = (rule.finishedWidth ?? 0) + (rule.seamAllowance ?? 0);
      const cutL = (rule.finishedLength ?? 0) + (rule.hemAllowance ?? 0);
      const area = cutW * cutL * plies * shrink * waste;
      return round3(area / (width * marker) / INCH_PER_M);
    }

    case "Component-Based":
      return round3((rule.fixedConsumption ?? 0) * shrink * waste);

    default:
      return 0;
  }
}

/* ------------------------------------------------------------------ *
 * Process
 * ------------------------------------------------------------------ */

export type ProcessBasis = "per pc" | "per m" | "per 1000 stitches" | "per kg";

export type ProcessItem = {
  id: string;
  componentId: string;
  processMasterId?: string;
  type: string;
  name: string;
  sequence: number;
  description?: string;
  params: SpecField[];
  basis: ProcessBasis;
  /** how many basis units this component consumes */
  quantity: number;
  rate: Sourced<number>;
  rateUnit: string;
  rateMasterId?: string;
  /** the option picked for this step, e.g. a dyeing method — see `costLines.ts` */
  optionId?: string;
};

export const processCost = (p: ProcessItem): number => p.quantity * finalOf(p.rate);

/* ------------------------------------------------------------------ *
 * Accessories / trims
 * ------------------------------------------------------------------ */

export type AccessoryItem = {
  id: string;
  /** component-level when the trim belongs to a component; product-level otherwise */
  componentId?: string;
  accessoryType: string;
  name: string;
  materialMasterId?: string;
  specification: string;
  quantity: number;
  consumption?: number;
  wastagePct?: number;
  rate: Sourced<number>;
  rateUnit: string;
  fixingCost?: number;
  source: SourceType;
};

export const accessoryCost = (a: AccessoryItem): number => {
  const per = a.consumption ?? 1;
  const waste = 1 + (a.wastagePct ?? 0) / 100;
  return a.quantity * per * finalOf(a.rate) * waste + (a.fixingCost ?? 0);
};

/* ------------------------------------------------------------------ *
 * Packaging — product-level direct cost category
 * ------------------------------------------------------------------ */

export type PackagingItem = {
  id: string;
  packagingType: "Labels" | "Standard Packaging" | "Special / Buyer-Specific" | "Carton Packing";
  subtype: string;
  specification: string;
  quantity: number;
  rate: Sourced<number>;
  rateUnit: string;
  source: SourceType;
  /** the packaging standard picked for this line */
  optionId?: string;
};

export const packagingCost = (p: PackagingItem): number => p.quantity * finalOf(p.rate);

/* ------------------------------------------------------------------ *
 * Testing & certification — product-level direct cost category
 * ------------------------------------------------------------------ */

/**
 * Lab tests and certificates are quoted per submission, not per piece, so the
 * per-piece figure is the lot cost divided across the order. Changing MOQ
 * therefore moves this category, exactly as it moves order setup.
 */
export type TestingItem = {
  id: string;
  testType: "Physical" | "Chemical" | "Certification";
  name: string;
  specification: string;
  labName: string;
  /** cost of one submission / certificate, ₹ */
  lotCost: number;
  /** pieces the lot cost is spread across */
  lotSize: number;
  source: SourceType;
  /** the test scope picked for this line */
  optionId?: string;
  /** full-protocol lot cost, kept so scope changes stay reversible */
  baseLotCost?: number;
};

export const testingCost = (t: TestingItem): number => (t.lotSize > 0 ? t.lotCost / t.lotSize : 0);

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export type ComponentType =
  | "Fabric"
  | "Trim / Self Fabric"
  | "Self Fabric Panel"
  | "Process"
  | "Decoration"
  | "Trim"
  | "Lining"
  | "Filling";

export type ComponentDef = {
  id: string;
  productId: string;
  parentId?: string;
  name: string;
  type: ComponentType;
  description: string;
  usage: string;
  required: boolean;
  /** occurrences per finished piece, e.g. 2 waist ties */
  quantity: number;
  sequence: number;
  relatedComponentIds: string[];
  active: boolean;
  material?: MaterialAssignment;
  makingSpec?: MakingSpec;
  consumption?: ConsumptionRule;
  processes: ProcessItem[];
  accessories: AccessoryItem[];
};

/* ------------------------------------------------------------------ *
 * Variant / option
 * ------------------------------------------------------------------ */

/**
 * An option is a variant that differs from its parent by exactly one
 * configurable parameter. Both carry a full component list so they can be
 * modified independently after creation — there is no shared mutable state
 * between a variant and its copies.
 */
export type OptionDef = {
  id: string;
  variantId: string;
  parameter: string;
  name: string;
  selectedValue: string;
  impactedComponentId?: string;
  costImpact: number;
  active: boolean;
};

export type Variant = {
  id: string;
  productId: string;
  name: string;
  description?: string;
  kind: "variant" | "option";
  parentId?: string;
  baseVariantId?: string;
  creationMethod: "New" | "Duplicate Existing";
  status: "Draft" | "Active" | "Archived";
  components: ComponentDef[];
  packaging: PackagingItem[];
  testing: TestingItem[];
  options: OptionDef[];
  /** MOQ / size / quality — see `pricingVariants.ts` for how they are applied */
  parameters: VariantParameter[];
  commercial: CommercialInputs;
  /**
   * The finished size and fabric GSM this variant's components were authored
   * against — `applyParameters` scales consumption relative to these. Falls
   * back to the Placemat reference build when absent so existing variants
   * need no change.
   */
  baseSize?: [number, number];
  baseGsm?: number;
  /** Fixed order-level setup cost (screens, digitising), ₹. Defaults to the Placemat figure. */
  setupCostInr?: number;
};

/* ---- pricing variants: parameters that sit above the component build ---- */

export type ParameterId = "moq" | "size" | "quality";

export type ParameterOption = {
  id: string;
  label: string;
  /** MOQ: order quantity · Size: [width, length] inches · Quality: GSM */
  value: number | [number, number];
  /** true when the costing team typed it rather than picking a tier */
  custom?: boolean;
};

export type VariantParameter = {
  id: ParameterId;
  label: string;
  hint: string;
  unit: string;
  options: ParameterOption[];
  selectedId: string;
};

/**
 * The commercial layer. Held on the variant so each one can be quoted
 * differently, but deliberately excluded from `rollupVariant` — direct cost
 * never sees a margin.
 */
export type CommercialInputs = {
  /** ₹ per $ */
  fxRate: number;
  targetMarginPct: number;
  /** what the buyer wants to pay, $ per piece */
  buyerTargetUsd: number;
};

/* ------------------------------------------------------------------ *
 * Product / style
 * ------------------------------------------------------------------ */

export type Product = {
  id: string;
  styleId: string;
  articleNo: string;
  name: string;
  category: string;
  description: string;
  buyer: string;
  buyerRef: string;
  status: string;
  size: string;
  colour: string;
  pantone: string;
  unit: string;
  moq: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  image?: string;
};

export type CostingModel = {
  product: Product;
  variants: Variant[];
};

/* ------------------------------------------------------------------ *
 * Resolution — one consolidated object per component
 * ------------------------------------------------------------------ */

export type ResolvedMaterial = {
  relationship: MaterialRelationship;
  /** the component the material is inherited from, when relationship is same-as */
  inheritedFrom?: string;
  master?: MaterialMaster;
  name: string;
  code: string;
  rate: Sourced<number>;
  rateUnit: string;
};

export type ResolvedComponent = {
  component: ComponentDef;
  material: ResolvedMaterial | null;
  makingSpec: MakingSpec | null;
  consumptionRule: ConsumptionRule | null;
  /** per occurrence, in the rule's unit */
  consumptionPerOccurrence: number;
  /** × quantity — what the table's "Consumption / pc" column shows */
  consumptionPerPiece: number;
  processes: ProcessItem[];
  accessories: AccessoryItem[];
  /** quantity × consumption × rate */
  materialCost: number;
  processTotal: number;
  accessoryTotal: number;
  /** material + process + accessories, the row's "Cost / pc" */
  totalCost: number;
  /** every value in this component that departs from its master */
  overrides: OverrideRecord[];
};

export type OverrideRecord = {
  field: string;
  source: SourceType;
  masterValue: string;
  overrideValue: string;
  finalValue: string;
  reason?: string;
};

type MasterLookup = {
  materials: Record<string, MaterialMaster>;
  processes: Record<string, ProcessMaster>;
};

/**
 * Resolve one component into everything the table and the inspector need.
 *
 * `all` is the component list of the same variant — required so a
 * "same as body fabric" relationship can be followed without duplicating
 * material data.
 */
export function resolveComponent(
  component: ComponentDef,
  all: ComponentDef[],
  masters: MasterLookup,
): ResolvedComponent {
  const material = resolveMaterial(component, all, masters);
  const rule = component.consumption ?? null;

  const perOccurrence = rule ? calculateConsumption(rule) : 0;
  const perPiece = round3(perOccurrence * component.quantity);

  const rate = material ? finalOf(material.rate) : 0;
  const materialCost = round2(perPiece * rate);
  const processTotal = round2(component.processes.reduce((t, p) => t + processCost(p), 0));
  const accessoryTotal = round2(component.accessories.reduce((t, a) => t + accessoryCost(a), 0));

  return {
    component,
    material,
    makingSpec: component.makingSpec ?? null,
    consumptionRule: rule,
    consumptionPerOccurrence: perOccurrence,
    consumptionPerPiece: perPiece,
    processes: [...component.processes].sort((a, b) => a.sequence - b.sequence),
    accessories: component.accessories,
    materialCost,
    processTotal,
    accessoryTotal,
    totalCost: round2(materialCost + processTotal + accessoryTotal),
    overrides: collectOverrides(component, material),
  };
}

function resolveMaterial(
  component: ComponentDef,
  all: ComponentDef[],
  masters: MasterLookup,
): ResolvedMaterial | null {
  const assignment = component.material;
  if (!assignment) return null;

  if (assignment.relationship === "same-as-component") {
    const parent = all.find((c) => c.id === assignment.sameAsComponentId);
    const inherited = parent ? resolveMaterial(parent, all, masters) : null;
    if (!inherited) return null;
    return {
      ...inherited,
      relationship: "same-as-component",
      inheritedFrom: parent?.name,
      // the component may still override the rate it is charged at
      rate: isOverridden(assignment.rate) ? assignment.rate : inherited.rate,
      rateUnit: assignment.rateUnit,
    };
  }

  if (assignment.relationship === "custom") {
    return {
      relationship: "custom",
      master: undefined,
      name: assignment.custom?.name ?? "Custom material",
      code: assignment.custom?.code ?? "—",
      rate: assignment.rate,
      rateUnit: assignment.rateUnit,
    };
  }

  const master = assignment.materialMasterId
    ? masters.materials[assignment.materialMasterId]
    : undefined;
  if (!master) return null;
  return {
    relationship: "master",
    master,
    name: master.name,
    code: master.code,
    rate: assignment.rate,
    rateUnit: assignment.rateUnit,
  };
}

function collectOverrides(
  component: ComponentDef,
  material: ResolvedMaterial | null,
): OverrideRecord[] {
  const out: OverrideRecord[] = [];

  if (material && isOverridden(material.rate)) {
    out.push({
      field: "Material rate",
      source: "Rate Master",
      masterValue: `${material.rate.masterValue.toFixed(2)} ${material.rateUnit}`,
      overrideValue: `${finalOf(material.rate).toFixed(2)} ${material.rateUnit}`,
      finalValue: `${finalOf(material.rate).toFixed(2)} ${material.rateUnit}`,
      reason: material.rate.overrideReason,
    });
  }

  const rule = component.consumption;
  if (rule?.overrideConsumption !== undefined) {
    const master = calculateConsumption({ ...rule, overrideConsumption: undefined });
    out.push({
      field: "Consumption",
      source: "Consumption Rule",
      masterValue: `${master.toFixed(3)} ${rule.unit}`,
      overrideValue: `${rule.overrideConsumption.toFixed(3)} ${rule.unit}`,
      finalValue: `${rule.overrideConsumption.toFixed(3)} ${rule.unit}`,
      reason: rule.overrideReason,
    });
  }

  for (const p of component.processes) {
    if (!isOverridden(p.rate)) continue;
    out.push({
      field: `${p.name} rate`,
      source: "Process Master",
      masterValue: `${p.rate.masterValue.toFixed(2)} ${p.rateUnit}`,
      overrideValue: `${finalOf(p.rate).toFixed(2)} ${p.rateUnit}`,
      finalValue: `${finalOf(p.rate).toFixed(2)} ${p.rateUnit}`,
      reason: p.rate.overrideReason,
    });
  }

  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ *
 * Roll-up — Raw Material + Process + Accessories + Packaging = Direct Cost
 * ------------------------------------------------------------------ */

export type CostRollup = {
  rawMaterial: number;
  process: number;
  accessories: number;
  packaging: number;
  testing: number;
  directCost: number;
  /** every component, already resolved — the table renders straight from this */
  components: ResolvedComponent[];
};

export function rollupVariant(variant: Variant, masters: MasterLookup): CostRollup {
  const active = variant.components.filter((c) => c.active).sort((a, b) => a.sequence - b.sequence);
  const components = active.map((c) => resolveComponent(c, variant.components, masters));

  const rawMaterial = round2(components.reduce((t, c) => t + c.materialCost, 0));
  const process = round2(components.reduce((t, c) => t + c.processTotal, 0));
  const accessories = round2(components.reduce((t, c) => t + c.accessoryTotal, 0));
  const packaging = round2(variant.packaging.reduce((t, p) => t + packagingCost(p), 0));
  const testing = round2(variant.testing.reduce((t, x) => t + testingCost(x), 0));

  return {
    rawMaterial,
    process,
    accessories,
    packaging,
    testing,
    directCost: round2(rawMaterial + process + accessories + packaging + testing),
    components,
  };
}

/* ------------------------------------------------------------------ *
 * Immutable variant editing
 * ------------------------------------------------------------------ */

export const patchComponentIn = (
  variant: Variant,
  componentId: string,
  patch: Partial<ComponentDef>,
): Variant => ({
  ...variant,
  components: variant.components.map((c) => (c.id === componentId ? { ...c, ...patch } : c)),
});

export const removeComponentFrom = (variant: Variant, componentId: string): Variant => ({
  ...variant,
  components: variant.components.filter((c) => c.id !== componentId && c.parentId !== componentId),
});

export const addComponentTo = (variant: Variant, component: ComponentDef): Variant => ({
  ...variant,
  components: [...variant.components, component],
});

/** Deep-enough clone for a duplicated variant — nested arrays get fresh identity. */
export const cloneComponents = (components: ComponentDef[]): ComponentDef[] =>
  components.map((c) => ({
    ...c,
    relatedComponentIds: [...c.relatedComponentIds],
    material: c.material ? { ...c.material, rate: { ...c.material.rate } } : undefined,
    makingSpec: c.makingSpec
      ? { ...c.makingSpec, fields: c.makingSpec.fields.map((f) => ({ ...f })) }
      : undefined,
    consumption: c.consumption ? { ...c.consumption } : undefined,
    processes: c.processes.map((p) => ({
      ...p,
      rate: { ...p.rate },
      params: p.params.map((f) => ({ ...f })),
    })),
    accessories: c.accessories.map((a) => ({ ...a, rate: { ...a.rate } })),
  }));

export const duplicateVariant = (source: Variant, id: string, name: string): Variant => ({
  ...source,
  id,
  name,
  baseVariantId: source.id,
  creationMethod: "Duplicate Existing",
  status: "Draft",
  components: cloneComponents(source.components),
  packaging: source.packaging.map((p) => ({ ...p, rate: { ...p.rate } })),
  testing: source.testing.map((t) => ({ ...t })),
  options: [],
  // A duplicate inherits the pricing variants it was copied from and can then
  // diverge — the arrays are rebuilt so the two variants never share state.
  parameters: source.parameters.map((p) => ({ ...p, options: p.options.map((o) => ({ ...o })) })),
  commercial: { ...source.commercial },
});
