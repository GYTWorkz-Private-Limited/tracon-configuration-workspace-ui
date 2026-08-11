/**
 * Masters + the Quilt (King, IKEA — SRF-1024) reference configuration.
 *
 * A second, structurally distinct product proving the model generalises past
 * the Placemat: independent fabric slots (Front / Back / Piping, each its own
 * master rather than an inherited copy), a Filling slot, Quilting and
 * Embroidery as PROCESS components rather than materials, and a Zipper /
 * Labels accessory slot — matching the component-slot vocabulary of the
 * quilt/comforter configurator brief.
 *
 * Same rule as the Placemat file: every number here is an INPUT. Costs are
 * produced by `costingModel.ts`, never stated directly.
 */

import {
  sourced,
  type AccessoryItem,
  type ComponentDef,
  type CostingModel,
  type MaterialMaster,
  type PackagingItem,
  type ProcessItem,
  type ProcessMaster,
  type TestingItem,
  type Product,
  type Variant,
  type VariantParameter,
  type CommercialInputs,
} from "./costingModel";
import type { ComponentPreset, FabricOption } from "./costingModelData";

/* ------------------------------------------------------------------ *
 * Material master — every entry genuinely distinct, never a copy
 * ------------------------------------------------------------------ */

export const QUILT_MATERIAL_MASTERS: MaterialMaster[] = [
  {
    id: "QMAT-F01",
    code: "PRC-PRN-108-WF",
    name: "Printed Percale",
    materialType: "Fabric",
    fabricType: "Cotton Percale",
    availability: "Ready Fabric",
    composition: "100% Cotton",
    yarnCount: "133 × 72",
    construction: "Percale",
    gsm: 133,
    width: 108,
    costingWidth: 106,
    colour: "Printed — Wildflower",
    pantone: "14-0740 TCX",
    certification: "OEKO-TEX Standard 100",
    supplier: "Vaibhav Mills",
    rateMasterId: "RATE-Q-011",
    rate: 214.5,
    rateUnit: "per metre",
    description: "Digitally printed percale, buyer artwork WF-2601. Ready Fabric costing path.",
    status: "Active",
  },
  {
    id: "QMAT-F02",
    code: "SAT-PRN-108-BL",
    name: "Printed Sateen",
    materialType: "Fabric",
    fabricType: "Cotton Sateen",
    availability: "Ready Fabric",
    composition: "100% Cotton",
    yarnCount: "40s × 40s",
    construction: "Sateen",
    gsm: 300,
    width: 108,
    costingWidth: 106,
    colour: "Printed — Wildflower",
    pantone: "14-0740 TCX",
    certification: "OEKO-TEX Standard 100",
    supplier: "Vaibhav Mills",
    rateMasterId: "RATE-Q-012",
    rate: 342.8,
    rateUnit: "per metre",
    description: "Higher-count sateen ground, same artwork. Premium hand-feel upgrade.",
    status: "Active",
  },
  {
    id: "QMAT-F03",
    code: "POP-PRN-108-WF",
    name: "Printed Poplin",
    materialType: "Fabric",
    fabricType: "Cotton Poplin",
    availability: "Ready Fabric",
    composition: "100% Cotton",
    yarnCount: "76 × 68",
    construction: "Poplin",
    gsm: 115,
    width: 108,
    costingWidth: 106,
    colour: "Printed — Wildflower",
    pantone: "14-0740 TCX",
    certification: "OEKO-TEX Standard 100",
    supplier: "Deccan Weaves",
    rateMasterId: "RATE-Q-013",
    rate: 176.2,
    rateUnit: "per metre",
    description: "Lighter poplin ground at a lower rate — cost-down alternative to percale.",
    status: "Active",
  },
  {
    id: "QMAT-F04",
    code: "FLN-PRN-108-WF",
    name: "Printed Flannel",
    materialType: "Fabric",
    fabricType: "Cotton Flannel",
    availability: "Ready Fabric",
    composition: "100% Cotton",
    yarnCount: "20s × 10s",
    construction: "Brushed Twill",
    gsm: 170,
    width: 108,
    costingWidth: 105,
    colour: "Printed — Wildflower",
    pantone: "14-0740 TCX",
    certification: "OEKO-TEX Standard 100",
    supplier: "Himalayan Textiles",
    rateMasterId: "RATE-Q-014",
    rate: 248.9,
    rateUnit: "per metre",
    description: "Brushed both sides for the winter programme. Warmer hand, slower throughput.",
    status: "Active",
  },
  {
    id: "QMAT-F05",
    code: "ORG-PRC-108-WF",
    name: "Organic Percale — GOTS",
    materialType: "Fabric",
    fabricType: "Organic Cotton Percale",
    availability: "Ready Fabric",
    composition: "100% Organic Cotton",
    yarnCount: "133 × 72",
    construction: "Percale",
    gsm: 133,
    width: 108,
    costingWidth: 106,
    colour: "Printed — Wildflower (GOTS dyes)",
    pantone: "14-0740 TCX",
    certification: "GOTS · OEKO-TEX Standard 100",
    supplier: "EcoWeave Mills",
    rateMasterId: "RATE-Q-015",
    rate: 289.4,
    rateUnit: "per metre",
    description: "GOTS-certified organic percale, low-impact print. Sustainable programme fabric.",
    status: "Active",
  },
  {
    id: "QMAT-B01",
    code: "PRC-SLD-108-NAT",
    name: "Solid Percale",
    materialType: "Fabric",
    fabricType: "Cotton Percale",
    availability: "Ready Fabric",
    composition: "100% Cotton",
    yarnCount: "133 × 72",
    construction: "Percale",
    gsm: 133,
    width: 108,
    costingWidth: 106,
    colour: "Natural White",
    pantone: "11-0601 TCX",
    certification: "OEKO-TEX Standard 100",
    supplier: "Vaibhav Mills",
    rateMasterId: "RATE-Q-021",
    rate: 168.75,
    rateUnit: "per metre",
    description: "Solid-dyed reverse panel — undyed base, no print. Ready Fabric costing path.",
    status: "Active",
  },
  {
    id: "QMAT-P01",
    code: "POP-PIP-44-WF",
    name: "Cotton Poplin — Piping",
    materialType: "Fabric",
    fabricType: "Cotton Poplin",
    availability: "Ready Fabric",
    composition: "100% Cotton",
    yarnCount: "45s × 45s",
    construction: "Plain",
    gsm: 120,
    width: 44,
    costingWidth: 42,
    colour: "Wildflower Multi",
    pantone: "14-0740 TCX",
    certification: "OEKO-TEX Standard 100",
    supplier: "Vaibhav Mills",
    rateMasterId: "RATE-Q-031",
    rate: 96.4,
    rateUnit: "per metre",
    description:
      "Narrow-width poplin cut on the bias for corded edge piping. Independent slot — not self-fabric.",
    status: "Active",
  },
  {
    id: "QMAT-FIL01",
    code: "FIL-PLY-150-100",
    name: "Polyester Wadding",
    materialType: "Other",
    composition: "100% Polyester",
    construction: "Uniform Fill",
    gsm: 150,
    width: 100,
    costingWidth: 98,
    supplier: "Ganga Nonwovens",
    rateMasterId: "RATE-Q-041",
    rate: 61,
    rateUnit: "per metre",
    description: "150 GSM polyester wadding, uniform-fill construction. Quilt interlining.",
    status: "Active",
  },
  {
    id: "QMAT-ZIP01",
    code: "ZIP-NY5-96-NAT",
    name: "Nylon Coil Zipper #5",
    materialType: "Trim",
    supplier: "YKK India",
    rateMasterId: "RATE-Q-051",
    rate: 42,
    rateUnit: "per piece",
    description: '96" YKK #5 nylon coil zipper with pull, cover closure.',
    status: "Active",
  },
  {
    id: "QMAT-LBL01",
    code: "LBL-WVN-QLT-BRAND",
    name: "Woven Brand Label",
    materialType: "Trim",
    supplier: "Avery Dennison",
    rateMasterId: "RATE-Q-052",
    rate: 1.35,
    rateUnit: "per piece",
    description: "Buyer-nominated woven main label, folded, stitched into the side seam.",
    status: "Active",
  },
  {
    id: "QMAT-LBL02",
    code: "LBL-PRT-QLT-CARE",
    name: "Printed Care / Content Label",
    materialType: "Trim",
    supplier: "Avery Dennison",
    rateMasterId: "RATE-Q-053",
    rate: 0.95,
    rateUnit: "per piece",
    description: "Satin care label, 6 languages, buyer template CL-IKEA-09.",
    status: "Active",
  },
];

/* ------------------------------------------------------------------ *
 * Process master — Quilting and Embroidery as PROCESSES, not materials
 * ------------------------------------------------------------------ */

export const QUILT_PROCESS_MASTERS: ProcessMaster[] = [
  {
    id: "QPRC-CUT",
    name: "Cutting",
    category: "Making",
    description: "Straight-knife cutting from marker, panel + filling together.",
    defaultParams: [{ label: "Cutting Method", value: "Straight knife, 12-ply" }],
    standardRate: 1.85,
    rateUnit: "per piece",
    rateMasterId: "RATE-Q-101",
    status: "Active",
  },
  {
    id: "QPRC-QLT",
    name: "Quilting",
    category: "Making",
    description: "Allover heart-pattern lockstitch quilting through face, filling and back.",
    defaultParams: [
      { label: "Pattern", value: "Heart" },
      { label: "Method", value: "Machine — multi-needle" },
      { label: "Placement", value: "Allover" },
      { label: "Stitch Density", value: "3.5 stitches / cm" },
      { label: "Supplier", value: "Sri Quilting Co." },
      { label: "MOQ", value: "45 pcs" },
    ],
    standardRate: 225.75,
    rateUnit: "per piece",
    rateMasterId: "RATE-Q-102",
    status: "Active",
  },
  {
    id: "QPRC-STC",
    name: "Stitching / Assembly",
    category: "Making",
    description: "Three-panel assembly (front, filling, back) with edge stitch.",
    defaultParams: [
      { label: "Machine", value: "Single needle + O/L" },
      { label: "Seam Allowance", value: '0.75"' },
    ],
    standardRate: 18.4,
    rateUnit: "per piece",
    rateMasterId: "RATE-Q-103",
    status: "Active",
  },
  {
    id: "QPRC-BND",
    name: "Edge Binding",
    category: "Making",
    description: "Self-fabric bias binding folded and topstitched around the perimeter.",
    defaultParams: [{ label: "Bind Width", value: '1"' }],
    standardRate: 12.6,
    rateUnit: "per piece",
    rateMasterId: "RATE-Q-104",
    status: "Active",
  },
  {
    id: "QPRC-EMB",
    name: "Boucle Embroidery",
    category: "Decoration",
    description: "Boucle-thread embroidery, Love + Heart motifs, buyer artwork BE-2601.",
    defaultParams: [
      { label: "Embroidery Type", value: "Boucle" },
      { label: "Design", value: "Love + Heart" },
      { label: "Placement", value: "Front" },
      { label: "Design Quantity", value: "Love ×5, Heart ×3" },
      { label: "Thread Type", value: "Boucle" },
      { label: "Number of Colours", value: "3" },
      { label: "Supplier", value: "Suman Emb" },
      { label: "Secondary Supplier", value: "SK Emb" },
    ],
    standardRate: 414,
    rateUnit: "per piece",
    rateMasterId: "RATE-Q-105",
    status: "Active",
  },
];

const materialById = (id: string): MaterialMaster => {
  const m = QUILT_MATERIAL_MASTERS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown Quilt material master: ${id}`);
  return m;
};

const processMasterById = (id: string): ProcessMaster => {
  const p = QUILT_PROCESS_MASTERS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown Quilt process master: ${id}`);
  return p;
};

export const QUILT_MASTERS = {
  materials: Object.fromEntries(QUILT_MATERIAL_MASTERS.map((m) => [m.id, m])) as Record<
    string,
    MaterialMaster
  >,
  processes: Object.fromEntries(QUILT_PROCESS_MASTERS.map((p) => [p.id, p])) as Record<
    string,
    ProcessMaster
  >,
};

/* ------------------------------------------------------------------ *
 * Product
 * ------------------------------------------------------------------ */

/** The demo SRF this product's article is bundled under — see `costingModels.ts`. */
export const QUILT_SRF_REF = "SRF-1024";

export const QUILT_PRODUCT: Product = {
  id: "PRD-QUILT-KING",
  styleId: "STY-QLT-10896",
  articleNo: "7042198",
  name: "Quilt",
  category: "Top of Bed — Quilts & Comforters",
  description:
    "King quilt, printed percale front, solid percale back, allover heart quilting, boucle embroidery motif.",
  buyer: "IKEA",
  buyerRef: "IKEA-SS26-BED-04",
  status: "In Progress",
  size: '108" × 96" (King)',
  colour: "Printed — Wildflower",
  pantone: "14-0740 TCX",
  unit: "pcs",
  moq: "2,500 pcs",
  currency: "INR",
  createdAt: "2026-05-02",
  updatedAt: "2026-08-10",
};

/* ------------------------------------------------------------------ *
 * Component builders
 * ------------------------------------------------------------------ */

const proc = (
  componentId: string,
  masterId: string,
  sequence: number,
  quantity: number,
  overrides?: Partial<Pick<ProcessItem, "rate" | "basis">>,
): ProcessItem => {
  const master = processMasterById(masterId);
  return {
    id: `${componentId}-${masterId}`,
    componentId,
    processMasterId: master.id,
    type: master.category,
    name: master.name,
    sequence,
    description: master.description,
    params: master.defaultParams,
    basis: master.rateUnit === "per metre" ? "per m" : "per pc",
    quantity,
    rate: sourced(master.standardRate, "Process Master", master.rateMasterId),
    rateUnit: master.rateUnit,
    rateMasterId: master.rateMasterId,
    ...overrides,
  };
};

const trim = (
  id: string,
  componentId: string,
  masterId: string,
  accessoryType: string,
  specification: string,
  quantity: number,
): AccessoryItem => {
  const master = materialById(masterId);
  return {
    id,
    componentId,
    accessoryType,
    name: master.name,
    materialMasterId: master.id,
    specification,
    quantity,
    rate: sourced(master.rate, "Rate Master", master.rateMasterId),
    rateUnit: master.rateUnit,
    source: "Material Master",
  };
};

/* --- 1. Front Fabric (Ready Fabric path) --- */

const frontFabric: ComponentDef = {
  id: "QCMP-01",
  productId: QUILT_PRODUCT.id,
  name: "Front Fabric",
  type: "Fabric",
  description:
    "Printed face panel — Ready Fabric costing path (Ready Fabric → process → final rate).",
  usage: "Face panel",
  required: true,
  quantity: 1,
  sequence: 1,
  relatedComponentIds: [],
  active: true,
  material: {
    id: "QCM-01",
    relationship: "master",
    materialMasterId: "QMAT-F01",
    rate: sourced(materialById("QMAT-F01").rate, "Rate Master", "RATE-Q-011"),
    rateUnit: "per metre",
  },
  makingSpec: {
    id: "QMS-01",
    source: "Style Master",
    masterId: "STY-QLT-10896",
    fields: [
      { label: "Costing Path", value: "A — Ready Fabric", source: "Style Master" },
      {
        label: "SAM (Standard Allowed Minutes)",
        value: "38",
        unit: "mins/pc",
        source: "Style Master",
      },
      { label: "Machine Type", value: "Single needle + O/L", source: "Style Master" },
      { label: "Seam Allowance", value: '0.75"', source: "Style Master" },
      { label: "Shrinkage Allowance", value: "3", unit: "%", source: "Material Master" },
      { label: "Fabric Wastage", value: "6", unit: "%", source: "Consumption Rule" },
      { label: "Cutting Method", value: "Straight knife, 12-ply", source: "Process Master" },
    ],
  },
  consumption: {
    id: "QCR-01",
    method: "Formula-Based",
    formula:
      "((W + seam) × (L + hem) × shrinkage × wastage) ÷ (costing_width × marker_efficiency) ÷ 39.37",
    formulaVersion: "v2.1",
    unit: "mtr",
    finishedWidth: 108,
    finishedLength: 96,
    seamAllowance: 1.5,
    hemAllowance: 1.5,
    shrinkagePct: 3,
    wastagePct: 6,
    fabricWidth: 106,
    markerEfficiency: 0.86,
    plies: 1,
    quantity: 1,
    source: "Consumption Rule",
  },
  processes: [proc("QCMP-01", "QPRC-CUT", 1, 1)],
  accessories: [],
};

/* --- 2. Back Fabric (Ready Fabric path, independent material) --- */

const backFabric: ComponentDef = {
  id: "QCMP-02",
  productId: QUILT_PRODUCT.id,
  name: "Back Fabric",
  type: "Fabric",
  description:
    "Solid reverse panel — Ready Fabric costing path, priced independently of the front.",
  usage: "Reverse panel",
  required: true,
  quantity: 1,
  sequence: 2,
  relatedComponentIds: [],
  active: true,
  material: {
    id: "QCM-02",
    relationship: "master",
    materialMasterId: "QMAT-B01",
    rate: sourced(materialById("QMAT-B01").rate, "Rate Master", "RATE-Q-021"),
    rateUnit: "per metre",
  },
  makingSpec: {
    id: "QMS-02",
    source: "Style Master",
    masterId: "STY-QLT-10896",
    fields: [
      { label: "Costing Path", value: "A — Ready Fabric", source: "Style Master" },
      { label: "Machine Type", value: "Single needle + O/L", source: "Style Master" },
      { label: "Seam Allowance", value: '0.75"', source: "Style Master" },
      { label: "Shrinkage Allowance", value: "3", unit: "%", source: "Material Master" },
      { label: "Fabric Wastage", value: "6", unit: "%", source: "Consumption Rule" },
    ],
  },
  consumption: {
    id: "QCR-02",
    method: "Formula-Based",
    formula:
      "((W + seam) × (L + hem) × shrinkage × wastage) ÷ (costing_width × marker_efficiency) ÷ 39.37",
    formulaVersion: "v2.1",
    unit: "mtr",
    finishedWidth: 108,
    finishedLength: 96,
    seamAllowance: 1.5,
    hemAllowance: 1.5,
    shrinkagePct: 3,
    wastagePct: 6,
    fabricWidth: 106,
    markerEfficiency: 0.86,
    plies: 1,
    quantity: 1,
    source: "Consumption Rule",
  },
  processes: [proc("QCMP-02", "QPRC-CUT", 1, 1)],
  accessories: [],
};

/* --- 3. Piping / Edge (independent fabric slot — not self-fabric) --- */

const piping: ComponentDef = {
  id: "QCMP-03",
  productId: QUILT_PRODUCT.id,
  name: "Piping / Edge",
  type: "Trim / Self Fabric",
  description:
    "Corded edge piping, cut from an independently sourced poplin — not the body fabric.",
  usage: "Perimeter seam",
  required: true,
  quantity: 1,
  sequence: 3,
  relatedComponentIds: [],
  active: true,
  material: {
    id: "QCM-03",
    relationship: "master",
    materialMasterId: "QMAT-P01",
    rate: sourced(materialById("QMAT-P01").rate, "Rate Master", "RATE-Q-031"),
    rateUnit: "per metre",
  },
  makingSpec: {
    id: "QMS-03",
    source: "Style Master",
    masterId: "STY-QLT-10896",
    fields: [
      { label: "Cord Diameter", value: "5", unit: "mm", source: "Style Master" },
      { label: "Cut Width", value: '1.5"', source: "Style Master" },
      { label: "Bias Cut", value: "Yes — 45°", source: "Style Master" },
    ],
  },
  consumption: {
    id: "QCR-03",
    method: "Length-Based",
    formula: "(2 × (W + L) + hem) × shrinkage × wastage ÷ 39.37",
    formulaVersion: "v2.1",
    unit: "mtr",
    finishedWidth: 108,
    finishedLength: 96,
    hemAllowance: 6,
    shrinkagePct: 2,
    wastagePct: 8,
    quantity: 1,
    source: "Consumption Rule",
  },
  processes: [proc("QCMP-03", "QPRC-BND", 1, 1)],
  accessories: [],
};

/* --- 4. Filling --- */

const filling: ComponentDef = {
  id: "QCMP-04",
  productId: QUILT_PRODUCT.id,
  name: "Filling",
  type: "Filling",
  description: "150 GSM polyester wadding interlining, sandwiched between face and back.",
  usage: "Between face and back",
  required: true,
  quantity: 1,
  sequence: 4,
  relatedComponentIds: [],
  active: true,
  material: {
    id: "QCM-04",
    relationship: "master",
    materialMasterId: "QMAT-FIL01",
    rate: sourced(materialById("QMAT-FIL01").rate, "Rate Master", "RATE-Q-041"),
    rateUnit: "per metre",
  },
  makingSpec: {
    id: "QMS-04",
    source: "Material Master",
    masterId: "QMAT-FIL01",
    fields: [
      { label: "Filling Type", value: "Polyester Wadding", source: "Material Master" },
      { label: "Construction", value: "Uniform Fill", source: "Material Master" },
      { label: "Loft", value: "12", unit: "mm", source: "Material Master" },
    ],
  },
  consumption: {
    id: "QCR-04",
    method: "Formula-Based",
    formula: "((W + seam) × (L + hem)) ÷ (costing_width × marker_efficiency) ÷ 39.37",
    formulaVersion: "v2.1",
    unit: "mtr",
    finishedWidth: 108,
    finishedLength: 96,
    seamAllowance: 1,
    hemAllowance: 1,
    shrinkagePct: 0,
    wastagePct: 5,
    fabricWidth: 98,
    markerEfficiency: 0.9,
    plies: 1,
    quantity: 1,
    source: "Consumption Rule",
  },
  processes: [],
  accessories: [],
};

/* --- 5. Quilting (process-only component) --- */

const quilting: ComponentDef = {
  id: "QCMP-05",
  productId: QUILT_PRODUCT.id,
  name: "Quilting",
  type: "Process",
  description: "Allover heart-pattern lockstitch quilting through all three layers.",
  usage: "Allover, all layers",
  required: true,
  quantity: 1,
  sequence: 5,
  relatedComponentIds: ["QCMP-01", "QCMP-02", "QCMP-04"],
  active: true,
  makingSpec: {
    id: "QMS-05",
    source: "Process Master",
    masterId: "QPRC-QLT",
    fields: [
      { label: "Pattern", value: "Heart", source: "Process Master" },
      { label: "Method", value: "Machine — multi-needle", source: "Process Master" },
      { label: "Placement", value: "Allover", source: "Process Master" },
      { label: "Stitch Density", value: "3.5 stitches / cm", source: "Process Master" },
      { label: "Supplier", value: "Sri Quilting Co.", source: "Process Master" },
      { label: "MOQ", value: "45 pcs", source: "Process Master" },
    ],
  },
  processes: [proc("QCMP-05", "QPRC-QLT", 1, 1), proc("QCMP-05", "QPRC-STC", 2, 1)],
  accessories: [],
};

/* --- 6. Decoration — Boucle Embroidery --- */

const decoration: ComponentDef = {
  id: "QCMP-06",
  productId: QUILT_PRODUCT.id,
  name: "Decoration",
  type: "Decoration",
  description: 'Boucle-thread embroidery — "Love" ×5 + "Heart" ×3 motifs, buyer artwork BE-2601.',
  usage: "Front, scattered placement",
  required: false,
  quantity: 1,
  sequence: 6,
  relatedComponentIds: ["QCMP-01"],
  active: true,
  makingSpec: {
    id: "QMS-06",
    source: "Buyer Template",
    masterId: "BE-2601",
    fields: [
      { label: "Embroidery Type", value: "Boucle", source: "Process Master" },
      { label: "Design", value: "Love + Heart", source: "Buyer Template" },
      { label: "Design Quantity", value: "Love ×5, Heart ×3", source: "Buyer Template" },
      { label: "Placement", value: "Front, scattered", source: "Buyer Template" },
      { label: "Thread Type", value: "Boucle", source: "Process Master" },
      { label: "Number of Colours", value: "3", source: "Process Master" },
      { label: "Supplier", value: "Suman Emb", source: "Process Master" },
      { label: "Secondary Supplier", value: "SK Emb", source: "Process Master" },
    ],
  },
  processes: [proc("QCMP-06", "QPRC-EMB", 1, 1)],
  accessories: [],
};

/* --- 7. Zipper --- */

const zipper: ComponentDef = {
  id: "QCMP-07",
  productId: QUILT_PRODUCT.id,
  name: "Zipper",
  type: "Trim",
  description: '96" nylon coil zipper closure along one long edge.',
  usage: "One long edge",
  required: true,
  quantity: 1,
  sequence: 7,
  relatedComponentIds: [],
  active: true,
  makingSpec: {
    id: "QMS-07",
    source: "Style Master",
    masterId: "STY-QLT-10896",
    fields: [
      { label: "Closure Type", value: "Zipper", source: "Style Master" },
      { label: "Zipper Length", value: "96", unit: "in", source: "Material Master" },
      { label: "Attachment", value: "Machine bound, both tapes", source: "Process Master" },
    ],
  },
  processes: [proc("QCMP-07", "QPRC-STC", 1, 0.4)],
  accessories: [
    trim("QACC-01", "QCMP-07", "QMAT-ZIP01", "Closure", '96" YKK #5 nylon coil zipper', 1),
  ],
};

/* --- 8. Labels & Tags --- */

const labels: ComponentDef = {
  id: "QCMP-08",
  productId: QUILT_PRODUCT.id,
  name: "Labels & Tags",
  type: "Trim",
  description: "Woven brand label and printed care/content label.",
  usage: "Side seam",
  required: true,
  quantity: 1,
  sequence: 8,
  relatedComponentIds: [],
  active: true,
  makingSpec: {
    id: "QMS-08",
    source: "Style Master",
    masterId: "STY-QLT-10896",
    fields: [
      { label: "Attachment", value: "Folded, stitched into side seam", source: "Process Master" },
    ],
  },
  processes: [],
  accessories: [
    trim("QACC-02", "QCMP-08", "QMAT-LBL01", "Label", "Woven main label, folded, side seam", 1),
    trim(
      "QACC-03",
      "QCMP-08",
      "QMAT-LBL02",
      "Label",
      "Printed care / content label, 6 languages",
      1,
    ),
  ],
};

/* ------------------------------------------------------------------ *
 * Packaging — product level
 * ------------------------------------------------------------------ */

export const QUILT_PACKAGING: PackagingItem[] = [
  {
    id: "QPKG-01",
    packagingType: "Standard Packaging",
    subtype: "Compression Polybag",
    specification: 'LDPE 60 micron, vacuum-compression bag, 24" × 20", header card',
    quantity: 1,
    rate: sourced(1.85, "Rate Master", "RATE-Q-201"),
    rateUnit: "per piece",
    source: "Rate Master",
  },
  {
    id: "QPKG-02",
    packagingType: "Carton Packing",
    subtype: "Master Carton",
    specification: "5-ply master carton, 6 pcs per carton — allocated per piece",
    quantity: 1,
    rate: sourced(1.1, "Rate Master", "RATE-Q-202"),
    rateUnit: "per piece",
    source: "Rate Master",
  },
];

/* ------------------------------------------------------------------ *
 * Testing & certification — distinct from the Placemat's programme
 * ------------------------------------------------------------------ */

export const QUILT_TESTING: TestingItem[] = [
  {
    id: "QTST-01",
    testType: "Physical",
    name: "Flammability — CPSC 16 CFR 1633",
    specification: "Mattress-and-bedding flammability standard, full quilt assembly",
    labName: "Intertek",
    lotCost: 18500,
    lotSize: 2500,
    source: "Buyer Template",
  },
  {
    id: "QTST-02",
    testType: "Physical",
    name: "Dimensional stability & seam slippage",
    specification: "ISO 6330 · 5 wash cycles · buyer protocol IK-QA-04",
    labName: "SGS",
    lotCost: 5400,
    lotSize: 2500,
    source: "Buyer Template",
  },
  {
    id: "QTST-03",
    testType: "Certification",
    name: "GOTS scope certificate — annual share",
    specification: "Organic content claim, certificate allocated across the season",
    labName: "Control Union",
    lotCost: 7200,
    lotSize: 2500,
    source: "Style Master",
  },
];

/* ------------------------------------------------------------------ *
 * Fabric option catalogue — the CONFIGURE tab offers these for Front Fabric
 * ------------------------------------------------------------------ */

export const QUILT_FABRIC_OPTIONS: FabricOption[] = [
  {
    materialMasterId: "QMAT-F01",
    note: "Buyer-approved print ground for the BE-2601 artwork.",
    aiSuggested: true,
    aiNote: "Best balance of cost and hand-feel for the printed programme at MOQ 2,500+.",
  },
  {
    materialMasterId: "QMAT-F02",
    note: "Higher-count sateen, noticeably smoother hand.",
    aiNote: "Premium tier — adds $0.34/pc, positions above the $32 IKEA price point.",
  },
  {
    materialMasterId: "QMAT-F03",
    note: "Lighter poplin ground, lower rate.",
    aiNote: "Cuts raw material ~18% — useful if the buyer target tightens.",
  },
  {
    materialMasterId: "QMAT-F04",
    note: "Brushed flannel for the winter/AW range.",
  },
  {
    materialMasterId: "QMAT-F05",
    note: "GOTS-certified organic percale, low-impact print.",
    aiNote: "Required for the sustainable programme SKU. Adds cost, unlocks GOTS labelling.",
  },
];

/* ------------------------------------------------------------------ *
 * Parameters + default variant
 * ------------------------------------------------------------------ */

export const QUILT_PARAMETERS: VariantParameter[] = [
  {
    id: "moq",
    label: "MOQ",
    hint: "Volume tier — setup amortised",
    unit: "pcs",
    selectedId: "moq-2500",
    options: [
      { id: "moq-1000", label: "1,000 pcs", value: 1000 },
      { id: "moq-2500", label: "2,500 pcs", value: 2500 },
      { id: "moq-5000", label: "5,000 pcs", value: 5000 },
      { id: "moq-10000", label: "10,000 pcs", value: 10000 },
    ],
  },
  {
    id: "size",
    label: "Size",
    hint: "Twin · King · Sham",
    unit: "inches",
    selectedId: "size-108x96",
    options: [
      { id: "size-90x96", label: 'Twin — 90" × 96"', value: [90, 96] },
      { id: "size-108x96", label: 'King — 108" × 96"', value: [108, 96] },
      { id: "size-20x26", label: 'Sham — 20" × 26"', value: [20, 26] },
    ],
  },
  {
    id: "quality",
    label: "Quality",
    hint: "Fabric weight (GSM)",
    unit: "GSM",
    selectedId: "gsm-133",
    options: [
      { id: "gsm-115", label: "115 GSM", value: 115 },
      { id: "gsm-133", label: "133 GSM", value: 133 },
      { id: "gsm-170", label: "170 GSM", value: 170 },
      { id: "gsm-300", label: "300 GSM", value: 300 },
    ],
  },
];

export const QUILT_COMMERCIAL: CommercialInputs = {
  fxRate: 90,
  targetMarginPct: 28,
  buyerTargetUsd: 32,
};

export const QUILT_COMPONENTS: ComponentDef[] = [
  frontFabric,
  backFabric,
  piping,
  filling,
  quilting,
  decoration,
  zipper,
  labels,
];

export const QUILT_DEFAULT_VARIANT: Variant = {
  id: "QVAR-01",
  productId: QUILT_PRODUCT.id,
  name: "Default Variant",
  description: "Buyer-approved base construction.",
  kind: "variant",
  creationMethod: "New",
  status: "Active",
  components: QUILT_COMPONENTS,
  packaging: QUILT_PACKAGING,
  testing: QUILT_TESTING,
  options: [],
  parameters: QUILT_PARAMETERS,
  commercial: QUILT_COMMERCIAL,
  baseSize: [108, 96],
  baseGsm: 133,
  setupCostInr: 38_000,
};

export const QUILT_MODEL: CostingModel = {
  product: QUILT_PRODUCT,
  variants: [QUILT_DEFAULT_VARIANT],
};

/* ------------------------------------------------------------------ *
 * Add-component presets, distinct from the Placemat's catalogue
 * ------------------------------------------------------------------ */

export const QUILT_COMPONENT_PRESETS: ComponentPreset[] = [
  {
    name: "Border",
    type: "Trim / Self Fabric",
    usage: "Outer frame, front panel",
    description: "Contrast border framing the front panel.",
    selfFabric: false,
  },
  {
    name: "Binding",
    type: "Trim / Self Fabric",
    usage: "Raw edges",
    description: "Bias binding finishing the raw edges.",
    selfFabric: false,
  },
  {
    name: "Corner Tab",
    type: "Trim",
    usage: "All four corners",
    description: "Fabric loop tab for duvet-clip attachment.",
    selfFabric: false,
  },
  {
    name: "Contrast Piping",
    type: "Trim / Self Fabric",
    usage: "Perimeter seam",
    description: "Second, contrast-colour piping run alongside the main edge.",
    selfFabric: false,
  },
  {
    name: "Appliqué Patch",
    type: "Decoration",
    usage: "Front panel",
    description: "Applied fabric patch, satin-stitched.",
    selfFabric: false,
  },
];

/**
 * Build a real component for a Quilt preset — always independently
 * material-assigned (never self-fabric), matching how Front/Back/Piping are
 * modelled: three genuinely distinct fabric slots, not a family.
 */
export function quiltComponentFromPreset(
  preset: ComponentPreset,
  id: string,
  sequence: number,
): ComponentDef {
  const isFabricLike = preset.type === "Trim / Self Fabric";
  return {
    id,
    productId: QUILT_PRODUCT.id,
    name: preset.name,
    type: preset.type,
    description: preset.description,
    usage: preset.usage,
    required: false,
    quantity: 1,
    sequence,
    relatedComponentIds: [],
    active: true,
    material: isFabricLike
      ? {
          id: `QCM-${id}`,
          relationship: "master",
          materialMasterId: "QMAT-P01",
          rate: sourced(materialById("QMAT-P01").rate, "Rate Master", "RATE-Q-031"),
          rateUnit: "per metre",
        }
      : undefined,
    makingSpec: {
      id: `QMS-${id}`,
      source: "Style Master",
      masterId: "STY-QLT-10896",
      fields: [
        { label: "Machine Type", value: "Single needle", source: "Style Master" },
        { label: "Seam Allowance", value: '0.5"', source: "Style Master" },
      ],
    },
    consumption: isFabricLike
      ? {
          id: `QCR-${id}`,
          method: "Length-Based",
          formula: "(2 × (W + L) + hem) × shrinkage × wastage ÷ 39.37",
          formulaVersion: "v2.1",
          unit: "mtr",
          finishedWidth: 108,
          finishedLength: 96,
          hemAllowance: 6,
          shrinkagePct: 2,
          wastagePct: 8,
          quantity: 1,
          source: "Consumption Rule",
        }
      : undefined,
    processes: [proc(id, "QPRC-CUT", 1, 0.4)],
    accessories: [],
  };
}
