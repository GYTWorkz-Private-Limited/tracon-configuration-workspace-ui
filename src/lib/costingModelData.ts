/**
 * Masters + the Placemat (POD-2046 / Zara Home) reference configuration.
 *
 * Every number here is an INPUT. Nothing in this file states a cost — costs are
 * produced by `costingModel.ts` from quantity × consumption × rate + process +
 * trims, so the table, the inspector and the roll-up can never disagree.
 *
 * The consumption figures are what the rule engine computes from the inputs
 * below; see `calculateConsumption`. If an input changes here, the displayed
 * consumption, component cost and direct cost all move together.
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
} from "./costingModel";
import { DEFAULT_COMMERCIAL, DEFAULT_PARAMETERS } from "./pricingVariants";

/* ------------------------------------------------------------------ *
 * Material master
 * ------------------------------------------------------------------ */

export const MATERIAL_MASTERS: MaterialMaster[] = [
  {
    id: "MAT-001",
    code: "COT-SAT-300-60-NW",
    name: "Cotton Sateen",
    materialType: "Fabric",
    fabricType: "Cotton",
    availability: "Ready Fabric",
    composition: "100% Cotton",
    yarnCount: "40s × 40s",
    construction: "Sateen",
    gsm: 300,
    width: 60,
    costingWidth: 58,
    colour: "Natural White",
    pantone: "11-0601 TCX",
    certification: "OEKO-TEX Standard 100",
    supplier: "Shree Textiles Pvt. Ltd.",
    rateMasterId: "RATE-F-011",
    rate: 181.28,
    rateUnit: "per metre",
    description: "Mercerised cotton sateen, buyer-approved base cloth for the placemat programme.",
    status: "Active",
  },
  {
    id: "MAT-002",
    code: "COT-TWL-280-60-BG",
    name: "Cotton Twill",
    materialType: "Fabric",
    fabricType: "Cotton",
    availability: "Ready Fabric",
    composition: "100% Cotton",
    yarnCount: "30s × 30s",
    construction: "Twill",
    gsm: 280,
    width: 60,
    costingWidth: 58,
    colour: "Beige",
    pantone: "13-0908 TCX",
    certification: "OEKO-TEX Standard 100",
    supplier: "Shree Textiles Pvt. Ltd.",
    rateMasterId: "RATE-F-012",
    rate: 158.4,
    rateUnit: "per metre",
    description: "Heavier twill weave, lower rate than sateen at comparable weight.",
    status: "Active",
  },
  {
    id: "MAT-003",
    code: "LIN-COT-260-60-NAT",
    name: "Linen Cotton",
    materialType: "Fabric",
    fabricType: "Linen blend",
    availability: "Ready Fabric",
    composition: "55% Linen / 45% Cotton",
    yarnCount: "24s × 24s",
    construction: "Plain",
    gsm: 260,
    width: 60,
    costingWidth: 57,
    colour: "Natural",
    pantone: "12-0910 TCX",
    certification: "OEKO-TEX Standard 100",
    supplier: "Ganga Textiles",
    rateMasterId: "RATE-F-013",
    rate: 214.6,
    rateUnit: "per metre",
    description: "Breathable, premium look and feel. Higher rate, lower yield.",
    status: "Active",
  },
  {
    id: "MAT-004",
    code: "PLY-COT-220-60-WHT",
    name: "Poly Cotton",
    materialType: "Fabric",
    fabricType: "Poly blend",
    availability: "Ready Fabric",
    composition: "65% Polyester / 35% Cotton",
    yarnCount: "45s × 45s",
    construction: "Plain",
    gsm: 220,
    width: 60,
    costingWidth: 58,
    colour: "White",
    pantone: "11-0601 TCX",
    certification: "OEKO-TEX Standard 100",
    supplier: "Deccan Synthetics",
    rateMasterId: "RATE-F-014",
    rate: 126.75,
    rateUnit: "per metre",
    description: "Cost effective, durable, wrinkle resistant.",
    status: "Active",
  },
  {
    id: "MAT-005",
    code: "ORG-COT-300-60-NAT",
    name: "Organic Cotton",
    materialType: "Fabric",
    fabricType: "Organic cotton",
    availability: "Ready Fabric",
    composition: "100% Organic Cotton",
    yarnCount: "40s × 40s",
    construction: "Sateen",
    gsm: 300,
    width: 60,
    costingWidth: 58,
    colour: "Natural",
    pantone: "11-0601 TCX",
    certification: "GOTS · OEKO-TEX Standard 100",
    supplier: "EcoWeave Mills",
    rateMasterId: "RATE-F-015",
    rate: 208.9,
    rateUnit: "per metre",
    description: "GOTS certified. Sustainable option for the eco programme.",
    status: "Active",
  },
  {
    id: "MAT-014",
    code: "TRM-TWL-25-NAT",
    name: "Cotton Twill Tape",
    materialType: "Trim",
    composition: "100% Cotton",
    width: 25,
    colour: "Natural",
    pantone: "11-0601 TCX",
    certification: "OEKO-TEX Standard 100",
    supplier: "Ganga Trims",
    rateMasterId: "RATE-T-104",
    rate: 2.5,
    rateUnit: "per piece",
    description: "25 mm woven cotton twill tape, cut to 90 mm for the hanging loop.",
    status: "Active",
  },
  {
    id: "MAT-021",
    code: "LBL-WVN-BRAND",
    name: "Woven Brand Label",
    materialType: "Trim",
    supplier: "Avery Dennison",
    rateMasterId: "RATE-T-201",
    rate: 1.2,
    rateUnit: "per piece",
    description: "Buyer-nominated woven main label, folded, stitched into the side seam.",
    status: "Active",
  },
  {
    id: "MAT-022",
    code: "LBL-PRT-CARE",
    name: "Printed Care / Content Label",
    materialType: "Trim",
    supplier: "Avery Dennison",
    rateMasterId: "RATE-T-202",
    rate: 0.8,
    rateUnit: "per piece",
    description: "Satin care label, 4 languages, buyer template CL-ZH-04.",
    status: "Active",
  },
];

/* ------------------------------------------------------------------ *
 * Process master
 * ------------------------------------------------------------------ */

export const PROCESS_MASTERS: ProcessMaster[] = [
  {
    id: "PRC-DYE",
    name: "Dyeing",
    category: "Wet Processing",
    description: "Reactive dyeing to buyer pantone, soft finish.",
    defaultParams: [
      { label: "Method", value: "Reactive — exhaust" },
      { label: "Shade depth", value: "Medium" },
    ],
    standardRate: 22.0,
    rateUnit: "per metre",
    rateMasterId: "RATE-P-301",
    status: "Active",
  },
  {
    id: "PRC-PRT",
    name: "Printing",
    category: "Wet Processing",
    description: "Rotary screen print, buyer artwork.",
    defaultParams: [
      { label: "Method", value: "Rotary screen" },
      { label: "Colours", value: "6" },
    ],
    standardRate: 82.5,
    rateUnit: "per piece",
    rateMasterId: "RATE-P-302",
    status: "Active",
  },
  {
    id: "PRC-CUT",
    name: "Cutting",
    category: "Making",
    description: "Straight-knife cutting from marker.",
    defaultParams: [{ label: "Cutting method", value: "Straight knife, 40-ply" }],
    standardRate: 1.0,
    rateUnit: "per piece",
    rateMasterId: "RATE-P-310",
    status: "Active",
  },
  {
    id: "PRC-STC",
    name: "Stitching / Assembly",
    category: "Making",
    description: "Single needle assembly with overlock finish.",
    defaultParams: [
      { label: "Machine", value: "Single needle + O/L" },
      { label: "Seam allowance", value: '0.5"' },
    ],
    standardRate: 3.0,
    rateUnit: "per piece",
    rateMasterId: "RATE-P-311",
    status: "Active",
  },
  {
    id: "PRC-HEM",
    name: "Hemming / Edge Finish",
    category: "Making",
    description: 'Straight hem, 0.5" turn, twin-needle topstitch.',
    defaultParams: [{ label: "Hem type", value: 'Straight hem, 0.5"' }],
    standardRate: 6.5,
    rateUnit: "per piece",
    rateMasterId: "RATE-P-312",
    status: "Active",
  },
  {
    id: "PRC-EMB",
    name: "Embroidery",
    category: "Decoration",
    description: "Flat embroidery, buyer motif, front centre.",
    defaultParams: [
      { label: "Stitch count", value: "12,500" },
      { label: "Threads", value: "3 colours" },
    ],
    standardRate: 1.44,
    rateUnit: "per 1000 stitches",
    rateMasterId: "RATE-P-320",
    status: "Active",
  },
];

const materialById = (id: string): MaterialMaster => {
  const m = MATERIAL_MASTERS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown material master: ${id}`);
  return m;
};

const processMasterById = (id: string): ProcessMaster => {
  const p = PROCESS_MASTERS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown process master: ${id}`);
  return p;
};

/** Lookup tables passed into every calculation in `costingModel`. */
export const MASTERS = {
  materials: Object.fromEntries(MATERIAL_MASTERS.map((m) => [m.id, m])) as Record<
    string,
    MaterialMaster
  >,
  processes: Object.fromEntries(PROCESS_MASTERS.map((p) => [p.id, p])) as Record<
    string,
    ProcessMaster
  >,
};

/* ------------------------------------------------------------------ *
 * Product
 * ------------------------------------------------------------------ */

export const PLACEMAT_PRODUCT: Product = {
  id: "PRD-6939227",
  styleId: "STY-PLM-1319",
  articleNo: "6939227",
  name: "Placemat",
  category: "Home Textiles — Table Linen",
  description:
    "Rectangular cotton sateen placemat with self-fabric ties, neck strap, pocket and printed front panel.",
  buyer: "Zara Home",
  buyerRef: "ZH-TBL-2046",
  status: "In Progress",
  size: '13" × 19"',
  colour: "Natural White",
  pantone: "11-0601 TCX",
  unit: "pcs",
  moq: "3,000 pcs",
  currency: "INR",
  createdAt: "2026-06-14",
  updatedAt: "2026-08-10",
};

/* ------------------------------------------------------------------ *
 * Component builders
 * ------------------------------------------------------------------ */

const BODY = "CMP-01";

/** A process line, costed as quantity × rate. */
const proc = (
  componentId: string,
  masterId: string,
  sequence: number,
  quantity: number,
  overrides?: Partial<
    Pick<ProcessItem, "name" | "rate" | "rateUnit" | "basis" | "params" | "description">
  >,
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
    basis:
      master.rateUnit === "per metre"
        ? "per m"
        : master.rateUnit === "per 1000 stitches"
          ? "per 1000 stitches"
          : "per pc",
    quantity,
    rate: sourced(master.standardRate, "Process Master", master.rateMasterId),
    rateUnit: master.rateUnit,
    rateMasterId: master.rateMasterId,
    ...overrides,
  };
};

/* --- 1. Body Fabric ------------------------------------------------ */

const bodyFabric: ComponentDef = {
  id: BODY,
  productId: PLACEMAT_PRODUCT.id,
  name: "Body Fabric",
  type: "Fabric",
  description: "Main body fabric for placemat",
  usage: "Main body of placemat",
  required: true,
  quantity: 1,
  sequence: 1,
  relatedComponentIds: ["CMP-02", "CMP-03", "CMP-04", "CMP-05"],
  active: true,
  material: {
    id: "CM-01",
    relationship: "master",
    materialMasterId: "MAT-001",
    rate: sourced(materialById("MAT-001").rate, "Rate Master", "RATE-F-011"),
    rateUnit: "per metre",
  },
  makingSpec: {
    id: "MS-01",
    source: "Style Master",
    masterId: "STY-PLM-1319",
    fields: [
      {
        label: "SAM (Standard Allowed Minutes)",
        value: "15",
        unit: "mins/pc",
        source: "Style Master",
      },
      { label: "Efficiency Factor", value: "75", unit: "%", source: "Style Master" },
      { label: "Machine Type", value: "Single needle + O/L", source: "Style Master" },
      { label: "Seam Allowance", value: '0.5"', source: "Style Master" },
      { label: "Hem Allowance", value: '0.5" all sides', source: "Style Master" },
      { label: "Shrinkage Allowance", value: "5", unit: "%", source: "Material Master" },
      { label: "Fabric Wastage", value: "8", unit: "%", source: "Consumption Rule" },
      { label: "Cutting Method", value: "Straight knife, 40-ply", source: "Process Master" },
    ],
  },
  consumption: {
    id: "CR-01",
    method: "Formula-Based",
    formula:
      "((W + seam) × (L + hem) × plies × shrinkage × wastage) ÷ (costing_width × marker_efficiency) ÷ 39.37",
    formulaVersion: "v2.1",
    unit: "mtr",
    finishedWidth: 13,
    finishedLength: 19,
    seamAllowance: 1,
    hemAllowance: 1,
    shrinkagePct: 5,
    wastagePct: 8,
    fabricWidth: 58,
    markerEfficiency: 0.81,
    plies: 4,
    quantity: 1,
    source: "Consumption Rule",
  },
  processes: [
    proc(BODY, "PRC-DYE", 1, 0.687),
    proc(BODY, "PRC-CUT", 2, 1),
    proc(BODY, "PRC-STC", 3, 1),
    proc(BODY, "PRC-HEM", 4, 1),
  ],
  accessories: [],
};

/* --- Self-fabric family -------------------------------------------- */

/**
 * Waist ties, neck strap and pocket all inherit the body fabric rather than
 * duplicating it — change the body fabric and all three re-cost automatically.
 */
const selfFabric = (
  id: string,
  name: string,
  sequence: number,
  type: ComponentDef["type"],
  required: boolean,
  quantity: number,
  usage: string,
  description: string,
  consumptionInputs: {
    finishedWidth: number;
    finishedLength: number;
    seam: number;
    hem: number;
  },
  processes: ProcessItem[],
): ComponentDef => ({
  id,
  productId: PLACEMAT_PRODUCT.id,
  parentId: BODY,
  name,
  type,
  description,
  usage,
  required,
  quantity,
  sequence,
  relatedComponentIds: [BODY],
  active: true,
  material: {
    id: `CM-${id}`,
    relationship: "same-as-component",
    sameAsComponentId: BODY,
    rate: sourced(materialById("MAT-001").rate, "Rate Master", "RATE-F-011"),
    rateUnit: "per metre",
  },
  makingSpec: {
    id: `MS-${id}`,
    source: "Style Master",
    masterId: "STY-PLM-1319",
    fields: [
      { label: "Machine Type", value: "Single needle", source: "Style Master" },
      { label: "Seam Allowance", value: `${consumptionInputs.seam}"`, source: "Style Master" },
      { label: "Hem Allowance", value: `${consumptionInputs.hem}"`, source: "Style Master" },
      { label: "Shrinkage Allowance", value: "5", unit: "%", source: "Material Master" },
      { label: "Fabric Wastage", value: "5", unit: "%", source: "Consumption Rule" },
      { label: "Cutting Method", value: "Straight knife, 40-ply", source: "Process Master" },
    ],
  },
  consumption: {
    id: `CR-${id}`,
    method: "Area-Based",
    formula:
      "((W + seam) × (L + hem) × shrinkage × wastage) ÷ (costing_width × marker_efficiency) ÷ 39.37",
    formulaVersion: "v2.1",
    unit: "mtr",
    finishedWidth: consumptionInputs.finishedWidth,
    finishedLength: consumptionInputs.finishedLength,
    seamAllowance: consumptionInputs.seam,
    hemAllowance: consumptionInputs.hem,
    shrinkagePct: 5,
    wastagePct: 5,
    fabricWidth: 58,
    markerEfficiency: 0.81,
    plies: 1,
    quantity,
    source: "Consumption Rule",
  },
  processes,
  accessories: [],
});

const waistTies = selfFabric(
  "CMP-02",
  "Waist Ties",
  2,
  "Trim / Self Fabric",
  true,
  2,
  "Both short edges",
  "Self fabric ties, cut on straight grain, turned and topstitched.",
  { finishedWidth: 3, finishedLength: 42.5, seam: 0.5, hem: 0.5 },
  [
    proc("CMP-02", "PRC-CUT", 1, 0.4, {
      rate: sourced(0.4, "Process Master", "RATE-P-310"),
      name: "Cutting",
    }),
    proc("CMP-02", "PRC-STC", 2, 0.4),
  ],
);

const neckStrap = selfFabric(
  "CMP-03",
  "Neck Strap",
  3,
  "Trim / Self Fabric",
  true,
  1,
  "Top edge, centre",
  "Self fabric strap, folded four-ply, bar-tacked at both ends.",
  { finishedWidth: 2.5, finishedLength: 38, seam: 0.5, hem: 0.5 },
  [
    proc("CMP-03", "PRC-CUT", 1, 0.2, { rate: sourced(0.4, "Process Master", "RATE-P-310") }),
    proc("CMP-03", "PRC-STC", 2, 0.2),
  ],
);

const pocket = selfFabric(
  "CMP-04",
  "Pocket",
  4,
  "Self Fabric Panel",
  false,
  1,
  "Front lower right",
  "Self fabric patch pocket for cutlery, hemmed top edge.",
  { finishedWidth: 6.5, finishedLength: 8, seam: 1, hem: 1 },
  [
    proc("CMP-04", "PRC-CUT", 1, 0.15, { rate: sourced(0.4, "Process Master", "RATE-P-310") }),
    proc("CMP-04", "PRC-STC", 2, 0.3),
  ],
);

/* --- 5. Edge Finish (process-only component) ----------------------- */

const edgeFinish: ComponentDef = {
  id: "CMP-05",
  productId: PLACEMAT_PRODUCT.id,
  parentId: BODY,
  name: "Edge Finish",
  type: "Process",
  description: "Straight hem around all four edges of the finished placemat.",
  usage: "All four edges",
  required: true,
  quantity: 1,
  sequence: 5,
  relatedComponentIds: [BODY],
  active: true,
  makingSpec: {
    id: "MS-05",
    source: "Process Master",
    masterId: "PRC-HEM",
    fields: [
      { label: "Hem Type", value: 'Straight hem, 0.5" turn', source: "Process Master" },
      { label: "Machine Type", value: "Twin needle", source: "Process Master" },
      { label: "Stitch Density", value: "10 SPI", source: "Process Master" },
      { label: "Thread", value: "Tex 40 core-spun", source: "Style Master" },
    ],
  },
  processes: [proc("CMP-05", "PRC-HEM", 1, 1)],
  accessories: [],
};

/* --- 6. Embroidery / Print ----------------------------------------- */

const decoration: ComponentDef = {
  id: "CMP-06",
  productId: PLACEMAT_PRODUCT.id,
  parentId: BODY,
  name: "Embroidery / Print",
  type: "Decoration",
  description: "Buyer artwork — rotary print ground with an embroidered motif at front centre.",
  usage: "Front centre",
  required: false,
  quantity: 1,
  sequence: 6,
  relatedComponentIds: [BODY],
  active: true,
  makingSpec: {
    id: "MS-06",
    source: "Buyer Template",
    masterId: "ZH-ART-2046",
    fields: [
      { label: "Artwork Ref", value: "ZH-ART-2046-A", source: "Buyer Template" },
      { label: "Print Method", value: "Rotary screen, 6 colours", source: "Process Master" },
      { label: "Stitch Count", value: "12,500", source: "Process Master" },
      { label: "Placement", value: 'Front centre, 3" from top', source: "Buyer Template" },
      { label: "Backing", value: "Cut-away, 1.5 oz", source: "Process Master" },
    ],
  },
  processes: [proc("CMP-06", "PRC-PRT", 1, 1), proc("CMP-06", "PRC-EMB", 2, 12.5)],
  accessories: [],
};

/* --- 7. Loop / Hanger ---------------------------------------------- */

const trim = (
  id: string,
  componentId: string,
  masterId: string,
  accessoryType: string,
  specification: string,
  quantity: number,
  fixingCost?: number,
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
    fixingCost,
    source: "Material Master",
  };
};

const loopHanger: ComponentDef = {
  id: "CMP-07",
  productId: PLACEMAT_PRODUCT.id,
  parentId: BODY,
  name: "Loop / Hanger",
  type: "Trim",
  description: "Cotton twill tape loop for hanging, bar-tacked into the top seam.",
  usage: "Top centre",
  required: false,
  quantity: 1,
  sequence: 7,
  relatedComponentIds: [BODY],
  active: true,
  makingSpec: {
    id: "MS-07",
    source: "Style Master",
    masterId: "STY-PLM-1319",
    fields: [
      { label: "Cut Length", value: "90", unit: "mm", source: "Style Master" },
      { label: "Tape Width", value: "25", unit: "mm", source: "Material Master" },
      { label: "Attachment", value: "Bar-tack ×2", source: "Process Master" },
    ],
  },
  processes: [proc("CMP-07", "PRC-STC", 1, 0.17)],
  accessories: [
    trim("ACC-01", "CMP-07", "MAT-014", "Twill Tape", "25 mm cotton twill tape, cut 90 mm", 1),
    trim("ACC-02", "CMP-07", "MAT-021", "Label", "Woven main label, folded, side seam", 1),
    trim("ACC-03", "CMP-07", "MAT-022", "Label", "Printed care / content label, 4 languages", 1),
  ],
};

/* ------------------------------------------------------------------ *
 * Packaging — product level
 * ------------------------------------------------------------------ */

export const PLACEMAT_PACKAGING: PackagingItem[] = [
  {
    id: "PKG-01",
    packagingType: "Standard Packaging",
    subtype: "Polybag",
    specification: 'LDPE 40 micron, 14" × 20", buyer-printed',
    quantity: 1,
    rate: sourced(0.45, "Rate Master", "RATE-K-401"),
    rateUnit: "per piece",
    source: "Rate Master",
  },
  {
    id: "PKG-02",
    packagingType: "Carton Packing",
    subtype: "Master Carton",
    specification: "5-ply master carton, 60 pcs per carton — allocated per piece",
    quantity: 1,
    rate: sourced(0.4, "Rate Master", "RATE-K-402"),
    rateUnit: "per piece",
    source: "Rate Master",
  },
];

/* ------------------------------------------------------------------ *
 * Fabric option catalogue — what the CONFIGURE tab offers
 * ------------------------------------------------------------------ */

export type FabricOption = {
  materialMasterId: string;
  /** short note shown under the composition line */
  note: string;
  /** the recommendation engine's pick, with its reasoning */
  aiSuggested?: boolean;
  aiNote?: string;
};

/**
 * Selecting one of these swaps the body fabric's material master. Every
 * self-fabric component inherits through its stored relationship, so ties,
 * strap, pocket and lining all re-cost from a single choice.
 */
export const FABRIC_OPTIONS: FabricOption[] = [
  {
    materialMasterId: "MAT-001",
    note: "Buyer-approved base cloth for the placemat programme.",
    aiSuggested: true,
    aiNote: "Best balance of cost and quality. Gives higher selling price at MOQ 2,000+.",
  },
  {
    materialMasterId: "MAT-002",
    note: "Heavier twill weave at a lower rate than sateen.",
    aiNote: "Improves margin by ~4% at MOQ 5,000+ due to lower cost.",
  },
  { materialMasterId: "MAT-003", note: "Breathable, premium look and feel." },
  { materialMasterId: "MAT-004", note: "Cost effective, durable, wrinkle resistant." },
  {
    materialMasterId: "MAT-005",
    note: "GOTS certified sustainable option.",
    aiNote: "Required for the Eco scenario. Adds cost but unlocks the sustainable programme.",
  },
];

/* ------------------------------------------------------------------ *
 * Testing & certification — a direct-cost category in its own right
 * ------------------------------------------------------------------ */

export const PLACEMAT_TESTING: TestingItem[] = [
  {
    id: "TST-01",
    testType: "Physical",
    name: "Dimensional stability to washing",
    specification: "ISO 6330 · 3 wash cycles · buyer protocol ZH-QA-11",
    labName: "Intertek",
    /** cost is quoted per submission and allocated across the order */
    lotCost: 4800,
    lotSize: 3000,
    source: "Buyer Template",
  },
  {
    id: "TST-02",
    testType: "Chemical",
    name: "Azo dyes & formaldehyde",
    specification: "EN 14362-1 · REACH Annex XVII",
    labName: "SGS",
    lotCost: 6500,
    lotSize: 3000,
    source: "Buyer Template",
  },
  {
    id: "TST-03",
    testType: "Certification",
    name: "OEKO-TEX Standard 100 — annual share",
    specification: "Class II · certificate allocated across the season",
    labName: "Hohenstein",
    lotCost: 3900,
    lotSize: 3000,
    source: "Style Master",
  },
];

/* ------------------------------------------------------------------ *
 * Default variant + model
 * ------------------------------------------------------------------ */

export const PLACEMAT_COMPONENTS: ComponentDef[] = [
  bodyFabric,
  waistTies,
  neckStrap,
  pocket,
  edgeFinish,
  decoration,
  loopHanger,
];

export const DEFAULT_VARIANT: Variant = {
  id: "VAR-01",
  productId: PLACEMAT_PRODUCT.id,
  name: "Default Variant",
  description: "Buyer-approved base construction.",
  kind: "variant",
  creationMethod: "New",
  status: "Active",
  components: PLACEMAT_COMPONENTS,
  packaging: PLACEMAT_PACKAGING,
  testing: PLACEMAT_TESTING,
  options: [],
  parameters: DEFAULT_PARAMETERS,
  commercial: DEFAULT_COMMERCIAL,
};

export const PLACEMAT_MODEL: CostingModel = {
  product: PLACEMAT_PRODUCT,
  variants: [DEFAULT_VARIANT],
};

/* ------------------------------------------------------------------ *
 * Add-component presets — a new component is a real, costed object
 * ------------------------------------------------------------------ */

export type ComponentPreset = {
  name: string;
  type: ComponentDef["type"];
  usage: string;
  description: string;
  /** self-fabric presets inherit the body fabric; others start unpriced */
  selfFabric: boolean;
};

export const COMPONENT_PRESETS: ComponentPreset[] = [
  {
    name: "Lining",
    type: "Lining",
    usage: "Reverse side",
    description: "Backing cloth on the reverse face.",
    selfFabric: true,
  },
  {
    name: "Filling",
    type: "Filling",
    usage: "Between face and backing",
    description: "Wadding between face and backing.",
    selfFabric: true,
  },
  {
    name: "Border",
    type: "Trim / Self Fabric",
    usage: "All four edges",
    description: "Contrast or self border on the outer edge.",
    selfFabric: true,
  },
  {
    name: "Piping",
    type: "Trim / Self Fabric",
    usage: "Perimeter seam",
    description: "Corded piping inserted in the perimeter seam.",
    selfFabric: true,
  },
  {
    name: "Binding",
    type: "Trim / Self Fabric",
    usage: "Raw edges",
    description: "Bias binding finishing the raw edges.",
    selfFabric: true,
  },
  {
    name: "Appliqué Patch",
    type: "Decoration",
    usage: "Front panel",
    description: "Applied fabric patch, satin-stitched.",
    selfFabric: true,
  },
];

/**
 * Build a real component for a preset — a new row is fully costed from the
 * body fabric's material and rule, never a blank placeholder.
 */
export function componentFromPreset(
  preset: ComponentPreset,
  id: string,
  sequence: number,
): ComponentDef {
  return {
    id,
    productId: PLACEMAT_PRODUCT.id,
    parentId: preset.selfFabric ? BODY : undefined,
    name: preset.name,
    type: preset.type,
    description: preset.description,
    usage: preset.usage,
    required: false,
    quantity: 1,
    sequence,
    relatedComponentIds: preset.selfFabric ? [BODY] : [],
    active: true,
    material: preset.selfFabric
      ? {
          id: `CM-${id}`,
          relationship: "same-as-component",
          sameAsComponentId: BODY,
          rate: sourced(materialById("MAT-001").rate, "Rate Master", "RATE-F-011"),
          rateUnit: "per metre",
        }
      : undefined,
    makingSpec: {
      id: `MS-${id}`,
      source: "Style Master",
      masterId: "STY-PLM-1319",
      fields: [
        { label: "Machine Type", value: "Single needle", source: "Style Master" },
        { label: "Seam Allowance", value: '0.5"', source: "Style Master" },
        { label: "Shrinkage Allowance", value: "5", unit: "%", source: "Material Master" },
        { label: "Fabric Wastage", value: "5", unit: "%", source: "Consumption Rule" },
      ],
    },
    consumption: preset.selfFabric
      ? {
          id: `CR-${id}`,
          method: "Area-Based",
          formula:
            "((W + seam) × (L + hem) × shrinkage × wastage) ÷ (costing_width × marker_efficiency) ÷ 39.37",
          formulaVersion: "v2.1",
          unit: "mtr",
          finishedWidth: 13,
          finishedLength: 19,
          seamAllowance: 0.5,
          hemAllowance: 0.5,
          shrinkagePct: 5,
          wastagePct: 5,
          fabricWidth: 58,
          markerEfficiency: 0.81,
          plies: 1,
          quantity: 1,
          source: "Consumption Rule",
        }
      : undefined,
    processes: [
      proc(id, "PRC-CUT", 1, 0.4, { rate: sourced(0.4, "Process Master", "RATE-P-310") }),
    ],
    accessories: [],
  };
}
