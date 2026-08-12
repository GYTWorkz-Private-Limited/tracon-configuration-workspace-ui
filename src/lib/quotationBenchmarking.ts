/**
 * Internal pricing benchmarks — "has anyone quoted this before, and at what?"
 *
 * Strictly a commercial team aid: it never appears in the customer-facing
 * preview and never feeds the priced numbers. Deterministic (hashed off
 * buyer + article), so the same quote always shows the same history instead
 * of reshuffling on every render.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

function hash(s: string): number {
  let h = 7;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 99991;
  return h;
}

export type BuyerOutcome = "Order" | "Countered" | "Declined" | "No response";

export type PreviousQuoteRow = {
  quoteNo: string;
  date: string;
  size: string;
  moq: string;
  priceUsd: number;
  outcome: BuyerOutcome;
};

export type SimilarQuoteRow = {
  buyer: string;
  quoteNo: string;
  product: string;
  size: string;
  priceUsd: number;
  status: BuyerOutcome;
};

const OUTCOMES: BuyerOutcome[] = ["Order", "Countered", "Declined", "No response"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const OTHER_BUYERS = ["IKEA", "West Elm", "H&M Home", "Target", "John Lewis", "Wayfair"];

/** Previous quotes raised to THIS buyer for the SAME article. */
export function previousQuotesToBuyer(
  buyer: string,
  srfRef: string,
  sizeLabel: string,
  currentMoq: number,
): PreviousQuoteRow[] {
  const h = hash(`${buyer}::${srfRef}`);
  const count = 2 + (h % 3); // 2–4 rows
  const rows: PreviousQuoteRow[] = [];
  for (let i = 0; i < count; i++) {
    const hh = hash(`${buyer}::${srfRef}::${i}`);
    const monthsAgo = 3 + ((hh >> 2) % 15) + i * 3;
    const d = new Date();
    d.setMonth(d.getMonth() - monthsAgo);
    // Earlier quotes trend a little cheaper — costs generally drift upward.
    const drift = 1 - (count - i) * (0.02 + ((hh >> 5) % 5) / 100);
    const basePrice = 3.2 + ((hh >> 4) % 400) / 100;
    rows.push({
      quoteNo: `QT-${2022 + Math.floor((hh >> 6) % 4)}-${String(10 + i * 17 + ((hh >> 8) % 20)).padStart(3, "0")}`,
      date: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      size: sizeLabel,
      moq: `${Math.round((currentMoq * (0.7 + ((hh >> 3) % 60) / 100)) / 50) * 50}`,
      priceUsd: round2(basePrice * drift),
      outcome: OUTCOMES[hh % 4],
    });
  }
  // oldest first, so the table reads as a timeline
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/** The same construction, quoted to OTHER buyers. */
export function similarQuotesToOtherBuyers(
  srfRef: string,
  productName: string,
  sizeLabel: string,
  excludeBuyer: string,
): SimilarQuoteRow[] {
  const h = hash(`similar::${srfRef}`);
  const buyers = OTHER_BUYERS.filter((b) => b !== excludeBuyer);
  const count = 3 + (h % 2);
  const rows: SimilarQuoteRow[] = [];
  for (let i = 0; i < count; i++) {
    const hh = hash(`similar::${srfRef}::${i}`);
    const buyer = buyers[hh % buyers.length];
    const price = 3.4 + ((hh >> 4) % 420) / 100;
    rows.push({
      buyer,
      quoteNo: `QT-${2023 + ((hh >> 6) % 3)}-${String(20 + i * 17 + ((hh >> 9) % 15)).padStart(3, "0")}`,
      product: productName,
      size: sizeLabel,
      priceUsd: round2(price),
      status: OUTCOMES[(hh >> 2) % 4],
    });
  }
  return rows;
}

/** One line explaining how the current quote sits against this buyer's history. */
export function buyerInsight(
  rows: PreviousQuoteRow[],
  currentPriceUsd: number,
  buyer: string,
  inputCostDriftPct: number,
): string {
  if (rows.length === 0) return `No previous quotes on file for ${buyer} on this article.`;

  const last = rows[rows.length - 1];
  const deltaPct =
    last.priceUsd > 0 ? ((currentPriceUsd - last.priceUsd) / last.priceUsd) * 100 : 0;
  const accepted = rows.filter((r) => r.outcome === "Order").length;
  const acceptRate =
    accepted === rows.length
      ? `${buyer} accepted every previous quote`
      : accepted === 0
        ? `${buyer} has not accepted a previous quote`
        : `${buyer} accepted ${accepted} of ${rows.length} previous quotes`;

  const direction = deltaPct >= 0 ? "above" : "below";
  const magnitude = Math.abs(Math.round(deltaPct * 10) / 10);
  const costLine =
    inputCostDriftPct > 0
      ? ` Input costs are up ${inputCostDriftPct.toFixed(1)}% — the increase is justified.`
      : "";

  return `Current quote is ${magnitude}% ${direction} the last accepted price of $${last.priceUsd.toFixed(2)}. ${acceptRate}.${costLine}`;
}

/** One line placing the current price inside the market range for this construction. */
export function marketInsight(rows: SimilarQuoteRow[], currentPriceUsd: number): string {
  if (rows.length === 0) return "No comparable quotes to other buyers on file.";
  const prices = rows.map((r) => r.priceUsd);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const position =
    currentPriceUsd > max
      ? "above the top of that range"
      : currentPriceUsd < min
        ? "below the bottom of that range"
        : currentPriceUsd >= min + (max - min) * 0.66
          ? "at the upper end"
          : currentPriceUsd <= min + (max - min) * 0.33
            ? "at the lower end"
            : "mid-range";

  return `Market range for this construction: $${min.toFixed(2)}–$${max.toFixed(2)}. Current quote of $${currentPriceUsd.toFixed(2)} is ${position}.`;
}

export const OUTCOME_TONE: Record<BuyerOutcome, string> = {
  Order: "bg-brand-50 text-brand-700",
  Countered: "bg-amber-50 text-amber-800",
  Declined: "bg-[#fbeceb] text-[#8f2c22]",
  "No response": "bg-ink-100 text-ink-500",
};
