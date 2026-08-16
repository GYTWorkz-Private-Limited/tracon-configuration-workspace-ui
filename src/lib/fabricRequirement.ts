/**
 * How many metres of each fabric this POD actually needs — and therefore what
 * the fabric costs.
 *
 * A placemat and a runner cut from the same greige are not two purchases, they
 * are one. Costed article by article, each one asks the mill for its own small
 * quantity and pays the small-quantity rate; costed together, the same order
 * clears a price break and every piece gets cheaper. The metre count is what
 * makes that visible, so it is computed once, across the whole POD, and the
 * fabric rows are then priced at the tier the total actually reaches.
 *
 * Two rules hold this together:
 *
 *   • Consumption is rate-independent. The requirement pass prices articles at
 *     base rates purely to read their consumption, so there is no circularity
 *     between "what does it cost" and "how much do we need".
 *
 *   • The tier is a RATE OVERRIDE, not a new number. It goes through the same
 *     `withOverride` the quality parameter uses, so the sheet's Master Source
 *     & Overrides panel can still say where the figure came from.
 */

import { rollupVariant, type MaterialMaster, type RateTier } from "./costingModel";
import { applyParameters, moqOf } from "./pricingVariants";
import { resolveCostingModel } from "./costingModels";
import { seedVariantFor } from "./articleCosting";
import { getPod, type Article, type Pod } from "./podsStore";

/** Where the metres came from — one article's use of one fabric. */
export type FabricUse = {
  articleId: string;
  articleName: string;
  componentName: string;
  /** metres per finished piece, including wastage and shrinkage */
  perPiece: number;
  moq: number;
  metres: number;
};

export type FabricRequirement = {
  masterId: string;
  name: string;
  code: string;
  /** the whole POD's requirement for this fabric */
  metres: number;
  /** the band those metres land in */
  tier: RateTier;
  /** what this fabric costs the order: metres × the tier rate */
  costInr: number;
  /** what a single small order would have paid */
  baseRate: number;
  /** how much cheaper the tier is than the base band, as a positive percent */
  savingPct: number;
  /** rupees saved on this fabric by reaching the tier — never below zero */
  savingInr: number;
  /** the next band up, when there is one still to reach */
  nextTier?: {
    tier: RateTier;
    /** metres still needed to reach it */
    metresAway: number;
    /** ₹ saved per metre once it is reached */
    savingPerMetre: number;
    /** roughly how many more finished pieces that is, at today's mix */
    piecesAway: number;
  };
  uses: FabricUse[];
  /** the full price-break ladder, so a detail view can show every band, not just the one reached */
  tiers: RateTier[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The mill's price break ladder, as a discount off the base rate.
 *
 * Real quotes come per fabric, but the SHAPE is the same everywhere — the big
 * saving is in the first jump and it flattens after that — so one ladder over
 * each fabric's own rate gives every master believable breaks without four
 * hand-written numbers per fabric. A master that carries its own `rateTiers`
 * keeps them; this is the fallback, not an override.
 */
const TIER_LADDER: { minMetres: number; discount: number }[] = [
  { minMetres: 500, discount: 0 },
  { minMetres: 1000, discount: 0.124 },
  { minMetres: 2000, discount: 0.219 },
  { minMetres: 5000, discount: 0.324 },
];

export function tiersOf(master: MaterialMaster): RateTier[] {
  if (master.rateTiers?.length) return master.rateTiers;
  return TIER_LADDER.map(({ minMetres, discount }) => ({
    minMetres,
    rate: Math.round(master.rate * (1 - discount)),
  }));
}

/**
 * The band a quantity falls in.
 *
 * Between bands you pay the band you have actually reached — 1,800 m buys at
 * the 1,000 m rate, not the 2,000 m one. Rounding UP would quote a price the
 * mill never offered.
 */
export function tierFor(tiers: RateTier[] | undefined, metres: number): RateTier | undefined {
  if (!tiers?.length) return undefined;
  const sorted = [...tiers].sort((a, b) => a.minMetres - b.minMetres);
  let hit = sorted[0];
  for (const t of sorted) if (metres >= t.minMetres) hit = t;
  return hit;
}

/** The next band up, if the order has not already reached the cheapest one. */
export function nextTierFor(tiers: RateTier[] | undefined, metres: number): RateTier | undefined {
  if (!tiers?.length) return undefined;
  return [...tiers].sort((a, b) => a.minMetres - b.minMetres).find((t) => t.minMetres > metres);
}

/* ------------------------------------------------------------------ *
 * The requirement pass
 * ------------------------------------------------------------------ */

/** Articles that share a fabric pool. Kits contribute through their members. */
function costableArticles(pod: Pod): Article[] {
  const out: Article[] = [];
  for (const a of pod.articles ?? []) {
    // A kit is not a thing that consumes fabric — its members are, and they
    // are already articles on the POD. Counting both would double the metres.
    if (a.type === "kit") continue;
    out.push(a);
  }
  return out;
}

/**
 * Every fabric this POD needs, with the metres behind it.
 *
 * Priced at base rates on purpose: this pass reads consumption, and consumption
 * does not depend on what the fabric costs.
 */
export function fabricRequirementsFor(pod: Pod | undefined): FabricRequirement[] {
  if (!pod) return [];

  const byMaster = new Map<string, { master: MaterialMaster; metres: number; uses: FabricUse[] }>();

  for (const article of costableArticles(pod)) {
    // One unreadable article must not cost the page its other fabrics — this
    // is a summary, and a partial summary beats an error boundary.
    let components;
    let moq: number;
    try {
      const bundle = resolveCostingModel(article.srfRef);
      const seeded = seedVariantFor(bundle.defaultVariant, article);
      const priced = applyParameters(seeded, seeded.parameters, bundle.masters);
      moq = moqOf(priced.parameters);
      components = rollupVariant(priced, bundle.masters).components;
    } catch {
      continue;
    }
    if (moq <= 0) continue;

    for (const c of components) {
      const master = c.material?.master;
      // Only real fabric masters tier — a trim bought by the piece has no
      // metre count to aggregate, and inventing one would be noise.
      if (!master || master.materialType !== "Fabric") continue;
      if (c.consumptionPerPiece <= 0) continue;

      const metres = c.consumptionPerPiece * moq;
      const entry = byMaster.get(master.id) ?? { master, metres: 0, uses: [] };
      entry.metres += metres;
      entry.uses.push({
        articleId: article.id,
        articleName: article.name,
        componentName: c.component.name,
        perPiece: c.consumptionPerPiece,
        moq,
        metres: round2(metres),
      });
      byMaster.set(master.id, entry);
    }
  }

  return Array.from(byMaster.values())
    .map(({ master, metres, uses }) => {
      const rounded = Math.round(metres);
      const tiers = tiersOf(master);
      const tier = tierFor(tiers, rounded) ?? { minMetres: 0, rate: master.rate };
      const next = nextTierFor(tiers, rounded);
      // Metres per piece across everything using this fabric, so "how many more
      // pieces" is answered at the real mix rather than one article's rate.
      //
      // Pieces are counted per ARTICLE: a fabric used by four components of the
      // same placemat is still one run of placemats, and counting the order
      // four times would make every piece look four times less thirsty.
      const pieces = new Map(uses.map((u) => [u.articleId, u.moq]));
      const totalPieces = Array.from(pieces.values()).reduce((t, n) => t + n, 0);
      const metresPerPiece = metres / Math.max(totalPieces, 1);

      // A saving is a saving: it is stated as a positive number and simply
      // absent when the order buys at the base band. A "−0%" says nothing and
      // a minus sign next to a cost invites reading it as one.
      const saved = Math.max(master.rate - tier.rate, 0);

      return {
        masterId: master.id,
        name: master.name,
        code: master.code,
        metres: rounded,
        tier,
        costInr: Math.round(rounded * tier.rate),
        baseRate: master.rate,
        savingPct: master.rate > 0 ? Math.round((saved / master.rate) * 100) : 0,
        savingInr: Math.round(saved * rounded),
        nextTier: next && {
          tier: next,
          metresAway: next.minMetres - rounded,
          savingPerMetre: round2(tier.rate - next.rate),
          piecesAway:
            metresPerPiece > 0 ? Math.ceil((next.minMetres - rounded) / metresPerPiece) : 0,
        },
        uses,
        tiers,
      };
    })
    .sort((a, b) => b.metres - a.metres);
}

export function fabricRequirements(podId: string | undefined): FabricRequirement[] {
  return podId ? fabricRequirementsFor(getPod(podId)) : [];
}

/* ------------------------------------------------------------------ *
 * Feeding the tier back into pricing
 * ------------------------------------------------------------------ */

/**
 * What `applyParameters` needs to reprice a fabric row at its tier.
 *
 * A FACTOR, not a rate. By the time a row is priced its rate may already have
 * moved for reasons that have nothing to do with volume — the quality
 * parameter reprices the face cloth by GSM — and replacing that number with
 * the master's tier rate would quietly throw the quality decision away. The
 * price break is a discount on whatever cloth was settled on, so it is applied
 * as one.
 */
export type FabricRateOverrides = Record<string, { factor: number; note: string }>;

export function fabricRateOverrides(reqs: FabricRequirement[]): FabricRateOverrides {
  const out: FabricRateOverrides = {};
  for (const r of reqs) {
    // Nothing to say when the order sits in the base band: the sheet already
    // shows that rate, and an override that changes nothing is just noise in
    // the audit panel.
    if (r.tier.rate === r.baseRate || r.baseRate <= 0) continue;
    out[r.masterId] = {
      factor: r.tier.rate / r.baseRate,
      note: `Fabric requirement — ${r.metres.toLocaleString("en-IN")} m across this POD reaches the ${r.tier.minMetres.toLocaleString("en-IN")} m tier`,
    };
  }
  return out;
}

/** One call for the common case: "price this POD at the tiers it earns." */
export function podFabricRates(podId: string | undefined): FabricRateOverrides {
  return fabricRateOverrides(fabricRequirements(podId));
}

/* ------------------------------------------------------------------ *
 * Presentation helpers — shared so the report and the sheet agree
 * ------------------------------------------------------------------ */

export const metres = (n: number) => `${Math.round(n).toLocaleString("en-IN")} m`;

/** Fabric spend, in whole rupees — the figure a buyer would recognise. */
export const fabricCost = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export const tierLabel = (t: RateTier) => `${t.minMetres.toLocaleString("en-IN")} m MOQ tier`;

/** The same band, said the way the insight sentence says it. */
export const bandLabel = (t: RateTier) => `${t.minMetres.toLocaleString("en-IN")} m MOQ band`;

/**
 * Indian short-form money — ₹20.77L, ₹1.24Cr.
 *
 * Fabric spend runs to seven figures, and at that size a full ₹20,77,470 is
 * harder to hold in the head than the magnitude it stands for. The exact
 * figure is still one hover away in the sheet.
 */
export const inrShort = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};

/** The Configuration sheet's one-line statement of a fabric requirement. */
export const fabricLine = (r: FabricRequirement) =>
  `${r.name} · ${metres(r.metres)} required · ${tierLabel(r.tier)} · ₹${r.tier.rate}/m`;

export const FABRIC_INSIGHT_TITLE = "MOQ-driven fabric optimization";

/**
 * One paragraph, same words wherever it appears — the sheet, the report's
 * fabric card and the AI insights tab are describing one fact, and three
 * phrasings of it would read as three different findings.
 */
export function fabricInsightText(r: FabricRequirement): string {
  const opening = `The current requirement of ${metres(r.metres)} falls across the ${bandLabel(r.tier)} at ₹${r.tier.rate}/m, resulting in a modeled fabric cost of ${inrShort(r.costInr)}.`;

  if (r.savingPct > 0) {
    return `${opening} This rate is ${r.savingPct}% below the base/reference rate, creating an estimated ${inrShort(r.savingInr)} cost advantage at the current volume.`;
  }
  if (r.nextTier) {
    return `${opening} This is the base/reference rate — a further ${metres(r.nextTier.metresAway)} would reach the ${bandLabel(r.nextTier.tier)} at ₹${r.nextTier.tier.rate}/m, worth an estimated ${inrShort(r.nextTier.savingPerMetre * r.metres)} at the current volume.`;
  }
  return `${opening} This is the base/reference rate.`;
}

/** Pieces the fabric is being bought for — per article, not per component. */
const totalPieces = (r: FabricRequirement) =>
  Array.from(new Map(r.uses.map((u) => [u.articleId, u.moq])).values()).reduce((t, n) => t + n, 0);
