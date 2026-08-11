// Component library — catalogue of buyable/configurable options per graph node.
// Clicking a node in the Cost graph opens a modal that pulls the matching entry
// here and lets the merchandiser pick a variant. Each variant applies a
// deterministic patch to CushionInputs.

import type { CushionInputs } from "./cushionCosting";

const uniq = (items: string[]) => Array.from(new Set(items));

export type ComponentVariant = {
  id: string;
  label: string;
  note?: string;
  tag?: "recommended" | "premium" | "budget" | "sustainable" | "fast";
  patch: Partial<CushionInputs>;
};

export type ComponentSpec = {
  nodeId: string;
  title: string;
  category: "Fabric" | "Making" | "Trims" | "Commercial";
  description: string;
  variants: ComponentVariant[];
};

export const COMPONENT_LIBRARY: Record<string, ComponentSpec> = {
  greige: {
    nodeId: "greige",
    title: "Greige Cotton",
    category: "Fabric",
    description: "Base woven cotton before print/dye. Drives ~40% of fabric ₹/m.",
    variants: [
      {
        id: "cotton-30s",
        label: "Carded 30s · 152 GSM",
        note: "Standard hand feel",
        tag: "budget",
        patch: { greigeCotton: 98 },
      },
      {
        id: "cotton-60s",
        label: "Combed 60s · 165 GSM",
        note: "Default spec",
        tag: "recommended",
        patch: { greigeCotton: 120 },
      },
      {
        id: "cotton-80s",
        label: "Combed 80s · 180 GSM",
        note: "Softer, denser weave",
        patch: { greigeCotton: 145 },
      },
      {
        id: "cotton-bci",
        label: "BCI Certified Cotton",
        note: "Better Cotton Initiative",
        tag: "sustainable",
        patch: { greigeCotton: 132 },
      },
      {
        id: "cotton-organic",
        label: "GOTS Organic Cotton",
        note: "Full traceability",
        tag: "premium",
        patch: { greigeCotton: 158 },
      },
      {
        id: "cotton-recycled",
        label: "Recycled Cotton Blend 60/40",
        note: "GRS certified",
        tag: "sustainable",
        patch: { greigeCotton: 104 },
      },
    ],
  },
  print: {
    nodeId: "print",
    title: "Reactive Print",
    category: "Fabric",
    description: "Colour/artwork applied on the front panel.",
    variants: [
      {
        id: "no-print",
        label: "No print · piece dyed",
        tag: "budget",
        patch: { reactivePrint: 0 },
      },
      { id: "reactive-2c", label: "Reactive · 2 colour", patch: { reactivePrint: 28 } },
      {
        id: "reactive-4c",
        label: "Reactive · 4 colour",
        tag: "recommended",
        patch: { reactivePrint: 38 },
      },
      { id: "reactive-6c", label: "Reactive · 6 colour + placement", patch: { reactivePrint: 54 } },
      {
        id: "digital",
        label: "Digital print · photo real",
        tag: "premium",
        patch: { reactivePrint: 72 },
      },
      {
        id: "pigment",
        label: "Pigment print",
        note: "Softer hand, lower fastness",
        patch: { reactivePrint: 22 },
      },
    ],
  },
  dye: {
    nodeId: "dye",
    title: "Solid Dyeing",
    category: "Fabric",
    description: "Applied to the back panel — usually a solid tone matching the print.",
    variants: [
      { id: "greige", label: "Undyed greige", tag: "budget", patch: { solidDyeing: 0 } },
      {
        id: "reactive-solid",
        label: "Reactive solid dye",
        tag: "recommended",
        patch: { solidDyeing: 22 },
      },
      { id: "vat-dye", label: "Vat dye · deep tones", tag: "premium", patch: { solidDyeing: 34 } },
      {
        id: "natural",
        label: "Natural / herbal dye",
        tag: "sustainable",
        patch: { solidDyeing: 46 },
      },
    ],
  },
  finish: {
    nodeId: "finish",
    title: "Finishing & Transport",
    category: "Fabric",
    description: "Softener, calendaring and freight to cut/sew unit.",
    variants: [
      {
        id: "std",
        label: "Standard finish · road freight",
        tag: "recommended",
        patch: { finishTransport: 7 },
      },
      { id: "soft", label: "Enzyme softener + peach", patch: { finishTransport: 11 } },
      {
        id: "premium",
        label: "Silicone softener · calendared",
        tag: "premium",
        patch: { finishTransport: 16 },
      },
      {
        id: "eco",
        label: "Bio-polishing · low water",
        tag: "sustainable",
        patch: { finishTransport: 13 },
      },
    ],
  },
  cutting: {
    nodeId: "cutting",
    title: "Cutting",
    category: "Making",
    description: "Marker + laying + panel cutting labour.",
    variants: [
      { id: "std", label: "Straight knife · manual layup", tag: "budget", patch: { cutting: 4 } },
      {
        id: "auto",
        label: "Auto layup + straight knife",
        tag: "recommended",
        patch: { cutting: 6 },
      },
      { id: "cad", label: "CAD marker + auto cutter", patch: { cutting: 9 } },
    ],
  },
  stitching: {
    nodeId: "stitching",
    title: "Stitching",
    category: "Making",
    description: "Sew line labour · SMV × line rate.",
    variants: [
      { id: "basic", label: "Basic seam · 4 operations", tag: "budget", patch: { stitching: 26 } },
      { id: "std", label: "Standard · 7 operations", tag: "recommended", patch: { stitching: 36 } },
      { id: "piped", label: "Corded piping · 9 ops", patch: { stitching: 44 } },
      {
        id: "hand-finish",
        label: "Hand-finished edges · 11 ops",
        tag: "premium",
        patch: { stitching: 58 },
      },
    ],
  },
  embroidery: {
    nodeId: "embroidery",
    title: "Embroidery",
    category: "Making",
    description: "Machine embroidery. Cost scales with stitch count.",
    variants: [
      { id: "none", label: "No embroidery", tag: "budget", patch: { embroidery: 0 } },
      { id: "logo-small", label: "Corner logo · 3k stitches", patch: { embroidery: 18 } },
      {
        id: "motif",
        label: "Front motif · 8k stitches",
        tag: "recommended",
        patch: { embroidery: 48 },
      },
      { id: "border", label: "Border embroidery · 12k stitches", patch: { embroidery: 68 } },
      {
        id: "all-over",
        label: "All-over · 20k stitches",
        tag: "premium",
        patch: { embroidery: 98 },
      },
      {
        id: "beaded",
        label: "Beaded + zari embroidery",
        tag: "premium",
        patch: { embroidery: 145 },
      },
    ],
  },
  trims: {
    nodeId: "trims",
    title: "Trims & Labels",
    category: "Trims",
    description: "Main label, care label, hangtag, thread.",
    variants: [
      { id: "printed", label: "Printed satin labels", tag: "budget", patch: { trimsLabels: 5 } },
      {
        id: "woven",
        label: "Woven main + care label",
        tag: "recommended",
        patch: { trimsLabels: 8 },
      },
      {
        id: "leather",
        label: "Leather patch + woven care",
        tag: "premium",
        patch: { trimsLabels: 14 },
      },
      {
        id: "recycled",
        label: "Recycled polyester labels",
        tag: "sustainable",
        patch: { trimsLabels: 9 },
      },
    ],
  },
  packaging: {
    nodeId: "packaging",
    title: "Packaging",
    category: "Trims",
    description: "Poly, tissue, sleeve or retail-ready carton.",
    variants: [
      { id: "poly", label: "Polybag only", tag: "budget", patch: { packaging: 3 } },
      { id: "kraft", label: "Poly + kraft sleeve", tag: "recommended", patch: { packaging: 5 } },
      { id: "gift", label: "Gift box + tissue", patch: { packaging: 12 } },
      {
        id: "retail",
        label: "Retail-ready · printed carton",
        tag: "premium",
        patch: { packaging: 18 },
      },
      {
        id: "compostable",
        label: "Compostable mailer",
        tag: "sustainable",
        patch: { packaging: 9 },
      },
    ],
  },
  setup: {
    nodeId: "setup",
    title: "Setup",
    category: "Commercial",
    description: "One-time fixed cost amortised across the run.",
    variants: [
      { id: "small", label: "Small run · 1 sample set", patch: { setup: 22_000 } },
      { id: "std", label: "Standard tooling", tag: "recommended", patch: { setup: 40_000 } },
      { id: "full", label: "Full sampling + strike-offs", patch: { setup: 65_000 } },
    ],
  },
};

// Intermediate graph nodes (front-per-m, back-pc, ...) alias to their most
// meaningful upstream component so every node click opens a populated library.
const NODE_ALIASES: Record<string, string> = {
  "front-per-m": "greige",
  "back-per-m": "greige",
  "front-pc": "greige",
  "back-pc": "greige",
  "piping-pc": "greige",
  "cutting-pc": "cutting",
  "stitching-pc": "stitching",
  "embroidery-pc": "embroidery",
  "trims-pc": "trims",
  "packaging-pc": "packaging",
  "setup-pc": "setup",
  "fabric-sub": "greige",
  "making-sub": "stitching",
};

export function libraryFor(nodeId: string): ComponentSpec | undefined {
  return COMPONENT_LIBRARY[nodeId] ?? COMPONENT_LIBRARY[NODE_ALIASES[nodeId]];
}

export function nodesForInputPatch(patch: Partial<CushionInputs>, extra: string[] = []) {
  const nodes: string[] = [...extra];
  const add = (...ids: string[]) => nodes.push(...ids);

  if ("greigeCotton" in patch) {
    add(
      "greige",
      "front-per-m",
      "back-per-m",
      "front-pc",
      "back-pc",
      "piping-pc",
      "fabric-sub",
      "overhead",
    );
  }
  if ("reactivePrint" in patch) add("print", "front-per-m", "front-pc", "fabric-sub", "overhead");
  if ("solidDyeing" in patch)
    add("dye", "back-per-m", "back-pc", "piping-pc", "fabric-sub", "overhead");
  if ("finishTransport" in patch) {
    add(
      "finish",
      "front-per-m",
      "back-per-m",
      "front-pc",
      "back-pc",
      "piping-pc",
      "fabric-sub",
      "overhead",
    );
  }
  if ("frontMeters" in patch) add("front-pc", "fabric-sub", "overhead");
  if ("backMeters" in patch || "backRatio" in patch || "pipingRatio" in patch) {
    add("back-pc", "piping-pc", "fabric-sub", "overhead");
  }
  if ("cutting" in patch) add("cutting", "cutting-pc", "making-sub", "overhead");
  if ("stitching" in patch) add("stitching", "stitching-pc", "making-sub", "overhead");
  if ("embroidery" in patch) add("embroidery", "embroidery-pc", "making-sub", "overhead");
  if ("trimsLabels" in patch) add("trims", "trims-pc", "making-sub", "overhead");
  if ("packaging" in patch) add("packaging", "packaging-pc", "making-sub", "overhead");
  if ("setup" in patch || "qty" in patch) add("setup", "setup-pc", "making-sub", "overhead");
  if ("fxRate" in patch) add("fx");
  if ("targetMarginPct" in patch) add("target-margin");
  if ("overheadPct" in patch) add("overhead");

  add("total", "quote");
  return uniq(nodes);
}

/* ---------------- Master component library ---------------- */
// Rich, attribute-annotated catalogue for the searchable side-panel browser.
// Every entry patches CushionInputs directly, so selecting an item from the
// master library behaves identically to picking a variant inside NodeConfigModal.

export type MasterAttribute = { key: string; value: string };
export type MasterTab = "Fabrics" | "Process" | "Trims";
export type MasterComponent = {
  id: string;
  name: string;
  tab: MasterTab;
  category: ComponentSpec["category"];
  nodeId: string; // which graph node this affects (for highlight)
  attributes: MasterAttribute[];
  tag?: ComponentVariant["tag"];
  price: string; // e.g. "₹184/mtr", "₹225/pcs"
  meta?: string; // short subtitle e.g. "108\" · Digital Sublimation · Polyester"
  patch: Partial<CushionInputs>;
  affectedNodes?: string[]; // extra nodes to pulse on apply
  contextTags?: string[];
};

// tabOf() derives the panel tab from the underlying category.
const catToTab = (c: ComponentSpec["category"]): MasterTab =>
  c === "Fabric" ? "Fabrics" : c === "Making" ? "Process" : "Trims";

export const MASTER_COMPONENTS: MasterComponent[] = [
  // ---------- Fabrics (from ready-reckoner) ----------
  {
    id: "mc-poly-micro-print",
    name: "90 GSM Poly Micro · Print",
    tab: "Fabrics",
    category: "Fabric",
    nodeId: "greige",
    price: "₹184/mtr",
    meta: `108" · Digital Sublimation · Polyester`,
    attributes: [
      { key: "GSM", value: "90" },
      { key: "Construction", value: "Plain weave" },
      { key: "Width", value: `108"` },
      { key: "Composition", value: "Polyester" },
      { key: "Count", value: "75D × 75D" },
      { key: "Process", value: "Digital Sublimation" },
    ],
    tag: "recommended",
    patch: { greigeCotton: 184, reactivePrint: 0, finishTransport: 7 },
    affectedNodes: ["greige", "print", "finish", "front-per-m", "front-pc", "fabric-sub"],
    contextTags: ["default"],
  },
  {
    id: "mc-poly-micro-solid",
    name: "90 GSM Poly Micro · Solid",
    tab: "Fabrics",
    category: "Fabric",
    nodeId: "greige",
    price: "₹81/mtr",
    meta: `108" · Reactive Dye · Polyester`,
    attributes: [
      { key: "GSM", value: "90" },
      { key: "Construction", value: "Plain weave" },
      { key: "Width", value: `108"` },
      { key: "Composition", value: "Polyester" },
      { key: "Count", value: "75D × 75D" },
      { key: "Process", value: "Reactive Dye" },
    ],
    tag: "budget",
    patch: { greigeCotton: 81, solidDyeing: 0, finishTransport: 7 },
    affectedNodes: ["greige", "dye", "finish", "back-per-m", "back-pc", "fabric-sub"],
    contextTags: ["value", "cheapest"],
  },
  {
    id: "mc-cotton-percale-print",
    name: "140 GSM Cotton Percale · Print",
    tab: "Fabrics",
    category: "Fabric",
    nodeId: "greige",
    price: "₹220/mtr",
    meta: `100" · Reactive Print · 100% Cotton · GOTS`,
    attributes: [
      { key: "GSM", value: "140" },
      { key: "Construction", value: "Percale" },
      { key: "Width", value: `100"` },
      { key: "Composition", value: "100% Cotton" },
      { key: "Count", value: "40s × 40s" },
      { key: "Certification", value: "GOTS" },
      { key: "Process", value: "Reactive Print" },
    ],
    tag: "premium",
    patch: { greigeCotton: 220, reactivePrint: 0, finishTransport: 7 },
    affectedNodes: ["greige", "print", "finish", "front-per-m", "front-pc", "fabric-sub"],
    contextTags: ["premium", "sustainable"],
  },
  {
    id: "mc-cotton-voile-solid",
    name: "120 GSM Cotton Voile · Solid",
    tab: "Fabrics",
    category: "Fabric",
    nodeId: "greige",
    price: "₹160/mtr",
    meta: `60" · Vat Dye · 100% Cotton`,
    attributes: [
      { key: "GSM", value: "120" },
      { key: "Construction", value: "Voile" },
      { key: "Width", value: `60"` },
      { key: "Composition", value: "100% Cotton" },
      { key: "Count", value: "60s × 60s" },
      { key: "Process", value: "Vat Dye" },
    ],
    patch: { greigeCotton: 160, solidDyeing: 0, finishTransport: 7 },
    affectedNodes: ["greige", "dye", "finish", "back-per-m", "back-pc", "fabric-sub"],
  },
  {
    id: "mc-cotton-canvas-greige",
    name: "Cotton Canvas · Greige",
    tab: "Fabrics",
    category: "Fabric",
    nodeId: "greige",
    price: "₹95/mtr",
    meta: `60" · Unbleached · 100% Cotton`,
    attributes: [
      { key: "GSM", value: "220" },
      { key: "Construction", value: "Canvas" },
      { key: "Width", value: `60"` },
      { key: "Composition", value: "100% Cotton" },
      { key: "Count", value: "10s × 10s" },
      { key: "Finish", value: "Unbleached" },
    ],
    tag: "budget",
    patch: { greigeCotton: 95 },
    affectedNodes: ["greige", "front-per-m", "back-per-m", "fabric-sub"],
    contextTags: ["value"],
  },

  // ---------- Process ----------
  {
    id: "mc-heart-quilting",
    name: "Heart Quilting",
    tab: "Process",
    category: "Making",
    nodeId: "embroidery",
    price: "₹225/pcs",
    meta: "Machine · Allover · Min 45 pcs",
    attributes: [
      { key: "Method", value: "Machine" },
      { key: "Pattern", value: "Heart" },
      { key: "Coverage", value: "Allover" },
      { key: "Min qty", value: "45 pcs" },
    ],
    tag: "premium",
    patch: { embroidery: 225 },
    affectedNodes: ["embroidery", "embroidery-pc", "making-sub"],
    contextTags: ["premium"],
  },
  {
    id: "mc-diamond-quilting",
    name: "Diamond Quilting",
    tab: "Process",
    category: "Making",
    nodeId: "embroidery",
    price: "₹180/pcs",
    meta: "Machine · Allover · Min 45 pcs",
    attributes: [
      { key: "Method", value: "Machine" },
      { key: "Pattern", value: "Diamond" },
      { key: "Coverage", value: "Allover" },
      { key: "Min qty", value: "45 pcs" },
    ],
    tag: "recommended",
    patch: { embroidery: 180 },
    affectedNodes: ["embroidery", "embroidery-pc", "making-sub"],
  },
  {
    id: "mc-sublimation-digital",
    name: "Sublimation Print (Digital)",
    tab: "Process",
    category: "Making",
    nodeId: "print",
    price: "₹0/pcs",
    meta: "Included in fabric cost",
    attributes: [
      { key: "Type", value: "Digital sublimation" },
      { key: "Artwork", value: "Placement / allover" },
      { key: "Handfeel", value: "Soft" },
      { key: "Included", value: "In fabric" },
    ],
    patch: { reactivePrint: 0 },
    affectedNodes: ["print", "front-per-m", "front-pc", "fabric-sub"],
  },
  {
    id: "mc-garment-wash",
    name: "Garment Wash",
    tab: "Process",
    category: "Making",
    nodeId: "finish",
    price: "₹45/pcs",
    meta: "Soft wash · Per kg basis",
    attributes: [
      { key: "Type", value: "Soft wash" },
      { key: "Basis", value: "Per kg" },
      { key: "Finish", value: "Soft hand" },
    ],
    patch: { finishTransport: 45 },
    affectedNodes: ["finish", "front-per-m", "back-per-m", "fabric-sub"],
  },

  // ---------- Trims ----------
  {
    id: "mc-zip-nylon-3",
    name: "Zipper — Nylon #3",
    tab: "Trims",
    category: "Trims",
    nodeId: "trims",
    price: "₹14/pcs",
    meta: "Lightweight · Hidden closure",
    attributes: [
      { key: "Type", value: "Nylon #3" },
      { key: "Grade", value: "Standard" },
      { key: "Use", value: "Cushion closure" },
    ],
    tag: "budget",
    patch: { trimsLabels: 14 },
    affectedNodes: ["trims", "trims-pc", "making-sub"],
    contextTags: ["value"],
  },
  {
    id: "mc-zip-nylon-5",
    name: "Zipper — Nylon #5",
    tab: "Trims",
    category: "Trims",
    nodeId: "trims",
    price: "₹18/pcs",
    meta: "Standard · Various lengths",
    attributes: [
      { key: "Type", value: "Nylon #5" },
      { key: "Grade", value: "Standard" },
      { key: "Lengths", value: "Various" },
    ],
    tag: "recommended",
    patch: { trimsLabels: 18 },
    affectedNodes: ["trims", "trims-pc", "making-sub"],
  },
  {
    id: "mc-zip-metal-5",
    name: "Zipper — Metal #5",
    tab: "Trims",
    category: "Trims",
    nodeId: "trims",
    price: "₹28/pcs",
    meta: "Premium · Gold/Silver tone",
    attributes: [
      { key: "Type", value: "Metal #5" },
      { key: "Grade", value: "Premium" },
      { key: "Finish", value: "Gold / Silver" },
    ],
    tag: "premium",
    patch: { trimsLabels: 28 },
    affectedNodes: ["trims", "trims-pc", "making-sub"],
    contextTags: ["premium"],
  },
  {
    id: "mc-care-label",
    name: "Care Label — Standard",
    tab: "Trims",
    category: "Trims",
    nodeId: "trims",
    price: "₹4/pcs",
    meta: "Woven · OEKO-TEX compliant",
    attributes: [
      { key: "Type", value: "Woven" },
      { key: "Certification", value: "OEKO-TEX" },
    ],
    tag: "budget",
    patch: { trimsLabels: 4 },
    affectedNodes: ["trims", "trims-pc", "making-sub"],
    contextTags: ["value"],
  },
  {
    id: "mc-hang-tag-gots",
    name: "Hang Tag — GOTS",
    tab: "Trims",
    category: "Trims",
    nodeId: "trims",
    price: "₹6/pcs",
    meta: "Printed card · With string",
    attributes: [
      { key: "Type", value: "Printed card" },
      { key: "Certification", value: "GOTS" },
      { key: "Attachment", value: "String" },
    ],
    tag: "sustainable",
    patch: { trimsLabels: 6 },
    affectedNodes: ["trims", "trims-pc", "making-sub"],
    contextTags: ["sustainable"],
  },
  {
    id: "mc-pack-kraft",
    name: "Poly + Kraft Sleeve",
    tab: "Trims",
    category: "Trims",
    nodeId: "packaging",
    price: "₹5/pcs",
    meta: "Polybag · Kraft sleeve · 1 colour print",
    attributes: [
      { key: "Primary", value: "Polybag" },
      { key: "Secondary", value: "Kraft sleeve" },
      { key: "Printing", value: "1 colour" },
    ],
    tag: "recommended",
    patch: { packaging: 5 },
    affectedNodes: ["packaging", "packaging-pc", "making-sub"],
  },
  {
    id: "mc-pack-retail",
    name: "Retail-ready Printed Carton",
    tab: "Trims",
    category: "Trims",
    nodeId: "packaging",
    price: "₹18/pcs",
    meta: "4-colour offset · Tissue + belly-band",
    attributes: [
      { key: "Primary", value: "Printed carton" },
      { key: "Printing", value: "4 colour offset" },
      { key: "Insert", value: "Tissue + belly-band" },
    ],
    tag: "premium",
    patch: { packaging: 18 },
    affectedNodes: ["packaging", "packaging-pc", "making-sub"],
    contextTags: ["premium"],
  },
];

// Silence "unused" warning while keeping helper available for future callers.
export { catToTab };
