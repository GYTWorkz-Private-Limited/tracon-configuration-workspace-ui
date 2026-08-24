/**
 * Where each quoted line stands in the commercial review.
 *
 * The Quotation workspace exists to take costed lines through Review →
 * Override → Approve / Reject, so every line needs a stated position in that
 * process and the quotation needs a count of them. Both the summary table and
 * the decision bar read from here, so the badge on a row and the number in the
 * health strip can never disagree.
 *
 * Derived, never stored: a line "requires review" because of what it currently
 * says, and answering the problem should clear the flag without anybody having
 * to remember to.
 */

import type { ViewedItem } from "./quotationView";

export type ReviewStatus = "rejected" | "overridden" | "review" | "ready";

export const REVIEW_LABEL: Record<ReviewStatus, string> = {
  rejected: "Rejected",
  overridden: "Overridden",
  review: "Review",
  ready: "Ready",
};

/**
 * The margin below which a line is held for review.
 *
 * Not zero: a line scraping a point of margin is as much of a commercial
 * decision as one losing money, and letting it through unflagged is how a
 * quotation goes out at a number nobody chose.
 */
export const REVIEW_MARGIN_PCT = 5;

/** Has a hand-set figure been applied anywhere on this line? */
export function isOverridden(view: ViewedItem): boolean {
  const c = view.priced.commercial;
  if (c.finalCostEdited || c.sellingPriceEdited) return true;
  if (view.kind === "kit") {
    return (
      view.item.sets !== undefined ||
      view.item.members.some((m) => m.line.moqOverride !== undefined)
    );
  }
  return view.item.lines.some(
    (l) =>
      l.moqOverride !== undefined ||
      l.finalCostOverrideInr !== undefined ||
      l.sellingPriceOverrideUsd !== undefined,
  );
}

/**
 * One line's position. Order matters: a rejected line is rejected whatever
 * else is true of it, and an overridden line has already had its commercial
 * decision taken, so it is not still awaiting one.
 */
export function reviewStatusOf(view: ViewedItem): ReviewStatus {
  if (view.item.rejected) return "rejected";
  if (isOverridden(view)) return "overridden";
  return view.priced.commercial.marginPct < REVIEW_MARGIN_PCT ? "review" : "ready";
}

export type CommercialHealth = {
  articles: number;
  pricingLines: number;
  totalCostUsd: number;
  orderValueUsd: number;
  avgMarginInr: number;
  avgMarginPct: number;
  needsReview: number;
  overrides: number;
  rejected: number;
};

/** The at-a-glance figures management reads before deciding. */
export function commercialHealth(views: ViewedItem[]): CommercialHealth {
  let totalCostUsd = 0;
  let orderValueUsd = 0;
  let marginInr = 0;
  let pricingLines = 0;
  let needsReview = 0;
  let overrides = 0;
  let rejected = 0;

  for (const v of views) {
    const qty = v.kind === "kit" ? v.priced.sets : v.priced.moq;
    totalCostUsd += v.priced.commercial.finalCostUsd * qty;
    orderValueUsd += v.priced.orderValueUsd;
    marginInr += v.priced.commercial.marginInr;
    // A kit is quoted as one commercial position; a product carries a row per
    // configuration the team is choosing between.
    pricingLines += v.kind === "kit" ? 1 : v.item.lines.length;

    const status = reviewStatusOf(v);
    if (status === "review") needsReview += 1;
    if (status === "overridden") overrides += 1;
    if (status === "rejected") rejected += 1;
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    articles: views.length,
    pricingLines,
    totalCostUsd: round2(totalCostUsd),
    orderValueUsd: round2(orderValueUsd),
    avgMarginInr: round2(marginInr),
    avgMarginPct:
      orderValueUsd > 0
        ? Math.round(((orderValueUsd - totalCostUsd) / orderValueUsd) * 1000) / 10
        : 0,
    needsReview,
    overrides,
    rejected,
  };
}
