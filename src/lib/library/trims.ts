/**
 * Trims, packaging and testing masters.
 *
 * Trims publish a real `MaterialMaster` like fabrics do, so a zipper picked
 * from the library and a zipper already on the sheet are the same record.
 * Packaging and testing are product-level and carry no material master — their
 * rate IS the master.
 */

import type { MaterialMaster } from "../costingModel";
import type { ConsumptionLogic, LibraryItem } from "./types";

const PER_PIECE: ConsumptionLogic = {
  method: "Fixed",
  basis: "units / pc",
  formula: "quantity × rate × (1 + wastage%)",
  drivers: ["Units per finished piece", "Wastage %"],
};

const BY_LENGTH: ConsumptionLogic = {
  method: "Length-Based",
  basis: "metres / pc",
  formula: "(perimeter or run length ÷ 39.37) × (1 + wastage%) × rate",
  drivers: ["Finished perimeter", "Run length", "Wastage %"],
};

type TrimInput = {
  id: string;
  code: string;
  name: string;
  accessoryType: string;
  group: "Closures" | "Labels" | "Other Trims";
  specification: string;
  supplier: string;
  rateMasterId: string;
  rate: number;
  rateUnit: string;
  summary: string;
  slots: string[];
  consumption?: ConsumptionLogic;
  attributes?: { label: string; value: string }[];
  tags?: string[];
};

function trim(input: TrimInput): LibraryItem {
  const master: MaterialMaster = {
    id: input.id,
    code: input.code,
    name: input.name,
    materialType: "Trim",
    availability: "Ready",
    supplier: input.supplier,
    rateMasterId: input.rateMasterId,
    rate: input.rate,
    rateUnit: input.rateUnit,
    description: input.specification,
    status: "Active",
  };

  return {
    id: input.id,
    kind: "trim",
    group: input.group,
    name: input.name,
    code: input.code,
    summary: input.summary,
    rate: input.rate,
    rateUnit: input.rateUnit,
    supplier: input.supplier,
    slots: input.slots,
    tags: input.tags,
    attributes: [
      { label: "Trim Type", value: input.accessoryType },
      { label: "Specification", value: input.specification },
      { label: "Supplier", value: input.supplier },
      { label: "Rate", value: `₹${input.rate.toFixed(2)} ${input.rateUnit}` },
      ...(input.attributes ?? []),
    ],
    consumption: input.consumption ?? PER_PIECE,
    master,
  };
}

const CLOSURES: LibraryItem[] = [
  trim({
    id: "LIB-T-ZIP3",
    code: "TRM-ZIP-NYL3",
    name: "Zipper — Nylon #3",
    accessoryType: "Zipper",
    group: "Closures",
    specification: 'Nylon coil #3, 22", concealed, colour matched',
    supplier: "YKK India",
    rateMasterId: "RATE-T-301",
    rate: 14,
    rateUnit: "per piece",
    summary: "Lightweight concealed closure for shams and cushion covers.",
    slots: ["Zipper", "Closures"],
    tags: ["zipper", "closure", "nylon"],
    attributes: [{ label: "Length", value: '22"' }],
  }),
  trim({
    id: "LIB-T-ZIP5",
    code: "TRM-ZIP-NYL5",
    name: "Zipper — Nylon #5",
    accessoryType: "Zipper",
    group: "Closures",
    specification: 'Nylon coil #5, 36", auto-lock slider',
    supplier: "YKK India",
    rateMasterId: "RATE-T-302",
    rate: 22.5,
    rateUnit: "per piece",
    summary: "Standard duvet and quilt-cover closure. Auto-lock slider is buyer-required.",
    slots: ["Zipper", "Closures"],
    tags: ["zipper", "closure", "duvet"],
    attributes: [{ label: "Length", value: '36"' }],
  }),
  trim({
    id: "LIB-T-BTN",
    code: "TRM-BTN-COC18",
    name: "Button — Coconut 18L",
    accessoryType: "Button",
    group: "Closures",
    specification: "18L coconut shell, 2-hole, natural finish",
    supplier: "Vardhman Trims",
    rateMasterId: "RATE-T-303",
    rate: 2.4,
    rateUnit: "per piece",
    summary: "Natural-fibre closure for the sustainable programme. Costed per button.",
    slots: ["Button", "Closures"],
    tags: ["button", "coconut", "sustainable"],
  }),
  trim({
    id: "LIB-T-PRB",
    code: "TRM-PRB-MTL15",
    name: "Press Button — Metal 15 mm",
    accessoryType: "Press Button",
    group: "Closures",
    specification: "15 mm ring snap, nickel-free, attached",
    supplier: "Vardhman Trims",
    rateMasterId: "RATE-T-304",
    rate: 1.85,
    rateUnit: "per piece",
    summary: "Snap closure with attaching cost built into the rate.",
    slots: ["Press Button", "Closures"],
    tags: ["snap", "press button"],
  }),
  trim({
    id: "LIB-T-VLC",
    code: "TRM-VLC-25MM",
    name: "Velcro — 25 mm Hook & Loop",
    accessoryType: "Velcro",
    group: "Closures",
    specification: "25 mm sew-on hook and loop tape, black or white",
    supplier: "Vardhman Trims",
    rateMasterId: "RATE-T-305",
    rate: 6.2,
    rateUnit: "per metre",
    summary: "Sew-on closure tape, costed by run length rather than per piece.",
    slots: ["Velcro", "Closures"],
    consumption: BY_LENGTH,
    tags: ["velcro", "hook and loop"],
  }),
];

const LABELS: LibraryItem[] = [
  trim({
    id: "LIB-T-LBLB",
    code: "TRM-LBL-BRND",
    name: "Brand Label — Woven Main",
    accessoryType: "Brand Label",
    group: "Labels",
    specification: "Woven damask main label, folded, sewn into side seam",
    supplier: "Kohinoor Labels",
    rateMasterId: "RATE-T-310",
    rate: 3.2,
    rateUnit: "per piece",
    summary: "Buyer's main identity label. One per piece, non-negotiable.",
    slots: ["Brand Label", "Labels"],
    tags: ["label", "woven", "brand"],
  }),
  trim({
    id: "LIB-T-LBLC",
    code: "TRM-LBL-CARE",
    name: "Care Label — Printed, 4 Languages",
    accessoryType: "Care Label",
    group: "Labels",
    specification: "Printed satin care/content label, 4 languages, OEKO-TEX",
    supplier: "Kohinoor Labels",
    rateMasterId: "RATE-T-311",
    rate: 1.65,
    rateUnit: "per piece",
    summary: "Wash and content declaration. Language count drives the rate.",
    slots: ["Care Label", "Labels"],
    tags: ["label", "care", "oeko-tex"],
  }),
  trim({
    id: "LIB-T-LBLS",
    code: "TRM-LBL-SIZE",
    name: "Size Label — Woven",
    accessoryType: "Size Label",
    group: "Labels",
    specification: "Woven size label, loop fold, sewn with care label",
    supplier: "Kohinoor Labels",
    rateMasterId: "RATE-T-312",
    rate: 0.95,
    rateUnit: "per piece",
    summary: "Separate size label — needed wherever one style ships in several sizes.",
    slots: ["Size Label", "Labels"],
    tags: ["label", "size"],
  }),
  trim({
    id: "LIB-T-HTAG",
    code: "TRM-TAG-HANG",
    name: "Hang Tag — Printed Card + String",
    accessoryType: "Hang Tag",
    group: "Labels",
    specification: "300 gsm FSC card, 4-colour offset, cotton string attached",
    supplier: "Kohinoor Labels",
    rateMasterId: "RATE-T-313",
    rate: 4.8,
    rateUnit: "per piece",
    summary: "Retail-facing tag. Attaching labour is inside the rate.",
    slots: ["Hang Tag", "Labels"],
    tags: ["tag", "hang tag", "fsc"],
  }),
  trim({
    id: "LIB-T-BCODE",
    code: "TRM-LBL-BARC",
    name: "Barcode Label — Adhesive",
    accessoryType: "Barcode Label",
    group: "Labels",
    specification: "Thermal adhesive EAN-13 label applied to polybag",
    supplier: "Kohinoor Labels",
    rateMasterId: "RATE-T-314",
    rate: 0.55,
    rateUnit: "per piece",
    summary: "Retail scanning label. Applied at packing, not at sewing.",
    slots: ["Barcode Label", "Labels"],
    tags: ["barcode", "ean", "retail"],
  }),
];

const OTHER_TRIMS: LibraryItem[] = [
  trim({
    id: "LIB-T-PIPE",
    code: "TRM-PIP-COR5",
    name: "Piping Cord — 5 mm Cotton",
    accessoryType: "Piping",
    group: "Other Trims",
    specification: "5 mm cotton filler cord for covered piping",
    supplier: "Vardhman Trims",
    rateMasterId: "RATE-T-320",
    rate: 4.1,
    rateUnit: "per metre",
    summary: "The cord inside piping — the covering fabric is a separate component.",
    slots: ["Piping", "Piping / Edge"],
    consumption: BY_LENGTH,
    tags: ["piping", "cord"],
  }),
  trim({
    id: "LIB-T-BIND",
    code: "TRM-BND-SAT25",
    name: "Binding Tape — 25 mm Satin",
    accessoryType: "Binding",
    group: "Other Trims",
    specification: "25 mm satin bias binding, pre-folded",
    supplier: "Vardhman Trims",
    rateMasterId: "RATE-T-321",
    rate: 5.6,
    rateUnit: "per metre",
    summary: "Ready-made binding — the alternative to cutting self-fabric bias.",
    slots: ["Binding", "Other Trim"],
    consumption: BY_LENGTH,
    tags: ["binding", "bias", "satin"],
  }),
  trim({
    id: "LIB-T-TWLT",
    code: "TRM-TAP-TWL25",
    name: "Twill Tape — 25 mm Cotton",
    accessoryType: "Other Trim",
    group: "Other Trims",
    specification: "25 mm cotton twill tape, cut and bar-tacked",
    supplier: "Vardhman Trims",
    rateMasterId: "RATE-T-322",
    rate: 3.4,
    rateUnit: "per metre",
    summary: "Hanging loops, ties and reinforcement. Cut length drives the cost.",
    slots: ["Hanger", "Other Trim", "Cord"],
    consumption: BY_LENGTH,
    tags: ["twill tape", "loop", "hanger"],
  }),
  trim({
    id: "LIB-T-ELAS",
    code: "TRM-ELS-12MM",
    name: "Elastic — 12 mm Braided",
    accessoryType: "Elastic",
    group: "Other Trims",
    specification: "12 mm braided elastic for fitted corners",
    supplier: "Vardhman Trims",
    rateMasterId: "RATE-T-323",
    rate: 3.9,
    rateUnit: "per metre",
    summary: "Fitted-sheet and corner-gather elastic. Costed on run length.",
    slots: ["Elastic", "Other Trim"],
    consumption: BY_LENGTH,
    tags: ["elastic", "fitted"],
  }),
  trim({
    id: "LIB-T-RIBB",
    code: "TRM-RIB-SAT15",
    name: "Ribbon — 15 mm Satin",
    accessoryType: "Ribbon",
    group: "Other Trims",
    specification: "15 mm double-face satin ribbon, colour matched",
    supplier: "Vardhman Trims",
    rateMasterId: "RATE-T-324",
    rate: 2.8,
    rateUnit: "per metre",
    summary: "Decorative tie and bow. Two ties per piece is the usual build.",
    slots: ["Ribbon", "Other Trim"],
    consumption: BY_LENGTH,
    tags: ["ribbon", "satin", "tie"],
  }),
];

/* ------------------------------------------------------------------ *
 * Packaging — product level
 * ------------------------------------------------------------------ */

type PackInput = {
  id: string;
  code: string;
  name: string;
  packagingType: "Labels" | "Standard Packaging" | "Special / Buyer-Specific" | "Carton Packing";
  specification: string;
  rate: number;
  summary: string;
  supplier?: string;
  tags?: string[];
};

const PACK_LOGIC: ConsumptionLogic = {
  method: "Per piece (allocated)",
  basis: "1 pack unit / pc",
  formula: "quantity × rate — carton cost divided by pieces per carton",
  drivers: ["Pack ratio", "Pieces per carton"],
  note: "A master carton is costed per piece by dividing across its pack quantity.",
};

function packaging(input: PackInput): LibraryItem {
  return {
    id: input.id,
    kind: "packaging",
    group: input.packagingType,
    name: input.name,
    code: input.code,
    summary: input.summary,
    rate: input.rate,
    rateUnit: "per piece",
    supplier: input.supplier,
    slots: ["Product level"],
    tags: input.tags,
    attributes: [
      { label: "Packaging Type", value: input.packagingType },
      { label: "Specification", value: input.specification },
      { label: "Rate", value: `₹${input.rate.toFixed(2)} per piece` },
      ...(input.supplier ? [{ label: "Supplier", value: input.supplier }] : []),
    ],
    consumption: PACK_LOGIC,
  };
}

const PACKAGING: LibraryItem[] = [
  packaging({
    id: "LIB-K-POLY",
    code: "PKG-POLY-STD",
    name: "Polybag — Standard",
    packagingType: "Standard Packaging",
    specification: "LDPE 40 micron, buyer-printed, self-adhesive seal",
    rate: 0.45,
    summary: "The default primary pack. Recyclability declaration is buyer-mandated.",
    supplier: "Shreeji Packaging",
    tags: ["polybag", "primary"],
  }),
  packaging({
    id: "LIB-K-BUYER",
    code: "PKG-POLY-BUY",
    name: "Polybag — Buyer Artwork",
    packagingType: "Special / Buyer-Specific",
    specification: "Printed to buyer artwork, 3-colour, hang-hole and warning text",
    rate: 1.35,
    summary: "Retail-visible pack — printing and artwork approval sit inside this rate.",
    supplier: "Shreeji Packaging",
    tags: ["polybag", "printed", "retail"],
  }),
  packaging({
    id: "LIB-K-BOX",
    code: "PKG-BOX-PREM",
    name: "Gift Box + Tissue",
    packagingType: "Special / Buyer-Specific",
    specification: "Rigid board box, 4-colour wrap, acid-free tissue insert",
    rate: 3.8,
    summary: "Premium presentation pack for gifting programmes.",
    supplier: "Shreeji Packaging",
    tags: ["box", "gift", "premium"],
  }),
  packaging({
    id: "LIB-K-KRAFT",
    code: "PKG-WRP-KRFT",
    name: "Recycled Kraft Wrap + Belly Band",
    packagingType: "Special / Buyer-Specific",
    specification: "FSC kraft wrap with printed belly band, no plastic",
    rate: 0.95,
    summary: "Plastic-free alternative for the sustainable programme.",
    supplier: "Shreeji Packaging",
    tags: ["kraft", "sustainable", "plastic free"],
  }),
  packaging({
    id: "LIB-K-CTN5",
    code: "PKG-CTN-5PLY",
    name: "Master Carton — 5-ply",
    packagingType: "Carton Packing",
    specification: "5-ply export carton, 60 pcs per carton — allocated per piece",
    rate: 0.4,
    summary: "Standard export outer. Cost per piece falls as pack quantity rises.",
    supplier: "Shreeji Packaging",
    tags: ["carton", "export", "outer"],
  }),
  packaging({
    id: "LIB-K-CTN7",
    code: "PKG-CTN-7PLY",
    name: "Master Carton — 7-ply Heavy Duty",
    packagingType: "Carton Packing",
    specification: "7-ply carton for long-haul sea freight, 40 pcs per carton",
    rate: 0.72,
    summary: "Heavier outer for bulky top-of-bed on long sea routes.",
    supplier: "Shreeji Packaging",
    tags: ["carton", "heavy duty"],
  }),
];

/* ------------------------------------------------------------------ *
 * Testing & certification — product level
 * ------------------------------------------------------------------ */

const TEST_LOGIC: ConsumptionLogic = {
  method: "Lot allocated",
  basis: "lot cost ÷ lot size",
  formula: "submission cost ÷ pieces in the order",
  drivers: ["Submission cost", "MOQ / lot size", "Test scope"],
  note: "Raising MOQ lowers this line without changing the test.",
};

type TestInput = {
  id: string;
  code: string;
  name: string;
  testType: "Physical" | "Chemical" | "Certification";
  specification: string;
  lab: string;
  lotCost: number;
  summary: string;
  tags?: string[];
};

function testing(input: TestInput): LibraryItem {
  return {
    id: input.id,
    kind: "testing",
    group: input.testType,
    name: input.name,
    code: input.code,
    summary: input.summary,
    rate: input.lotCost,
    rateUnit: "per lot",
    supplier: input.lab,
    slots: ["Product level"],
    tags: input.tags,
    attributes: [
      { label: "Test Type", value: input.testType },
      { label: "Specification", value: input.specification },
      { label: "Laboratory", value: input.lab },
      { label: "Lot Cost", value: `₹${input.lotCost.toLocaleString("en-IN")}` },
    ],
    consumption: TEST_LOGIC,
  };
}

const TESTING: LibraryItem[] = [
  testing({
    id: "LIB-Q-DIM",
    code: "TST-DIM-6330",
    name: "Dimensional stability to washing",
    testType: "Physical",
    specification: "ISO 6330 · 3 wash cycles · buyer protocol",
    lab: "Intertek",
    lotCost: 4800,
    summary: "Shrinkage after wash — the test that validates the shrinkage % on every rule.",
    tags: ["shrinkage", "iso 6330", "wash"],
  }),
  testing({
    id: "LIB-Q-AZO",
    code: "TST-CHM-AZO",
    name: "Azo dyes & formaldehyde",
    testType: "Chemical",
    specification: "EN 14362-1 · REACH Annex XVII",
    lab: "SGS",
    lotCost: 6500,
    summary: "Mandatory EU chemical screening on any dyed or printed cloth.",
    tags: ["azo", "reach", "chemical"],
  }),
  testing({
    id: "LIB-Q-FAST",
    code: "TST-PHY-FAST",
    name: "Colour fastness — wash, rub, light",
    testType: "Physical",
    specification: "ISO 105 C06 / X12 / B02",
    lab: "Intertek",
    lotCost: 5200,
    summary: "The test that separates reactive from pigment dyeing on a spec sheet.",
    tags: ["fastness", "iso 105"],
  }),
  testing({
    id: "LIB-Q-OEKO",
    code: "TST-CRT-OEKO",
    name: "OEKO-TEX Standard 100 — annual share",
    testType: "Certification",
    specification: "Class II · certificate allocated across the season",
    lab: "Hohenstein",
    lotCost: 3900,
    summary: "Annual certificate, allocated across the season's volume rather than per order.",
    tags: ["oeko-tex", "certification"],
  }),
  testing({
    id: "LIB-Q-GOTS",
    code: "TST-CRT-GOTS",
    name: "GOTS transaction certificate",
    testType: "Certification",
    specification: "Scope certificate + per-shipment transaction certificate",
    lab: "Control Union",
    lotCost: 7400,
    summary: "Required wherever a GOTS claim reaches the label. Per shipment, not per style.",
    tags: ["gots", "organic", "certification"],
  }),
];

export const LIBRARY_TRIMS: LibraryItem[] = [...CLOSURES, ...LABELS, ...OTHER_TRIMS];
export const LIBRARY_PACKAGING: LibraryItem[] = PACKAGING;
export const LIBRARY_TESTING: LibraryItem[] = TESTING;
