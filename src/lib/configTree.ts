/**
 * Configuration workspace structure.
 *
 * The workspace is organised the way a costing team actually builds a sheet:
 *
 *   INPUT DRIVERS → RAW MATERIAL → PROCESS → PACKAGING → DIRECT COST
 *
 * Nothing new is invented here — every card comes from the existing field set
 * in `fabricConfig.ts`; this module only regroups them into phases / groups and
 * declares how each group's per-piece cost is read.
 */

import {
  ALL_CARDS,
  CERTIFICATION_CARDS,
  EMBROIDERY_CARDS,
  PRINTING_CARDS,
  TESTING_CARDS,
  WASHING_CARDS,
  computeConfig,
  type CardDef,
  type ConfigState,
  type SectionDef,
} from "./fabricConfig";

/* ------------------------------------------------------------------ *
 * Manufacturing route — drives which process steps are relevant
 * ------------------------------------------------------------------ */

export type RouteId = "ready" | "greige" | "yarn";

export const ROUTE_LABEL: Record<RouteId, string> = {
  ready: "Ready Fabric route",
  greige: "Greige Fabric route",
  yarn: "Yarn route",
};

export function routeOf(state: ConfigState): RouteId {
  const v = (state.mfgRoute?.value ?? "").toLowerCase();
  if (v.startsWith("ready")) return "ready";
  if (v.startsWith("greige")) return "greige";
  return "yarn";
}

/* ------------------------------------------------------------------ *
 * Fabric components — component-level breakdown inside Raw Material
 * ------------------------------------------------------------------ */

export type FabricComponent = {
  id: string;
  name: string;
  spec: string;
  /** fabric width, inches */
  width: number;
  /** metres per piece */
  consumption: number;
  /** wastage %, applied on consumption */
  wastage: number;
  /** ₹ / metre */
  rate: number;
  /** derived from the fabric cards — cannot be deleted */
  derived?: boolean;
  /** processes assigned to this component */
  printing?: boolean;
  embroidery?: boolean;
  /** the catalog option currently applied — undefined until the costing
   *  team picks one from the option list */
  optionId?: string;
};

/* ------------------------------------------------------------------ *
 * Component option catalog — every component (Filling, Interlining,
 * Border, Piping, Lining…) resolves to a named, costed option instead of
 * a blank numeric form. Each option carries the calculation logic the
 * costing team needs to see, not just the resulting number.
 * ------------------------------------------------------------------ */

export type ComponentOptionSpec = {
  id: string;
  label: string;
  spec: string;
  width: number;
  consumption: number;
  wastage: number;
  rate: number;
  /** the consumption/costing rule this option applies — shown verbatim */
  calc: string;
};

const wadding = (
  id: string,
  label: string,
  gsm: number,
  consumption: number,
  rate: number,
  rule: string,
): ComponentOptionSpec => ({
  id,
  label,
  spec: gsm > 0 ? `${gsm} GSM · ${label}` : label,
  width: 44,
  consumption,
  wastage: 5,
  rate,
  calc: rule,
});

export const COMPONENT_OPTION_CATALOG: Record<string, ComponentOptionSpec[]> = {
  filling: [
    wadding(
      "fill-front-poly-100",
      "Front Panel — Poly Fill 100gsm",
      100,
      0.18,
      62,
      "Consumption = front panel area ÷ fill width, no repeat. Wastage covers panel-edge trim only.",
    ),
    wadding(
      "fill-back-poly-100",
      "Back Panel — Poly Fill 100gsm",
      100,
      0.18,
      62,
      "Mirrors the front panel rule — same area, same wastage. Priced identically unless the back panel is unlined.",
    ),
    wadding(
      "fill-front-poly-150",
      "Front Panel — Poly Fill 150gsm",
      150,
      0.18,
      78,
      "Same area rule as the 100gsm option; rate scales with GSM. Use when the buyer spec calls for extra loft.",
    ),
    wadding(
      "fill-back-poly-150",
      "Back Panel — Poly Fill 150gsm",
      150,
      0.18,
      78,
      "Mirrors the front 150gsm panel. Both panels must match GSM within one component group.",
    ),
    wadding(
      "fill-corner-poly-100",
      "Corner Fill — Poly 100gsm",
      100,
      0.05,
      62,
      "Consumption = corner patch area only (~28% of a full panel). Applied on placemats and runners with reinforced corners.",
    ),
    wadding(
      "fill-cotton-100",
      "Cotton Fill 100gsm",
      100,
      0.18,
      94,
      "Same area rule as poly fill; rate reflects natural-fibre cost. Preferred for OEKO-TEX / organic programs.",
    ),
    wadding(
      "fill-cotton-150",
      "Cotton Fill 150gsm",
      150,
      0.18,
      118,
      "Cotton fill at higher loft — same consumption rule, rate scales with GSM.",
    ),
    wadding(
      "fill-down-alt-133",
      "Down Alternative Fill 133gsm",
      133,
      0.2,
      142,
      "Consumption includes a 10% loft allowance over the flat panel area to account for compression recovery.",
    ),
    wadding(
      "fill-recycled-poly-100",
      "Recycled Poly Fill 100gsm (rPET)",
      100,
      0.18,
      74,
      "Same consumption rule as virgin poly fill; rate carries the rPET premium. Required on recycled-content programs.",
    ),
    wadding(
      "fill-edge-strip",
      "Edge Strip Fill — 40mm",
      80,
      0.06,
      48,
      "Narrow-strip fill along the finished edge only. Consumption = perimeter length × strip width, not panel area.",
    ),
  ],
  interlining: [
    wadding(
      "int-fuse-light",
      "Fusible Interlining — Light (25gsm)",
      25,
      0.12,
      38,
      "Consumption = pattern piece area needing support, typically collar/cuff only. Fused at 150°C, 15s dwell.",
    ),
    wadding(
      "int-fuse-medium",
      "Fusible Interlining — Medium (45gsm)",
      45,
      0.12,
      46,
      "Same area rule as light fuse; used where the buyer spec calls for firmer hand-feel.",
    ),
    wadding(
      "int-fuse-heavy",
      "Fusible Interlining — Heavy (70gsm)",
      70,
      0.14,
      56,
      "Area rule plus 15% allowance for structured panels (waistbands, plackets).",
    ),
    wadding(
      "int-nonwoven",
      "Non-woven Interlining",
      35,
      0.12,
      34,
      "Standard area-based consumption. Lowest-cost option; not recommended for garments needing drape.",
    ),
    wadding(
      "int-woven",
      "Woven Interlining",
      40,
      0.13,
      52,
      "Area-based consumption with grain-matching allowance (+8%) since it's cut on-grain like the shell fabric.",
    ),
    wadding(
      "int-buckram",
      "Buckram",
      120,
      0.08,
      64,
      "Used on small structured areas only (collar stands, belt loops) — consumption is per-piece count × piece area, not panel area.",
    ),
    wadding(
      "int-canvas",
      "Canvas Interlining — Hair Blend",
      180,
      0.15,
      88,
      "Tailoring-grade chest canvas. Consumption includes a bias-cut allowance (+20%) over the flat pattern area.",
    ),
  ],
  border: [
    wadding(
      "border-self-woven",
      "Self Fabric Border — Woven",
      0,
      0.24,
      0,
      "Rate inherits the main fabric rate. Consumption = perimeter ÷ border width, mitred corners add 4 × width to length.",
    ),
    wadding(
      "border-contrast-print",
      "Contrast Border — Printed",
      0,
      0.22,
      68,
      "Perimeter-based consumption, same mitre rule as self-fabric. Rate includes the print surcharge.",
    ),
    wadding(
      "border-jacquard",
      "Jacquard Woven Border",
      0,
      0.22,
      96,
      "Perimeter-based consumption. Jacquard tape is bought by the metre, priced independently of body fabric.",
    ),
    wadding(
      "border-piped-double",
      "Double-piped Border",
      0,
      0.28,
      112,
      "Perimeter × 2 (both piping runs) plus mitre allowance. Two rates blended into one effective rate.",
    ),
  ],
  piping: [
    wadding(
      "piping-self",
      "Self Fabric Piping — 5mm",
      0,
      0.9,
      18,
      "Consumption = seam length requiring piping × 1.08 (bias-cut waste factor).",
    ),
    wadding(
      "piping-contrast",
      "Contrast Piping — 5mm",
      0,
      0.9,
      24,
      "Same seam-length rule as self piping; rate reflects the separate contrast fabric purchase.",
    ),
    wadding(
      "piping-corded-7mm",
      "Corded Piping — 7mm",
      0,
      0.95,
      31,
      "Seam-length rule with a wider bias allowance (1.12×) for the thicker cord.",
    ),
  ],
  lining: [
    wadding(
      "lining-poly-taffeta",
      "Poly Taffeta Lining",
      0,
      1.05,
      54,
      "Consumption mirrors the main body panel count at 1.05× (lining allowance for seam take-up).",
    ),
    wadding(
      "lining-cotton-voile",
      "Cotton Voile Lining",
      0,
      1.05,
      72,
      "Same panel-count rule as poly taffeta; natural-fibre rate.",
    ),
    wadding(
      "lining-mesh",
      "Mesh Lining — Ventilated",
      0,
      1.0,
      46,
      "Panel-count rule without the seam take-up allowance — mesh doesn't fray, so no extra margin is added.",
    ),
  ],
  generic: [
    wadding(
      "generic-self-fabric",
      "Self Fabric",
      0,
      0.2,
      0,
      "Rate inherits the main fabric rate; consumption defaults to the component's declared area.",
    ),
    wadding(
      "generic-bonded-foam",
      "Bonded Foam Layer",
      0,
      0.2,
      58,
      "Area-based consumption with a 6% bonding-loss allowance.",
    ),
    wadding(
      "generic-mesh",
      "Technical Mesh",
      0,
      0.2,
      64,
      "Area-based consumption, no additional loss allowance — mesh is cut to shape without fraying.",
    ),
  ],
};

/** Loose name → catalog group match, so any component (built-in or
 *  user-typed) resolves to a real option list instead of a dead end. */
export function optionCatalogFor(component: { name: string }): ComponentOptionSpec[] {
  const n = component.name.toLowerCase();
  const key = Object.keys(COMPONENT_OPTION_CATALOG).find((k) => k !== "generic" && n.includes(k));
  return COMPONENT_OPTION_CATALOG[key ?? "generic"];
}

/** Build a fully-populated FabricComponent straight from a catalog option —
 *  used to seed defaults so the network diagram opens with real data. */
function componentFromOption(id: string, name: string, opt: ComponentOptionSpec): FabricComponent {
  return {
    id,
    name,
    spec: opt.spec,
    width: opt.width,
    consumption: opt.consumption,
    wastage: opt.wastage,
    rate: opt.rate,
    optionId: opt.id,
  };
}

/** Every article starts with this standard component set already costed —
 *  Filling, Interlining, Border and Piping are common to woven table linen.
 *  Main Body is derived separately and always comes first. Nothing here is a
 *  blank row waiting to be filled in; the costing team can still swap the
 *  option, add more components, or remove ones that don't apply. */
export const DEFAULT_EXTRA_COMPONENTS: FabricComponent[] = [
  componentFromOption("filling", "Filling", COMPONENT_OPTION_CATALOG.filling[0]),
  componentFromOption(
    "interlining",
    "Interlining / Fusing",
    COMPONENT_OPTION_CATALOG.interlining[0],
  ),
  // border[0] ("Self Fabric Border") inherits the main fabric rate rather
  // than carrying its own — defaulting to it would show a misleading ₹0.00.
  // border[1] is a real, independently-rated option.
  componentFromOption("border", "Border", COMPONENT_OPTION_CATALOG.border[1]),
  componentFromOption("piping", "Piping", COMPONENT_OPTION_CATALOG.piping[0]),
];

export const componentCost = (c: FabricComponent) =>
  c.consumption * (1 + (c.wastage || 0) / 100) * c.rate;

export const componentsCost = (list: FabricComponent[]) =>
  list.reduce((t, c) => t + componentCost(c), 0);

/** Common starting points for the "+ Add component" picker (open list). */
export const COMPONENT_PRESETS = [
  "Main Body",
  "Border",
  "Piping",
  "Lining",
  "Sleeve",
  "Collar",
  "Cuff",
  "Pocket",
  "Filling",
  "Binding",
  "Panel",
];

const num = (s?: string) => {
  const n = parseFloat((s ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const byId = (ids: string[]): CardDef[] =>
  ids.map((id) => ALL_CARDS.find((c) => c.id === id)).filter(Boolean) as CardDef[];

/** re-section a set of cards so a group can lay out its own columns */
const inSection = (ids: string[], section: string): CardDef[] =>
  byId(ids).map((c) => ({ ...c, section }));

const sumNums = (state: ConfigState, ids: string[]) =>
  ids.reduce((t, id) => t + num(state[id]?.value), 0);

const perMCost = (state: ConfigState, ids: string[]) =>
  computeConfig(state, byId(ids)).costPerPiece;

const moduleCost = (state: ConfigState, cards: CardDef[]) =>
  computeConfig(state, cards).costPerPiece;

/** The fabric cards that carry the raw-material ₹ / metre build-up. */
export const FABRIC_COST_CARD_IDS = [
  "supplier",
  "fabricQuality",
  "fabricType",
  "construction",
  "gsm",
  "composition",
];

/** Main-body component derived live from the fabric cards, so no value is lost. */
export function deriveMainComponent(state: ConfigState): FabricComponent {
  const m = computeConfig(state, byId(FABRIC_COST_CARD_IDS));
  return {
    id: "__main",
    name: "Main Body",
    spec:
      [state.fabricQuality?.value, state.gsm?.value, state.composition?.value]
        .filter(Boolean)
        .join(" · ") || "Fabric spec from Raw Material cards",
    width: num(state.widthUsed?.value) || num(state.finishedWidth?.value),
    consumption: m.requiredMeter,
    wastage: 0,
    rate: m.fabricPerM,
    derived: true,
  };
}

export function fabricComponents(state: ConfigState, extras: FabricComponent[]): FabricComponent[] {
  return [deriveMainComponent(state), ...extras];
}

/* ------------------------------------------------------------------ *
 * Groups
 * ------------------------------------------------------------------ */

export type PhaseId = "input" | "raw" | "process" | "packaging" | "direct";

export type GroupCtx = { fabricExtras: FabricComponent[] };

export type ConfigGroup = {
  id: string;
  label: string;
  /** cards shown on the canvas for this group */
  cards: CardDef[];
  sections: SectionDef[];
  /** false for classification / spec-only groups (no cost node) */
  costed: boolean;
  /** per-piece cost read for this group */
  amount?: (state: ConfigState, ctx: GroupCtx) => number;
  /** fabric component breakdown panel */
  components?: boolean;
  /** process can be assigned per fabric component */
  componentAssign?: "printing" | "embroidery";
  /** only relevant for these manufacturing routes */
  routes?: RouteId[];
  hint?: string;
  insight?: { text: string; savings?: string } | null;
};

export type ConfigPhase = {
  id: PhaseId;
  label: string;
  costed: boolean;
  groups: ConfigGroup[];
};

const totalSection = (label: string): SectionDef => ({ id: "grand", label, readOnly: true });

/* ---- Input drivers ---- */

const INPUT_GROUPS: ConfigGroup[] = [
  {
    id: "drivers",
    label: "Article & Order",
    costed: false,
    hint: "Order context — the classification the whole sheet hangs off. Not a cost line.",
    sections: [
      { id: "idProduct", label: "Article / Order Context" },
      { id: "idCompliance", label: "Compliance" },
    ],
    cards: [
      ...inSection(
        [
          "productCategory",
          "articleStyle",
          "buyerName",
          "sizeSpec",
          "colour",
          "orderQty",
          "unitType",
        ],
        "idProduct",
      ),
      ...inSection(["certRequirement"], "idCompliance"),
    ],
  },
  {
    id: "route",
    label: "Manufacturing Route",
    costed: false,
    hint: "The route decides which process steps are shown downstream: Ready fabric, Greige fabric or Yarn.",
    sections: [{ id: "idRoute", label: "Route Decision" }],
    cards: inSection(["mfgRoute", "fabricType", "fabricSource"], "idRoute"),
  },
  {
    id: "fabricSpec",
    label: "Fabric & Material Spec",
    costed: false,
    hint: "Identification, construction, composition and widths — one comprehensive fabric definition.",
    sections: [
      { id: "idFabricId", label: "Fabric Identification" },
      { id: "idSpec", label: "Fabric Construction" },
      { id: "idComposition", label: "Material Composition" },
      { id: "idWidth", label: "Fabric Dimensions" },
    ],
    cards: [
      ...inSection(["fabricCode", "supplier", "fabricQuality"], "idFabricId"),
      ...inSection(["count", "warp", "weft", "ply", "construction", "reedPick", "gsm"], "idSpec"),
      ...inSection(["fibreType", "composition", "blendPct", "organicRecycled"], "idComposition"),
      ...inSection(["greigeWidth", "finishedWidth", "usableWidth", "costingWidth"], "idWidth"),
    ],
  },
  {
    id: "colourDesign",
    label: "Colour & Design",
    costed: false,
    components: true,
    hint: "Shade, print and embroidery intent. The component list on the left is the material breakdown these designs sit on.",
    sections: [
      { id: "idColour", label: "Colour" },
      { id: "idDesign", label: "Design" },
    ],
    cards: [
      ...inSection(
        ["colour", "pantone", "buyerColourCode", "labDip", "colourway", "contrastColour"],
        "idColour",
      ),
      ...inSection(
        ["printDesign", "placement", "coverage", "embroideryDesign", "embroideryPlacement"],
        "idDesign",
      ),
    ],
  },
];

/* ---- Raw material ---- */

const RAW_GROUPS: ConfigGroup[] = [
  {
    id: "fabric",
    label: "Fabric",
    costed: true,
    components: true,
    hint: "Fabric is costed component by component — each component rolls into the fabric subtotal.",
    insight: {
      text: "Switching the main body to Mafatlal Mills at ₹137.50 / m keeps the same quality band and saves about ₹2.45 per piece at MOQ 4,800.",
      savings: "Potential savings ₹2.45 / pc",
    },
    sections: [
      { id: "rmSupply", label: "Fabric Supply" },
      { id: "rmQuality", label: "Quality & Construction" },
      totalSection("Fabric Subtotal"),
    ],
    cards: [
      ...inSection(["supplier", "fabricWidth"], "rmSupply"),
      ...inSection(["fabricQuality", "construction"], "rmQuality"),
    ],
    amount: (state, ctx) => componentsCost(fabricComponents(state, ctx.fabricExtras)),
  },
  {
    id: "yarn",
    label: "Yarn",
    costed: false,
    routes: ["greige", "yarn"],
    hint: "Yarn specification carried into weaving — no separate cost line.",
    sections: [
      { id: "rmYarnCount", label: "Count & Construction" },
      { id: "rmYarnWeight", label: "Weights" },
    ],
    cards: [
      ...inSection(["warp", "weft", "reedPick"], "rmYarnCount"),
      ...inSection(["hankWeight", "bundleWeight"], "rmYarnWeight"),
    ],
  },
  {
    id: "filling",
    label: "Filling",
    costed: true,
    sections: [{ id: "rmFilling", label: "Filling" }, totalSection("Filling Subtotal")],
    cards: inSection(["accPolyFilling", "accCottonFilling", "accPolywadding"], "rmFilling"),
    amount: (state) => sumNums(state, ["accPolyFilling", "accCottonFilling", "accPolywadding"]),
  },
  {
    id: "interlining",
    label: "Interlining / Fusing",
    costed: true,
    sections: [
      { id: "rmFuse", label: "Interlining / Fusing" },
      totalSection("Interlining Subtotal"),
    ],
    cards: inSection(["accFusingPaper"], "rmFuse"),
    amount: (state) => sumNums(state, ["accFusingPaper"]),
  },
  {
    id: "trims",
    label: "Trims & Accessories",
    costed: true,
    hint: "Each trim can be tagged to the component it sits on.",
    sections: [
      { id: "rmTrimClose", label: "Closures" },
      { id: "rmTrimHard", label: "Hardware & Board" },
      totalSection("Trims Subtotal"),
    ],
    cards: [
      ...inSection(["accZipper", "accButton", "accPressButtons"], "rmTrimClose"),
      ...inSection(["accEyelet", "accORing", "accCardboard"], "rmTrimHard"),
    ],
    amount: (state) =>
      sumNums(state, [
        "accZipper",
        "accButton",
        "accPressButtons",
        "accEyelet",
        "accORing",
        "accCardboard",
      ]),
  },
];

/* ---- Process ---- */

const PRINTING_GROUP_CARDS: CardDef[] = [
  ...PRINTING_CARDS,
  ...inSection(["printingMethod", "printingType", "screenDigital"], "pfabricRoute"),
];

const PROCESS_GROUPS: ConfigGroup[] = [
  {
    id: "yarnPrep",
    label: "Yarn Preparation",
    costed: false,
    routes: ["yarn"],
    hint: "Twisting applies only when yarn is bought in.",
    sections: [{ id: "prTwist", label: "Twisting" }],
    cards: inSection(["twisting"], "prTwist"),
  },
  {
    id: "dyeing",
    label: "Dyeing",
    costed: true,
    routes: ["greige", "yarn"],
    sections: [{ id: "prDye", label: "Dyeing" }, totalSection("Dyeing Subtotal")],
    cards: inSection(["dyeing"], "prDye"),
    amount: (state) => perMCost(state, ["dyeing"]),
  },
  {
    id: "weaving",
    label: "Weaving / Knitting",
    costed: false,
    routes: ["yarn"],
    hint: "Loom construction — the rate sits in the fabric quality build-up.",
    sections: [{ id: "prWeave", label: "Weaving" }],
    cards: inSection(["weaving"], "prWeave"),
  },
  {
    id: "printing",
    label: "Printing",
    costed: true,
    componentAssign: "printing",
    sections: [
      { id: "pbasic", label: "Print Basics" },
      { id: "pdesign", label: "Design" },
      { id: "pprocess", label: "Print Process" },
      { id: "pfabricRoute", label: "Fabric Print Route" },
      { id: "pcalc", label: "Calculations" },
      totalSection("Printing Subtotal"),
    ],
    cards: PRINTING_GROUP_CARDS,
    amount: (state) => moduleCost(state, PRINTING_GROUP_CARDS),
    insight: {
      text: "Digital inkjet avoids screen setup at MOQ 4,800 — about ₹1.80 per piece cheaper than rotary for a 6-colour design.",
      savings: "Potential savings ₹1.80 / pc",
    },
  },
  {
    id: "embroidery",
    label: "Embroidery",
    costed: true,
    componentAssign: "embroidery",
    sections: [
      { id: "esetup", label: "Embroidery Setup" },
      { id: "edetails", label: "Embroidery Details" },
      { id: "eparams", label: "Parameters" },
      totalSection("Embroidery Subtotal"),
    ],
    cards: EMBROIDERY_CARDS.filter((c) => c.kind !== "readonly"),
    amount: (state) => moduleCost(state, EMBROIDERY_CARDS),
    insight: {
      text: "TESPL runs computer embroidery in-house at no per-dot premium — keeping it internal avoids freight and an extra 6-day lead time.",
    },
  },
  {
    id: "washing",
    label: "Washing",
    costed: true,
    sections: [
      { id: "wsetup", label: "Washing Setup" },
      { id: "wdetails", label: "Washing Details" },
      totalSection("Washing Subtotal"),
    ],
    cards: WASHING_CARDS.filter((c) => c.kind !== "readonly"),
    amount: (state) => moduleCost(state, WASHING_CARDS),
    insight: {
      text: "Normal wash on TESPL’s in-house line holds the approved shade band, so no re-wash allowance is needed in the cost.",
    },
  },
  {
    id: "finishing",
    label: "Finishing",
    costed: true,
    sections: [{ id: "prFinish", label: "Finishing" }, totalSection("Finishing Subtotal")],
    cards: inSection(["specialProcess", "transport"], "prFinish"),
    amount: (state) => perMCost(state, ["specialProcess", "transport"]),
  },
  {
    id: "consumption",
    label: "Consumption / Wastage",
    costed: false,
    hint: "Cut size, width, shrinkage and wastage — these drive the required metres used by every fabric component.",
    sections: [
      { id: "prCut", label: "Cut Size" },
      { id: "prLoss", label: "Shrinkage & Wastage" },
      { id: "calc", label: "Required Metres", readOnly: true },
    ],
    cards: [
      ...inSection(["cutWidth", "cutLength", "bitsMarker", "widthUsed"], "prCut"),
      ...inSection(["shrinkage", "wastage"], "prLoss"),
      ...inSection(["consumption", "requiredMeter"], "calc"),
    ],
  },
  {
    id: "cutting",
    label: "Cutting",
    costed: true,
    sections: [{ id: "prCutOp", label: "Cutting" }, totalSection("Cutting Subtotal")],
    cards: inSection(["mfgCutting"], "prCutOp"),
    amount: (state) => sumNums(state, ["mfgCutting"]),
  },
  {
    id: "stitching",
    label: "Stitching / Assembly",
    costed: true,
    sections: [{ id: "prStitch", label: "Stitching" }, totalSection("Stitching Subtotal")],
    cards: inSection(["mfgStitching"], "prStitch"),
    amount: (state) => sumNums(state, ["mfgStitching"]),
  },
  {
    id: "hemming",
    label: "Hemming / Edge Finish",
    costed: true,
    sections: [{ id: "prHem", label: "Hemming" }, totalSection("Hemming Subtotal")],
    cards: inSection(["mfgHemming"], "prHem"),
    amount: (state) => sumNums(state, ["mfgHemming"]),
  },
  {
    id: "special",
    label: "Special Processes",
    costed: true,
    sections: [
      { id: "prSpecial", label: "Hand & Wash Processes" },
      { id: "prSpecialOps", label: "Hand Work" },
      totalSection("Special Subtotal"),
    ],
    cards: [
      ...inSection(["handProcess", "tubWash"], "prSpecial"),
      ...inSection(["accFusingProcess", "accHandQuilting", "accHandTucking"], "prSpecialOps"),
    ],
    amount: (state) =>
      perMCost(state, ["handProcess", "tubWash"]) +
      sumNums(state, ["accFusingProcess", "accHandQuilting", "accHandTucking"]),
  },
  {
    id: "compliance",
    label: "Testing & Certification",
    costed: true,
    hint: "Certification is flagged in Input Drivers — the cost is carried here.",
    sections: [
      { id: "testSetup", label: "Testing" },
      { id: "certSetup", label: "Certification" },
      totalSection("Compliance Subtotal"),
    ],
    cards: [
      ...TESTING_CARDS.filter((c) => c.kind !== "readonly"),
      ...CERTIFICATION_CARDS.filter((c) => c.kind !== "readonly"),
    ],
    amount: (state) => moduleCost(state, [...TESTING_CARDS, ...CERTIFICATION_CARDS]),
  },
];

/* ---- Packaging ---- */

const pkg = (ids: string[], section: string) => inSection(ids, section);
const pkgRates = (state: ConfigState, ids: string[]) =>
  ids.reduce((t, id) => t + (state[id]?.rate ?? 0), 0);

const PACKAGING_GROUPS: ConfigGroup[] = [
  {
    id: "labels",
    label: "Labels",
    costed: true,
    sections: [{ id: "pkLabels", label: "Labels & Tags" }, totalSection("Labels Subtotal")],
    cards: pkg(["pkgBarcode", "pkgHangTag"], "pkLabels"),
    amount: (state) => pkgRates(state, ["pkgHangTag"]),
  },
  {
    id: "standard",
    label: "Standard Packaging",
    costed: true,
    sections: [{ id: "pkStd", label: "Primary Packing" }, totalSection("Standard Subtotal")],
    cards: pkg(["pkgType", "pkgPolyBag", "pkgInner"], "pkStd"),
    amount: (state) => pkgRates(state, ["pkgType", "pkgPolyBag"]),
    insight: {
      text: "Single poly pack with a tissue interleaf meets the retail-ready spec at the lowest allocated packing cost.",
    },
  },
  {
    id: "special",
    label: "Special Packaging",
    costed: false,
    hint: "Gift box / multi-pack instructions — selected on the packaging type when the buyer asks for it.",
    sections: [{ id: "pkNotes", label: "Special Packing" }],
    cards: pkg(["pkgNotes"], "pkNotes"),
  },
  {
    id: "carton",
    label: "Carton Packing",
    costed: true,
    sections: [{ id: "pkCarton", label: "Master Carton" }, totalSection("Carton Subtotal")],
    cards: pkg(["pkgCarton"], "pkCarton"),
    amount: (state) => pkgRates(state, ["pkgCarton"]),
  },
];

/* ------------------------------------------------------------------ *
 * Phases
 * ------------------------------------------------------------------ */

export const PHASES: ConfigPhase[] = [
  { id: "input", label: "Input Drivers", costed: false, groups: INPUT_GROUPS },
  { id: "raw", label: "Raw Material", costed: true, groups: RAW_GROUPS },
  { id: "process", label: "Process", costed: true, groups: PROCESS_GROUPS },
  { id: "packaging", label: "Packaging", costed: true, groups: PACKAGING_GROUPS },
  { id: "direct", label: "Direct Cost", costed: true, groups: [] },
];

export const visibleGroups = (phase: ConfigPhase, route: RouteId) =>
  phase.groups.filter((g) => !g.routes || g.routes.includes(route));

export function findGroup(phaseId: PhaseId, groupId: string): ConfigGroup | undefined {
  return PHASES.find((p) => p.id === phaseId)?.groups.find((g) => g.id === groupId);
}

export type PhaseRollup = {
  id: PhaseId;
  label: string;
  amount: number;
  groups: { id: string; label: string; amount: number; costed: boolean }[];
};

/** Per-piece roll-up of every costed phase. Direct cost = raw + process + packaging. */
export function rollupPhases(
  state: ConfigState,
  ctx: GroupCtx,
): {
  phases: PhaseRollup[];
  directTotal: number;
} {
  const route = routeOf(state);
  const phases = PHASES.filter((p) => p.id !== "direct").map((p) => {
    const groups = visibleGroups(p, route).map((g) => ({
      id: g.id,
      label: g.label,
      costed: g.costed,
      amount: g.costed && g.amount ? g.amount(state, ctx) : 0,
    }));
    return {
      id: p.id,
      label: p.label,
      amount: p.costed ? groups.reduce((t, g) => t + g.amount, 0) : 0,
      groups,
    };
  });
  const directTotal = phases.reduce((t, p) => t + p.amount, 0);
  return { phases, directTotal };
}
