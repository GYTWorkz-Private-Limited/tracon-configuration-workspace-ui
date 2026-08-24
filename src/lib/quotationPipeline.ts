/**
 * The quotation pipeline — every quotation placed on ONE axis.
 *
 * The internal lifecycle (`quotationLifecycle`) answers "may I edit this, who
 * decides"; the buyer record answers "what did they say". The KPI row at the
 * top of the Quotations module needs both collapsed into a single position —
 * Draft → Pending Approval → Sent to Buyer → Accepted → Converted, with
 * Revised / Rejected / Expired as the off-ramps. This module is that collapse,
 * pure derivation only: nothing here is stored, so the cards can never
 * disagree with the stores they summarise.
 *
 * It also grades input-cost risk. `masterSnapshot` already knows which masters
 * rose and by how much; this module reduces that to the banner's three bands
 * (Critical / High / Medium) and to the two figures the list shows per row —
 * worst input-cost Δ and the margin the quotation would ACTUALLY earn if
 * honoured at today's rates.
 */

import type { QuotationState } from "./quotationLifecycle";
import { riskAssessment, type CostingSnapshot, type RiskAssessment } from "./masterSnapshot";
import { latestResponse, type BuyerRecord } from "./buyerResponseStore";

/* ------------------------------------------------------------------ *
 * Pipeline status
 * ------------------------------------------------------------------ */

export type PipelineStatus =
  | "draft"
  | "pending_approval"
  | "sent"
  | "accepted"
  | "converted"
  | "revised"
  | "rejected"
  | "expired";

export const PIPELINE_LABEL: Record<PipelineStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  sent: "Sent to Buyer",
  accepted: "Accepted",
  converted: "Converted to Order",
  revised: "Revised",
  rejected: "Rejected",
  expired: "Expired",
};

export const PIPELINE_TONE: Record<PipelineStatus, string> = {
  draft: "border-hairline bg-surface-alt text-ink-600",
  pending_approval: "border-gold-500/40 bg-gold-50 text-gold-700",
  sent: "border-sky-200 bg-sky-50 text-sky-700",
  accepted: "border-brand-600/30 bg-brand-50 text-brand-700",
  converted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  revised: "border-amber-300/60 bg-amber-50 text-amber-700",
  rejected: "border-[var(--color-risk)]/30 bg-[var(--color-risk-soft)] text-[var(--color-risk)]",
  expired: "border-hairline bg-ink-100 text-ink-500",
};

/** How long a sent quotation stands before it lapses. */
export const VALIDITY_DAYS = 14;

/** The date a sent quotation stops being an offer. */
export function validUntilOf(sentAt: string | undefined): Date | undefined {
  if (!sentAt) return undefined;
  const at = new Date(sentAt).getTime();
  if (!Number.isFinite(at)) return undefined;
  return new Date(at + VALIDITY_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * One position per quotation. Buyer facts outrank internal ones — a rejection
 * is a rejection whatever the approval panel says — and conversion outranks
 * everything, because an order is the end of the pipeline.
 */
export function pipelineStatusOf(
  state: QuotationState,
  buyer: BuyerRecord | undefined,
  sentAt: string | undefined,
): PipelineStatus {
  if (buyer?.convertedAt) return "converted";

  const last = latestResponse(buyer);
  if (last?.outcome === "accepted" || last?.outcome === "counter") return "accepted";
  if (last?.outcome === "rejected_price" || last?.outcome === "rejected_moq") return "rejected";
  if (last?.outcome === "revision") return "revised";

  // Out with the buyer, past its validity, and nothing has come back —
  // the offer has lapsed on its own.
  const validUntil = validUntilOf(sentAt);
  if (state.stage === "approved" && validUntil && validUntil.getTime() < Date.now()) {
    return "expired";
  }

  if (state.stage === "approved") return "sent";
  if (state.stage === "changes") return "revised";
  if (state.stage === "approval") return "pending_approval";
  return "draft";
}

/* ------------------------------------------------------------------ *
 * Risk grading
 * ------------------------------------------------------------------ */

export type RiskLevel = "critical" | "high" | "medium";

export const RISK_LABEL: Record<RiskLevel, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
};

export type QuotationRisk = {
  level: RiskLevel;
  /** the worst single input's rise — the figure the row leads with */
  maxPctUp: number;
  risen: RiskAssessment["risen"];
};

/**
 * Grade a snapshot into the banner's bands. Returns undefined when nothing
 * rose — no risk is a fact, not a fourth band.
 */
export function riskOf(snapshot: CostingSnapshot | undefined): QuotationRisk | undefined {
  if (!snapshot) return undefined;
  const { risen } = riskAssessment(snapshot);
  if (risen.length === 0) return undefined;
  const maxPctUp = Math.max(...risen.map((r) => r.pctUp));
  const level: RiskLevel = maxPctUp > 10 ? "critical" : maxPctUp > 5 ? "high" : "medium";
  return { level, maxPctUp, risen };
}

/**
 * The margin this quotation would ACTUALLY earn if honoured at today's rates.
 *
 * An estimate, stated as one: the raw-material share of cost is scaled by the
 * average rise across the risen masters, everything else held. That is exactly
 * the arithmetic a merchandiser does on paper before deciding whether to
 * requote, and it needs no re-cost pass to say.
 */
export function marginNowPct(
  sellingInr: number,
  finalCostInr: number,
  rawMaterialInr: number,
  risk: QuotationRisk | undefined,
): number {
  const base = sellingInr > 0 ? ((sellingInr - finalCostInr) / sellingInr) * 100 : 0;
  if (!risk || sellingInr <= 0) return base;
  const avgRise = risk.risen.reduce((t, r) => t + r.pctUp, 0) / risk.risen.length / 100;
  const newCost = finalCostInr + rawMaterialInr * avgRise;
  return ((sellingInr - newCost) / sellingInr) * 100;
}

/**
 * The price that would restore the quoted margin over today's estimated cost —
 * what the risk banner recommends before offering the requote.
 */
export function recommendedPriceUsd(
  sellingInr: number,
  finalCostInr: number,
  rawMaterialInr: number,
  quotedMarginPct: number,
  fxRate: number,
  risk: QuotationRisk | undefined,
): number | undefined {
  if (!risk || fxRate <= 0) return undefined;
  const avgRise = risk.risen.reduce((t, r) => t + r.pctUp, 0) / risk.risen.length / 100;
  const newCost = finalCostInr + rawMaterialInr * avgRise;
  const m = Math.min(Math.max(quotedMarginPct, 0), 95) / 100;
  const newSellingInr = m < 1 ? newCost / (1 - m) : newCost;
  return Math.round((newSellingInr / fxRate) * 100) / 100;
}
