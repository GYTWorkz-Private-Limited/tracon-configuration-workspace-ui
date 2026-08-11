/**
 * Historical context for the pricing decision — read-only.
 *
 * Two lenses, both deterministic so the same article always shows the same
 * history: what this buyer paid for this article before, and what the market
 * paid for the same construction. Neither is editable; they exist to tell the
 * preparer whether the number they are about to send is defensible.
 */

import { costIndexFor, type QuotationLine } from "./quotationsStore";

export type PreviousQuote = {
  quoteNo: string;
  date: string;
  size: string;
  moq: number;
  priceUsd: number;
  outcome: "order" | "rejected" | "no_response";
};

export type SimilarQuote = {
  buyer: string;
  quoteNo: string;
  product: string;
  size: string;
  priceUsd: number;
  status: "order" | "quoted" | "lost";
};

function hash(s: string): number {
  let h = 11;
  for (const ch of s) h = (h * 33 + ch.charCodeAt(0)) % 99991;
  return h;
}

const MONTHS = ["Jan", "Mar", "May", "Aug", "Sep", "Nov"];

/** Prior quotes to the same buyer for the same article. Newest first. */
export function previousQuotes(buyer: string, line: QuotationLine): PreviousQuote[] {
  const h = hash(`${buyer}|${line.srfRef}`);
  const year = new Date().getFullYear();
  const base = line.priceUsd / (1 + ((h % 12) + 4) / 100);

  return [0, 1, 2].map((i) => {
    const drop = 1 - i * (0.02 + ((h >> (i + 1)) % 4) / 100);
    return {
      quoteNo: `QT-${year - 1 - i}-${String(((h + i * 17) % 900) + 20).padStart(3, "0")}`,
      date: `${MONTHS[(h + i * 2) % MONTHS.length]} ${year - 1 - i}`,
      size: line.size,
      moq: Math.max(45, Math.round((line.moq * (0.08 + i * 0.02)) / 5) * 5),
      priceUsd: round2(base * drop),
      outcome: "order" as const,
    };
  });
}

/** Same construction quoted to other buyers — the market band. */
export function similarQuotes(line: QuotationLine): SimilarQuote[] {
  const h = hash(`market|${line.srfRef}|${line.size}`);
  const buyers = ["TARGET", "INUOVO", "WALMART", "H&M HOME", "IKEA"];
  const statuses: SimilarQuote["status"][] = ["order", "quoted", "order", "lost", "quoted"];
  const year = new Date().getFullYear();

  return [0, 1, 2].map((i) => {
    const swing = 1 + (((h >> (i * 3)) % 11) - 5) / 100;
    return {
      buyer: buyers[(h + i) % buyers.length],
      quoteNo: `QT-${year - (i % 2)}-${String(((h + i * 29) % 900) + 20).padStart(3, "0")}`,
      product: shortProduct(line.name),
      size: line.size,
      priceUsd: round2(line.priceUsd * swing),
      status: statuses[(h + i) % statuses.length],
    };
  });
}

function shortProduct(name: string): string {
  const words = name.split(/[\s—·-]+/).filter(Boolean);
  return words.slice(-2).join(" ");
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ *
 * Computed insights — the one-liners under each panel
 * ------------------------------------------------------------------ */

export type BuyerInsight = {
  deltaPct: number;
  lastAccepted: number;
  inputCostPct: number;
  justified: boolean;
  text: string;
};

export function buyerInsight(
  buyer: string,
  line: QuotationLine,
  history: PreviousQuote[],
): BuyerInsight | null {
  const lastOrder = history.find((h) => h.outcome === "order");
  if (!lastOrder) return null;

  const deltaPct = ((line.priceUsd - lastOrder.priceUsd) / lastOrder.priceUsd) * 100;
  const inputCostPct = (costIndexFor(line.srfRef) - 1) * 100;
  const accepted = history.filter((h) => h.outcome === "order").length;
  const justified = deltaPct <= inputCostPct + 1;

  const direction = deltaPct >= 0 ? "above" : "below";
  const text =
    `Current quote ($${line.priceUsd.toFixed(2)}) is ${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}% ` +
    `${direction} last accepted price. ${buyer} accepted ${
      accepted === history.length
        ? "every previous quote"
        : `${accepted} of ${history.length} previous quotes`
    }. ` +
    (inputCostPct > 0.5
      ? `Input costs are up ${inputCostPct.toFixed(1)}% — ${justified ? "price increase is justified" : "increase runs ahead of cost movement"}.`
      : "Input costs are broadly flat since the last order.");

  return { deltaPct, lastAccepted: lastOrder.priceUsd, inputCostPct, justified, text };
}

export type MarketInsight = {
  low: number;
  high: number;
  position: "below" | "within" | "top" | "above";
  text: string;
};

export function marketInsight(line: QuotationLine, market: SimilarQuote[]): MarketInsight | null {
  if (market.length === 0) return null;
  const prices = market.map((m) => m.priceUsd);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const p = line.priceUsd;

  const position: MarketInsight["position"] =
    p < low ? "below" : p > high ? "above" : p >= high - (high - low) * 0.25 ? "top" : "within";

  const where =
    position === "above"
      ? "above the market range"
      : position === "top"
        ? "at the top of range"
        : position === "below"
          ? "below the market range"
          : "mid-range";

  const inputCostPct = (costIndexFor(line.srfRef) - 1) * 100;
  const text =
    `Market range for this construction: $${low.toFixed(2)}–$${high.toFixed(2)}. ` +
    `This quote of $${p.toFixed(2)} is ${where}` +
    (inputCostPct > 0.5 ? ` given ${inputCostPct.toFixed(1)}% input cost increase.` : ".");

  return { low, high, position, text };
}
