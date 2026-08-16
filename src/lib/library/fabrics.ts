/**
 * Fabric and filling masters.
 *
 * Each entry publishes a real `MaterialMaster` alongside its library record, so
 * picking a fabric from the library and picking it from a row's dropdown are
 * the same act on the same data.
 *
 * Fabrics are grouped by the path that produces their rate — Ready Fabric,
 * Greige + Process, or Yarn-Dyed Woven. A greige-path entry's rate is the
 * finished rate its chain arrives at; the chain itself is shown in the library
 * so the costing team can see what that rate is made of.
 */

import type { MaterialMaster, RateTier } from "../costingModel";
import type { ConsumptionLogic, FabricPathId, LibraryItem } from "./types";

/** Every cut-and-sew fabric consumes on the same marker formula. */
const MARKER_LOGIC: ConsumptionLogic = {
  method: "Area-Based (marker)",
  basis: "mtr / pc",
  formula:
    "((W + seam) × (L + hem) × plies × shrinkage × wastage) ÷ (costing width × marker efficiency) ÷ 39.37",
  drivers: [
    "Finished width & length",
    "Seam / hem allowance",
    "Plies per piece",
    "Costing width",
    "Marker efficiency",
    "Shrinkage %",
    "Wastage %",
  ],
  note: "Costing width — not roll width — is what the marker is laid on.",
};

/** Fillings are quoted on the same marker basis but never cut on a marker. */
const FILL_LOGIC: ConsumptionLogic = {
  method: "Area-Based (panel)",
  basis: "mtr / pc",
  formula: "((W + overhang) × (L + overhang) × shrinkage × wastage) ÷ (roll width) ÷ 39.37",
  drivers: ["Finished size", "Overhang for quilting draw-in", "Roll width", "Wastage %"],
  note: "Quilting draws the panel in — the overhang covers it and is not free.",
};

type FabricInput = {
  id: string;
  code: string;
  name: string;
  path: FabricPathId;
  fabricType: string;
  composition: string;
  yarnCount: string;
  construction: string;
  gsm: number;
  width: number;
  costingWidth: number;
  colour: string;
  shade?: string;
  pantone?: string;
  certification?: string;
  supplier: string;
  rateMasterId: string;
  rate: number;
  summary: string;
  slots: string[];
  tags?: string[];
  /** what the rate is built from, for the two processed paths */
  chainDetail?: { label: string; value: string }[];
  shrinkagePct: number;
  wastagePct: number;
};

const PATH_GROUP: Record<FabricPathId, string> = {
  ready: "Ready Fabric",
  greige: "Greige + Process",
  ydw: "Yarn-Dyed Woven",
};

const PATH_AVAILABILITY: Record<FabricPathId, string> = {
  ready: "Ready Fabric",
  greige: "Greige + Process",
  ydw: "Yarn Dyed Woven",
};

/**
 * The mill's price break ladder, as a discount off the 500 m rate.
 *
 * Real quotes come per fabric, but the SHAPE is the same everywhere — the big
 * saving is in the first jump, and it flattens after that — so one ladder over
 * each fabric's own base rate gives every master a believable set of breaks
 * without inventing four numbers per fabric by hand.
 */
const TIER_LADDER: { minMetres: number; discount: number }[] = [
  { minMetres: 500, discount: 0 },
  { minMetres: 1000, discount: 0.124 },
  { minMetres: 2000, discount: 0.219 },
  { minMetres: 5000, discount: 0.324 },
];

const tiersFor = (baseRate: number): RateTier[] =>
  TIER_LADDER.map(({ minMetres, discount }) => ({
    minMetres,
    rate: Math.round(baseRate * (1 - discount)),
  }));

function fabric(input: FabricInput): LibraryItem {
  const rateTiers = tiersFor(input.rate);
  const master: MaterialMaster = {
    id: input.id,
    code: input.code,
    name: input.name,
    materialType: "Fabric",
    fabricType: input.fabricType,
    availability: PATH_AVAILABILITY[input.path],
    composition: input.composition,
    yarnCount: input.yarnCount,
    construction: input.construction,
    gsm: input.gsm,
    width: input.width,
    costingWidth: input.costingWidth,
    colour: input.colour,
    pantone: input.pantone,
    certification: input.certification,
    supplier: input.supplier,
    rateMasterId: input.rateMasterId,
    rate: input.rate,
    rateUnit: "per metre",
    rateTiers,
    description: input.summary,
    status: "Active",
  };

  return {
    id: input.id,
    kind: "fabric",
    group: PATH_GROUP[input.path],
    name: input.name,
    code: input.code,
    summary: input.summary,
    rate: input.rate,
    rateUnit: "per metre",
    supplier: input.supplier,
    certification: input.certification,
    pathId: input.path,
    slots: input.slots,
    tags: input.tags,
    attributes: [
      { label: "Material Type", value: "Fabric" },
      { label: "Fabric Type", value: input.fabricType },
      { label: "Composition", value: input.composition },
      { label: "GSM", value: String(input.gsm) },
      { label: "Width", value: `${input.width}"` },
      { label: "Costing Width", value: `${input.costingWidth}"` },
      { label: "Construction", value: input.construction },
      { label: "Yarn Count", value: input.yarnCount },
      { label: "Colour", value: input.colour },
      { label: "Shade", value: input.shade ?? "As approved" },
      { label: "Pantone", value: input.pantone ?? "—" },
      { label: "Certification", value: input.certification ?? "—" },
      { label: "Supplier", value: input.supplier },
      { label: "Availability", value: PATH_AVAILABILITY[input.path] },
      { label: "Rate", value: `₹${input.rate.toFixed(2)}` },
      { label: "Rate Unit", value: "per metre" },
      { label: "Shrinkage %", value: `${input.shrinkagePct}%` },
      { label: "Wastage %", value: `${input.wastagePct}%` },
      ...(input.chainDetail ?? []),
    ],
    consumption: MARKER_LOGIC,
    master,
  };
}

/* ------------------------------------------------------------------ *
 * A · Ready Fabric
 * ------------------------------------------------------------------ */

const READY: LibraryItem[] = [
  fabric({
    id: "LIB-F-001",
    code: "COT-PRC-140-100-PRT",
    name: "Cotton Percale 140 — Printed",
    path: "ready",
    fabricType: "Woven cotton",
    composition: "100% Cotton",
    yarnCount: "40s × 40s",
    construction: "Percale",
    gsm: 140,
    width: 100,
    costingWidth: 98,
    colour: "Printed",
    pantone: "Per artwork",
    certification: "GOTS",
    supplier: "Vaibhav Mills",
    rateMasterId: "RATE-F-101",
    rate: 220,
    summary: "Buyer-approved percale base for top-of-bed fronts. Reactive print, soft finish.",
    slots: ["Front Fabric", "Main Fabric", "Back Fabric", "Sham Front"],
    tags: ["cotton", "print", "gots", "top of bed"],
    shrinkagePct: 3,
    wastagePct: 7,
  }),
  fabric({
    id: "LIB-F-002",
    code: "PLY-MIC-090-108-PRT",
    name: "Polyester Micro 90 — Printed",
    path: "ready",
    fabricType: "Woven polyester",
    composition: "100% Polyester",
    yarnCount: "75D × 75D",
    construction: "Plain",
    gsm: 90,
    width: 108,
    costingWidth: 106,
    colour: "Printed",
    certification: "OEKO-TEX Standard 100",
    supplier: "Vaibhav Mills",
    rateMasterId: "RATE-F-102",
    rate: 184,
    summary: "Wide-width micro polyester — digital sublimation, no piecing at King width.",
    slots: ["Front Fabric", "Back Fabric", "Main Fabric", "Lining"],
    tags: ["polyester", "wide width", "sublimation"],
    shrinkagePct: 2,
    wastagePct: 7,
  }),
  fabric({
    id: "LIB-F-003",
    code: "PLY-MIC-090-108-SLD",
    name: "Polyester Micro 90 — Solid",
    path: "ready",
    fabricType: "Woven polyester",
    composition: "100% Polyester",
    yarnCount: "75D × 75D",
    construction: "Plain",
    gsm: 90,
    width: 108,
    costingWidth: 106,
    colour: "Solid dyed",
    pantone: "As approved",
    certification: "OEKO-TEX Standard 100",
    supplier: "Deccan Synthetics",
    rateMasterId: "RATE-F-103",
    rate: 81,
    summary: "The value back-panel cloth. Same base as the printed micro at under half the rate.",
    slots: ["Back Fabric", "Lining", "Pocket Lining"],
    tags: ["polyester", "value", "back panel"],
    shrinkagePct: 2,
    wastagePct: 6,
  }),
  fabric({
    id: "LIB-F-004",
    code: "COT-SAT-300-60-NW",
    name: "Cotton Sateen 300",
    path: "ready",
    fabricType: "Woven cotton",
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
    rateMasterId: "RATE-F-104",
    rate: 181.28,
    summary: "Mercerised sateen — the table-linen and placemat base cloth.",
    slots: ["Main Fabric", "Front Fabric", "Border", "Binding"],
    tags: ["cotton", "sateen", "table linen"],
    shrinkagePct: 5,
    wastagePct: 8,
  }),
  fabric({
    id: "LIB-F-005",
    code: "LIN-COT-260-60-NAT",
    name: "Linen Cotton 260",
    path: "ready",
    fabricType: "Linen blend",
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
    rateMasterId: "RATE-F-105",
    rate: 214.6,
    summary: "Premium hand and drape. Higher rate, lower yield — narrow costing width.",
    slots: ["Main Fabric", "Front Fabric", "Contrast Fabric", "Border", "Flange"],
    tags: ["linen", "premium"],
    shrinkagePct: 6,
    wastagePct: 9,
  }),
  fabric({
    id: "LIB-F-006",
    code: "COT-CAN-220-60-GRG",
    name: "Cotton Canvas 220 — Greige",
    path: "ready",
    fabricType: "Woven cotton",
    composition: "100% Cotton",
    yarnCount: "10s × 10s",
    construction: "Canvas",
    gsm: 220,
    width: 60,
    costingWidth: 58,
    colour: "Unbleached",
    supplier: "Ganga Textiles",
    rateMasterId: "RATE-F-106",
    rate: 95,
    summary: "Heavy unbleached canvas for pockets, backing and structural panels.",
    slots: ["Pocket", "Back Fabric", "Other Fabric Component"],
    tags: ["cotton", "canvas", "value"],
    shrinkagePct: 7,
    wastagePct: 8,
  }),
];

/* ------------------------------------------------------------------ *
 * B · Greige + Process
 * ------------------------------------------------------------------ */

const GREIGE: LibraryItem[] = [
  fabric({
    id: "LIB-F-010",
    code: "GRG-COT-120-63-RCT",
    name: "Cotton Greige 120 → Reactive Dyed",
    path: "greige",
    fabricType: "Woven cotton",
    composition: "100% Cotton",
    yarnCount: "60s × 60s",
    construction: "Plain",
    gsm: 120,
    width: 63,
    costingWidth: 60,
    colour: "Solid dyed",
    shade: "Medium",
    certification: "OEKO-TEX Standard 100",
    supplier: "Ganga Textiles + Kumar Processors",
    rateMasterId: "RATE-F-110",
    rate: 148.5,
    summary:
      "Greige bought at ₹104 and processed to a finished ₹148.50 — dyeing and finishing costed separately, so a shade change moves only its own stage.",
    slots: ["Front Fabric", "Back Fabric", "Main Fabric", "Contrast Fabric"],
    tags: ["greige", "reactive", "cotton"],
    chainDetail: [
      { label: "Greige Rate", value: "₹104.00 / m" },
      { label: "Greige Width", value: '63"' },
      { label: "Dyeing Type", value: "Reactive — exhaust" },
      { label: "Dye Type", value: "Bi-functional reactive" },
      { label: "Dyeing Supplier", value: "Kumar Processors" },
      { label: "Dyeing Rate", value: "₹22.00 / m" },
      { label: "Finish Type", value: "Enzyme soft + calendar" },
      { label: "Finishing Rate", value: "₹11.00 / m" },
      { label: "Process Loss %", value: "4%" },
    ],
    shrinkagePct: 5,
    wastagePct: 8,
  }),
  fabric({
    id: "LIB-F-011",
    code: "GRG-COT-140-63-PRT",
    name: "Cotton Greige 140 → Rotary Printed",
    path: "greige",
    fabricType: "Woven cotton",
    composition: "100% Cotton",
    yarnCount: "40s × 40s",
    construction: "Percale",
    gsm: 140,
    width: 63,
    costingWidth: 60,
    colour: "Printed",
    certification: "GOTS",
    supplier: "Ganga Textiles + Kumar Processors",
    rateMasterId: "RATE-F-111",
    rate: 206.5,
    summary:
      "Printed in-house from greige. Screen count is the cost driver — six screens at ₹82.50/m against four at ₹64.",
    slots: ["Front Fabric", "Main Fabric", "Sham Front"],
    tags: ["greige", "print", "rotary"],
    chainDetail: [
      { label: "Greige Rate", value: "₹112.00 / m" },
      { label: "Print Type", value: "Reactive" },
      { label: "Print Method", value: "Rotary screen" },
      { label: "No. of Screens", value: "6" },
      { label: "Colour Coverage", value: "62%" },
      { label: "Placement", value: "Allover" },
      { label: "Print Supplier", value: "Kumar Processors" },
      { label: "Print Rate", value: "₹82.50 / m" },
      { label: "Finish Type", value: "Softener" },
      { label: "Finishing Rate", value: "₹12.00 / m" },
      { label: "Process Loss %", value: "5%" },
    ],
    shrinkagePct: 4,
    wastagePct: 8,
  }),
  fabric({
    id: "LIB-F-012",
    code: "GRG-PLY-090-108-PIG",
    name: "Poly Greige 90 → Pigment Dyed",
    path: "greige",
    fabricType: "Woven polyester",
    composition: "100% Polyester",
    yarnCount: "75D × 75D",
    construction: "Plain",
    gsm: 90,
    width: 108,
    costingWidth: 106,
    colour: "Pigment dyed",
    shade: "Pastel",
    supplier: "Deccan Synthetics",
    rateMasterId: "RATE-F-112",
    rate: 79.75,
    summary: "Cheapest processed route — surface pigment, low fastness. Pastels only.",
    slots: ["Back Fabric", "Lining", "Pocket Lining"],
    tags: ["greige", "pigment", "budget"],
    chainDetail: [
      { label: "Greige Rate", value: "₹62.00 / m" },
      { label: "Dyeing Type", value: "Pigment" },
      { label: "Dyeing Rate", value: "₹12.75 / m" },
      { label: "Finish Type", value: "Heat set" },
      { label: "Finishing Rate", value: "₹5.00 / m" },
      { label: "Process Loss %", value: "3%" },
    ],
    shrinkagePct: 2,
    wastagePct: 6,
  }),
];

/* ------------------------------------------------------------------ *
 * C · Yarn-Dyed Woven
 * ------------------------------------------------------------------ */

const YDW: LibraryItem[] = [
  fabric({
    id: "LIB-F-020",
    code: "YDW-COT-180-60-STR",
    name: "Yarn-Dyed Cotton Stripe 180",
    path: "ydw",
    fabricType: "Yarn-dyed woven",
    composition: "100% Cotton",
    yarnCount: "30s × 30s",
    construction: "Plain — woven stripe",
    gsm: 180,
    width: 60,
    costingWidth: 57,
    colour: "Yarn-dyed stripe",
    certification: "OEKO-TEX Standard 100",
    supplier: "Ganga Textiles",
    rateMasterId: "RATE-F-120",
    rate: 236.4,
    summary:
      "Costed from yarn upward — colour is in the yarn, so it cannot be changed after weaving without a new warp.",
    slots: ["Contrast Fabric", "Border", "Flange", "Main Fabric"],
    tags: ["yarn dyed", "stripe", "cotton"],
    chainDetail: [
      { label: "Yarn Type", value: "Combed cotton ring spun" },
      { label: "Yarn Count", value: "30s" },
      { label: "Yarn Rate", value: "₹285.00 / kg" },
      { label: "Warp Consumption", value: "0.098 kg/m" },
      { label: "Weft Consumption", value: "0.084 kg/m" },
      { label: "Yarn Dyeing Rate", value: "₹68.00 / kg" },
      { label: "Loom Type", value: "Air jet" },
      { label: "Reed", value: "68" },
      { label: "Pick", value: "64" },
      { label: "Weaving Rate", value: "₹92.00 / m" },
      { label: "Finishing Process", value: "Mercerise + soft" },
      { label: "Finishing Rate", value: "₹18.00 / m" },
    ],
    shrinkagePct: 6,
    wastagePct: 9,
  }),
  fabric({
    id: "LIB-F-021",
    code: "YDW-COT-210-60-CHK",
    name: "Yarn-Dyed Cotton Check 210",
    path: "ydw",
    fabricType: "Yarn-dyed woven",
    composition: "100% Cotton",
    yarnCount: "20s × 20s",
    construction: "Twill — woven check",
    gsm: 210,
    width: 60,
    costingWidth: 57,
    colour: "Yarn-dyed check",
    certification: "GOTS",
    supplier: "Ganga Textiles",
    rateMasterId: "RATE-F-121",
    rate: 268.9,
    summary:
      "Heavier yarn-dyed check for kitchen linen and table runners. Pattern match adds wastage.",
    slots: ["Main Fabric", "Contrast Fabric", "Border"],
    tags: ["yarn dyed", "check", "kitchen linen"],
    chainDetail: [
      { label: "Yarn Type", value: "Carded cotton" },
      { label: "Yarn Count", value: "20s" },
      { label: "Yarn Rate", value: "₹262.00 / kg" },
      { label: "Warp Consumption", value: "0.126 kg/m" },
      { label: "Weft Consumption", value: "0.112 kg/m" },
      { label: "Yarn Dyeing Rate", value: "₹72.00 / kg" },
      { label: "Loom Type", value: "Rapier" },
      { label: "Reed", value: "52" },
      { label: "Pick", value: "48" },
      { label: "Weaving Rate", value: "₹108.00 / m" },
      { label: "Finishing Rate", value: "₹16.00 / m" },
    ],
    shrinkagePct: 7,
    wastagePct: 12,
  }),
];

/* ------------------------------------------------------------------ *
 * Filling / wadding / interlining
 * ------------------------------------------------------------------ */

type FillInput = {
  id: string;
  code: string;
  name: string;
  fillingType: string;
  composition: string;
  gsm: number;
  width: number;
  construction: string;
  supplier: string;
  rateMasterId: string;
  rate: number;
  summary: string;
  slots: string[];
  wastagePct: number;
  tags?: string[];
};

function filling(input: FillInput): LibraryItem {
  const master: MaterialMaster = {
    id: input.id,
    code: input.code,
    name: input.name,
    materialType: "Other",
    fabricType: input.fillingType,
    availability: "Ready Fabric",
    composition: input.composition,
    construction: input.construction,
    gsm: input.gsm,
    width: input.width,
    costingWidth: input.width,
    supplier: input.supplier,
    rateMasterId: input.rateMasterId,
    rate: input.rate,
    rateUnit: "per metre",
    description: input.summary,
    status: "Active",
  };

  return {
    id: input.id,
    kind: "filling",
    group: "Filling & Wadding",
    name: input.name,
    code: input.code,
    summary: input.summary,
    rate: input.rate,
    rateUnit: "per metre",
    supplier: input.supplier,
    slots: input.slots,
    tags: input.tags,
    attributes: [
      { label: "Filling Type", value: input.fillingType },
      { label: "Material", value: input.composition.split("%").slice(-1)[0].trim() || "—" },
      { label: "Composition", value: input.composition },
      { label: "GSM", value: String(input.gsm) },
      { label: "Width", value: `${input.width}"` },
      { label: "Construction", value: input.construction },
      { label: "Supplier", value: input.supplier },
      { label: "Rate", value: `₹${input.rate.toFixed(2)}` },
      { label: "Rate Unit", value: "per metre" },
      { label: "Wastage %", value: `${input.wastagePct}%` },
    ],
    consumption: FILL_LOGIC,
    master,
  };
}

const FILLINGS: LibraryItem[] = [
  filling({
    id: "LIB-FI-001",
    code: "FIL-PLY-150-100-UNI",
    name: "Polyester Wadding 150 GSM",
    fillingType: "Polyester Wadding",
    composition: "100% Polyester",
    gsm: 150,
    width: 100,
    construction: "Uniform Fill",
    supplier: "Nova Fibres",
    rateMasterId: "RATE-FI-201",
    rate: 61,
    summary: "The standard quilt fill. Uniform loft, machine-quiltable at any pattern density.",
    slots: ["Filling", "Wadding"],
    wastagePct: 5,
    tags: ["wadding", "quilt", "polyester"],
  }),
  filling({
    id: "LIB-FI-002",
    code: "FIL-PLY-220-100-UNI",
    name: "Polyester Wadding 220 GSM",
    fillingType: "Polyester Wadding",
    composition: "100% Polyester",
    gsm: 220,
    width: 100,
    construction: "Uniform Fill",
    supplier: "Nova Fibres",
    rateMasterId: "RATE-FI-202",
    rate: 84.5,
    summary: "Heavier winter loft. Adds draw-in, so quilting consumption rises with it.",
    slots: ["Filling", "Wadding", "Padding"],
    wastagePct: 6,
    tags: ["wadding", "winter"],
  }),
  filling({
    id: "LIB-FI-003",
    code: "FIL-COT-200-90-NAT",
    name: "Cotton Wadding 200 GSM",
    fillingType: "Cotton Wadding",
    composition: "100% Cotton",
    gsm: 200,
    width: 90,
    construction: "Needle-punched",
    supplier: "Ganga Textiles",
    rateMasterId: "RATE-FI-203",
    rate: 118,
    summary: "Natural-fibre fill for the sustainable programme. Shrinks more than polyester.",
    slots: ["Filling", "Wadding"],
    wastagePct: 8,
    tags: ["cotton", "sustainable"],
  }),
  filling({
    id: "LIB-FI-004",
    code: "FIL-PLY-080-100-PAD",
    name: "Polyester Padding 80 GSM",
    fillingType: "Padding",
    composition: "100% Polyester",
    gsm: 80,
    width: 100,
    construction: "Thermal bonded",
    supplier: "Nova Fibres",
    rateMasterId: "RATE-FI-204",
    rate: 38,
    summary: "Light padding for shams, placemats and table protectors.",
    slots: ["Padding", "Filling"],
    wastagePct: 5,
    tags: ["padding", "light"],
  }),
  filling({
    id: "LIB-FI-005",
    code: "FIL-NWV-045-60-FUS",
    name: "Fusible Interlining 45 GSM",
    fillingType: "Interlining",
    composition: "100% Polyester non-woven",
    gsm: 45,
    width: 60,
    construction: "Non-woven, dot-coated",
    supplier: "Nova Fibres",
    rateMasterId: "RATE-FI-205",
    rate: 26.4,
    summary: "Fusible interlining for flanges, borders and structured edges.",
    slots: ["Interlining", "Other Filling"],
    wastagePct: 6,
    tags: ["interlining", "fusible"],
  }),
];

export const LIBRARY_FABRICS: LibraryItem[] = [...READY, ...GREIGE, ...YDW];
export const LIBRARY_FILLINGS: LibraryItem[] = FILLINGS;
