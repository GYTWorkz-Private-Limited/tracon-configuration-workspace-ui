/**
 * Configuration workspace model.
 *
 * Modules (Fabric … Packaging) → sections → cards. Each card is a summary node;
 * editing happens in the right drawer. Values are seeded from the JCP costing
 * sheet (Placemat / Runner / Napkin) wherever the Excel provides them.
 */

export type CardOption = {
  id: string;
  label: string;
  meta?: string;
  /** rate in the card's unit; 0 = no cost impact */
  rate?: number;
  recommended?: boolean;
  reasons?: string[];
  extras?: { label: string; value: string }[];
};

export type CardKind = "options" | "number" | "text" | "readonly";
export type Unit = "perM" | "perPc" | "perDot" | "perKg" | "none";

export type CardDef = {
  id: string;
  label: string;
  section: string;
  kind: CardKind;
  unit?: Unit;
  suffix?: string;
  options?: CardOption[];
  /** which computed metric a readonly card renders */
  metric?: "consumption" | "requiredMeter" | "fabricPerM" | "costPerPiece" | "fabricTotal";
  /** readonly card is considered configured even when the metric is ₹0.00 */
  zeroOk?: boolean;
  /** accessory cards use the cost + supplier + notes drawer */
  accessory?: boolean;
  /** summary card mirrors another module's total */
  summaryOf?: ModuleId;
  ai?: boolean;
  /** shown on the card when `ai` is set — why AI is suggesting this node */
  aiReason?: string;
  hint?: string;
  /** required before moving to the next step — renders a red dot on the card */
  mandatory?: boolean;
};

export type SectionDef = { id: string; label: string; readOnly?: boolean };

export const SECTIONS: SectionDef[] = [
  { id: "basic", label: "Basic Fabric" },
  { id: "cut", label: "Cut Size" },
  { id: "process", label: "Fabric Process" },
  { id: "technical", label: "Technical" },
  { id: "calc", label: "Calculations", readOnly: true },
  { id: "total", label: "Fabric Total", readOnly: true },
  { id: "grand", label: "Grand Total", readOnly: true },
];

export const MODULES = [
  { id: "fabric", label: "Fabric" },
  { id: "printing", label: "Printing" },
  { id: "embroidery", label: "Embroidery" },
  { id: "washing", label: "Washing" },
  { id: "manufacturing", label: "Manufacturing" },
  { id: "accessories", label: "Accessories" },
  { id: "packaging", label: "Packaging" },
  { id: "testing", label: "Testing" },
  { id: "certification", label: "Certification" },
  { id: "summary", label: "Summary" },
] as const;

export type ModuleId = (typeof MODULES)[number]["id"];

const suppliers: CardOption[] = [
  {
    id: "tespl",
    label: "TESPL Textiles",
    meta: "Preferred supplier · Karur",
    rate: 141.28,
    extras: [
      { label: "On-time delivery", value: "98%" },
      { label: "Lead time", value: "45 days" },
      { label: "MOQ", value: "500 mtr" },
      { label: "Payment terms", value: "30 days" },
    ],
  },
  {
    id: "mafatlal",
    label: "Mafatlal Mills",
    meta: "Saves ₹2.45 / piece (2.6%)",
    rate: 137.5,
    recommended: true,
    reasons: ["Lowest cost", "Better lead time", "Lower wastage"],
    extras: [
      { label: "On-time delivery", value: "96%" },
      { label: "Lead time", value: "30 days" },
      { label: "MOQ", value: "1,000 mtr" },
      { label: "Payment terms", value: "45 days" },
    ],
  },
  {
    id: "nahar",
    label: "Nahar Textiles",
    meta: "Saves ₹1.80 / piece (1.9%)",
    rate: 139.0,
    recommended: true,
    reasons: ["Higher yield", "Preferred supplier"],
    extras: [
      { label: "On-time delivery", value: "94%" },
      { label: "Lead time", value: "40 days" },
      { label: "MOQ", value: "800 mtr" },
      { label: "Payment terms", value: "30 days" },
    ],
  },
  {
    id: "siyaram",
    label: "Siyaram Textiles",
    meta: "Saves ₹0.30 / piece (0.3%)",
    rate: 142.2,
    extras: [
      { label: "On-time delivery", value: "97%" },
      { label: "Lead time", value: "50 days" },
      { label: "MOQ", value: "1,200 mtr" },
      { label: "Payment terms", value: "60 days" },
    ],
  },
];

const opt = (label: string, meta?: string, rate?: number): CardOption => ({
  id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  label,
  meta,
  rate,
});

export const FABRIC_CARDS: CardDef[] = [
  // Basic fabric
  {
    id: "supplier",
    label: "Supplier",
    section: "basic",
    kind: "options",
    unit: "perM",
    options: suppliers,
    mandatory: true,
    ai: true,
    aiReason:
      "Mafatlal Mills matches the same quality band at ₹137.50 / m — lowest landed cost at MOQ 4,800.",
    hint: "Fabric supplier sets the base ₹ / metre.",
  },
  {
    id: "fabricQuality",
    label: "Fabric Quality",
    section: "basic",
    kind: "options",
    unit: "perM",
    mandatory: true,
    options: [
      opt("10s × 6s : 76 × 28", "300 GSM · cost sheet", 8),
      opt("20s × 20s : 60 × 60", "144 TC · lighter hand", 12),
      opt("30s × 30s : 76 × 68", "200 TC · finer yarn", 17),
    ],
    ai: true,
    aiReason: "10s × 6s : 76 × 28 hits the 300 GSM buyer spec with the least yarn waste.",
  },
  {
    id: "fabricType",
    label: "Fabric Type",
    section: "basic",
    kind: "options",
    unit: "perM",
    mandatory: true,
    options: [
      opt("Woven", "Loom base rate", 6),
      opt("Knitted", "Circular knit", 9),
      opt("Non-woven", "Bonded web", 4),
    ],
  },
  {
    id: "construction",
    label: "Fabric Construction",
    section: "basic",
    kind: "options",
    unit: "perM",
    mandatory: true,
    options: [
      opt("Plain Weave", "Standard loom", 5),
      opt("Twill", "Higher pick rate", 8),
      opt("Satin", "Slower loom speed", 11),
      opt("Dobby", "Jacquard attachment", 14),
    ],
  },
  {
    id: "greigeWidth",
    label: "Greige Width",
    section: "basic",
    kind: "number",
    suffix: "in",
    mandatory: true,
  },
  {
    id: "finishedWidth",
    label: "Finished Width",
    section: "basic",
    kind: "number",
    suffix: "in",
    mandatory: true,
  },
  { id: "fabricWidth", label: "Fabric Width", section: "basic", kind: "number", suffix: "in" },
  {
    id: "gsm",
    label: "GSM",
    section: "basic",
    kind: "options",
    unit: "perM",
    mandatory: true,
    options: [
      opt("200 GSM", "Lighter weight", 5),
      opt("250 GSM", "Mid weight", 8),
      opt("300 GSM", "Cost sheet spec", 12),
      opt("350 GSM", "Heavier hand", 16),
    ],
  },
  { id: "count", label: "Count", section: "basic", kind: "text", mandatory: true },
  { id: "colour", label: "Colour", section: "basic", kind: "text", mandatory: true },
  {
    id: "composition",
    label: "Composition",
    section: "basic",
    kind: "options",
    unit: "perM",
    mandatory: true,
    options: [
      opt("100% Cotton", "Conventional yarn", 9),
      opt("Organic Cotton", "+8% rate · certified", 18),
      opt("Cotton / Linen 70:30", "Linen blend", 24),
    ],
  },

  // Cut size
  {
    id: "cutWidth",
    label: "Cut Width",
    section: "cut",
    kind: "number",
    suffix: "in",
    mandatory: true,
  },
  {
    id: "cutLength",
    label: "Cut Length",
    section: "cut",
    kind: "number",
    suffix: "in",
    mandatory: true,
  },
  { id: "bitsMarker", label: "Bits / Marker", section: "cut", kind: "number", mandatory: true },
  {
    id: "widthUsed",
    label: "Fabric Width Used",
    section: "cut",
    kind: "number",
    suffix: "in",
    mandatory: true,
  },

  // Process
  {
    id: "dyeing",
    label: "Dyeing Method",
    section: "process",
    kind: "options",
    unit: "perM",
    mandatory: true,
    ai: true,
    aiReason:
      "Reactive dyeing is the only method that clears the buyer’s wash-fastness standard on this shade.",
    options: [
      {
        ...opt("Reactive Dyeing", "Best fastness", 22),
        recommended: true,
        reasons: ["Best colour fastness", "Buyer approved"],
      },
      opt("Pigment Dyeing", "Lower fastness", 14),
      opt("Vat Dyeing", "Deep shades", 38),
    ],
  },
  {
    id: "printingMethod",
    label: "Printing Method",
    section: "process",
    kind: "options",
    unit: "perM",
    mandatory: true,
    ai: true,
    aiReason:
      "Digital printing avoids screen setup, which is the cheapest route at this order quantity.",
    options: [
      {
        ...opt("Digital Printing", "No screens · short runs", 38),
        recommended: true,
        reasons: ["Lowest setup at MOQ 4,800", "Higher yield"],
      },
      opt("Rotary Screen", "Volume runs", 26),
      opt("Flat Bed Screen", "Large repeats", 31),
    ],
  },
  {
    id: "printingType",
    label: "Printing Type",
    section: "process",
    kind: "options",
    unit: "perM",
    options: [
      opt("Pigment", undefined, 0),
      opt("Reactive", undefined, 6),
      opt("Discharge", undefined, 9),
    ],
  },
  {
    id: "screenDigital",
    label: "Screen Printing / Digital",
    section: "process",
    kind: "options",
    options: [opt("Digital"), opt("Screen")],
  },
  {
    id: "specialProcess",
    label: "Special Process",
    section: "process",
    kind: "options",
    unit: "perM",
    options: [opt("None", undefined, 0), opt("Foil", undefined, 12), opt("Flock", undefined, 9)],
  },
  {
    id: "handProcess",
    label: "Hand Process",
    section: "process",
    kind: "options",
    unit: "perM",
    options: [opt("None", undefined, 0), opt("Hand Block", undefined, 18)],
  },
  {
    id: "tubWash",
    label: "Tub Wash",
    section: "process",
    kind: "options",
    unit: "perM",
    options: [opt("No", undefined, 0), opt("Yes", "Softer hand", 7)],
  },
  {
    id: "transport",
    label: "Transport Required",
    section: "process",
    kind: "options",
    unit: "perM",
    options: [opt("No", undefined, 0), opt("Yes", "Mill → unit freight", 7)],
  },

  // Technical
  { id: "warp", label: "Warp", section: "technical", kind: "text", mandatory: true },
  { id: "weft", label: "Weft", section: "technical", kind: "text", mandatory: true },
  { id: "reedPick", label: "Reed / Pick", section: "technical", kind: "text" },
  { id: "hankWeight", label: "Hank Weight", section: "technical", kind: "text" },
  { id: "bundleWeight", label: "Bundle Weight", section: "technical", kind: "text" },
  {
    id: "twisting",
    label: "Twisting",
    section: "technical",
    kind: "options",
    options: [opt("No"), opt("Yes")],
  },
  {
    id: "weaving",
    label: "Weaving",
    section: "technical",
    kind: "options",
    mandatory: true,
    options: [opt("Plain Weave"), opt("Twill Weave")],
    ai: true,
    aiReason: "Plain weave keeps the loom rate low and matches the approved handfeel sample.",
  },

  // Calculations
  {
    id: "consumption",
    label: "Consumption",
    section: "calc",
    kind: "readonly",
    metric: "consumption",
  },
  { id: "shrinkage", label: "Shrinkage %", section: "calc", kind: "number", suffix: "%" },
  { id: "wastage", label: "Wastage %", section: "calc", kind: "number", suffix: "%" },
  {
    id: "requiredMeter",
    label: "Required Meter",
    section: "calc",
    kind: "readonly",
    metric: "requiredMeter",
  },

  // Fabric total
  {
    id: "fabricPerM",
    label: "Fabric Cost / Meter",
    section: "total",
    kind: "readonly",
    metric: "fabricPerM",
  },
  {
    id: "costPerPiece",
    label: "Cost / Piece",
    section: "total",
    kind: "readonly",
    metric: "costPerPiece",
  },
  {
    id: "fabricTotal",
    label: "Fabric Total",
    section: "total",
    kind: "readonly",
    metric: "fabricTotal",
  },
];

/* ------------------------------------------------------------------ *
 * Printing module — same card workflow, printing content
 * ------------------------------------------------------------------ */

export const PRINTING_SECTIONS: SectionDef[] = [
  { id: "pbasic", label: "Print Basics" },
  { id: "pdesign", label: "Design" },
  { id: "pprocess", label: "Print Process" },
  { id: "pcalc", label: "Calculations" },
  { id: "ptotal", label: "Printing Total", readOnly: true },
  { id: "grand", label: "Grand Total", readOnly: true },
];

export const PRINTING_CARDS: CardDef[] = [
  // Print basics
  {
    id: "printVendor",
    label: "Print Vendor",
    section: "pbasic",
    kind: "options",
    unit: "perM",
    mandatory: true,
    ai: true,
    aiReason:
      "Sunrise Prints holds the buyer’s approved strike-off and quotes ₹34 / m at this width.",
    hint: "Vendor sets the base print rate per metre.",
    options: [
      {
        ...opt("Sunrise Prints", "Approved strike-off · Karur", 34),
        recommended: true,
        reasons: ["Buyer approved", "Lowest rate"],
        extras: [
          { label: "On-time delivery", value: "97%" },
          { label: "Lead time", value: "12 days" },
          { label: "MOQ", value: "600 mtr" },
          { label: "Repeat capacity", value: "64 cm" },
        ],
      },
      opt("Veeyes Processing", "Rotary specialist", 29),
      opt("Colourtex Digital", "Short runs", 41),
    ],
  },
  {
    id: "printTech",
    label: "Print Technique",
    section: "pbasic",
    kind: "options",
    unit: "perM",
    mandatory: true,
    ai: true,
    aiReason: "Digital avoids screen setup — cheapest route at MOQ 4,800 with a 6-colour design.",
    options: [
      {
        ...opt("Digital Inkjet", "No screens · short runs", 18),
        recommended: true,
        reasons: ["No setup cost", "Unlimited colours"],
      },
      opt("Rotary Screen", "Volume runs", 11),
      opt("Flat Bed Screen", "Large repeats", 14),
    ],
  },
  {
    id: "printInk",
    label: "Ink Type",
    section: "pbasic",
    kind: "options",
    unit: "perM",
    mandatory: true,
    options: [
      opt("Pigment", "Standard", 0),
      opt("Reactive", "Best fastness", 6),
      opt("Discharge", "Dark grounds", 9),
    ],
  },
  {
    id: "printColours",
    label: "No. of Colours",
    section: "pbasic",
    kind: "number",
    mandatory: true,
  },
  {
    id: "printScreens",
    label: "Number of Screens",
    section: "pbasic",
    kind: "number",
    hint: "Screens engraved for this design — e.g. 4, 6, 8, 10.",
  },

  // Design
  {
    id: "designRef",
    label: "Design Reference",
    section: "pdesign",
    kind: "options",
    unit: "perM",
    mandatory: true,
    hint: "Artwork / template drives the engraving and colour-matching charge.",
    options: [
      opt("DSG-4471 · Botanic Stripe", "6 colours · buyer approved", 4),
      opt("DSG-2210 · Geo Grid", "4 colours · library artwork", 2),
      opt("DSG-5590 · Floral Bloom", "8 colours · new development", 7),
      opt("Buyer supplied artwork", "Colour separation required", 5),
    ],
  },

  {
    id: "repeatSize",
    label: "Repeat Size",
    section: "pdesign",
    kind: "number",
    suffix: "cm",
    mandatory: true,
  },
  {
    id: "coverage",
    label: "Coverage %",
    section: "pdesign",
    kind: "number",
    suffix: "%",
    mandatory: true,
  },
  {
    id: "placement",
    label: "Placement",
    section: "pdesign",
    kind: "options",
    mandatory: true,
    options: [opt("All-over"), opt("Border"), opt("Panel / Engineered")],
  },

  // Print process
  {
    id: "curing",
    label: "Curing / Fixation",
    section: "pprocess",
    kind: "options",
    unit: "perM",
    mandatory: true,
    ai: true,
    aiReason:
      "Steam fixation is required for reactive inks to clear the buyer’s wash-fastness spec.",
    options: [
      {
        ...opt("Steam Fixation", "Required for reactive", 5),
        recommended: true,
        reasons: ["Buyer wash standard"],
      },
      opt("Thermal Cure", "Pigment inks", 3),
    ],
  },
  {
    id: "postWash",
    label: "Post-print Wash",
    section: "pprocess",
    kind: "options",
    unit: "perM",
    mandatory: true,
    options: [opt("No", undefined, 0), opt("Yes", "Removes thickener", 6)],
  },
  {
    id: "softener",
    label: "Softener Finish",
    section: "pprocess",
    kind: "options",
    unit: "perM",
    options: [
      opt("None", "No finish", 0),
      opt("Silicone", "Softer hand", 4),
      opt("Hydrophilic Softener", "Absorbency retained", 6),
      opt("Enzyme Finish", "Peached surface", 8),
    ],
  },
  {
    id: "strikeOff",
    label: "Strike-off / Sampling",
    section: "pprocess",
    kind: "options",
    unit: "perM",
    mandatory: true,
    options: [opt("Approved", undefined, 0), opt("Pending", "Adds ₹3 / m amortised", 3)],
  },
  {
    id: "screenCost",
    label: "Screen Cost",
    section: "pprocess",
    kind: "number",
    suffix: "₹",
    hint: "One-time engraving charge, e.g. ₹1200.",
  },

  // Calculations
  {
    id: "printConsumption",
    label: "Consumption",
    section: "pcalc",
    kind: "readonly",
    metric: "consumption",
  },
  { id: "printWastage", label: "Print Wastage %", section: "pcalc", kind: "number", suffix: "%" },
  {
    id: "printRequired",
    label: "Required Meter",
    section: "pcalc",
    kind: "readonly",
    metric: "requiredMeter",
  },

  // Printing total
  {
    id: "printPerM",
    label: "Print Cost / Meter",
    section: "ptotal",
    kind: "readonly",
    metric: "fabricPerM",
  },
  {
    id: "printPerPiece",
    label: "Cost / Piece",
    section: "ptotal",
    kind: "readonly",
    metric: "costPerPiece",
  },
  {
    id: "printTotal",
    label: "Printing Total",
    section: "ptotal",
    kind: "readonly",
    metric: "fabricTotal",
  },
];

/* ------------------------------------------------------------------ *
 * Embroidery module
 * ------------------------------------------------------------------ */

export const EMBROIDERY_SECTIONS: SectionDef[] = [
  { id: "esetup", label: "Embroidery Setup" },
  { id: "edetails", label: "Embroidery Details" },
  { id: "eparams", label: "Parameters" },
  { id: "ecalc", label: "Calculated Output", readOnly: true },
  { id: "grand", label: "Embroidery Total", readOnly: true },
];

export const EMBROIDERY_CARDS: CardDef[] = [
  {
    id: "embSupplier",
    label: "Embroidery Supplier",
    section: "esetup",
    kind: "options",
    unit: "perDot",
    mandatory: true,
    ai: true,
    aiReason:
      "TESPL runs the approved computer-embroidery head count in-house — no external freight or lead-time risk.",
    hint: "Embroidery supplier sets the per-dot rate and lead time.",
    options: [
      {
        ...opt("TESPL", "In-house unit · Karur", 0),
        recommended: true,
        reasons: ["In-house capacity", "No freight"],
        extras: [
          { label: "On-time delivery", value: "98%" },
          { label: "Lead time", value: "8 days" },
          { label: "Cost", value: "₹0.00 / dot" },
        ],
      },
      {
        ...opt("Sri Embroidery Works", "External · Tirupur", 0.06),
        extras: [
          { label: "On-time delivery", value: "93%" },
          { label: "Lead time", value: "14 days" },
          { label: "Cost", value: "₹0.06 / dot" },
        ],
      },
      {
        ...opt("Zari Craft", "Hand + machine", 0.09),
        extras: [
          { label: "On-time delivery", value: "90%" },
          { label: "Lead time", value: "18 days" },
          { label: "Cost", value: "₹0.09 / dot" },
        ],
      },
    ],
  },
  {
    id: "embType",
    label: "Embroidery Type",
    section: "esetup",
    kind: "options",
    unit: "perDot",
    mandatory: true,
    hint: "Technique drives the per-dot machine rate.",
    options: [
      { ...opt("Computer Embroidery", "Cost sheet · standard heads", 0), recommended: true },
      opt("Hand Embroidery", "Artisanal · slower output", 0.12),
      opt("Applique", "Patch + stitch", 0.18),
    ],
  },

  {
    id: "embDots",
    label: "Number of Embroidery Dots",
    section: "edetails",
    kind: "number",
    mandatory: true,
  },
  {
    id: "embPerDot",
    label: "Per Dot Cost",
    section: "edetails",
    kind: "number",
    suffix: "₹",
    mandatory: true,
  },

  { id: "embWastage", label: "Wastage", section: "eparams", kind: "number", suffix: "%" },

  {
    id: "embTotalCost",
    label: "Total Embroidery Cost",
    section: "ecalc",
    kind: "readonly",
    metric: "costPerPiece",
    zeroOk: true,
  },
];

/** Cost-sheet defaults for embroidery. */
export const EMBROIDERY_SEED: ConfigState = {
  embSupplier: { value: "TESPL", optionId: "tespl", rate: 0 },
  embType: { value: "Computer Embroidery", optionId: "computer-embroidery", rate: 0 },
  embDots: { value: "0" },
  embPerDot: { value: "0.00" },
  embWastage: { value: "0" },
};

/* ------------------------------------------------------------------ *
 * Washing module
 * ------------------------------------------------------------------ */

export const WASHING_SECTIONS: SectionDef[] = [
  { id: "wsetup", label: "Washing Setup" },
  { id: "wdetails", label: "Washing Details" },
  { id: "wcalc", label: "Calculated Output", readOnly: true },
  { id: "grand", label: "Washing Total", readOnly: true },
];

export const WASHING_CARDS: CardDef[] = [
  {
    id: "washSupplier",
    label: "Washing Supplier",
    section: "wsetup",
    kind: "options",
    unit: "perKg",
    mandatory: true,
    ai: true,
    aiReason: "TESPL’s in-house wash line holds the buyer’s shade band, avoiding re-wash risk.",
    hint: "Washing supplier sets the ₹ / kg rate.",
    options: [
      {
        ...opt("TESPL", "In-house wash line · Karur", 0),
        recommended: true,
        reasons: ["In-house capacity", "Shade consistency"],
        extras: [
          { label: "On-time delivery", value: "98%" },
          { label: "Lead time", value: "5 days" },
          { label: "Cost", value: "₹0.00 / kg" },
        ],
      },
      opt("Aqua Processors", "External · Erode", 4.5),
      opt("Blue Wave Wash", "Enzyme specialist", 6.0),
    ],
  },
  {
    id: "washType",
    label: "Washing Type",
    section: "wsetup",
    kind: "options",
    unit: "perKg",
    mandatory: true,
    hint: "Wash type sets the base ₹ / kg processing rate.",
    options: [
      { ...opt("Normal Wash", "Cost sheet · standard", 0), recommended: true },
      opt("Enzyme Wash", "Softer hand feel", 5.5),
      opt("Softener Wash", "Buyer hand-feel spec", 3.75),
    ],
  },
  {
    id: "washRecipe",
    label: "Washing Process / Recipe",
    section: "wsetup",
    kind: "options",
    unit: "perKg",
    hint: "Recipe applied on the wash line — drives chemical cost per kg.",
    options: [
      { ...opt("Standard Recipe", "Cost sheet · base chemicals", 0), recommended: true },
      opt("Silicone Wash", "Premium hand feel", 7.0),
      opt("Enzyme + Softener", "Two-stage recipe", 8.5),
      opt("Bio-polish", "Low pilling finish", 6.25),
    ],
  },

  {
    id: "washPerKg",
    label: "Per KG Cost",
    section: "wdetails",
    kind: "number",
    suffix: "₹",
    mandatory: true,
  },
  {
    id: "washWeightPerPcs",
    label: "Weight Per Piece",
    section: "wdetails",
    kind: "number",
    suffix: "kg",
    mandatory: true,
  },

  {
    id: "washCostPerPcs",
    label: "Washing Cost Per PCS",
    section: "wcalc",
    kind: "readonly",
    metric: "costPerPiece",
    zeroOk: true,
  },
];

export const WASHING_SEED: ConfigState = {
  washSupplier: { value: "TESPL", optionId: "tespl", rate: 0 },
  washType: { value: "Normal Wash", optionId: "normal-wash", rate: 0 },
  washRecipe: { value: "Standard Recipe", optionId: "standard-recipe", rate: 0 },
  washPerKg: { value: "0.00" },
  washWeightPerPcs: { value: "0.00" },
};

/* ------------------------------------------------------------------ *
 * Manufacturing module
 * ------------------------------------------------------------------ */

export const MANUFACTURING_SECTIONS: SectionDef[] = [
  { id: "mops", label: "Manufacturing Operations" },
  { id: "grand", label: "Manufacturing Total", readOnly: true },
];

export const MANUFACTURING_CARDS: CardDef[] = [
  {
    id: "mfgCutting",
    label: "Cutting Cost",
    section: "mops",
    kind: "number",
    suffix: "₹",
    unit: "perPc",
    mandatory: true,
    hint: "Cutting operation cost per piece.",
  },
  {
    id: "mfgStitching",
    label: "Stitching Cost",
    section: "mops",
    kind: "number",
    suffix: "₹",
    unit: "perPc",
    mandatory: true,
    hint: "Stitching operation cost per piece.",
  },
  {
    id: "mfgHemming",
    label: "Hemming / Edge Finish",
    section: "mops",
    kind: "number",
    suffix: "₹",
    unit: "perPc",
    hint: "Hemming or edge-finish operation cost per piece.",
  },
];

export const MANUFACTURING_SEED: ConfigState = {
  mfgCutting: { value: "1.00" },
  mfgStitching: { value: "3.00" },
  mfgHemming: { value: "0.60" },
};

/* ------------------------------------------------------------------ *
 * Accessories module
 * ------------------------------------------------------------------ */

export const ACCESSORIES_SECTIONS: SectionDef[] = [
  { id: "acc", label: "Accessories" },
  { id: "grand", label: "Accessories Total", readOnly: true },
];

export const ACCESSORIES_CARDS: CardDef[] = [
  {
    id: "accZipper",
    label: "Zipper Cost",
    section: "acc",
    kind: "number",
    suffix: "₹",
    unit: "perPc",
    accessory: true,
  },
  {
    id: "accFusingProcess",
    label: "Fusing Process Cost",
    section: "acc",
    kind: "number",
    suffix: "₹",
    unit: "perPc",
    accessory: true,
  },
  {
    id: "accHandQuilting",
    label: "Hand Quilting",
    section: "acc",
    kind: "number",
    suffix: "₹",
    unit: "perPc",
    accessory: true,
  },
  {
    id: "accHandTucking",
    label: "Hand Tucking",
    section: "acc",
    kind: "number",
    suffix: "₹",
    unit: "perPc",
    accessory: true,
  },
  {
    id: "accORing",
    label: "O-Ring",
    section: "acc",
    kind: "number",
    suffix: "₹",
    unit: "perPc",
    accessory: true,
  },
  {
    id: "accButton",
    label: "Button Cost",
    section: "acc",
    kind: "number",
    suffix: "₹",
    unit: "perPc",
    accessory: true,
  },
  {
    id: "accEyelet",
    label: "Eyelet + Fixing",
    section: "acc",
    kind: "number",
    suffix: "₹",
    unit: "perPc",
    accessory: true,
  },
  {
    id: "accCardboard",
    label: "Cardboard",
    section: "acc",
    kind: "number",
    suffix: "₹",
    unit: "perPc",
    accessory: true,
  },
  {
    id: "accPressButtons",
    label: "Press Buttons / Buttons",
    section: "acc",
    kind: "number",
    suffix: "₹",
    unit: "perPc",
    accessory: true,
  },
];

export const ACCESSORIES_SEED: ConfigState = {
  accZipper: { value: "0.00" },
  accFusingProcess: { value: "0.00" },
  accHandQuilting: { value: "0.00" },
  accHandTucking: { value: "0.00" },
  accORing: { value: "0.00" },
  accButton: { value: "0.00" },
  accEyelet: { value: "0.00" },
  accCardboard: { value: "0.00" },
  accPressButtons: { value: "0.00" },
};

/* ------------------------------------------------------------------ *
 * Packaging module
 * ------------------------------------------------------------------ */

export const PACKAGING_SECTIONS: SectionDef[] = [
  { id: "pkgSetup", label: "Packaging Setup" },
  { id: "pkgNotesSec", label: "Notes" },
  { id: "pkgCalc", label: "Calculated Output", readOnly: true },
  { id: "grand", label: "Packaging Total", readOnly: true },
];

export const PACKAGING_CARDS: CardDef[] = [
  {
    id: "pkgType",
    label: "Packaging Type",
    section: "pkgSetup",
    kind: "options",
    unit: "perPc",
    mandatory: true,
    ai: true,
    aiReason:
      "Single poly + master carton matches the buyer’s retail-ready spec at the lowest packing cost.",
    hint: "Primary packing format — drives the per-piece packing cost.",
    options: [
      { ...opt("Single Poly Pack", "Cost sheet · retail ready", 0.85), recommended: true },
      opt("Set of 4 Pack", "Multi-pack with belly band", 1.4),
      opt("Gift Box Pack", "Rigid box · premium", 3.2),
      opt("Bulk Pack", "No individual packing", 0.25),
    ],
  },
  {
    id: "pkgCarton",
    label: "Carton Type",
    section: "pkgSetup",
    kind: "options",
    unit: "perPc",
    hint: "Master carton grade — allocated per piece.",
    options: [
      { ...opt("5-Ply Master Carton", "Cost sheet · standard export", 0.6), recommended: true },
      opt("3-Ply Carton", "Lighter · domestic freight", 0.4),
      opt("7-Ply Heavy Duty", "Long-haul sea freight", 0.95),
    ],
  },
  {
    id: "pkgInner",
    label: "Inner Packing",
    section: "pkgSetup",
    kind: "options",
    hint: "Inner separation used inside the master carton.",
    options: [
      { ...opt("Tissue Interleaf", "Standard inner"), recommended: true },
      opt("Butter Paper", "Print protection"),
      opt("None", "No inner packing"),
    ],
  },
  {
    id: "pkgPolyBag",
    label: "Poly Bag",
    section: "pkgSetup",
    kind: "options",
    unit: "perPc",
    hint: "Poly bag specification per piece.",
    options: [
      { ...opt("LDPE 40 Micron", "Cost sheet · standard", 0.3), recommended: true },
      opt("Recycled LDPE", "GRS certified", 0.45),
      opt("Compostable Bag", "Buyer sustainability spec", 0.72),
    ],
  },
  {
    id: "pkgBarcode",
    label: "Barcode Label",
    section: "pkgSetup",
    kind: "options",
    hint: "Label format for retail scanning.",
    options: [
      { ...opt("Buyer EAN Sticker", "Supplied artwork"), recommended: true },
      opt("Printed Barcode Tag", "Tag with barcode"),
      opt("None", "No barcode required"),
    ],
  },
  {
    id: "pkgHangTag",
    label: "Hang Tag",
    section: "pkgSetup",
    kind: "options",
    unit: "perPc",
    hint: "Hang tag applied per piece, if applicable.",
    options: [
      { ...opt("None", "No hang tag", 0), recommended: true },
      opt("Recycled Board Tag", "Buyer artwork", 0.35),
      opt("Premium Tag + String", "Foil finish", 0.65),
    ],
  },

  { id: "pkgNotes", label: "Packing Notes", section: "pkgNotesSec", kind: "text" },

  {
    id: "pkgTotalCost",
    label: "Packaging Cost Per PCS",
    section: "pkgCalc",
    kind: "readonly",
    metric: "costPerPiece",
    zeroOk: true,
  },
];

export const PACKAGING_SEED: ConfigState = {
  pkgType: { value: "Single Poly Pack", optionId: "single-poly-pack", rate: 0.85 },
};

/* ------------------------------------------------------------------ *
 * Testing module
 * ------------------------------------------------------------------ */

export const TESTING_SECTIONS: SectionDef[] = [
  { id: "testSetup", label: "Testing Setup" },
  { id: "testCalc", label: "Calculated Output", readOnly: true },
  { id: "grand", label: "Testing Total", readOnly: true },
];

export const TESTING_CARDS: CardDef[] = [
  {
    id: "testRequired",
    label: "Testing Required",
    section: "testSetup",
    kind: "options",
    hint: "Whether buyer testing applies to this article.",
    options: [
      { ...opt("Yes", "Buyer protocol applies"), recommended: true },
      opt("No", "No testing in scope"),
    ],
  },
  {
    id: "testType",
    label: "Test Type",
    section: "testSetup",
    kind: "options",
    unit: "perPc",
    ai: true,
    aiReason:
      "Standard physical + colourfastness panel covers the buyer protocol without the full chemical suite.",
    hint: "Test panel required — allocated per piece.",
    options: [
      { ...opt("Physical + Colourfastness", "Standard buyer panel", 0.4), recommended: true },
      opt("Chemical (AZO / pH)", "Restricted substances", 0.75),
      opt("Full Buyer Protocol", "Physical + chemical + wash", 1.25),
    ],
  },
  {
    id: "testLab",
    label: "Testing Laboratory",
    section: "testSetup",
    kind: "options",
    unit: "perPc",
    hint: "Lab performing the tests — sets the allocated lab fee.",
    options: [
      { ...opt("SGS India", "Buyer nominated", 0.3), recommended: true },
      opt("Intertek", "Buyer approved", 0.35),
      opt("Bureau Veritas", "Buyer approved", 0.32),
      opt("In-house Lab", "Internal pre-testing", 0.1),
    ],
  },

  {
    id: "testTotalCost",
    label: "Testing Cost Per PCS",
    section: "testCalc",
    kind: "readonly",
    metric: "costPerPiece",
    zeroOk: true,
  },
];

export const TESTING_SEED: ConfigState = {};

/* ------------------------------------------------------------------ *
 * Certification module
 * ------------------------------------------------------------------ */

export const CERTIFICATION_SECTIONS: SectionDef[] = [
  { id: "certSetup", label: "Certification Setup" },
  { id: "certCalc", label: "Calculated Output", readOnly: true },
  { id: "grand", label: "Certification Total", readOnly: true },
];

export const CERTIFICATION_CARDS: CardDef[] = [
  {
    id: "certType",
    label: "Certification Type",
    section: "certSetup",
    kind: "options",
    unit: "perPc",
    ai: true,
    aiReason:
      "OEKO-TEX Standard 100 is already held on this fabric quality — no incremental audit cost.",
    hint: "Certification carried on the article — allocated per piece.",
    options: [
      { ...opt("OEKO-TEX Standard 100", "Held on current fabric", 0.15), recommended: true },
      opt("GOTS", "Organic chain of custody", 0.55),
      opt("BCI", "Better Cotton mass balance", 0.25),
      opt("GRS", "Recycled content claim", 0.45),
      opt("Organic Cotton", "Certified organic fibre", 0.6),
      opt("FSC", "Paper / packaging claim", 0.12),
    ],
  },

  {
    id: "certTotalCost",
    label: "Certification Cost Per PCS",
    section: "certCalc",
    kind: "readonly",
    metric: "costPerPiece",
    zeroOk: true,
  },
];

export const CERTIFICATION_SEED: ConfigState = {};

/* ------------------------------------------------------------------ *
 * Input drivers — classification / decision inputs (no cost impact)
 * ------------------------------------------------------------------ */

export const INPUT_CARDS: CardDef[] = [
  {
    id: "productCategory",
    label: "Product Category",
    section: "idProduct",
    kind: "options",
    mandatory: true,
    hint: "Category drives the default process route and cost template.",
    options: [
      opt("Table Linen", "Placemat / runner / napkin"),
      opt("Bath Linen", "Towels · bath mats"),
      opt("Bed Linen", "Sheets · duvet covers"),
      opt("Cushions & Filled", "Filled products"),
      opt("Kitchen Linen", "Aprons · gloves · pot holders"),
    ],
  },
  {
    id: "sizeSpec",
    label: "Size",
    section: "idProduct",
    kind: "text",
    mandatory: true,
    hint: "Finished size, e.g. 33 × 48 cm.",
  },
  {
    id: "orderQty",
    label: "MOQ / Quantity",
    section: "idProduct",
    kind: "number",
    suffix: "pcs",
    mandatory: true,
  },
  {
    id: "unitType",
    label: "Unit Type",
    section: "idProduct",
    kind: "options",
    mandatory: true,
    options: [
      opt("Piece", "Costed per piece"),
      opt("Set", "Costed per set"),
      opt("Pair", "Costed per pair"),
    ],
  },
  {
    id: "mfgRoute",
    label: "Manufacturing Route",
    section: "idRoute",
    kind: "options",
    mandatory: true,
    ai: true,
    aiReason:
      "Yarn route is the full chain for this quality — it exposes twisting, dyeing and weaving so the mill build-up can be costed.",
    hint: "Route decides which process steps apply downstream.",
    options: [
      opt("Ready Fabric", "Buy finished fabric — no dyeing / weaving"),
      opt("Greige Fabric", "Buy greige — dyeing applies"),
      {
        ...opt("Yarn", "Yarn in — twisting, dyeing and weaving apply"),
        recommended: true,
        reasons: ["Full mill build-up", "Best cost visibility"],
      },
    ],
  },
  {
    id: "certRequirement",
    label: "Certification Requirement",
    section: "idCompliance",
    kind: "options",
    hint: "Flag only — the certification cost is carried in Process.",
    options: [
      { ...opt("OEKO-TEX Standard 100", "Buyer requirement"), recommended: true },
      opt("GOTS", "Organic chain of custody"),
      opt("GRS", "Recycled content claim"),
      opt("BCI", "Better Cotton"),
      opt("Not required", "No certification in scope"),
    ],
  },
  /* ---- Article / order context ---- */
  {
    id: "articleStyle",
    label: "Article / Style",
    section: "idProduct",
    kind: "text",
    hint: "Style reference used on the cost sheet.",
  },
  {
    id: "buyerName",
    label: "Buyer",
    section: "idProduct",
    kind: "text",
    hint: "Buyer this configuration is costed for.",
  },

  /* ---- Fabric identification ---- */
  {
    id: "fabricCode",
    label: "Fabric Code",
    section: "idFabricId",
    kind: "text",
    hint: "Internal fabric / quality code.",
  },
  {
    id: "fabricSource",
    label: "Fabric Source",
    section: "idFabricId",
    kind: "options",
    options: [
      opt("Mill Direct", "Bought from mill"),
      opt("Trader", "Bought from trader"),
      opt("In-house Weaving", "Woven in-house"),
    ],
  },

  /* ---- Construction ---- */
  { id: "ply", label: "Ply", section: "idSpec", kind: "text", hint: "Single / double ply." },

  /* ---- Composition ---- */
  {
    id: "fibreType",
    label: "Fibre Type",
    section: "idComposition",
    kind: "options",
    options: [opt("Cotton"), opt("Linen"), opt("Polyester"), opt("Viscose"), opt("Blend")],
  },
  { id: "blendPct", label: "Blend %", section: "idComposition", kind: "text", hint: "e.g. 70:30." },
  {
    id: "organicRecycled",
    label: "Organic / Recycled",
    section: "idComposition",
    kind: "options",
    options: [opt("Conventional"), opt("Organic"), opt("Recycled"), opt("Organic + Recycled")],
  },

  /* ---- Dimensions ---- */
  { id: "usableWidth", label: "Usable Width", section: "idWidth", kind: "number", suffix: "in" },
  {
    id: "costingWidth",
    label: "Costing Width",
    section: "idWidth",
    kind: "number",
    suffix: "in",
    hint: "Width used for consumption maths.",
  },

  /* ---- Colour & design ---- */
  {
    id: "pantone",
    label: "Pantone",
    section: "idColour",
    kind: "text",
    hint: "Pantone reference for the shade.",
  },
  { id: "buyerColourCode", label: "Buyer Colour Code", section: "idColour", kind: "text" },
  {
    id: "labDip",
    label: "Lab Dip",
    section: "idColour",
    kind: "options",
    options: [
      { ...opt("Approved", "Shade signed off"), recommended: true },
      opt("Pending", "Awaiting approval"),
      opt("Not required", "Greige / undyed"),
    ],
  },
  {
    id: "colourway",
    label: "Solid / Multi-Colour",
    section: "idColour",
    kind: "options",
    options: [opt("Solid"), opt("Multi-Colour"), opt("Yarn Dyed Stripe")],
  },
  { id: "contrastColour", label: "Contrast Colour", section: "idColour", kind: "text" },
  {
    id: "printDesign",
    label: "Print Design",
    section: "idDesign",
    kind: "text",
    hint: "Design name / reference.",
  },
  { id: "embroideryDesign", label: "Embroidery Design", section: "idDesign", kind: "text" },
  {
    id: "embroideryPlacement",
    label: "Embroidery Placement",
    section: "idDesign",
    kind: "options",
    options: [opt("Border"), opt("Corner"), opt("All-over"), opt("Panel")],
  },
];

export const INPUT_SEED: ConfigState = {
  productCategory: { value: "Table Linen", optionId: "table-linen" },
  sizeSpec: { value: "33 × 48 cm" },
  orderQty: { value: "4800" },
  unitType: { value: "Piece", optionId: "piece" },
  mfgRoute: { value: "Yarn", optionId: "yarn" },
  certRequirement: { value: "OEKO-TEX Standard 100", optionId: "oeko-tex-standard-100" },
  articleStyle: { value: "TL-2214 Placemat" },
  buyerName: { value: "Zara Home" },
  fabricCode: { value: "FQ-10s6s-300" },
  fabricSource: { value: "Mill Direct", optionId: "mill-direct" },
  fibreType: { value: "Cotton", optionId: "cotton" },
  organicRecycled: { value: "Conventional", optionId: "conventional" },
  labDip: { value: "Approved", optionId: "approved" },
  colourway: { value: "Solid", optionId: "solid" },
};

/* ------------------------------------------------------------------ *
 * Configuration summary
 * ------------------------------------------------------------------ */

export const SUMMARY_SECTIONS: SectionDef[] = [
  { id: "sfabric", label: "Fabric Cost", readOnly: true },
  { id: "sprinting", label: "Printing Cost", readOnly: true },
  { id: "sembroidery", label: "Embroidery Cost", readOnly: true },
  { id: "swashing", label: "Washing Cost", readOnly: true },
  { id: "smanufacturing", label: "Manufacturing Cost", readOnly: true },
  { id: "saccessories", label: "Accessories Cost", readOnly: true },
  { id: "spackaging", label: "Packaging Cost", readOnly: true },
  { id: "stesting", label: "Testing Cost", readOnly: true },
  { id: "scertification", label: "Certification Cost", readOnly: true },
  { id: "stotal", label: "Total", readOnly: true },
  { id: "smargin", label: "Supplier Margin OH", readOnly: true },
  { id: "sgrand", label: "Grand Total", readOnly: true },
  { id: "sfinal", label: "Fabric + Print + Emb", readOnly: true },
  { id: "grand", label: "Ready for Costing", readOnly: true },
];

/** Supplier margin / overhead applied on the process total. */
export const SUPPLIER_MARGIN_OH_PCT = 0.12;

export const SUMMARY_CARDS: CardDef[] = [
  {
    id: "sumFabric",
    label: "Fabric Total",
    section: "sfabric",
    kind: "readonly",
    zeroOk: true,
    summaryOf: "fabric",
  },
  {
    id: "sumPrinting",
    label: "Printing Total",
    section: "sprinting",
    kind: "readonly",
    zeroOk: true,
    summaryOf: "printing",
  },
  {
    id: "sumEmbroidery",
    label: "Embroidery Total",
    section: "sembroidery",
    kind: "readonly",
    zeroOk: true,
    summaryOf: "embroidery",
  },
  {
    id: "sumWashing",
    label: "Washing Total",
    section: "swashing",
    kind: "readonly",
    zeroOk: true,
    summaryOf: "washing",
  },
  {
    id: "sumManufacturing",
    label: "Manufacturing Total",
    section: "smanufacturing",
    kind: "readonly",
    zeroOk: true,
    summaryOf: "manufacturing",
  },
  {
    id: "sumAccessories",
    label: "Accessories Total",
    section: "saccessories",
    kind: "readonly",
    zeroOk: true,
    summaryOf: "accessories",
  },
  {
    id: "sumPackaging",
    label: "Packaging Total",
    section: "spackaging",
    kind: "readonly",
    zeroOk: true,
    summaryOf: "packaging",
  },
  {
    id: "sumTesting",
    label: "Testing Total",
    section: "stesting",
    kind: "readonly",
    zeroOk: true,
    summaryOf: "testing",
  },
  {
    id: "sumCertification",
    label: "Certification Total",
    section: "scertification",
    kind: "readonly",
    zeroOk: true,
    summaryOf: "certification",
  },
  { id: "sumTotal", label: "Total", section: "stotal", kind: "readonly", zeroOk: true },
  {
    id: "sumMarginOh",
    label: "Supplier Margin OH",
    section: "smargin",
    kind: "readonly",
    zeroOk: true,
  },
  { id: "sumGrandTotal", label: "Grand Total", section: "sgrand", kind: "readonly", zeroOk: true },
  {
    id: "sumFinalMaterial",
    label: "Fabric + Print + Emb",
    section: "sfinal",
    kind: "readonly",
    zeroOk: true,
  },
];

/** Summary cards that roll up a configuration module (clickable → edit module). */
export const SUMMARY_MODULE_CARDS = SUMMARY_CARDS.filter((c) => c.summaryOf);

export type CardValue = { value: string; optionId?: string; rate?: number };
export type ConfigState = Record<string, CardValue>;

/** Values that exist in the cost sheet — pre-configured on load. */
export const EXCEL_SEED: ConfigState = {
  supplier: { value: "TESPL Textiles", optionId: "tespl", rate: 141.28 },
  fabricQuality: { value: "10s × 6s : 76 × 28", optionId: "10s-6s-76-28", rate: 8 },
  fabricType: { value: "Woven", optionId: "woven", rate: 6 },
  construction: { value: "Plain Weave", optionId: "plain-weave", rate: 5 },
  greigeWidth: { value: "57" },
  finishedWidth: { value: "57" },
  gsm: { value: "300 GSM", optionId: "300-gsm", rate: 12 },
  composition: { value: "100% Cotton", optionId: "100-cotton", rate: 9 },

  colour: { value: "Base — Ecru" },
  cutWidth: { value: "18.00" },
  cutLength: { value: "23.00" },
  bitsMarker: { value: "3" },
  widthUsed: { value: "54.00" },
  dyeing: { value: "Reactive Dyeing", optionId: "reactive-dyeing", rate: 22 },
  printingMethod: { value: "Digital Printing", optionId: "digital-printing", rate: 38 },
  warp: { value: "10s Cotton" },
  weft: { value: "6s Cotton" },
  weaving: { value: "Plain Weave", optionId: "plain-weave" },
  shrinkage: { value: "10" },
  wastage: { value: "7" },
};

/** Printing module demo seed — one configured card in every column. */
export const PRINTING_SEED: ConfigState = {
  printVendor: { value: "Sunrise Prints", optionId: "sunrise-prints", rate: 34 },
  printTech: { value: "Digital Inkjet", optionId: "digital-inkjet", rate: 18 },
  printInk: { value: "Reactive", optionId: "reactive", rate: 6 },
  printColours: { value: "6" },
  designRef: { value: "DSG-4471 · Botanic Stripe", optionId: "dsg-4471-botanic-stripe", rate: 4 },
  repeatSize: { value: "32" },
  coverage: { value: "45" },
  placement: { value: "All-over", optionId: "all-over" },
  curing: { value: "Steam Fixation", optionId: "steam-fixation", rate: 5 },
  postWash: { value: "Yes", optionId: "yes", rate: 6 },
  strikeOff: { value: "Approved", optionId: "approved", rate: 0 },
  printWastage: { value: "5" },
  printScreens: { value: "6" },
  screenCost: { value: "1200" },
};

/** Every card across modules — used by the drawer to resolve a card by id. */
export const ALL_CARDS: CardDef[] = [
  ...INPUT_CARDS,
  ...FABRIC_CARDS,
  ...PRINTING_CARDS,
  ...EMBROIDERY_CARDS,
  ...WASHING_CARDS,
  ...MANUFACTURING_CARDS,
  ...ACCESSORIES_CARDS,
  ...PACKAGING_CARDS,
  ...TESTING_CARDS,
  ...CERTIFICATION_CARDS,
  ...SUMMARY_CARDS,
];

/** Module label a card belongs to — used for the drawer breadcrumb. */
export function moduleLabelForCard(cardId: string): string {
  if (INPUT_CARDS.some((c) => c.id === cardId)) return "Input Drivers";
  if (PRINTING_CARDS.some((c) => c.id === cardId)) return "Printing";

  if (EMBROIDERY_CARDS.some((c) => c.id === cardId)) return "Embroidery";
  if (WASHING_CARDS.some((c) => c.id === cardId)) return "Washing";
  if (MANUFACTURING_CARDS.some((c) => c.id === cardId)) return "Manufacturing";
  if (ACCESSORIES_CARDS.some((c) => c.id === cardId)) return "Accessories";
  if (PACKAGING_CARDS.some((c) => c.id === cardId)) return "Packaging";
  if (TESTING_CARDS.some((c) => c.id === cardId)) return "Testing";
  if (CERTIFICATION_CARDS.some((c) => c.id === cardId)) return "Certification";
  if (SUMMARY_CARDS.some((c) => c.id === cardId)) return "Summary";
  return "Fabric";
}

export type Metrics = {
  consumption: number;
  requiredMeter: number;
  fabricPerM: number;
  costPerPiece: number;
  fabricTotal: number;
  runningTotal: number;
  grandTotal: number;
  contribution: number;
};

const num = (s?: string) => {
  const n = parseFloat((s ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function computeConfig(state: ConfigState, cards: CardDef[] = FABRIC_CARDS): Metrics {
  const has = (id: string) => cards.some((c) => c.id === id);

  // Accessories — sum of every configured accessory line.
  if (has("accZipper")) {
    const perPiece = cards.reduce((sum, c) => sum + num(state[c.id]?.value), 0);
    const configuredAcc = cards.filter((c) => state[c.id]).length;
    return {
      consumption: 0,
      requiredMeter: 0,
      fabricPerM: 0,
      costPerPiece: perPiece,
      fabricTotal: perPiece,
      runningTotal: perPiece,
      grandTotal: perPiece,
      contribution: cards.length ? configuredAcc / cards.length : 0,
    };
  }

  // Option-rate modules (packaging / testing / certification) — sum of selected rates.
  if (has("pkgType") || has("testRequired") || has("certType")) {
    const perPiece = cards.reduce((sum, c) => {
      if (c.kind === "readonly" || c.unit !== "perPc") return sum;
      return sum + (state[c.id]?.rate ?? 0);
    }, 0);
    const editable = cards.filter((c) => c.kind !== "readonly");
    const configured = editable.filter((c) => state[c.id]).length;
    return {
      consumption: 0,
      requiredMeter: 0,
      fabricPerM: 0,
      costPerPiece: perPiece,
      fabricTotal: perPiece,
      runningTotal: perPiece,
      grandTotal: perPiece,
      contribution: editable.length ? configured / editable.length : 0,
    };
  }

  // Modules costed per piece (embroidery / washing / manufacturing).
  if (has("embDots") || has("washPerKg") || has("mfgCutting")) {
    let perPiece = 0;
    if (has("embDots")) {
      const dots = num(state.embDots?.value);
      const perDot =
        num(state.embPerDot?.value) + (state.embSupplier?.rate ?? 0) + (state.embType?.rate ?? 0);

      const w = num(state.embWastage?.value) / 100;
      perPiece = dots * perDot * (1 + w);
    } else if (has("washPerKg")) {
      perPiece =
        (num(state.washPerKg?.value) +
          (state.washSupplier?.rate ?? 0) +
          (state.washType?.rate ?? 0) +
          (state.washRecipe?.rate ?? 0)) *
        num(state.washWeightPerPcs?.value);
    } else {
      perPiece =
        num(state.mfgCutting?.value) +
        num(state.mfgStitching?.value) +
        num(state.mfgHemming?.value);
    }
    const configuredPc = cards.filter((c) => c.kind !== "readonly" && state[c.id]).length;
    const totalPc = cards.filter((c) => c.kind !== "readonly").length;
    return {
      consumption: 0,
      requiredMeter: 0,
      fabricPerM: 0,
      costPerPiece: perPiece,
      fabricTotal: perPiece,
      runningTotal: perPiece,
      grandTotal: perPiece,
      contribution: totalPc ? configuredPc / totalPc : 0,
    };
  }

  const scopedWaste = cards.some((c) => c.id === "printWastage") ? "printWastage" : "wastage";
  const cutLength = num(state.cutLength?.value) || 0;
  const shrink = num(state.shrinkage?.value) / 100;
  const waste = num(state[scopedWaste]?.value) / 100;
  const base = cutLength / 39.37;
  const consumption = base > 0 ? base * (1 + shrink) * (1 + waste) : 0;
  const requiredMeter = consumption;

  let fabricPerM = 0;
  for (const card of cards) {
    if (card.unit !== "perM") continue;
    const v = state[card.id];
    if (v?.rate) fabricPerM += v.rate;
  }

  const costPerPiece = fabricPerM * requiredMeter;
  const fabricTotal = costPerPiece;
  const grandTotal = fabricTotal;
  const configured = cards.filter((c) => c.kind !== "readonly" && state[c.id]).length;
  const total = cards.filter((c) => c.kind !== "readonly").length;
  return {
    consumption,
    requiredMeter,
    fabricPerM,
    costPerPiece,
    fabricTotal,
    runningTotal: grandTotal,
    grandTotal,
    contribution: total ? configured / total : 0,
  };
}

export const inr = (n: number, d = 2) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d })}`;

/** Completion counters for the left nav. */
export function moduleProgress(state: ConfigState) {
  const editable = FABRIC_CARDS.filter((c) => c.kind !== "readonly");
  const done = editable.filter((c) => state[c.id]).length;
  return { done, total: editable.length };
}

export const MODULE_TOTALS: Record<ModuleId, number> = {
  fabric: FABRIC_CARDS.filter((c) => c.kind !== "readonly").length,
  printing: 5,
  embroidery: 4,
  washing: 4,
  manufacturing: 6,
  accessories: ACCESSORIES_CARDS.length,
  packaging: PACKAGING_CARDS.filter((c) => c.kind !== "readonly").length,
  testing: TESTING_CARDS.filter((c) => c.kind !== "readonly").length,
  certification: CERTIFICATION_CARDS.filter((c) => c.kind !== "readonly").length,
  summary: SUMMARY_CARDS.length,
};
