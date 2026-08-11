// AI Commercial Intelligence — scenario data + deterministic recompute.
// Everything here is a UX mock: no real AI, no backend.

export type FieldGroup = "Fabric" | "Making" | "Accessories" | "Commercial";

export type FieldDef = {
  id: string;
  label: string;
  group: FieldGroup;
  options: { id: string; label: string; delta: number; note?: string }[];
  aiPick?: string;
  aiReason?: string;
};

export const FIELDS: FieldDef[] = [
  // Fabric
  {
    id: "front_fabric",
    label: "Front Fabric",
    group: "Fabric",
    aiPick: "cotton_500",
    aiReason: "Previously accepted by this buyer",
    options: [
      { id: "cotton_500", label: "Cotton 500 GSM", delta: 0, note: "Zero-twist, combed" },
      { id: "cotton_600", label: "Cotton 600 GSM", delta: 0.4 },
      { id: "cotton_blend", label: "Cotton/Bamboo 60/40", delta: 0.17, note: "OEKO-TEX" },
      { id: "cotton_450", label: "Cotton 450 GSM", delta: -0.32, note: "Saves $0.32" },
    ],
  },
  {
    id: "back_fabric",
    label: "Back Fabric",
    group: "Fabric",
    options: [
      { id: "percale_200", label: "Percale 200 TC", delta: 0 },
      { id: "sateen_300", label: "Sateen 300 TC", delta: 0.35 },
      { id: "muslin", label: "Muslin Voile", delta: -0.15 },
    ],
  },
  {
    id: "construction",
    label: "Construction",
    group: "Fabric",
    options: [
      { id: "waffle", label: "Waffle weave", delta: 0.1 },
      { id: "terry", label: "Terry loop", delta: 0 },
      { id: "jacquard", label: "Jacquard", delta: 0.3 },
    ],
  },
  {
    id: "gsm",
    label: "GSM",
    group: "Fabric",
    options: [
      { id: "450", label: "450 GSM", delta: -0.25 },
      { id: "500", label: "500 GSM", delta: 0 },
      { id: "600", label: "600 GSM", delta: 0.4 },
    ],
  },
  // Making
  {
    id: "printing",
    label: "Printing",
    group: "Making",
    options: [
      { id: "none", label: "None", delta: 0 },
      { id: "digital_1", label: "Digital 1-color", delta: 0.18 },
      { id: "screen_3", label: "Screen 3-color", delta: 0.28 },
    ],
  },
  {
    id: "embroidery",
    label: "Embroidery",
    group: "Making",
    options: [
      { id: "none", label: "None", delta: 0 },
      { id: "logo_3k", label: "Logo 3k stitches", delta: 0.22 },
      { id: "logo_8k", label: "Logo 8k stitches", delta: 0.42 },
    ],
  },
  {
    id: "quilting",
    label: "Quilting",
    group: "Making",
    options: [
      { id: "none", label: "None", delta: 0 },
      { id: "box_10", label: "Box quilting 10cm", delta: 0.28 },
      { id: "diamond", label: "Diamond quilting", delta: 0.34 },
    ],
  },
  {
    id: "filling",
    label: "Filling",
    group: "Making",
    options: [
      { id: "none", label: "None", delta: 0 },
      { id: "hollow_200", label: "Hollow-fiber 200 GSM", delta: 0.9 },
      { id: "down", label: "Down feather", delta: 1.6 },
    ],
  },
  {
    id: "piping",
    label: "Piping / Edge",
    group: "Making",
    options: [
      { id: "std", label: "Standard stitch", delta: 0 },
      { id: "corded", label: "Corded piping — Cream", delta: 0.18 },
      { id: "double", label: "Double-needle", delta: 0.13 },
    ],
  },
  // Accessories
  {
    id: "labels",
    label: "Labels",
    group: "Accessories",
    options: [
      { id: "woven", label: "Woven label", delta: 0.06 },
      { id: "printed", label: "Printed satin", delta: 0.03 },
      { id: "leather", label: "Leather patch", delta: 0.24 },
    ],
  },
  {
    id: "hangtags",
    label: "Hang Tags",
    group: "Accessories",
    options: [
      { id: "none", label: "None", delta: 0 },
      { id: "kraft", label: "Kraft hang tag", delta: 0.05 },
      { id: "coated", label: "Coated art card", delta: 0.09 },
    ],
  },
  {
    id: "packaging",
    label: "Packaging",
    group: "Accessories",
    options: [
      { id: "polybag", label: "Polybag", delta: 0.06 },
      { id: "kraft_sleeve", label: "Kraft sleeve", delta: 0.14 },
      { id: "retail_ready", label: "Retail-ready box", delta: 0.32 },
    ],
  },
  // Commercial
  {
    id: "testing",
    label: "Testing",
    group: "Commercial",
    options: [
      { id: "std", label: "Standard package", delta: 0.11 },
      { id: "full", label: "Full package", delta: 0.19 },
    ],
  },
  {
    id: "certifications",
    label: "Certifications",
    group: "Commercial",
    options: [
      { id: "oekotex", label: "OEKO-TEX", delta: 0.04 },
      { id: "oekotex_bci", label: "OEKO-TEX · BCI", delta: 0.09 },
      { id: "gots", label: "GOTS Organic", delta: 0.14 },
    ],
  },
  {
    id: "transportation",
    label: "Transportation",
    group: "Commercial",
    options: [
      { id: "fob", label: "FOB Nhava Sheva", delta: 0 },
      { id: "cif", label: "CIF Destination", delta: 0.34 },
      { id: "ddp", label: "DDP door", delta: 0.61 },
    ],
  },
  {
    id: "supplier",
    label: "Supplier",
    group: "Commercial",
    aiPick: "karur",
    aiReason: "96% on-time · 18 previous orders",
    options: [
      { id: "karur", label: "Karur Mills", delta: 0 },
      { id: "erode", label: "Erode Weaves", delta: 0.12 },
      { id: "panipat", label: "Panipat Textiles", delta: -0.22, note: "Longer lead time" },
    ],
  },
  {
    id: "moq",
    label: "MOQ",
    group: "Commercial",
    options: [
      { id: "1000", label: "1,000 pcs", delta: 0 },
      { id: "2500", label: "2,500 pcs", delta: -0.18 },
      { id: "5000", label: "5,000 pcs", delta: -0.32 },
    ],
  },
];

export type Selection = Record<string, string>;

export type Scenario = {
  id: string;
  name: string;
  tagline: string;
  kind:
    | "current"
    | "lowest"
    | "balanced"
    | "premium"
    | "value"
    | "sustainable"
    | "moq"
    | "fast"
    | "custom";
  recommended?: boolean;
  locked?: boolean;
  selection: Selection;
};

const BASE_COST = 5.35; // fixed base before deltas
const BASE_LEAD = 42;

export function defaultSelection(): Selection {
  const s: Selection = {};
  for (const f of FIELDS) s[f.id] = f.options[0].id;
  return s;
}

function mut(sel: Selection, patch: Selection): Selection {
  return { ...sel, ...patch };
}

export const DEFAULT_SCENARIOS: Scenario[] = [
  {
    id: "current",
    name: "Current",
    tagline: "As specified by buyer",
    kind: "current",
    selection: defaultSelection(),
  },
  {
    id: "lowest",
    name: "Lowest Cost",
    tagline: "Cost-first · trims non-essential features",
    kind: "lowest",
    selection: mut(defaultSelection(), {
      front_fabric: "cotton_450",
      embroidery: "none",
      hangtags: "none",
      packaging: "polybag",
      moq: "5000",
    }),
  },
  {
    id: "balanced",
    name: "Balanced",
    tagline: "AI recommended · best margin/risk trade-off",
    kind: "balanced",
    recommended: true,
    selection: mut(defaultSelection(), {
      moq: "2500",
      packaging: "kraft_sleeve",
      certifications: "oekotex_bci",
    }),
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "Best-in-class hand feel and finish",
    kind: "premium",
    selection: mut(defaultSelection(), {
      front_fabric: "cotton_600",
      construction: "jacquard",
      labels: "leather",
      packaging: "retail_ready",
      certifications: "gots",
    }),
  },
  {
    id: "value",
    name: "Value Engineered",
    tagline: "Keeps buyer-visible features, trims hidden cost",
    kind: "value",
    selection: mut(defaultSelection(), {
      back_fabric: "muslin",
      quilting: "none",
      packaging: "kraft_sleeve",
      moq: "2500",
    }),
  },
];

export const PRESETS: { id: Scenario["kind"]; name: string; tagline: string }[] = [
  { id: "lowest", name: "Lowest Cost", tagline: "Cost-first" },
  { id: "premium", name: "Premium", tagline: "Best-in-class finish" },
  { id: "value", name: "Value Engineered", tagline: "Trim hidden cost" },
  { id: "moq", name: "Highest MOQ", tagline: "Best price at scale" },
  { id: "sustainable", name: "Sustainable", tagline: "GOTS + recycled packaging" },
  { id: "fast", name: "Fastest Delivery", tagline: "Cuts lead-time 30%" },
  { id: "custom", name: "Blank Custom", tagline: "Start from defaults" },
];

export type Metrics = {
  material: number;
  making: number;
  packaging: number;
  testing: number;
  transportation: number;
  overheads: number;
  totalCost: number;
  sellingPrice: number;
  profit: number;
  margin: number;
  leadTime: number;
  confidence: number;
  winProbability: number;
  health: "Strong" | "Watch" | "At Risk";
};

const TARGET_PRICE = 8.5;

export function computeMetrics(sel: Selection): Metrics {
  const groupCost: Record<FieldGroup, number> = {
    Fabric: 0,
    Making: 0,
    Accessories: 0,
    Commercial: 0,
  };
  for (const f of FIELDS) {
    const opt = f.options.find((o) => o.id === sel[f.id]) ?? f.options[0];
    groupCost[f.group] += opt.delta;
  }
  const material = 3.95 + groupCost.Fabric;
  const making = 0.42 + groupCost.Making;
  const packaging =
    0.18 +
    (groupCost.Accessories -
      (FIELDS.find((f) => f.id === "labels")!.options.find((o) => o.id === sel.labels)?.delta ??
        0));
  const labelsCost =
    FIELDS.find((f) => f.id === "labels")!.options.find((o) => o.id === sel.labels)?.delta ?? 0;
  const testing =
    FIELDS.find((f) => f.id === "testing")!.options.find((o) => o.id === sel.testing)?.delta ?? 0;
  const cert =
    FIELDS.find((f) => f.id === "certifications")!.options.find((o) => o.id === sel.certifications)
      ?.delta ?? 0;
  const trans =
    FIELDS.find((f) => f.id === "transportation")!.options.find((o) => o.id === sel.transportation)
      ?.delta ?? 0;
  const supplierDelta =
    FIELDS.find((f) => f.id === "supplier")!.options.find((o) => o.id === sel.supplier)?.delta ?? 0;
  const moqDelta =
    FIELDS.find((f) => f.id === "moq")!.options.find((o) => o.id === sel.moq)?.delta ?? 0;

  const totalCost = Math.max(
    2,
    BASE_COST +
      material -
      3.95 +
      making +
      packaging +
      labelsCost +
      testing +
      cert +
      trans +
      supplierDelta +
      moqDelta,
  );
  const sellingPrice = Math.max(
    totalCost + 0.4,
    TARGET_PRICE - 0.85 + (BASE_COST - totalCost) * -0.3,
  );
  const overheads = totalCost * 0.12;
  const profit = sellingPrice - totalCost;
  const margin = (profit / sellingPrice) * 100;
  const leadTime =
    BASE_LEAD +
    (sel.supplier === "panipat" ? 6 : 0) +
    (sel.moq === "5000" ? 8 : 0) -
    (sel.moq === "1000" ? 4 : 0);
  const confidence = Math.max(
    55,
    Math.min(96, Math.round(72 + margin * 0.6 - (sel.supplier === "panipat" ? 8 : 0))),
  );
  const winProbability = Math.max(
    35,
    Math.min(
      94,
      Math.round(
        60 + (sellingPrice < TARGET_PRICE ? 15 : -8) + (sel.certifications === "gots" ? 6 : 0),
      ),
    ),
  );
  const health: Metrics["health"] = margin >= 20 ? "Strong" : margin >= 12 ? "Watch" : "At Risk";

  return {
    material: round(material),
    making: round(making + labelsCost * 0.2),
    packaging: round(packaging + labelsCost * 0.8),
    testing: round(testing + cert),
    transportation: round(trans),
    overheads: round(overheads),
    totalCost: round(totalCost),
    sellingPrice: round(sellingPrice),
    profit: round(profit),
    margin: Math.round(margin * 10) / 10,
    leadTime,
    confidence,
    winProbability,
    health,
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

export function costRows(m: Metrics) {
  const base = m.totalCost;
  return [
    { key: "material", label: "Material", value: m.material, color: "#05604d" },
    { key: "making", label: "Making", value: m.making, color: "#2d8f7a" },
    { key: "packaging", label: "Packaging", value: m.packaging, color: "#c69324" },
    { key: "testing", label: "Testing", value: m.testing, color: "#7A5230" },
    { key: "transportation", label: "Transportation", value: m.transportation, color: "#4d5651" },
    { key: "overheads", label: "Overheads", value: m.overheads, color: "#0a7460" },
  ].map((r) => ({ ...r, pct: base > 0 ? Math.round((r.value / base) * 100) : 0 }));
}
