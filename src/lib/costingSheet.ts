// Costing review sheet — derives every card shown in the Costing workspace
// from the configured product (Configuration step) + commercial variables.
// Read-only: this module never mutates inputs, it only explains values.

import { computeCushion, type CushionInputs, type CushionMetrics } from "./cushionCosting";

export type CostSection =
  "product" | "material" | "materialTotal" | "overheads" | "grand" | "pricing";

export type ExplainRow = { label: string; value: string };

export type CostCard = {
  id: string;
  section: CostSection;
  label: string;
  /** headline value shown on the card */
  value: string;
  /** short description under the value */
  desc?: string;
  /** rows rendered inside the card (product details / pricing) */
  rows?: ExplainRow[];
  /** read-only explanation panel content */
  explain: {
    summary: string;
    rows: ExplainRow[];
    rule?: string;
    source?: string;
  };
  emphasis?: "total" | "grand";
};

export type CostSectionDef = { id: CostSection; label: string; note?: string };

export const COST_SECTIONS: CostSectionDef[] = [
  { id: "product", label: "Product details", note: "configured" },
  { id: "material", label: "Material cost", note: "read only" },
  { id: "materialTotal", label: "Material total" },
  { id: "overheads", label: "Commercial overheads" },
  { id: "grand", label: "Grand total" },
  { id: "pricing", label: "Commercial pricing" },
];

export const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const inr0 = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const pct = (n: number) => `${(n * 100).toFixed((n * 100) % 1 === 0 ? 0 : 1)}%`;

/** Commercial overhead rules straight off the costing sheet. */
export const OVERHEAD_RULES = {
  // Purchase costs
  overhead: 0.08,
  cnf: 0.012,
  ecgcDocBc: 0.008,
  insFrt: 0.014,
  // Selling / compliance costs
  paymentTerms: 0.009,
  testing: 0.015,
  certification: 0.006,
  safeguard: 0.004,
  pli: -0.005, // incentive — credit back to cost
  // Business adjustments
  provisionPurchase: 0.02,
  provisionSale: 0.01,
  dbk: -0.026, // duty drawback — credit back to cost
};

export type CostingNums = {
  fabric: number;
  printing: number;
  embroidery: number;
  washing: number;
  manufacturing: number;
  accessories: number;
  packagingMaterial: number;
  materialTotal: number;
  overhead: number;
  cnf: number;
  ecgcDocBc: number;
  insFrt: number;
  paymentTerms: number;
  testing: number;
  certification: number;
  safeguard: number;
  pli: number;
  packaging: number;
  provPurchase: number;
  provSale: number;
  dbk: number;
  supplierMarginOh: number;
  grandTotal: number;
  spInr: number;
  spUsd: number;
  marginPct: number;
  fxRate: number;
  qty: number;
};

export type CostingSheet = {
  cards: CostCard[];
  materialTotal: number;
  overheadTotal: number;
  grandTotal: number;
  spInr: number;
  spUsd: number;
  marginPct: number;
  /** same numbers the cards display — exposed for comparison views */
  nums: CostingNums;
};

export function buildCostingSheet(
  inputs: CushionInputs,
  opts: { productName: string; variantName: string; supplier?: string; quality?: string; includeOverheads?: boolean },
  metricsIn?: CushionMetrics,
): CostingSheet {
  const m = metricsIn ?? computeCushion(inputs);
  const includeOverheads = opts.includeOverheads ?? false;

  // ---- Material cost buckets (fed from the Configuration modules) ----
  const printingShare =
    m.frontPc *
    (inputs.reactivePrint /
      Math.max(1, inputs.greigeCotton + inputs.reactivePrint + inputs.finishTransport));
  const fabricCost = m.fabricSubtotal - printingShare;
  const printingCost = printingShare;
  const embroideryCost = m.embroideryPc;
  const washingCost = m.fillingPc > 0 ? 0 : 0; // washing not configured for this article
  const manufacturingCost = m.cuttingPc + m.stitchingPc + m.setupPc;
  const accessoriesCost = m.trimsPc + m.fillingPc;
  const packagingMaterialCost = m.packagingPc;

  const materialTotal =
    fabricCost +
    printingCost +
    embroideryCost +
    washingCost +
    manufacturingCost +
    accessoriesCost +
    packagingMaterialCost;

  // ---- Commercial overheads & Compliance costs (applied at Quotation stage) ----
  const oh = OVERHEAD_RULES;
  const overheadAmt = materialTotal * oh.overhead;
  const cnfAmt = materialTotal * oh.cnf;
  const ecgcAmt = materialTotal * oh.ecgcDocBc;
  const insFrtAmt = materialTotal * oh.insFrt;
  const paymentTermsAmt = materialTotal * oh.paymentTerms;
  const testingAmt = materialTotal * oh.testing + (inputs.testingPerPc ?? 0);
  const certificationAmt = materialTotal * oh.certification + (inputs.certPerPc ?? 0);

  const safeguardAmt = materialTotal * oh.safeguard;
  const pliAmt = materialTotal * oh.pli;
  const provPurchaseAmt = materialTotal * oh.provisionPurchase;
  const provSaleAmt = materialTotal * oh.provisionSale;
  const dbkAmt = materialTotal * oh.dbk;
  const calculatedOverheads =
    overheadAmt +
    cnfAmt +
    ecgcAmt +
    insFrtAmt +
    paymentTermsAmt +
    testingAmt +
    certificationAmt +
    safeguardAmt +
    pliAmt +
    provPurchaseAmt +
    provSaleAmt +
    dbkAmt;

  const overheadTotal = includeOverheads ? calculatedOverheads : 0;

  const grandTotal = materialTotal + overheadTotal;
  const marginPct = inputs.targetMarginPct;
  const spInr = grandTotal / (1 - marginPct);
  const spUsd = spInr / inputs.fxRate;

  const share = (v: number) =>
    `${((v / Math.max(materialTotal, 0.01)) * 100).toFixed(1)}% of material`;

  const cards: CostCard[] = [
    // ------- Product details -------
    {
      id: "product",
      section: "product",
      label: "Product details",
      value: opts.productName,
      rows: [
        {
          label: "Size",
          value: inputs.sizeInches ? `${inputs.sizeInches}" × ${inputs.sizeInches}"` : "—",
        },
        { label: "MOQ", value: `${inputs.qty.toLocaleString("en-IN")} pcs` },
        { label: "Quality", value: opts.quality ?? `${inputs.fabricGsm ?? 200} GSM cotton` },
        { label: "Supplier", value: opts.supplier ?? "Aarav Textiles (in-house)" },
        { label: "Variant", value: opts.variantName },
      ],
      explain: {
        summary:
          "This node is the configured product carried forward from the Configuration step. Every cost below is derived from these attributes.",
        rows: [
          { label: "Size", value: inputs.sizeInches ? `${inputs.sizeInches}"` : "—" },
          { label: "MOQ", value: inputs.qty.toLocaleString("en-IN") },
          { label: "Fabric weight", value: `${inputs.fabricGsm ?? 200} GSM` },
          { label: "Front consumption", value: `${inputs.frontMeters.toFixed(2)} m / pc` },
          { label: "Back consumption", value: `${inputs.backMeters.toFixed(2)} m / pc` },
        ],
        rule: "Change any of these in Configuration and regenerate costing — this workspace updates automatically.",
        source: "Configuration · Product",
      },
    },

    // ------- Material cost -------
    mat(
      "fabric",
      "Fabric cost",
      fabricCost,
      "Greige + dyeing + finish, shrinkage & waste applied",
      {
        summary:
          "Fabric cost is the panel consumption multiplied by the landed fabric rate per metre.",
        rows: [
          { label: "Front fabric ₹/m", value: `${inr(m.frontFabricPerM)} / m` },
          { label: "Back fabric ₹/m", value: `${inr(m.backFabricPerM)} / m` },
          { label: "Front + back + piping", value: inr(m.fabricSubtotal) },
          { label: "Less print component", value: `− ${inr(printingCost)}` },
          { label: "Fabric cost / pc", value: inr(fabricCost) },
        ],
        rule: `Rate × consumption × shrinkage ${pct(inputs.shrinkage)} × waste ${pct(inputs.waste)}. GSM multiplier ${((inputs.fabricGsm ?? 200) / 200).toFixed(2)}×.`,
        source: "Configuration · Fabric module",
      },
      share(fabricCost),
    ),

    mat(
      "printing",
      "Printing cost",
      printingCost,
      "Reactive print on the front panel",
      {
        summary: "The print rate applies only to the front panel metres.",
        rows: [
          { label: "Reactive print rate", value: `${inr(inputs.reactivePrint)} / m` },
          { label: "Front consumption", value: `${inputs.frontMeters.toFixed(2)} m / pc` },
          { label: "Printing cost / pc", value: inr(printingCost) },
        ],
        rule: "Print rate × front metres × shrinkage × waste. Back panel is solid-dyed, so no print is charged there.",
        source: "Configuration · Printing module",
      },
      share(printingCost),
    ),

    mat(
      "embroidery",
      "Embroidery cost",
      embroideryCost,
      embroideryCost ? "Motif stitch-out per piece" : "Not configured",
      {
        summary:
          "Embroidery is quoted per piece from stitch count; digitising setup is amortised in Manufacturing.",
        rows: [
          { label: "Embroidery rate", value: `${inr(inputs.embroidery)} / pc` },
          {
            label: "Approx. stitches",
            value: `${Math.round(inputs.embroidery * 350).toLocaleString("en-IN")}`,
          },
          { label: "Embroidery cost / pc", value: inr(embroideryCost) },
        ],
        rule: "Cost scales with stitch count. ₹0.00 means embroidery was not configured for this variant.",
        source: "Configuration · Embroidery module",
      },
      share(embroideryCost),
    ),

    mat(
      "washing",
      "Washing cost",
      washingCost,
      "No wash process configured",
      {
        summary:
          "Washing is charged per kg of garment weight. No wash process is configured for this article.",
        rows: [
          { label: "Wash rate", value: "₹0.00 / kg" },
          { label: "Weight per pc", value: "—" },
          { label: "Washing cost / pc", value: inr(washingCost) },
        ],
        rule: "Rate per kg × weight per piece. Add a wash in Configuration to populate this card.",
        source: "Configuration · Washing module",
      },
      share(washingCost),
    ),

    mat(
      "manufacturing",
      "Manufacturing cost",
      manufacturingCost,
      "Cutting + stitching + amortised setup",
      {
        summary:
          "Direct conversion cost: cutting, stitching and one-time setup amortised across the order.",
        rows: [
          { label: "Cutting", value: `${inr(m.cuttingPc)} / pc` },
          { label: "Stitching", value: `${inr(m.stitchingPc)} / pc` },
          { label: "Setup (total)", value: inr0(inputs.setup) },
          {
            label: `Setup ÷ ${inputs.qty.toLocaleString("en-IN")} pcs`,
            value: `${inr(m.setupPc)} / pc`,
          },
          { label: "Manufacturing / pc", value: inr(manufacturingCost) },
        ],
        rule: "Setup per piece = total setup ÷ MOQ, so higher MOQ lowers this card.",
        source: "Configuration · Manufacturing module",
      },
      share(manufacturingCost),
    ),

    mat(
      "accessories",
      "Accessories cost",
      accessoriesCost,
      "Trims, labels & filling",
      {
        summary: "Sum of all accessory line items configured for the article.",
        rows: [
          { label: "Trims & labels", value: `${inr(m.trimsPc)} / pc` },
          { label: "Filling", value: `${inr(m.fillingPc)} / pc` },
          { label: "Accessories / pc", value: inr(accessoriesCost) },
        ],
        rule: "Each accessory is a flat ₹/pc line. ₹0.00 lines are simply not configured.",
        source: "Configuration · Accessories module",
      },
      share(accessoriesCost),
    ),

    mat(
      "packaging",
      "Packaging cost",
      packagingMaterialCost,
      "Standard & special packaging per piece",
      {
        summary:
          "Packaging comes straight from the Packaging module — packaging type plus any selected carton, poly bag, hangtag and label options.",
        rows: [
          { label: "Packaging (configured)", value: `${inr(m.packagingPc)} / pc` },
          { label: "Packaging cost / pc", value: inr(packagingMaterialCost) },
        ],
        rule: "Sum of all ₹/pc packaging options selected in Configuration. Counted once here — it is not repeated in overheads.",
        source: "Configuration · Packaging module",
      },
      share(packagingMaterialCost),
    ),

    // ------- Material total -------
    {
      id: "material-total",
      section: "materialTotal",
      label: "Material total",
      value: inr(materialTotal),
      desc: "Sum of all configuration modules",
      emphasis: "total",
      rows: [
        { label: "Fabric", value: inr(fabricCost) },
        { label: "Printing", value: inr(printingCost) },
        { label: "Embroidery", value: inr(embroideryCost) },
        { label: "Washing", value: inr(washingCost) },
        { label: "Manufacturing", value: inr(manufacturingCost) },
        { label: "Accessories", value: inr(accessoriesCost) },
        { label: "Packaging", value: inr(packagingMaterialCost) },
      ],
      explain: {
        summary: "Roll-up of every material and conversion module from the Configuration step.",
        rows: [
          { label: "Fabric", value: inr(fabricCost) },
          { label: "Printing", value: inr(printingCost) },
          { label: "Embroidery", value: inr(embroideryCost) },
          { label: "Washing", value: inr(washingCost) },
          { label: "Manufacturing", value: inr(manufacturingCost) },
          { label: "Accessories", value: inr(accessoriesCost) },
          { label: "Packaging", value: inr(packagingMaterialCost) },
          { label: "Material total", value: inr(materialTotal) },
        ],
        rule: "Calculated card — no direct input. Edit the source module to change it.",
        source: "Configuration · Summary",
      },
    },

    // ------- Commercial overheads · purchase costs -------
    ovh("overhead", "Overhead", pct(oh.overhead), overheadAmt, materialTotal, {
      summary: "Purchase costs · Factory overhead recovery applied on material total.",
      rule: "Material total × 8% — covers utilities, supervision, factory admin and machine depreciation.",
      source: "Costing sheet · Overhead",
    }),
    ovh("cnf", "C & F", pct(oh.cnf), cnfAmt, materialTotal, {
      summary: "Purchase costs · Clearing & forwarding charges at the port of loading.",
      rule: "Material total × 1.2% — CHA fees, terminal handling, documentation at port.",
      source: "Costing sheet · C & F",
    }),
    ovh("ecgc", "ECGC + DOC + BC", pct(oh.ecgcDocBc), ecgcAmt, materialTotal, {
      summary: "Purchase costs · Export credit guarantee, documentation and bank charges.",
      rule: "Material total × 0.8% — ECGC premium, doc charges and bill collection/negotiation fees.",
      source: "Costing sheet · ECGC + DOC + BC",
    }),
    ovh("insfrt", "INS + FRT(I)", pct(oh.insFrt), insFrtAmt, materialTotal, {
      summary: "Purchase costs · Marine insurance and inland freight to port.",
      rule: "Material total × 1.4% — insurance premium plus inland freight on the export leg.",
      source: "Costing sheet · INS + FRT(I)",
    }),

    // ------- Commercial overheads · selling / compliance -------
    ovh("payment-terms", "Payment terms", pct(oh.paymentTerms), paymentTermsAmt, materialTotal, {
      summary: "Selling costs · Cost of credit for the agreed buyer payment terms.",
      rule: "Material total × 0.9% — interest carry on the receivable window (30 days net).",
      source: "Costing sheet · Payment terms",
    }),
    ovh("testing", "Testing", pct(oh.testing), testingAmt, materialTotal, {
      summary:
        "Selling costs · Third-party lab testing provision (fastness, shrinkage, fibre composition).",
      rule: "Material total × 1.5%. Pulled from the Testing module — lab and test type selections drive this.",
      source: "Configuration · Testing module",
    }),
    ovh("certification", "Certification", pct(oh.certification), certificationAmt, materialTotal, {
      summary: "Selling costs · Certification and audit charges (OEKO-TEX, GOTS, BCI and similar).",
      rule: "Material total × 0.6%. Driven by the Certification module selections in Configuration.",
      source: "Configuration · Certification module",
    }),
    ovh("safeguard", "Safeguard", pct(oh.safeguard), safeguardAmt, materialTotal, {
      summary: "Selling costs · Safeguard duty / levy provision on the export shipment.",
      rule: "Material total × 0.4% — statutory safeguard levy provision.",
      source: "Costing sheet · Safeguard",
    }),
    ovh("pli", "PLI", pct(oh.pli), pliAmt, materialTotal, {
      summary: "Selling costs · Production-linked incentive credit — reduces landed cost.",
      rule: "Material total × 0.5%, applied as a credit (negative) once incentive eligibility is confirmed.",
      source: "Costing sheet · PLI",
    }),

    // ------- Commercial overheads · business adjustments -------
    ovh(
      "oh-prov-purchase",
      "Total provision purchase",
      pct(oh.provisionPurchase),
      provPurchaseAmt,
      materialTotal,
      {
        summary:
          "Business adjustments · Provision held against purchase-side risk: rate escalation and short supply.",
        rule: "Material total × 2%. Payment terms 30 days against delivery; provision covers rate movement inside the window.",
        source: "Costing sheet · Provision purchase",
      },
    ),
    ovh("oh-prov-sale", "Total provision sale", pct(oh.provisionSale), provSaleAmt, materialTotal, {
      summary:
        "Business adjustments · Provision held against sale-side risk: claims, discounts and short-shipment.",
      rule: "Material total × 1%. Released after buyer acceptance of the shipment.",
      source: "Costing sheet · Provision sale",
    }),
    ovh("oh-dbk", "DBK", pct(oh.dbk), dbkAmt, materialTotal, {
      summary: "Business adjustments · Duty drawback credit on export — reduces landed cost.",
      rule: "Material total × 2.6%, applied as a credit (negative). Claimed against shipping bill after export.",
      source: "Costing sheet · DBK",
    }),

    // ------- Grand total -------
    {
      id: "grand-total",
      section: "grand",
      label: "Grand total / pc",
      value: inr(grandTotal),
      emphasis: "grand",
      rows: [
        { label: "Material total", value: inr(materialTotal) },
        { label: "Overheads (net)", value: inr(overheadTotal) },
      ],
      explain: {
        summary: "Fully loaded cost per piece before margin.",
        rows: [
          { label: "Material total", value: inr(materialTotal) },
          { label: "Overhead 8%", value: inr(overheadAmt) },
          { label: "C & F 1.2%", value: inr(cnfAmt) },
          { label: "ECGC + DOC + BC 0.8%", value: inr(ecgcAmt) },
          { label: "INS + FRT(I) 1.4%", value: inr(insFrtAmt) },
          { label: "Payment terms 0.9%", value: inr(paymentTermsAmt) },
          { label: "Testing 1.5%", value: inr(testingAmt) },
          { label: "Certification 0.6%", value: inr(certificationAmt) },
          { label: "Safeguard 0.4%", value: inr(safeguardAmt) },
          { label: "PLI −0.5%", value: inr(pliAmt) },
          { label: "Provision purchase 2%", value: inr(provPurchaseAmt) },
          { label: "Provision sale 1%", value: inr(provSaleAmt) },
          { label: "DBK −2.6%", value: inr(dbkAmt) },
          { label: "Grand total", value: inr(grandTotal) },
        ],
        rule: "Calculated card — material total plus net commercial overheads.",

        source: "Costing sheet",
      },
    },

    // ------- Commercial pricing -------
    {
      id: "sp-inr",
      section: "pricing",
      label: "SP price (INR)",
      value: inr(spInr),
      desc: `Grand total ÷ (1 − ${pct(marginPct)})`,
      explain: {
        summary:
          "Selling price in rupees, grossed up from cost so the target margin is realised on sale value.",
        rows: [
          { label: "Grand total", value: inr(grandTotal) },
          { label: "Target margin", value: pct(marginPct) },
          { label: "SP price (INR)", value: inr(spInr) },
        ],
        rule: "SP = grand total ÷ (1 − margin). Margin is taken on selling price, not on cost.",
        source: "Commercial variables · Target margin",
      },
    },
    {
      id: "sp-usd",
      section: "pricing",
      label: "Price (USD)",
      value: `$${spUsd.toFixed(2)}`,
      desc: `FX ₹${inputs.fxRate.toFixed(2)} / $`,
      explain: {
        summary: "Quoted price converted at the working FX rate.",
        rows: [
          { label: "SP price (INR)", value: inr(spInr) },
          { label: "FX rate", value: `₹${inputs.fxRate.toFixed(2)} / $` },
          { label: "Price (USD)", value: `$${spUsd.toFixed(2)}` },
        ],
        rule: "SP INR ÷ FX rate. FX is a commercial variable on the left panel.",
        source: "Commercial variables · FX rate",
      },
    },
    {
      id: "margin",
      section: "pricing",
      label: "Margin %",
      value: pct(marginPct),
      desc: `${inr(spInr - grandTotal)} / pc`,
      explain: {
        summary: "Realised margin on the quoted selling price.",
        rows: [
          { label: "SP price (INR)", value: inr(spInr) },
          { label: "Grand total", value: inr(grandTotal) },
          { label: "Margin value", value: inr(spInr - grandTotal) },
          { label: "Margin %", value: pct(marginPct) },
        ],
        rule: "(SP − grand total) ÷ SP. Set the target on the left panel; costing recalculates the price.",
        source: "Commercial variables · Target margin",
      },
    },
    {
      id: "quoted-moq",
      section: "pricing",
      label: "Quoted MOQ",
      value: `${inputs.qty.toLocaleString("en-IN")} pcs`,
      desc: `Order value $${(spUsd * inputs.qty).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
      explain: {
        summary: "The quantity this price is valid for.",
        rows: [
          { label: "Quoted MOQ", value: `${inputs.qty.toLocaleString("en-IN")} pcs` },
          { label: "Price / pc", value: `$${spUsd.toFixed(2)}` },
          {
            label: "Order value",
            value: `$${(spUsd * inputs.qty).toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
          },
          { label: "Setup / pc at this MOQ", value: inr(m.setupPc) },
        ],
        rule: "Price is MOQ-dependent — setup amortisation changes with quantity.",
        source: "Commercial variables · MOQ",
      },
    },
  ];

  return {
    cards,
    materialTotal,
    overheadTotal,
    grandTotal,
    spInr,
    spUsd,
    marginPct,
    nums: {
      fabric: fabricCost,
      printing: printingCost,
      embroidery: embroideryCost,
      washing: washingCost,
      manufacturing: manufacturingCost,
      accessories: accessoriesCost,
      packagingMaterial: packagingMaterialCost,
      materialTotal,
      overhead: overheadAmt,
      cnf: cnfAmt,
      ecgcDocBc: ecgcAmt,
      insFrt: insFrtAmt,
      paymentTerms: paymentTermsAmt,
      testing: testingAmt,
      certification: certificationAmt,
      safeguard: safeguardAmt,
      pli: pliAmt,
      packaging: packagingMaterialCost,

      provPurchase: provPurchaseAmt,
      provSale: provSaleAmt,
      dbk: dbkAmt,
      supplierMarginOh: materialTotal * 0.12,
      grandTotal,
      spInr,
      spUsd,
      marginPct,
      fxRate: inputs.fxRate,
      qty: inputs.qty,
    },
  };

  function mat(
    id: string,
    label: string,
    value: number,
    desc: string,
    explain: { summary: string; rows: ExplainRow[]; rule?: string; source?: string },
    shareLine?: string,
  ): CostCard {
    return {
      id: `mat-${id}`,
      section: "material",
      label,
      value: inr(value),
      desc: value > 0 ? `${desc}${shareLine ? ` · ${shareLine}` : ""}` : desc,
      explain,
    };
  }

  function ovh(
    id: string,
    label: string,
    rate: string,
    amount: number,
    base: number,
    e: { summary: string; rule?: string; source?: string },
  ): CostCard {
    return {
      id: id.startsWith("oh-") ? id : `oh-${id}`,
      section: "overheads",
      label,
      value: inr(amount),
      desc: `${rate} of material total`,
      explain: {
        summary: e.summary,
        rows: [
          { label: "Basis", value: `Material total ${inr(base)}` },
          { label: "Rate applied", value: rate },
          { label: "Calculated amount", value: inr(amount) },
        ],
        rule: e.rule,
        source: e.source,
      },
    };
  }
}
