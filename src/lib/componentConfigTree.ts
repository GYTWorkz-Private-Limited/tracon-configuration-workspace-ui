/**
 * Configuration tree — the hierarchy every surface reads from.
 *
 *   PRODUCT → COMPONENT → SUB-COMPONENT → CONFIGURATION GROUP → VARIABLE → OPTION
 *
 * Nothing here is a second copy of the costing data. Every node is DERIVED from
 * the already-resolved component (`resolveComponent`), so the table, the
 * inspector, the tab totals and the roll-up cannot disagree — there is exactly
 * one calculation, and this file only gives it a shape.
 *
 * Nodes carry a real relationship (id, parentId, level, type, componentId,
 * order) plus, where the variable is genuinely configurable, the option list
 * and the current selection. Selecting an option writes back to the variant and
 * the cost recomputes — nothing here is decorative.
 */

import {
  accessoryCost,
  calculateConsumption,
  finalOf,
  processCost,
  type ConsumptionMethod,
  type ConsumptionRule,
  type PackagingItem,
  type ResolvedComponent,
  type TestingItem,
} from "./costingModel";
import { packagingCost, testingCost } from "./costingModel";

/** What a node represents — drives how the row is rendered, not what it means. */
export type ConfigNodeType =
  "component" | "sub-component" | "group" | "variable" | "process" | "accessory";

/** A selectable value for a configurable variable. */
export type ConfigOption = {
  id: string;
  label: string;
};

/**
 * Which real field an option list writes to. The table needs this to know
 * what callback to fire — a node is never "configurable" in the abstract.
 */
export type ConfigField = "consumptionMethod" | "wastagePct" | "shrinkagePct" | "markerEfficiency";

export type ConfigNode = {
  id: string;
  parentId?: string;
  /** 0 = component, 1 = group, 2 = variable, deeper where genuinely nested */
  level: number;
  type: ConfigNodeType;
  /** the component this node ultimately belongs to — every node has one */
  componentId: string;
  order: number;
  label: string;
  /** the selected value, already formatted for display */
  value?: string;
  /** per-piece cost where this node carries one */
  cost?: number;
  /** present only when the variable is genuinely selectable */
  field?: ConfigField;
  options?: ConfigOption[];
  selectedOptionId?: string;
  children: ConfigNode[];
};

/* ------------------------------------------------------------------ *
 * Option catalogues — real values, each of which changes the cost
 * ------------------------------------------------------------------ */

export const CONSUMPTION_METHODS: ConsumptionMethod[] = [
  "Fixed",
  "Formula-Based",
  "Width-Based",
  "Length-Based",
  "Area-Based",
  "Marker-Based",
  "Component-Based",
];

const PCT_OPTIONS = [0, 2, 3, 5, 8, 10, 12];
const MARKER_OPTIONS = [0.75, 0.78, 0.81, 0.86, 0.9];

const methodOptions = (): ConfigOption[] => CONSUMPTION_METHODS.map((m) => ({ id: m, label: m }));

const pctOptions = (current: number): ConfigOption[] => {
  const values = PCT_OPTIONS.includes(current)
    ? PCT_OPTIONS
    : [...PCT_OPTIONS, current].sort((a, b) => a - b);
  return values.map((v) => ({ id: String(v), label: `${v}%` }));
};

const markerOptions = (current: number): ConfigOption[] => {
  const values = MARKER_OPTIONS.includes(current)
    ? MARKER_OPTIONS
    : [...MARKER_OPTIONS, current].sort((a, b) => a - b);
  return values.map((v) => ({ id: String(v), label: `${Math.round(v * 100)}%` }));
};

/* ------------------------------------------------------------------ *
 * Builders
 * ------------------------------------------------------------------ */

type Fmt = (amountInr: number, decimals?: number) => string;

let seq = 0;
const nid = (prefix: string) => `${prefix}-${++seq}`;

const leaf = (
  parent: ConfigNode,
  label: string,
  value: string,
  order: number,
  extra?: Partial<ConfigNode>,
): ConfigNode => ({
  id: nid(`${parent.id}-v`),
  parentId: parent.id,
  level: parent.level + 1,
  type: "variable",
  componentId: parent.componentId,
  order,
  label,
  value,
  children: [],
  ...extra,
});

const group = (parent: ConfigNode, label: string, order: number, cost?: number): ConfigNode => ({
  id: nid(`${parent.id}-g`),
  parentId: parent.id,
  level: parent.level + 1,
  type: "group",
  componentId: parent.componentId,
  order,
  label,
  cost,
  children: [],
});

/**
 * One component's full configuration sub-tree:
 *   Material → Consumption → Processes → Accessories → Cost
 *
 * A group is only emitted when the component actually has that dimension — a
 * process-only component gets no Material or Consumption group rather than an
 * empty one saying "—".
 */
/**
 * Which cost category the tree is being read under. A category view shows only
 * the groups that category is made of — reading the Process tab should not
 * scroll past a Material block costed at zero.
 */
export type TreeScope = "all" | "raw" | "process" | "accessories";

function componentNode(
  resolved: ResolvedComponent,
  money: Fmt,
  order: number,
  scope: TreeScope,
): ConfigNode {
  const { component: c, material, consumptionRule: rule } = resolved;
  const wants = (g: Exclude<TreeScope, "all">) => scope === "all" || scope === g;

  const node: ConfigNode = {
    id: `cmp-${c.id}`,
    level: 0,
    type: "component",
    componentId: c.id,
    order,
    label: c.name,
    value: c.usage,
    cost: resolved.totalCost,
    children: [],
  };

  /* ---- Material ---- */
  if (material && wants("raw")) {
    const g = group(node, "Material", 1, resolved.materialCost);
    g.value = material.name;
    const m = material.master;
    let i = 0;
    if (material.inheritedFrom) {
      g.children.push(leaf(g, "Inherited from", material.inheritedFrom, i++));
    }
    g.children.push(leaf(g, "Material Code", material.code, i++));
    if (m?.materialType) g.children.push(leaf(g, "Material Type", m.materialType, i++));
    if (m?.fabricType) g.children.push(leaf(g, "Fabric Type", m.fabricType, i++));
    if (m?.availability) g.children.push(leaf(g, "Fabric Availability", m.availability, i++));
    if (m?.composition) g.children.push(leaf(g, "Composition", m.composition, i++));
    if (m?.yarnCount) g.children.push(leaf(g, "Yarn Count", m.yarnCount, i++));
    if (m?.construction) g.children.push(leaf(g, "Construction", m.construction, i++));
    if (m?.gsm !== undefined) g.children.push(leaf(g, "GSM", String(m.gsm), i++));
    if (m?.width !== undefined) g.children.push(leaf(g, "Width", `${m.width}"`, i++));
    if (m?.costingWidth !== undefined) {
      g.children.push(leaf(g, "Costing Width", `${m.costingWidth}"`, i++));
    }
    if (m?.colour) g.children.push(leaf(g, "Colour / Shade", m.colour, i++));
    if (m?.pantone) g.children.push(leaf(g, "Pantone", m.pantone, i++));
    if (m?.certification) g.children.push(leaf(g, "Certification", m.certification, i++));
    if (m?.supplier) g.children.push(leaf(g, "Supplier", m.supplier, i++));
    g.children.push(
      leaf(
        g,
        "Rate / Unit",
        `${money(finalOf(material.rate))} ${material.rateUnit.replace("per ", "/ ")}`,
        i++,
      ),
    );
    node.children.push(g);
  }

  /* ---- Consumption — the configurable group ---- */
  if (rule && wants("raw")) {
    const g = group(node, "Consumption", 2);
    g.value = `${resolved.consumptionPerPiece.toFixed(3)} ${rule.unit} / pc`;
    let i = 0;

    g.children.push(
      leaf(g, "Calculation Method", rule.method, i++, {
        field: "consumptionMethod",
        options: methodOptions(),
        selectedOptionId: rule.method,
      }),
    );

    if (rule.finishedWidth !== undefined) {
      const dims = group(g, "Finished Dimensions", i++);
      dims.value = `${rule.finishedWidth}" × ${rule.finishedLength ?? 0}"`;
      dims.children.push(leaf(dims, "Width", `${rule.finishedWidth}"`, 0));
      dims.children.push(leaf(dims, "Length", `${rule.finishedLength ?? 0}"`, 1));
      g.children.push(dims);
    }

    if (rule.seamAllowance !== undefined || rule.hemAllowance !== undefined) {
      const allow = group(g, "Allowances", i++);
      allow.value = `+${rule.seamAllowance ?? 0}" seam / +${rule.hemAllowance ?? 0}" hem`;
      allow.children.push(leaf(allow, "Seam Allowance", `${rule.seamAllowance ?? 0}"`, 0));
      allow.children.push(leaf(allow, "Hem Allowance", `${rule.hemAllowance ?? 0}"`, 1));
      g.children.push(allow);
    }

    if (rule.fabricWidth !== undefined) {
      g.children.push(leaf(g, "Fabric Width Used", `${rule.fabricWidth}"`, i++));
    }

    g.children.push(
      leaf(g, "Shrinkage", `${rule.shrinkagePct ?? 0}%`, i++, {
        field: "shrinkagePct",
        options: pctOptions(rule.shrinkagePct ?? 0),
        selectedOptionId: String(rule.shrinkagePct ?? 0),
      }),
    );
    g.children.push(
      leaf(g, "Wastage", `${rule.wastagePct}%`, i++, {
        field: "wastagePct",
        options: pctOptions(rule.wastagePct),
        selectedOptionId: String(rule.wastagePct),
      }),
    );
    if (rule.markerEfficiency !== undefined) {
      g.children.push(
        leaf(g, "Marker Efficiency", `${Math.round(rule.markerEfficiency * 100)}%`, i++, {
          field: "markerEfficiency",
          options: markerOptions(rule.markerEfficiency),
          selectedOptionId: String(rule.markerEfficiency),
        }),
      );
    }
    if (rule.plies !== undefined && rule.plies > 1) {
      g.children.push(leaf(g, "Plies / Panels", String(rule.plies), i++));
    }
    g.children.push(leaf(g, "Formula", rule.formula, i++));
    g.children.push(
      leaf(
        g,
        "Calculated Consumption",
        `${resolved.consumptionPerOccurrence.toFixed(3)} ${rule.unit} / occ.`,
        i++,
      ),
    );
    if (rule.overrideConsumption !== undefined) {
      g.children.push(
        leaf(g, "Override Consumption", `${rule.overrideConsumption.toFixed(3)} ${rule.unit}`, i++),
      );
    }
    node.children.push(g);
  }

  /* ---- Processes ---- */
  if (resolved.processes.length && wants("process")) {
    const g = group(node, `Processes (${resolved.processes.length})`, 3, resolved.processTotal);
    g.value = resolved.processes.map((p) => p.name).join(", ");
    resolved.processes.forEach((p, pi) => {
      const pn: ConfigNode = {
        id: `${g.id}-p-${p.id}`,
        parentId: g.id,
        level: g.level + 1,
        type: "process",
        componentId: c.id,
        order: pi,
        label: p.name,
        value: `${p.quantity} ${p.basis}`,
        cost: processCost(p),
        children: [],
      };
      p.params.forEach((f, fi) =>
        pn.children.push(leaf(pn, f.label, `${f.value}${f.unit ? ` ${f.unit}` : ""}`, fi)),
      );
      pn.children.push(
        leaf(pn, "Rate", `${money(finalOf(p.rate))} ${p.rateUnit}`, pn.children.length),
      );
      g.children.push(pn);
    });
    node.children.push(g);
  }

  /* ---- Accessories / trims ---- */
  if (resolved.accessories.length && wants("accessories")) {
    const g = group(
      node,
      `Accessories / Trims (${resolved.accessories.length})`,
      4,
      resolved.accessoryTotal,
    );
    g.value = resolved.accessories.map((a) => a.name).join(", ");
    resolved.accessories.forEach((a, ai) => {
      const an: ConfigNode = {
        id: `${g.id}-a-${a.id}`,
        parentId: g.id,
        level: g.level + 1,
        type: "accessory",
        componentId: c.id,
        order: ai,
        label: a.name,
        value: a.specification,
        cost: accessoryCost(a),
        children: [],
      };
      an.children.push(leaf(an, "Accessory Type", a.accessoryType, 0));
      an.children.push(leaf(an, "Quantity", String(a.quantity), 1));
      an.children.push(leaf(an, "Rate", `${money(finalOf(a.rate))} ${a.rateUnit}`, 2));
      g.children.push(an);
    });
    node.children.push(g);
  }

  /* ---- Cost — always last, always the sum of the groups above ---- */
  const cost = group(node, "Cost", 5, resolved.totalCost);
  cost.value = money(resolved.totalCost);
  let ci = 0;
  if (material && wants("raw")) {
    cost.children.push(leaf(cost, "Material cost", money(resolved.materialCost), ci++));
  }
  if (resolved.processes.length && wants("process")) {
    cost.children.push(leaf(cost, "Process cost", money(resolved.processTotal), ci++));
  }
  if (resolved.accessories.length && wants("accessories")) {
    cost.children.push(leaf(cost, "Accessories / trims", money(resolved.accessoryTotal), ci++));
  }
  cost.children.push(leaf(cost, "Component cost / pc", money(resolved.totalCost), ci++));
  node.children.push(cost);

  return node;
}

/** Packaging and testing are product-level, so they build their own nodes. */
function packagingNode(p: PackagingItem, money: Fmt, order: number): ConfigNode {
  const node: ConfigNode = {
    id: `pkg-${p.id}`,
    level: 0,
    type: "component",
    componentId: p.id,
    order,
    label: p.subtype,
    value: p.packagingType,
    cost: packagingCost(p),
    children: [],
  };
  const g = group(node, "Packaging", 1, packagingCost(p));
  g.value = p.packagingType;
  g.children.push(leaf(g, "Packaging Type", p.packagingType, 0));
  g.children.push(leaf(g, "Specification", p.specification, 1));
  g.children.push(leaf(g, "Quantity", String(p.quantity), 2));
  g.children.push(leaf(g, "Rate", `${money(finalOf(p.rate))} ${p.rateUnit}`, 3));
  g.children.push(leaf(g, "Cost / pc", money(packagingCost(p)), 4));
  node.children.push(g);
  return node;
}

function testingNode(t: TestingItem, money: Fmt, order: number): ConfigNode {
  const node: ConfigNode = {
    id: `tst-${t.id}`,
    level: 0,
    type: "component",
    componentId: t.id,
    order,
    label: t.name,
    value: `${t.testType} · ${t.labName}`,
    cost: testingCost(t),
    children: [],
  };
  const g = group(node, "Testing & Certification", 1, testingCost(t));
  g.value = t.testType;
  g.children.push(leaf(g, "Test Type", t.testType, 0));
  g.children.push(leaf(g, "Specification", t.specification, 1));
  g.children.push(leaf(g, "Lab / Body", t.labName, 2));
  g.children.push(leaf(g, "Lot Cost", money(t.lotCost), 3));
  g.children.push(leaf(g, "Lot Size", `${t.lotSize.toLocaleString("en-IN")} pcs`, 4));
  g.children.push(leaf(g, "Cost / pc", money(testingCost(t)), 5));
  node.children.push(g);
  return node;
}

export function buildComponentTree(
  components: ResolvedComponent[],
  money: Fmt,
  scope: TreeScope = "all",
): ConfigNode[] {
  seq = 0;
  return components.map((c, i) => componentNode(c, money, i, scope));
}

export function buildPackagingTree(items: PackagingItem[], money: Fmt): ConfigNode[] {
  return items.map((p, i) => packagingNode(p, money, i));
}

export function buildTestingTree(items: TestingItem[], money: Fmt): ConfigNode[] {
  return items.map((t, i) => testingNode(t, money, i));
}

/* ------------------------------------------------------------------ *
 * Applying an option — the write side of the tree
 * ------------------------------------------------------------------ */

/**
 * Turn a picked option back into a real change on the consumption rule.
 * Returns a NEW rule; the caller swaps it into the variant immutably, and the
 * roll-up recomputes from it on the next render.
 */
export function applyConfigOption(
  rule: ConsumptionRule,
  field: ConfigField,
  optionId: string,
): ConsumptionRule {
  switch (field) {
    case "consumptionMethod":
      return { ...rule, method: optionId as ConsumptionMethod };
    case "wastagePct":
      return { ...rule, wastagePct: Number(optionId) };
    case "shrinkagePct":
      return { ...rule, shrinkagePct: Number(optionId) };
    case "markerEfficiency":
      return { ...rule, markerEfficiency: Number(optionId) };
    default:
      return rule;
  }
}

/** Consumption a rule would produce — used to preview an option before applying. */
export const previewConsumption = (
  rule: ConsumptionRule,
  field: ConfigField,
  optionId: string,
): number => calculateConsumption(applyConfigOption(rule, field, optionId));
