/**
 * Costing an article on ITS OWN geometry and volume.
 *
 * Several articles legitimately share a costing model — a runner and a
 * placemat are both flat printed table linen — but they are not the same
 * product. These helpers seed the size and MOQ parameters from the article
 * record so each one is costed at its real dimensions instead of the model's
 * reference build.
 *
 * Pure, and used by both the Configuration workspace and the Kit Summary, so
 * a member tab and the consolidation can never start from different builds.
 */

import { rollupVariant, type Variant } from "./costingModel";
import { addCustomOption, applyParameters } from "./pricingVariants";
import { resolveCostingModel } from "./costingModels";
import { parseMoq, parseSize } from "./quotationPricing";
import type { KitItem } from "./podsStore";

/** The article facts that change how a shared costing model prices. */
export type ArticleDimensions = { size?: string; moq?: string };

/** Apply an article's own size and MOQ on top of a model's default variant. */
export function seedVariantFor(defaultVariant: Variant, article: ArticleDimensions): Variant {
  const size = parseSize(article.size);
  const moq = parseMoq(article.moq);
  if (!size && !moq) return defaultVariant;

  let parameters = defaultVariant.parameters;
  if (size) {
    parameters = addCustomOption(parameters, "size", {
      id: `size-${size[0]}x${size[1]}`,
      label: `${size[0]}" × ${size[1]}"`,
      value: size,
    });
  }
  if (moq) {
    parameters = addCustomOption(parameters, "moq", {
      id: `moq-${moq}`,
      label: `${moq.toLocaleString("en-IN")} pcs`,
      value: moq,
    });
  }
  return { ...defaultVariant, parameters };
}

/**
 * Direct cost per set at each member's default build — for a page header,
 * which renders before any member tab has reported its live roll-up. Uses the
 * same seeded pipeline the tabs use, so it lands on the same number they do.
 */
export function estimateKitDirectUsd(items: KitItem[] = []): number {
  let inr = 0;
  let fx = 90;
  for (const item of items) {
    const bundle = resolveCostingModel(item.srfRef);
    const seeded = seedVariantFor(bundle.defaultVariant, item);
    const priced = applyParameters(seeded, seeded.parameters, bundle.masters);
    inr += rollupVariant(priced, bundle.masters).directCost * (item.qty > 0 ? item.qty : 1);
    fx = priced.commercial.fxRate > 0 ? priced.commercial.fxRate : fx;
  }
  return inr / fx;
}
