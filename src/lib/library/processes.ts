/**
 * Process masters — the variables that cost money once a fabric exists.
 *
 * A process is not a property of a component; it is a step applied TO one, and
 * it is what the Process tab lists as rows. Every entry states its own
 * configurable variable (dyeing method, quilting pattern, wash type) — the
 * option catalogue for that variable lives in `costLines.ts`, keyed by the same
 * `processMasterId`, so a step added from the library is configurable the
 * moment it lands on the sheet.
 */

import type { ConsumptionLogic, LibraryItem } from "./types";
import type { ProcessBasis } from "../costingModel";

type ProcInput = {
  id: string;
  processMasterId: string;
  name: string;
  group: string;
  category: string;
  code: string;
  summary: string;
  basis: ProcessBasis;
  rate: number;
  rateUnit: string;
  supplier?: string;
  /** the variable this step is configured on, plus its current setting */
  defaultParams: { label: string; value: string }[];
  /** what decides how many basis units the component consumes */
  consumption: ConsumptionLogic;
  slots: string[];
  tags?: string[];
  attributes?: { label: string; value: string }[];
};

function process(input: ProcInput): LibraryItem {
  return {
    id: input.id,
    kind: "process",
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
      { label: "Process", value: input.name },
      { label: "Category", value: input.category },
      ...input.defaultParams,
      { label: "Basis", value: input.basis },
      { label: "Rate", value: `₹${input.rate.toFixed(2)} ${input.rateUnit}` },
      ...(input.supplier ? [{ label: "Supplier", value: input.supplier }] : []),
      ...(input.attributes ?? []),
    ],
    consumption: input.consumption,
    process: {
      processMasterId: input.processMasterId,
      category: input.category,
      basis: input.basis,
      rateUnit: input.rateUnit,
      defaultParams: input.defaultParams,
    },
  };
}

const PER_METRE: ConsumptionLogic = {
  method: "Fabric-linked",
  basis: "metres processed / pc",
  formula: "component consumption (m/pc) × 1",
  drivers: ["Component fabric consumption"],
  note: "Charged on every metre of the component's fabric, so a wastage change moves it too.",
};

const PER_PIECE: ConsumptionLogic = {
  method: "Per piece",
  basis: "1 operation / pc",
  formula: "quantity × rate",
  drivers: ["Occurrences per finished piece"],
};

const PER_STITCH: ConsumptionLogic = {
  method: "Stitch-count based",
  basis: "thousand stitches / pc",
  formula: "(stitch count ÷ 1000) × rate",
  drivers: ["Design stitch count", "Design repeats per piece", "Thread type"],
};

/* ---- wet processing ---- */

const WET: LibraryItem[] = [
  process({
    id: "LIB-P-DYE",
    processMasterId: "PRC-DYE",
    name: "Dyeing",
    group: "Wet Processing",
    category: "Wet Processing",
    code: "PRC-DYE",
    summary: "Piece dyeing to buyer pantone. Method decides fastness and rate.",
    basis: "per m",
    rate: 22,
    rateUnit: "per metre",
    supplier: "Kumar Processors",
    defaultParams: [
      { label: "Dyeing Method", value: "Reactive — exhaust" },
      { label: "Shade depth", value: "Medium" },
    ],
    consumption: PER_METRE,
    slots: ["Front Fabric", "Back Fabric", "Main Fabric", "Contrast Fabric", "Border", "Binding"],
    tags: ["dye", "reactive", "vat", "pigment", "wet"],
    attributes: [{ label: "Fastness", value: "4–5 (reactive)" }],
  }),
  process({
    id: "LIB-P-PRT",
    processMasterId: "PRC-PRT",
    name: "Printing",
    group: "Wet Processing",
    category: "Wet Processing",
    code: "PRC-PRT",
    summary: "Screen or digital print to buyer artwork. Screen count is the cost driver.",
    basis: "per m",
    rate: 82.5,
    rateUnit: "per metre",
    supplier: "Kumar Processors",
    defaultParams: [
      { label: "Print Method", value: "Rotary screen — 6 colours" },
      { label: "Colour coverage", value: "62%" },
      { label: "Placement", value: "Allover" },
    ],
    consumption: PER_METRE,
    slots: ["Front Fabric", "Main Fabric", "Contrast Fabric"],
    tags: ["print", "rotary", "digital", "screens"],
  }),
  process({
    id: "LIB-P-WSH",
    processMasterId: "PRC-WSH",
    name: "Washing",
    group: "Wet Processing",
    category: "Wet Processing",
    code: "PRC-WSH",
    summary: "Garment wash after assembly — hand feel, and it fixes the shrinkage before shipping.",
    basis: "per pc",
    rate: 18,
    rateUnit: "per piece",
    supplier: "Kumar Processors",
    defaultParams: [{ label: "Wash Type", value: "Soft wash" }],
    consumption: PER_PIECE,
    slots: ["Front Fabric", "Main Fabric", "Product level"],
    tags: ["wash", "enzyme", "softener", "finishing"],
  }),
  process({
    id: "LIB-P-FIN",
    processMasterId: "PRC-FIN",
    name: "Finishing",
    group: "Wet Processing",
    category: "Wet Processing",
    code: "PRC-FIN",
    summary: "Softener, calendaring or heat-set applied to the cloth before cutting.",
    basis: "per m",
    rate: 11,
    rateUnit: "per metre",
    supplier: "Kumar Processors",
    defaultParams: [{ label: "Finish Type", value: "Enzyme soft + calendar" }],
    consumption: PER_METRE,
    slots: ["Front Fabric", "Back Fabric", "Main Fabric"],
    tags: ["finish", "softener", "calendar"],
  }),
];

/* ---- decoration ---- */

const DECORATION: LibraryItem[] = [
  process({
    id: "LIB-P-EMB",
    processMasterId: "PRC-EMB",
    name: "Embroidery",
    group: "Decoration",
    category: "Decoration",
    code: "PRC-EMB",
    summary: "Machine embroidery. Cost scales with stitch count, not with area.",
    basis: "per 1000 stitches",
    rate: 1.44,
    rateUnit: "per 1000 stitches",
    supplier: "Suman Emb",
    defaultParams: [
      { label: "Embroidery Type", value: "Flat embroidery" },
      { label: "Thread Type", value: "Viscose" },
      { label: "Number of Colours", value: "3" },
      { label: "Placement", value: "Front centre" },
    ],
    consumption: PER_STITCH,
    slots: ["Front Fabric", "Main Fabric", "Decoration"],
    tags: ["embroidery", "boucle", "sequin", "stitch count"],
    attributes: [{ label: "Secondary Supplier", value: "SK Emb" }],
  }),
  process({
    id: "LIB-P-APQ",
    processMasterId: "PRC-APQ",
    name: "Appliqué",
    group: "Decoration",
    category: "Decoration",
    code: "PRC-APQ",
    summary: "Cut fabric shape laid on and satin-stitched down. Costed per motif.",
    basis: "per pc",
    rate: 34,
    rateUnit: "per piece",
    supplier: "Suman Emb",
    defaultParams: [
      { label: "Appliqué Type", value: "Satin edge" },
      { label: "Motifs per piece", value: "3" },
    ],
    consumption: PER_PIECE,
    slots: ["Front Fabric", "Decoration", "Patch"],
    tags: ["applique", "patch", "motif"],
  }),
  process({
    id: "LIB-P-QLT",
    processMasterId: "PRC-QLT",
    name: "Quilting",
    group: "Making",
    category: "Making",
    code: "PRC-QLT",
    summary:
      "Quilting is a process, never a material — it stitches face, filling and back into one panel.",
    basis: "per pc",
    rate: 225.75,
    rateUnit: "per piece",
    supplier: "Sri Quilting Co.",
    defaultParams: [
      { label: "Quilting Pattern", value: "Heart" },
      { label: "Method", value: "Machine" },
      { label: "Placement", value: "Allover" },
    ],
    consumption: PER_PIECE,
    slots: ["Front Fabric", "Filling", "Product level"],
    tags: ["quilting", "heart", "diamond", "channel", "box", "wave"],
    attributes: [{ label: "MOQ", value: "45 pcs" }],
  }),
];

/* ---- making ---- */

const MAKING: LibraryItem[] = [
  process({
    id: "LIB-P-CUT",
    processMasterId: "PRC-CUT",
    name: "Cutting",
    group: "Making",
    category: "Making",
    code: "PRC-CUT",
    summary: "Marker, lay-up and panel cutting. Method decides ply depth and accuracy.",
    basis: "per pc",
    rate: 1,
    rateUnit: "per piece",
    defaultParams: [{ label: "Cutting Method", value: "Straight knife, 40-ply" }],
    consumption: PER_PIECE,
    slots: ["Front Fabric", "Back Fabric", "Main Fabric", "Border", "Binding", "Piping / Edge"],
    tags: ["cutting", "marker", "cam", "die"],
  }),
  process({
    id: "LIB-P-STC",
    processMasterId: "PRC-STC",
    name: "Stitching / Assembly",
    group: "Making",
    category: "Making",
    code: "PRC-STC",
    summary: "Sew-line labour. SAM × line rate, expressed as a per-piece charge.",
    basis: "per pc",
    rate: 3,
    rateUnit: "per piece",
    defaultParams: [
      { label: "Stitch Type", value: "Single needle lockstitch" },
      { label: "Seam allowance", value: '0.5"' },
    ],
    consumption: PER_PIECE,
    slots: ["Front Fabric", "Main Fabric", "Back Fabric", "Pocket", "Lining"],
    tags: ["stitching", "snls", "overlock", "flatlock"],
  }),
  process({
    id: "LIB-P-HEM",
    processMasterId: "PRC-HEM",
    name: "Hemming / Edge Finish",
    group: "Making",
    category: "Making",
    code: "PRC-HEM",
    summary: "Perimeter hem. Mitred corners cost most; a rolled hem costs least.",
    basis: "per pc",
    rate: 6.5,
    rateUnit: "per piece",
    defaultParams: [{ label: "Hem Type", value: 'Double fold, 0.5"' }],
    consumption: PER_PIECE,
    slots: ["Front Fabric", "Main Fabric", "Border", "Flange"],
    tags: ["hem", "mitred", "rolled", "blind"],
  }),
  process({
    id: "LIB-P-BND",
    processMasterId: "PRC-BND",
    name: "Binding / Edge Closing",
    group: "Making",
    category: "Making",
    code: "PRC-BND",
    summary: "Bias binding or piped edge closing the quilt sandwich.",
    basis: "per pc",
    rate: 12.6,
    rateUnit: "per piece",
    defaultParams: [{ label: "Bind Type", value: 'Self-fabric bias, 1"' }],
    consumption: PER_PIECE,
    slots: ["Binding", "Piping / Edge", "Border"],
    tags: ["binding", "bias", "piping", "edge"],
  }),
];

export const LIBRARY_PROCESSES: LibraryItem[] = [...WET, ...DECORATION, ...MAKING];
