/**
 * The commercial layer that turns DIRECT COST into a quoted selling price.
 *
 * Direct cost is manufacturing reality and is owned by Configuration & Costing
 * (`rollupVariant`). Nothing in this module ever writes back into it — every
 * figure here is applied ON TOP, exactly the way an export cost sheet stacks
 * provisions over the ex-works cost:
 *
 *   direct cost
 *     + purchase / supplier provisions   (what it costs us to buy it)
 *     + sale / commercial provisions     (what it costs us to ship & bill it)
 *     = final cost
 *     ÷ (1 − margin)                     = selling price
 *
 * Percentages are quoted against direct cost, which is how the sheet is
 * written and how the costing team reasons about them. Credits (PLI, duty
 * drawback) are negative rates and reduce the loaded cost, so a single sum
 * handles debits and credits without special cases.
 *
 * Everything is pure: same inputs, same numbers, every render.
 */

/* ------------------------------------------------------------------ *
 * Rates
 * ------------------------------------------------------------------ */

/** One provision line: a named percentage applied to direct cost. */
export type ProvisionId =
  /* purchase / supplier side */
  | "overheadCost"
  | "supplierMargin"
  | "testingCost"
  | "specialCommercial"
  | "safeguard"
  | "paymentTerms"
  | "commission"
  | "unexpectedClaim"
  | "pli"
  /* sale / commercial side */
  | "colourMatchingBox"
  | "pkgAcc"
  | "inspectionFreight"
  | "ecgcDocBc"
  | "cnf"
  | "dbk";

export type ProvisionSide = "purchase" | "sale";

export type ProvisionDef = {
  id: ProvisionId;
  label: string;
  side: ProvisionSide;
  /** a negative default marks the line as an incentive / drawback credit */
  credit?: boolean;
  hint: string;
};

/**
 * The sheet, in the order a costing team reads it. Kept as data so the
 * quotation panel, the kit summary and any future approval screen all render
 * the same lines from one definition.
 */
export const PROVISIONS: ProvisionDef[] = [
  /* ---- Purchase / Supplier Provisions ---- */
  {
    id: "overheadCost",
    label: "Overhead Cost %",
    side: "purchase",
    hint: "Factory and administrative overhead absorbed into the purchase price.",
  },
  {
    id: "supplierMargin",
    label: "Supplier Margin / OH %",
    side: "purchase",
    hint: "The vendor's own margin and overhead recovery on the ex-works price.",
  },
  {
    id: "testingCost",
    label: "Testing Cost %",
    side: "purchase",
    hint: "Lab testing and certification, spread across the quoted quantity.",
  },
  {
    id: "specialCommercial",
    label: "Special Commercial Cost",
    side: "purchase",
    hint: "Buyer-specific commercial charges agreed outside the standard terms.",
  },
  {
    id: "safeguard",
    label: "Safeguard %",
    side: "purchase",
    hint: "Provision held against quality rejections and reworks.",
  },
  {
    id: "paymentTerms",
    label: "Payment Terms %",
    side: "purchase",
    hint: "Cost of credit carried over the agreed payment window.",
  },
  {
    id: "commission",
    label: "Commission %",
    side: "purchase",
    hint: "Buying-house or agent commission on the order value.",
  },
  {
    id: "unexpectedClaim",
    label: "Unexpected Claim %",
    side: "purchase",
    hint: "Contingency for claims, shortfalls and late-shipment penalties.",
  },
  {
    id: "pli",
    label: "PLI %",
    side: "purchase",
    credit: true,
    hint: "Production-linked incentive — a credit, so it reduces the loaded cost.",
  },

  /* ---- Sale / Commercial Provisions ---- */
  {
    id: "colourMatchingBox",
    label: "Colour Matching Box %",
    side: "sale",
    hint: "Lab dips, colour boxes and shade approvals raised for the buyer.",
  },
  {
    id: "pkgAcc",
    label: "PKG + ACC %",
    side: "sale",
    hint: "Export packing, cartons and accessories charged at the sale stage.",
  },
  {
    id: "inspectionFreight",
    label: "Inspection + Freight %",
    side: "sale",
    hint: "Third-party inspection plus inland freight to the port.",
  },
  {
    id: "ecgcDocBc",
    label: "ECGC + Documentation + BC %",
    side: "sale",
    hint: "Credit insurance, export documentation and bank charges.",
  },
  {
    id: "cnf",
    label: "C&F %",
    side: "sale",
    hint: "Clearing and forwarding at the load port.",
  },
  {
    id: "dbk",
    label: "DBK %",
    side: "sale",
    credit: true,
    hint: "Duty drawback — a credit, so it reduces the loaded cost.",
  },
];

export type ProvisionRates = Record<ProvisionId, number>;

/**
 * House defaults, matching the working cost sheet. Credits are stored
 * negative so debits and credits sum in one pass.
 */
export const DEFAULT_PROVISIONS: ProvisionRates = {
  overheadCost: 8.0,
  supplierMargin: 4.5,
  testingCost: 1.5,
  specialCommercial: 0.75,
  safeguard: 0.4,
  paymentTerms: 1.2,
  commission: 2.0,
  unexpectedClaim: 0.5,
  pli: -0.5,

  colourMatchingBox: 0.35,
  pkgAcc: 2.2,
  inspectionFreight: 1.6,
  ecgcDocBc: 0.85,
  cnf: 1.1,
  dbk: -2.6,
};

/* ------------------------------------------------------------------ *
 * Computation
 * ------------------------------------------------------------------ */

export type CommercialSettings = {
  rates: ProvisionRates;
  /** ₹ per $ */
  fxRate: number;
  /** margin on the selling price, not a mark-up on cost */
  targetMarginPct: number;
  /** what the buyer has said they want to pay, $ / pc */
  buyerTargetUsd: number;
};

export type ProvisionLine = ProvisionDef & {
  /** the rate actually applied, % of direct cost */
  pct: number;
  /** ₹ per piece this line contributes (negative for credits) */
  amountInr: number;
};

export type CommercialResult = {
  /** manufacturing cost from the costing roll-up, ₹ / pc — never modified here */
  directCostInr: number;

  purchaseLines: ProvisionLine[];
  saleLines: ProvisionLine[];

  /** Total Provision on Purchase % — the subtotal of every purchase-side line */
  totalPurchasePct: number;
  totalPurchaseInr: number;
  /** Total Provision on Sale % */
  totalSalePct: number;
  totalSaleInr: number;

  /* ---- the four buckets the final block reports, non-overlapping ---- */
  commercialOverheadsInr: number;
  supplierMarginsInr: number;
  otherIndirectInr: number;
  provisionsInr: number;

  /** direct cost + every provision, ₹ / pc */
  finalCostInr: number;
  finalCostUsd: number;

  fxRate: number;
  marginPct: number;
  sellingInr: number;
  sellingUsd: number;
  marginInr: number;
  marginUsd: number;

  buyerTargetUsd: number;
  /** the quote is at or under what the buyer said they would pay */
  onTarget: boolean;
  headroomUsd: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Buckets used by the Final Commercial Calculation block. */
const OTHER_INDIRECT: ProvisionId[] = [
  "testingCost",
  "specialCommercial",
  "safeguard",
  "paymentTerms",
  "commission",
  "unexpectedClaim",
  "pli",
];

/**
 * Load a direct cost with the full commercial stack.
 *
 * `directCostInr` comes straight from `rollupVariant(...).directCost` — the
 * same number the costing sheet shows — and is returned untouched so the two
 * screens can never disagree about what the product costs to make.
 */
export function computeCommercials(
  directCostInr: number,
  settings: CommercialSettings,
): CommercialResult {
  const rates = { ...DEFAULT_PROVISIONS, ...settings.rates };
  const fxRate = settings.fxRate > 0 ? settings.fxRate : 1;

  const lineOf = (d: ProvisionDef): ProvisionLine => {
    const pct = rates[d.id] ?? 0;
    return { ...d, pct, amountInr: round2((directCostInr * pct) / 100) };
  };

  const purchaseLines = PROVISIONS.filter((p) => p.side === "purchase").map(lineOf);
  const saleLines = PROVISIONS.filter((p) => p.side === "sale").map(lineOf);

  const sumPct = (lines: ProvisionLine[]) => round2(lines.reduce((t, l) => t + l.pct, 0));
  const sumInr = (lines: ProvisionLine[]) => round2(lines.reduce((t, l) => t + l.amountInr, 0));

  const totalPurchasePct = sumPct(purchaseLines);
  const totalPurchaseInr = sumInr(purchaseLines);
  const totalSalePct = sumPct(saleLines);
  const totalSaleInr = sumInr(saleLines);

  const pick = (ids: ProvisionId[]) => sumInr(purchaseLines.filter((l) => ids.includes(l.id)));

  const commercialOverheadsInr = pick(["overheadCost"]);
  const supplierMarginsInr = pick(["supplierMargin"]);
  const otherIndirectInr = pick(OTHER_INDIRECT);
  const provisionsInr = totalSaleInr;

  const finalCostInr = round2(directCostInr + totalPurchaseInr + totalSaleInr);

  // Margin is quoted on the selling price, not as a mark-up on cost — which is
  // how the commercial team states it and how the buyer reads it back.
  const marginFraction = Math.min(0.94, Math.max(-2, settings.targetMarginPct / 100));
  const sellingInr = round2(finalCostInr / (1 - marginFraction));
  const sellingUsd = round2(sellingInr / fxRate);
  const marginInr = round2(sellingInr - finalCostInr);

  return {
    directCostInr: round2(directCostInr),
    purchaseLines,
    saleLines,
    totalPurchasePct,
    totalPurchaseInr,
    totalSalePct,
    totalSaleInr,
    commercialOverheadsInr,
    supplierMarginsInr,
    otherIndirectInr,
    provisionsInr,
    finalCostInr,
    finalCostUsd: round2(finalCostInr / fxRate),
    fxRate,
    marginPct: settings.targetMarginPct,
    sellingInr,
    sellingUsd,
    marginInr,
    marginUsd: round2(marginInr / fxRate),
    buyerTargetUsd: settings.buyerTargetUsd,
    onTarget: sellingUsd <= settings.buyerTargetUsd,
    headroomUsd: round2(settings.buyerTargetUsd - sellingUsd),
  };
}

/**
 * Roll several already-loaded members up into one set price.
 *
 * A kit is not two quotes side by side: the members' direct costs are summed
 * per set FIRST, then the commercial stack is applied once to the set. That is
 * what makes the kit price a single commercial position rather than an
 * arithmetic total of unrelated lines.
 */
export function computeKitCommercials(
  members: { directCostInr: number; unitsPerSet: number }[],
  settings: CommercialSettings,
): CommercialResult {
  const setDirect = members.reduce(
    (t, m) => t + m.directCostInr * (m.unitsPerSet > 0 ? m.unitsPerSet : 1),
    0,
  );
  return computeCommercials(round2(setDirect), settings);
}

/** Formatting helpers shared by every commercial surface. */
export const inr = (n: number, decimals = 2) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

export const usd = (n: number, decimals = 2) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

export const pct = (n: number, decimals = 2) => `${n.toFixed(decimals)}%`;
