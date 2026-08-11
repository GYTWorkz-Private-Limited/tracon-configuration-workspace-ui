/**
 * Article Library — the master catalogue production teams pick from when
 * building a costing POD. Also holds the Tech Pack / Working Cost Sheet
 * ingestion fixtures used by the "Create New Article" flow.
 *
 * Structured so future work can layer on: re-quote from previous version,
 * clone article/kit, sync updates from a tech pack, diff tech pack versions
 * and an audit history of imported data (see `LibraryArticle.version` /
 * `techPackRef` / `lastSyncedAt`).
 */

import { IMG } from "./inquiries-data";
import placematImg from "@/assets/article-placemat.png";
import runnerImg from "@/assets/article-runner.png";
import napkinImg from "@/assets/article-napkin.png";

export type LibraryStatus = "active" | "draft" | "archived";

export type LibraryArticle = {
  id: string;
  name: string;
  articleNo: string;
  buyer: string;
  buyerRef: string;
  category: string;
  collection: string;
  season: string;
  status: LibraryStatus;
  image: string;
  size: string;
  moq: string;
  style: string;
  supplier: string;
  updatedAt: string;
  composition?: string;
  construction?: string;
  gsm?: string;
  colour?: string;
  /** future: re-quote / version diffing */
  version?: string;
  techPackRef?: string;
  lastSyncedAt?: string;
  estUnitCost?: number;
  estSellPrice?: number;
};

export const LIBRARY_ARTICLES: LibraryArticle[] = [
  {
    id: "LIB-1001",
    name: "Placemat",
    articleNo: "6939227",
    buyer: "Zara Home",
    buyerRef: "ZH-SS27-TBLTOP-01",
    category: "Table Top",
    collection: "Table Top Essentials",
    season: "SS27",
    status: "active",
    image: placematImg,
    size: '13" × 19"',
    moq: "3,000 pcs",
    style: "Printed / Mitred",
    supplier: "TESPL",
    updatedAt: "2h ago",
    composition: "100% Cotton",
    construction: "144 TC / Flat weave",
    gsm: "180 GSM",
    colour: "Warm / Multi",
    version: "v3",
    techPackRef: "TP-ZH-4471",
    lastSyncedAt: "27/03/2026",
    estUnitCost: 4.82,
    estSellPrice: 6.07,
  },
  {
    id: "LIB-1002",
    name: "Runner",
    articleNo: "6979727",
    buyer: "Zara Home",
    buyerRef: "ZH-SS27-TBLTOP-02",
    category: "Table Top",
    collection: "Table Top Essentials",
    season: "SS27",
    status: "active",
    image: runnerImg,
    size: '14" × 72"',
    moq: "1,500 pcs",
    style: "Printed / Hemmed",
    supplier: "TESPL",
    updatedAt: "2h ago",
    composition: "100% Cotton",
    construction: "144 TC / Flat weave",
    gsm: "180 GSM",
    colour: "Warm / Multi",
    version: "v2",
    techPackRef: "TP-ZH-4472",
    lastSyncedAt: "27/03/2026",
    estUnitCost: 9.4,
    estSellPrice: 11.85,
  },
  {
    id: "LIB-1003",
    name: "Napkin",
    articleNo: "6980227",
    buyer: "Zara Home",
    buyerRef: "ZH-SS27-TBLTOP-03",
    category: "Table Top",
    collection: "Table Top Essentials",
    season: "SS27",
    status: "active",
    image: napkinImg,
    size: '20" × 20"',
    moq: "6,000 pcs",
    style: "Solid / Double hem",
    supplier: "TESPL",
    updatedAt: "1d ago",
    composition: "100% Cotton",
    construction: "144 TC / Flat weave",
    gsm: "160 GSM",
    colour: "Cool / Multi",
    version: "v1",
    techPackRef: "TP-ZH-4473",
    lastSyncedAt: "27/03/2026",
    estUnitCost: 2.1,
    estSellPrice: 2.7,
  },
  {
    id: "LIB-1004",
    name: "Cushion Cover",
    articleNo: "5512044",
    buyer: "Zara Home",
    buyerRef: "ZH-AW26-CUSH-01",
    category: "Cushion Cover",
    collection: "Winter Living",
    season: "AW26",
    status: "active",
    image: IMG.cushion,
    size: "45×45 cm",
    moq: "1,000 pcs",
    style: "Embroidered",
    supplier: "TESPL",
    updatedAt: "3d ago",
    composition: "100% Cotton",
    construction: "Panama weave",
    gsm: "220 GSM",
    colour: "Ecru",
    version: "v4",
    techPackRef: "TP-ZH-4102",
    estUnitCost: 5.6,
    estSellPrice: 7.2,
  },
  {
    id: "LIB-1005",
    name: "Cushion Cover (Quilted)",
    articleNo: "5512088",
    buyer: "West Elm",
    buyerRef: "WE-AW26-HOME-11",
    category: "Cushion Cover",
    collection: "Textured Living",
    season: "AW26",
    status: "active",
    image: IMG.cushion,
    size: "40×40 cm",
    moq: "800 pcs",
    style: "Quilted",
    supplier: "Anantam",
    updatedAt: "5d ago",
    composition: "100% Cotton",
    gsm: "240 GSM",
    colour: "Slate",
    version: "v2",
    estUnitCost: 6.15,
    estSellPrice: 7.95,
  },
  {
    id: "LIB-1006",
    name: "Bath Towel",
    articleNo: "4410233",
    buyer: "IKEA",
    buyerRef: "IKEA-SS26-BATH-02",
    category: "Bath",
    collection: "Everyday Bath",
    season: "SS26",
    status: "active",
    image: IMG.towel,
    size: "70×140 cm",
    moq: "1,200 pcs",
    style: "Dobby border",
    supplier: "TESPL",
    updatedAt: "1w ago",
    composition: "100% Cotton",
    gsm: "500 GSM",
    colour: "White",
    version: "v6",
    techPackRef: "TP-IK-2210",
    estUnitCost: 7.3,
    estSellPrice: 9.1,
  },
  {
    id: "LIB-1007",
    name: "Hand Towel",
    articleNo: "4410244",
    buyer: "IKEA",
    buyerRef: "IKEA-SS26-BATH-03",
    category: "Bath",
    collection: "Everyday Bath",
    season: "SS26",
    status: "active",
    image: IMG.towel,
    size: "40×60 cm",
    moq: "2,000 pcs",
    style: "Dobby border",
    supplier: "TESPL",
    updatedAt: "1w ago",
    composition: "100% Cotton",
    gsm: "500 GSM",
    colour: "White",
    version: "v6",
    estUnitCost: 3.05,
    estSellPrice: 3.95,
  },
  {
    id: "LIB-1008",
    name: "Bath Mat",
    articleNo: "4410277",
    buyer: "IKEA",
    buyerRef: "IKEA-SS26-BATH-07",
    category: "Bath",
    collection: "Everyday Bath",
    season: "SS26",
    status: "draft",
    image: IMG.towel,
    size: "50×80 cm",
    moq: "900 pcs",
    style: "Tufted",
    supplier: "Anantam",
    updatedAt: "2w ago",
    composition: "100% Cotton",
    gsm: "1200 GSM",
    colour: "Grey",
    version: "v1",
    estUnitCost: 8.4,
    estSellPrice: 10.8,
  },
  {
    id: "LIB-1009",
    name: "Duvet Cover",
    articleNo: "7712001",
    buyer: "IKEA",
    buyerRef: "IKEA-SS26-BED-04",
    category: "Bedding",
    collection: "Percale Bedding",
    season: "SS26",
    status: "active",
    image: IMG.bedding,
    size: "220×240 cm",
    moq: "400 pcs",
    style: "Percale",
    supplier: "TESPL",
    updatedAt: "4d ago",
    composition: "100% Cotton",
    construction: "200 TC Percale",
    colour: "Off White",
    version: "v3",
    techPackRef: "TP-IK-2288",
    estUnitCost: 14.2,
    estSellPrice: 18.4,
  },
  {
    id: "LIB-1010",
    name: "Fitted Sheet",
    articleNo: "7712014",
    buyer: "IKEA",
    buyerRef: "IKEA-SS26-BED-05",
    category: "Bedding",
    collection: "Percale Bedding",
    season: "SS26",
    status: "active",
    image: IMG.bedding,
    size: "160×200 cm",
    moq: "500 pcs",
    style: "Percale",
    supplier: "TESPL",
    updatedAt: "4d ago",
    composition: "100% Cotton",
    construction: "200 TC Percale",
    colour: "Off White",
    version: "v3",
    estUnitCost: 9.8,
    estSellPrice: 12.6,
  },
  {
    id: "LIB-1011",
    name: "Pillow Cover",
    articleNo: "7712022",
    buyer: "IKEA",
    buyerRef: "IKEA-SS26-BED-06",
    category: "Bedding",
    collection: "Percale Bedding",
    season: "SS26",
    status: "active",
    image: IMG.bedding,
    size: "50×75 cm",
    moq: "1,000 pcs",
    style: "Percale",
    supplier: "TESPL",
    updatedAt: "4d ago",
    composition: "100% Cotton",
    colour: "Off White",
    version: "v3",
    estUnitCost: 3.4,
    estSellPrice: 4.35,
  },
  {
    id: "LIB-1012",
    name: "Quilt",
    articleNo: "7712099",
    buyer: "IKEA",
    buyerRef: "IKEA-SS26-BED-09",
    category: "Bedding",
    collection: "Percale Bedding",
    season: "SS26",
    status: "active",
    image: IMG.bedding,
    size: "230×250 cm",
    moq: "300 pcs",
    style: "Hand quilted",
    supplier: "Anantam",
    updatedAt: "6d ago",
    composition: "100% Cotton",
    colour: "Off White",
    version: "v2",
    estUnitCost: 22.5,
    estSellPrice: 28.9,
  },
  {
    id: "LIB-1013",
    name: "Throw Blanket",
    articleNo: "6620411",
    buyer: "West Elm",
    buyerRef: "WE-AW26-HOME-04",
    category: "Throw",
    collection: "Textured Living",
    season: "AW26",
    status: "active",
    image: IMG.throw,
    size: "130×170 cm",
    moq: "500 pcs",
    style: "Woven fringe",
    supplier: "Anantam",
    updatedAt: "1w ago",
    composition: "80% Cotton / 20% Wool",
    gsm: "380 GSM",
    colour: "Camel",
    version: "v5",
    estUnitCost: 18.1,
    estSellPrice: 23.4,
  },
  {
    id: "LIB-1014",
    name: "Curtain Panel",
    articleNo: "8830112",
    buyer: "West Elm",
    buyerRef: "WE-AW26-WIN-02",
    category: "Curtain",
    collection: "Window Story",
    season: "AW26",
    status: "archived",
    image: IMG.curtain,
    size: "140×240 cm",
    moq: "800 pcs",
    style: "Rod pocket",
    supplier: "TESPL",
    updatedAt: "1mo ago",
    composition: "100% Linen",
    gsm: "200 GSM",
    colour: "Natural",
    version: "v2",
    estUnitCost: 16.4,
    estSellPrice: 21.1,
  },
  {
    id: "LIB-1015",
    name: "Silk Scarf",
    articleNo: "9910044",
    buyer: "Zara Home",
    buyerRef: "ZH-SS27-ACC-01",
    category: "Accessory",
    collection: "Resort Accessories",
    season: "SS27",
    status: "draft",
    image: IMG.scarf,
    size: "90×90 cm",
    moq: "1,000 pcs",
    style: "Digital print",
    supplier: "Anantam",
    updatedAt: "3w ago",
    composition: "100% Silk",
    gsm: "16 mm",
    colour: "Multi",
    version: "v1",
    estUnitCost: 11.9,
    estSellPrice: 15.6,
  },
];

export const LIBRARY_FILTERS = {
  buyer: Array.from(new Set(LIBRARY_ARTICLES.map((a) => a.buyer))),
  category: Array.from(new Set(LIBRARY_ARTICLES.map((a) => a.category))),
  collection: Array.from(new Set(LIBRARY_ARTICLES.map((a) => a.collection))),
  season: Array.from(new Set(LIBRARY_ARTICLES.map((a) => a.season))),
  status: ["active", "draft", "archived"] as LibraryStatus[],
};

export const LIBRARY_STATUS_LABEL: Record<LibraryStatus, string> = {
  active: "Active",
  draft: "Draft",
  archived: "Archived",
};

/* ------------------------------------------------------------------ */
/* Tech Pack ingestion                                                 */
/* ------------------------------------------------------------------ */

export type TechPack = {
  id: string;
  fileName: string;
  buyer: string;
  season: string;
  pages: number;
  uploadedAt: string;
  version: string;
  image: string;
};

export const TECH_PACKS: TechPack[] = [
  {
    id: "TP-ZH-4471",
    fileName: "ZH_SS27_TableTop_Placemat_TechPack_v3.pdf",
    buyer: "Zara Home",
    season: "SS27",
    pages: 14,
    uploadedAt: "Today, 09:12",
    version: "v3",
    image: placematImg,
  },
  {
    id: "TP-IK-2288",
    fileName: "IKEA_SS26_Percale_DuvetCover_v3.pdf",
    buyer: "IKEA",
    season: "SS26",
    pages: 21,
    uploadedAt: "Yesterday",
    version: "v3",
    image: IMG.bedding,
  },
  {
    id: "TP-WE-1180",
    fileName: "WestElm_AW26_TexturedThrow_v5.pdf",
    buyer: "West Elm",
    season: "AW26",
    pages: 9,
    uploadedAt: "2 days ago",
    version: "v5",
    image: IMG.throw,
  },
];

export type ExtractedField = {
  key: string;
  label: string;
  value: string;
  confidence: number; // 0-1
  group: "commercial" | "product" | "construction" | "process" | "compliance";
};

/** Simulated AI extraction result for the selected tech pack. */
export function extractTechPack(tp: TechPack): ExtractedField[] {
  const zh = tp.buyer === "Zara Home";
  return [
    { key: "buyer", label: "Buyer", value: tp.buyer, confidence: 0.99, group: "commercial" },
    {
      key: "buyerRef",
      label: "Buyer Reference",
      value: zh ? "ZH-SS27-TBLTOP-01" : `${tp.buyer.slice(0, 2).toUpperCase()}-${tp.season}-REF-01`,
      confidence: 0.96,
      group: "commercial",
    },
    {
      key: "name",
      label: "Product Name",
      value: zh ? "Placemat" : (tp.fileName.split("_")[2] ?? "Article"),
      confidence: 0.94,
      group: "product",
    },
    {
      key: "articleNo",
      label: "Article Number",
      value: zh ? "6939227" : "7712001",
      confidence: 0.91,
      group: "product",
    },
    {
      key: "size",
      label: "Dimensions",
      value: zh ? '13" × 19"' : "220×240 cm",
      confidence: 0.97,
      group: "product",
    },
    {
      key: "construction",
      label: "Construction",
      value: zh ? "144 TC / Flat weave" : "200 TC Percale",
      confidence: 0.88,
      group: "construction",
    },
    {
      key: "gsm",
      label: "GSM",
      value: zh ? "180 GSM" : "110 GSM",
      confidence: 0.82,
      group: "construction",
    },
    {
      key: "composition",
      label: "Composition",
      value: "100% Cotton",
      confidence: 0.95,
      group: "construction",
    },
    {
      key: "colorways",
      label: "Colorways",
      value: zh ? "Warm / Multi, Cool / Multi" : "Off White, Sage",
      confidence: 0.79,
      group: "product",
    },
    {
      key: "fabricPlacement",
      label: "Fabric Placement",
      value: zh ? "Front: all over print · Back: solid ground" : "Face + reverse self",
      confidence: 0.71,
      group: "process",
    },
    {
      key: "printDetails",
      label: "Print Details",
      value: zh ? "Rotary print, 6 colours, repeat 32 cm" : "Not specified",
      confidence: zh ? 0.86 : 0.34,
      group: "process",
    },
    {
      key: "embroideryDetails",
      label: "Embroidery Details",
      value: zh ? "None" : "Single needle logo, 1,200 stitches",
      confidence: 0.58,
      group: "process",
    },
    {
      key: "accessories",
      label: "Accessories",
      value: zh ? "Woven main label, care label" : "Woven label, hangtag, cotton tape",
      confidence: 0.74,
      group: "process",
    },
    {
      key: "packaging",
      label: "Packaging Instructions",
      value: zh ? "Poly bag + belly band, 12 pcs/inner" : "Poly bag + gift box, 4 pcs/inner",
      confidence: 0.68,
      group: "compliance",
    },
    {
      key: "testing",
      label: "Testing Requirements",
      value: "OEKO-TEX 100, shrinkage ≤ 3%, colour fastness 4",
      confidence: 0.77,
      group: "compliance",
    },
    { key: "supplier", label: "Supplier", value: "TESPL", confidence: 0.64, group: "commercial" },
    {
      key: "moq",
      label: "MOQ",
      value: zh ? "3,000 pcs" : "400 pcs",
      confidence: 0.89,
      group: "commercial",
    },
    {
      key: "commercialNotes",
      label: "Commercial Notes",
      value: "Safe Guard · 60 days payment terms · FOB Mundra",
      confidence: 0.55,
      group: "commercial",
    },
  ];
}

export const EXTRACTION_STAGES = [
  "Reading tech pack pages",
  "Detecting spec tables",
  "Extracting construction & composition",
  "Reading process & packaging notes",
  "Validating against buyer master",
] as const;

/* ------------------------------------------------------------------ */
/* Working cost sheet import                                           */
/* ------------------------------------------------------------------ */

export type ColumnMapping = {
  source: string;
  target: string | null;
  sample: string;
  confidence: number;
};

export const COST_SHEET_FILES = [
  "XYZ-030-26-27_SS27_WorkingCostSheet.xlsx",
  "ZaraHome_TableTop_Costing_Mar26.xlsx",
  "IKEA_Percale_Bedding_Costing.xlsx",
];

export const COST_SHEET_MAPPINGS: ColumnMapping[] = [
  { source: "ART NO", target: "articleNo", sample: "6939227", confidence: 0.97 },
  { source: "DESCRIPTION", target: "name", sample: "Placemat — printed", confidence: 0.93 },
  { source: "SIZE (INCH)", target: "size", sample: '13" × 19"', confidence: 0.95 },
  { source: "MOQ", target: "moq", sample: "3000", confidence: 0.96 },
  { source: "COMPO", target: "composition", sample: "100% CTN", confidence: 0.88 },
  { source: "CONST", target: "construction", sample: "144TC", confidence: 0.85 },
  { source: "SUPP", target: "supplier", sample: "TESPL", confidence: 0.81 },
  { source: "CUR / EX", target: null, sample: "USD / 60.00", confidence: 0.42 },
  { source: "RMKS-2", target: null, sample: "Safe Guard 60 days", confidence: 0.31 },
];

export const MAPPING_TARGETS = [
  "articleNo",
  "name",
  "size",
  "moq",
  "composition",
  "construction",
  "supplier",
  "colour",
  "currency",
  "remarks",
  "ignore",
];

/* ------------------------------------------------------------------ */
/* Kits                                                               */
/* ------------------------------------------------------------------ */

export const KIT_PRESETS = [
  { name: "Bedding Set", categories: ["Bedding"] },
  { name: "Dining Set", categories: ["Table Top"] },
  { name: "Bathroom Collection", categories: ["Bath"] },
  { name: "Gift Set", categories: [] },
];
