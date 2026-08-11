/**
 * Live costing pull for the Quotation module.
 *
 * Quotation is the COMMERCIAL layer. It never owns product cost — every rupee
 * shown in the Quoted Lines table is re-derived here, on read, from the same
 * costing engine the Costing workspace uses (`buildCostingSheet`).
 *
 * That is deliberate: the risk banner has to stay honest even when costing
 * changes after a quote was sent, so nothing here is ever frozen into the
 * quotation record except an explicit "cost at the moment we quoted" snapshot
 * used purely for drift comparison.
 */

import { DEFAULT_INPUTS, type CushionInputs } from "./cushionCosting";
import { buildCostingSheet } from "./costingSheet";

/** Stable small hash so every article costs the same on every render. */
function hash(s: string): number {
  let h = 7;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 99991;
  return h;
}

/** Size string → the longest dimension in inches (drives fabric consumption). */
export function inchesFromSize(size?: string): number {
  if (!size) return 18;
  const cm = /(\d+(?:\.\d+)?)\s*(?:×|x|\*)\s*(\d+(?:\.\d+)?)\s*cm/i.exec(size);
  if (cm) return Math.max(Number(cm[1]), Number(cm[2])) / 2.54;
  const inches = /(\d+(?:\.\d+)?)\s*(?:×|x|\*)\s*(\d+(?:\.\d+)?)/.exec(size);
  if (inches) return Math.max(Number(inches[1]), Number(inches[2]));
  const single = /(\d+(?:\.\d+)?)/.exec(size);
  return single ? Number(single[1]) : 18;
}

/** "2,500 pcs" → 2500 */
export function qtyFromMoq(moq?: string | number): number {
  if (typeof moq === "number") return moq > 0 ? moq : 1000;
  const n = Number(String(moq ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 1000;
}

export const BASE_SIZE_INCHES = 18;
/** Consumption grows with size but sub-quadratically, and is capped so an
 *  oversize article (a 108" quilt) does not produce an absurd fabric bill. */
function consumptionScale(sizeInches: number): number {
  return Math.min(9, Math.max(0.35, Math.pow(sizeInches / BASE_SIZE_INCHES, 1.55)));
}

export type CostPullItem = { label: string; rate?: string; amount: number };

export type CostPull = {
  /** raw material + process + packaging, ₹ / pc */
  directInr: number;
  /** compliance cost, ₹ / pc */
  complianceInr: number;
  /** net commercial overheads, ₹ / pc */
  overheadInr: number;
  /** fully loaded cost per piece — the Cost column in the quote table */
  grandInr: number;
  fxRate: number;
  moq: number;
  sizeInches: number;
  gsm: number;
  /** direct material & manufacturing bucket breakdown */
  directBuckets: CostPullItem[];
  /** compliance & testing breakdown */
  complianceBuckets: CostPullItem[];
  /** commercial overheads & logistics breakdown */
  overheadBuckets: CostPullItem[];
  /** legacy bucket list */
  buckets: CostPullItem[];
};

export type CostPullOpts = {
  moq: number;
  sizeInches?: number;
  gsm?: number;
  /** input-cost index — 1.0 = the rates the article was originally costed at */
  index?: number;
};

/**
 * Re-cost one article from its costing reference for Quotation.
 *
 * Pure and deterministic: same srfRef + same options always return the same
 * numbers, so the table does not flicker between renders.
 */
export function costingPull(srfRef: string, o: CostPullOpts): CostPull {
  const h = hash(srfRef);
  const sizeInches = o.sizeInches ?? BASE_SIZE_INCHES;
  const scale = consumptionScale(sizeInches);
  const index = o.index ?? 1;

  const inputs: CushionInputs = {
    ...DEFAULT_INPUTS,
    greigeCotton: round2(DEFAULT_INPUTS.greigeCotton * (0.86 + (h % 45) / 100)),
    reactivePrint: round2(DEFAULT_INPUTS.reactivePrint * (0.75 + ((h >> 2) % 60) / 100)),
    stitching: round2(DEFAULT_INPUTS.stitching * (0.8 + ((h >> 4) % 55) / 100) * scale ** 0.4),
    embroidery: h % 3 === 0 ? 0 : round2(DEFAULT_INPUTS.embroidery * (0.6 + ((h >> 6) % 70) / 100)),
    trimsLabels: round2(DEFAULT_INPUTS.trimsLabels * (0.7 + ((h >> 8) % 60) / 100)),
    packaging: round2(DEFAULT_INPUTS.packaging * (0.8 + ((h >> 5) % 50) / 100) * scale ** 0.3),
    frontMeters: round2(DEFAULT_INPUTS.frontMeters * scale),
    backMeters: round2(DEFAULT_INPUTS.backMeters * scale),
    qty: o.moq,
    sizeInches,
    fabricGsm: o.gsm ?? 200,
  };

  const sheet = buildCostingSheet(inputs, { productName: srfRef, variantName: "Quoted", includeOverheads: true });
  const n = sheet.nums;

  const directInr = sheet.materialTotal * index;
  const testingCost = round2((sheet.materialTotal * 0.015 + (inputs.testingPerPc ?? 0)) * index);
  const certCost = round2((sheet.materialTotal * 0.006 + (inputs.certPerPc ?? 0)) * index);
  const ecgcCost = round2(sheet.materialTotal * 0.008 * index);
  const safeguardCost = round2(sheet.materialTotal * 0.004 * index);
  const complianceInr = round2(testingCost + certCost + ecgcCost + safeguardCost);

  const factoryOhCost = round2(sheet.materialTotal * 0.08 * index);
  const cnfCost = round2(sheet.materialTotal * 0.012 * index);
  const insFrtCost = round2(sheet.materialTotal * 0.014 * index);
  const paymentTermsCost = round2(sheet.materialTotal * 0.009 * index);
  const pliCredit = round2(sheet.materialTotal * -0.005 * index);
  const dbkCredit = round2(sheet.materialTotal * -0.026 * index);
  const provPurchaseCost = round2(sheet.materialTotal * 0.02 * index);
  const provSaleCost = round2(sheet.materialTotal * 0.01 * index);
  const overheadInr = round2(factoryOhCost + cnfCost + insFrtCost + paymentTermsCost + pliCredit + dbkCredit + provPurchaseCost + provSaleCost);

  const grandInr = round2(directInr + complianceInr + overheadInr);

  const directBuckets: CostPullItem[] = [
    { label: "Base Fabric (Greige & Processing)", amount: round2(n.fabric * index) },
    { label: "Printing / Dyeing", amount: round2(n.printing * index) },
    { label: "Embroidery / Finishing", amount: round2(n.embroidery * index) },
    { label: "Manufacturing & Assembly", amount: round2(n.manufacturing * index) },
    { label: "Trims & Accessories", amount: round2(n.accessories * index) },
    { label: "Packaging Material", amount: round2(n.packagingMaterial * index) },
  ];

  const complianceBuckets: CostPullItem[] = [
    { label: "Testing & Lab Analysis", rate: "1.5%", amount: testingCost },
    { label: "Certifications (OEKO-TEX / GOTS)", rate: "0.6%", amount: certCost },
    { label: "ECGC & Credit Insurance", rate: "0.8%", amount: ecgcCost },
    { label: "Quality Safeguard Provision", rate: "0.4%", amount: safeguardCost },
  ];

  const overheadBuckets: CostPullItem[] = [
    { label: "Factory & Admin Overhead", rate: "8.0%", amount: factoryOhCost },
    { label: "CNF & Port Handling", rate: "1.2%", amount: cnfCost },
    { label: "Transit Insurance & Freight", rate: "1.4%", amount: insFrtCost },
    { label: "Commercial Payment Terms", rate: "0.9%", amount: paymentTermsCost },
    { label: "Provision - Purchase & Sale", rate: "3.0%", amount: round2(provPurchaseCost + provSaleCost) },
    { label: "PLI Incentive Credit", rate: "-0.5%", amount: pliCredit },
    { label: "Duty Drawback (DBK Credit)", rate: "-2.6%", amount: dbkCredit },
  ];

  const buckets: CostPullItem[] = [
    ...directBuckets,
    { label: "Compliance & Quality Costs", amount: complianceInr },
    { label: "Commercial & Logistics Overheads", amount: overheadInr },
  ];

  return {
    directInr,
    complianceInr,
    overheadInr,
    grandInr,
    fxRate: inputs.fxRate,
    moq: o.moq,
    sizeInches,
    gsm: inputs.fabricGsm ?? 200,
    directBuckets,
    complianceBuckets,
    overheadBuckets,
    buckets,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ *
 * Price ↔ margin — the only two editable numbers in the module.
 * Cost is fixed by costing; changing one of these recalculates the other.
 * ------------------------------------------------------------------ */

/** Margin realised on a selling price, given the loaded cost. */
export function marginFor(priceUsd: number, costInr: number, fxRate: number): number {
  if (priceUsd <= 0) return 0;
  const costUsd = costInr / fxRate;
  return ((priceUsd - costUsd) / priceUsd) * 100;
}

/** Selling price that realises a target margin, given the loaded cost. */
export function priceFor(marginPct: number, costInr: number, fxRate: number): number {
  const m = Math.min(94, Math.max(-200, marginPct)) / 100;
  const costUsd = costInr / fxRate;
  return round2(costUsd / (1 - m));
}

export const DEFAULT_TARGET_MARGIN = 22;
