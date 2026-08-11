/**
 * Quotation module — system of record for the COMMERCIAL layer.
 *
 * Boundaries that hold everywhere in this file:
 *  - Costing owns product cost. Quotation never writes it back. The `costInr`
 *    on a line is a *snapshot at quote time* kept only so the risk banner can
 *    compare against the live pull; the table itself always shows live cost.
 *  - Nothing is overwritten. Revise / requote archive the current state into
 *    `versions` and open a new version number.
 *  - Every mutation that a reviewer could be asked to justify lands in `audit`.
 */

import { useSyncExternalStore } from "react";
import { getPod, updateArticle, type Article, type Pod } from "./podsStore";
import {
  DEFAULT_TARGET_MARGIN,
  costingPull,
  inchesFromSize,
  marginFor,
  priceFor,
  qtyFromMoq,
} from "./quotationCosting";

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type QuotationStatus =
  | "draft"
  | "pending_approval"
  | "sent"
  | "needs_revision"
  | "accepted"
  | "rejected"
  | "converted_to_order";

export type LineKind = "article" | "variant" | "kit" | "kit_component";
export type LineStatus = "active" | "rejected";

export type QuotationLineOptions = {
  size?: string;
  gsm?: number;
  fabricQuality?: string;
  printType?: string;
  embroideryType?: string;
  trims?: string;
  moqTier?: string;
  filling?: string;
};

export type QuotationLine = {
  id: string;
  /** display sequence — "1", "1A", "1B"; kit components carry "1.1" */
  sr: string;
  kind: LineKind;
  /** variant / kit-component rows point at the head row they belong to */
  parentId?: string;
  /** POD article this line was pulled from */
  articleId?: string;
  /** costing reference — the live cost pull key */
  srfRef: string;
  name: string;
  spec: string;
  size: string;
  moq: number;
  composition: string;
  certifications: string[];
  image?: string;
  /** variant identification */
  variantName?: string;
  variantId?: string;
  /** detailed product configuration options */
  options?: QuotationLineOptions;
  /** kit components only — how many of this article go into one set */
  unitsPerSet?: number;
  /** loaded cost at the moment the line was quoted (drift baseline only) */
  costAtQuoteInr: number;
  fxRate: number;
  priceUsd: number;
  /** which side of the price/margin pair the user last pinned */
  overrideOf?: "price" | "margin";
  status: LineStatus;
  rejectReason?: string;
  /** carried forward from a prior version by a requote */
  carriedFrom?: { version: number; mode: RequoteMode };
};

export type RequoteMode = "full_reconfiguration" | "high_level_override";

export type BuyerOutcome = "accepted" | "countered" | "rejected" | "none";

export type BuyerResponse = {
  outcome: BuyerOutcome;
  counterPriceUsd?: number;
  comments?: string;
  at?: string;
};

export type QuotationTerms = {
  incoterm: string;
  payment: string;
  delivery: string;
  certifications: string[];
};

export type AuditEntry = {
  id: string;
  at: string;
  by: string;
  action: string;
  /** what moved */
  field?: string;
  from?: string;
  to?: string;
  reason?: string;
  lineLabel?: string;
  version: number;
};

export type QuotationTimeline = {
  costingDoneAt?: string;
  approvedAt?: string;
  sentAt?: string;
  respondedAt?: string;
  orderedAt?: string;
};

/** A frozen, fully-readable copy of a prior version — never a diff. */
export type QuotationVersion = {
  version: number;
  label: string;
  createdAt: string;
  createdBy: string;
  status: QuotationStatus;
  lines: QuotationLine[];
  terms: QuotationTerms;
  timeline: QuotationTimeline;
  response?: BuyerResponse;
  /** true for the version that actually reached the buyer */
  sentToBuyer: boolean;
  note?: string;
};

export type Quotation = {
  id: string;
  podId: string;
  buyer: string;
  buyerRef: string;
  contact?: string;
  status: QuotationStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  validUntil: string;
  terms: QuotationTerms;
  lines: QuotationLine[];
  timeline: QuotationTimeline;
  response?: BuyerResponse;
  /** preparer explicitly accepted trading at a drifted cost */
  riskAcceptedAt?: string;
  audit: AuditEntry[];
  versions: QuotationVersion[];
  requotedFrom?: { quotationId: string; version: number };
  approvalNote?: string;
  revisionNote?: string;
};

export const ME = "Gautam Kitclu";

/* ------------------------------------------------------------------ *
 * Input-cost index — how far raw rates have moved since costing.
 * Real systems read this off the rate master; here it is a small, stable
 * table so the drift banner demonstrates a genuine recompute rather than a
 * frozen number.
 * ------------------------------------------------------------------ */

const COST_INDEX: Record<string, number> = {
  "SRF-1035": 1.113,
  "SRF-1024": 1.084,
  "SRF-1042": 1.031,
};

export function costIndexFor(srfRef: string): number {
  return COST_INDEX[srfRef] ?? 1;
}

/** Live loaded cost per piece for a line — recomputed on every read. */
export function liveCostInr(line: QuotationLine): number {
  return costingPull(line.srfRef, {
    moq: line.moq,
    sizeInches: inchesFromSize(line.size),
    index: costIndexFor(line.srfRef),
  }).grandInr;
}

/**
 * Cost of a line in the context of the quote it sits in.
 *
 * A kit is not costed on its own — it is the sum of its components, so the set
 * line always reconciles with the rows underneath it.
 */
export function liveCostOf(line: QuotationLine, all: QuotationLine[]): number {
  if (line.kind !== "kit") return liveCostInr(line);
  const parts = all.filter((l) => l.parentId === line.id && l.kind === "kit_component");
  if (parts.length === 0) return liveCostInr(line);
  return parts.reduce((s, p) => s + liveCostInr(p) * (p.unitsPerSet ?? 1), 0);
}

export function lineMargin(line: QuotationLine, costInr = liveCostInr(line)): number {
  return marginFor(line.priceUsd, costInr, line.fxRate);
}

/** Quoted cost baseline, kit-aware — mirrors `liveCostOf`. */
export function quotedCostOf(line: QuotationLine, all: QuotationLine[]): number {
  if (line.kind !== "kit") return line.costAtQuoteInr;
  const parts = all.filter((l) => l.parentId === line.id && l.kind === "kit_component");
  if (parts.length === 0) return line.costAtQuoteInr;
  return parts.reduce((s, p) => s + p.costAtQuoteInr * (p.unitsPerSet ?? 1), 0);
}

/* ------------------------------------------------------------------ *
 * Drift / risk
 * ------------------------------------------------------------------ */

export type DriftSeverity = "none" | "moderate" | "critical";

export type QuotationDrift = {
  severity: DriftSeverity;
  /** ₹ / pc, weighted across active lines */
  costDeltaInr: number;
  costDeltaPct: number;
  /** margin if the buyer accepted today, vs. margin at send time */
  marginNow: number;
  marginAtSend: number;
  /** blended recommended price across active lines, $ / pc */
  recommendedPriceUsd: number;
  currentPriceUsd: number;
  since?: string;
};

export function driftFor(q: Quotation): QuotationDrift | null {
  const lines = sendableLines(q);
  if (lines.length === 0) return null;

  // Averaged per piece, not summed: the banner speaks in the same unit the
  // quote does — one piece — so "₹175/pc" means something the reader can act on.
  const n = lines.length;
  const quoted = lines.reduce((s, l) => s + quotedCostOf(l, q.lines), 0) / n;
  const live = lines.reduce((s, l) => s + liveCostOf(l, q.lines), 0) / n;
  const price = lines.reduce((s, l) => s + l.priceUsd, 0) / n;

  const costDeltaInr = live - quoted;
  const costDeltaPct = quoted > 0 ? (costDeltaInr / quoted) * 100 : 0;
  if (Math.abs(costDeltaPct) < 0.5) return null;

  const fx = lines[0].fxRate;
  const marginNow = marginFor(price, live, fx);
  const marginAtSend = marginFor(price, quoted, fx);
  // Price that restores the margin the quote was approved at.
  const recommendedPriceUsd = priceFor(marginAtSend, live, fx);
  const marginDrop = marginAtSend - marginNow;

  return {
    severity: marginDrop >= 5 ? "critical" : "moderate",
    costDeltaInr,
    costDeltaPct,
    marginNow,
    marginAtSend,
    recommendedPriceUsd,
    currentPriceUsd: price,
    since: q.timeline.sentAt,
  };
}

/* ------------------------------------------------------------------ *
 * Derived helpers
 * ------------------------------------------------------------------ */

export const activeLines = (q: Quotation) => q.lines.filter((l) => l.status === "active");

export const sendableLines = (q: Quotation) =>
  activeLines(q).filter((l) => l.kind !== "kit_component");

// Kit components are priced inside their set, so they never count again at
// the quotation level — otherwise every kit would be billed twice.
export function orderValueUsd(q: Quotation): number {
  return sendableLines(q).reduce((s, l) => s + l.priceUsd * l.moq, 0);
}

export function blendedMargin(q: Quotation): number {
  const lines = sendableLines(q);
  if (!lines.length) return 0;
  const revenue = lines.reduce((s, l) => s + l.priceUsd * l.moq, 0);
  const cost = lines.reduce((s, l) => s + (liveCostOf(l, q.lines) / l.fxRate) * l.moq, 0);
  return revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
}

/** Blocking reasons that keep "Send for Approval" disabled. */
export function validateForApproval(q: Quotation): string[] {
  const problems: string[] = [];
  const lines = sendableLines(q);
  if (lines.length === 0) problems.push("Add at least one article, set or kit.");
  if (lines.some((l) => !(l.priceUsd > 0))) problems.push("Every line needs a price.");
  if (q.lines.some((l) => l.status === "rejected"))
    problems.push("Resolve lines sent back for recosting, or remove them.");
  if (!q.terms.incoterm.trim()) problems.push("Incoterm is required.");
  if (!q.terms.payment.trim()) problems.push("Payment terms are required.");
  if (!q.terms.delivery.trim()) problems.push("Delivery window is required.");
  return problems;
}

export const STATUS_LABEL: Record<QuotationStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  sent: "Sent — Awaiting Response",
  needs_revision: "Needs Revision",
  accepted: "Accepted",
  rejected: "Rejected",
  converted_to_order: "Converted to Order",
};

export const STATUS_TONE: Record<QuotationStatus, string> = {
  draft: "bg-ink-100 text-ink-700",
  pending_approval: "bg-amber-100 text-amber-800",
  sent: "bg-sky-100 text-sky-800",
  needs_revision: "bg-orange-100 text-orange-800",
  accepted: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
  converted_to_order: "bg-emerald-600 text-white",
};

/* ------------------------------------------------------------------ *
 * Store plumbing
 * ------------------------------------------------------------------ */

const STORAGE_KEY = "tracon.quotations.v2";

let quotations: Quotation[] = [];
const listeners = new Set<() => void>();

const now = () => new Date().toISOString();
const rid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(quotations));
  } catch {
    /* quota / private mode — the store still works in memory */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/* ------------------------------------------------------------------ *
 * Line construction
 * ------------------------------------------------------------------ */

function nextSr(lines: QuotationLine[]): string {
  const heads = lines.filter((l) => !l.parentId);
  return String(heads.length + 1);
}

function variantSr(lines: QuotationLine[], parent: QuotationLine): string {
  const siblings = lines.filter((l) => l.parentId === parent.id && l.kind === "variant");
  return `${parent.sr}${String.fromCharCode(65 + siblings.length)}`;
}

function componentSr(lines: QuotationLine[], parent: QuotationLine): string {
  const siblings = lines.filter((l) => l.parentId === parent.id);
  return `${parent.sr}.${siblings.length + 1}`;
}

type LineSeed = {
  kind: LineKind;
  articleId?: string;
  srfRef: string;
  name: string;
  variantName?: string;
  variantId?: string;
  options?: QuotationLineOptions;
  spec: string;
  size: string;
  moq: number;
  composition: string;
  certifications: string[];
  image?: string;
  unitsPerSet?: number;
  targetMarginPct?: number;
};

function buildLine(seed: LineSeed, sr: string, parentId?: string): QuotationLine {
  const pull = costingPull(seed.srfRef, {
    moq: seed.moq,
    sizeInches: inchesFromSize(seed.size),
    index: costIndexFor(seed.srfRef),
  });
  const margin = seed.targetMarginPct ?? DEFAULT_TARGET_MARGIN;
  return {
    id: rid("L"),
    sr,
    kind: seed.kind,
    parentId,
    articleId: seed.articleId,
    srfRef: seed.srfRef,
    name: seed.name,
    variantName: seed.variantName,
    variantId: seed.variantId,
    options: seed.options,
    spec: seed.spec,
    size: seed.size,
    moq: seed.moq,
    composition: seed.composition,
    certifications: seed.certifications,
    image: seed.image,
    unitsPerSet: seed.unitsPerSet,
    costAtQuoteInr: pull.grandInr,
    fxRate: pull.fxRate,
    priceUsd: priceFor(margin, pull.grandInr, pull.fxRate),
    status: "active",
  };
}

function seedFromArticle(a: Article): LineSeed {
  return {
    kind: a.type === "kit" ? "kit" : "article",
    articleId: a.id,
    srfRef: a.srfRef,
    name: a.name,
    spec:
      a.construction ||
      a.description ||
      [a.style, a.colour].filter(Boolean).join(" · ") ||
      "As per approved costing",
    size: a.size,
    moq: qtyFromMoq(a.moq),
    composition: a.composition || "100% Cotton",
    certifications: ["GOTS", "Oeko-Tex"],
    image: a.image,
  };
}

/* ------------------------------------------------------------------ *
 * Audit
 * ------------------------------------------------------------------ */

function log(q: Quotation, entry: Omit<AuditEntry, "id" | "at" | "version">): Quotation {
  return {
    ...q,
    updatedAt: now(),
    audit: [{ id: rid("AU"), at: now(), version: q.version, ...entry }, ...q.audit],
  };
}

function apply(id: string, fn: (q: Quotation) => Quotation) {
  quotations = quotations.map((q) => (q.id === id ? fn(q) : q));
  emit();
}

/* ------------------------------------------------------------------ *
 * Seed data
 * ------------------------------------------------------------------ */

function seed(): Quotation[] {
  const day = 86_400_000;
  const at = (d: number) => new Date(Date.now() - d * day).toISOString();
  const ahead = (d: number) => new Date(Date.now() + d * day).toISOString();

  const terms: QuotationTerms = {
    incoterm: "FOB Chennai",
    payment: "30% Advance + 70% BL",
    delivery: "90–100 days",
    certifications: ["GOTS", "Oeko-Tex"],
  };

  const mk = (seedLine: LineSeed, sr: string, parentId?: string) =>
    buildLine(seedLine, sr, parentId);

  const head = mk(
    {
      kind: "article",
      articleId: "A-SRF-1024",
      srfRef: "SRF-1024",
      name: "Sublimation Print Quilt",
      variantName: "Standard Queen (220 GSM)",
      variantId: "V-1024-STD",
      options: {
        size: '90×96"',
        gsm: 220,
        fabricQuality: "100% Poly Microfiber",
        printType: "Engineered Sublimation Print",
        embroideryType: "Terry Towel Accent Stitch",
        trims: "Self-fabric Piping & Corner Ties",
        moqTier: "500 pcs",
      },
      spec: "Front: Engineered sub print + terry emb · Back: Solid dyed poly · Heart quilting",
      size: '90×96"',
      moq: 500,
      composition: "100% Poly",
      certifications: ["GOTS", "Oeko-Tex"],
    },
    "1",
  );
  const v1 = mk(
    {
      kind: "variant",
      srfRef: "SRF-1024",
      name: "Same — Higher MOQ",
      variantName: "Volume Tier (1,000 pcs)",
      variantId: "V-1024-MOQ1000",
      options: {
        size: '90×96"',
        gsm: 220,
        fabricQuality: "100% Poly Microfiber",
        printType: "Engineered Sublimation Print",
        embroideryType: "Terry Towel Accent Stitch",
        trims: "Self-fabric Piping",
        moqTier: "1,000 pcs",
      },
      spec: "Identical construction",
      size: '90×96"',
      moq: 1000,
      composition: "100% Poly",
      certifications: ["GOTS", "Oeko-Tex"],
    },
    "1A",
    head.id,
  );
  const v2 = mk(
    {
      kind: "variant",
      srfRef: "SRF-1024",
      name: "Same — King Size",
      variantName: "King Oversize Tier",
      variantId: "V-1024-KING",
      options: {
        size: '108×96"',
        gsm: 220,
        fabricQuality: "100% Poly Microfiber",
        printType: "Engineered Sublimation Print",
        embroideryType: "Terry Towel Accent Stitch",
        trims: "Self-fabric Piping",
        moqTier: "500 pcs",
      },
      spec: "Identical construction, larger size",
      size: '108×96"',
      moq: 500,
      composition: "100% Poly",
      certifications: ["GOTS", "Oeko-Tex"],
    },
    "1B",
    head.id,
  );
  const sham = mk(
    {
      kind: "article",
      srfRef: "SRF-1042",
      name: "Sham",
      variantName: "Standard Pillow Sham",
      variantId: "V-1042-STD",
      options: {
        size: '20×26"',
        gsm: 200,
        fabricQuality: "100% Poly Microfiber",
        printType: "Matching Roller Print",
        embroideryType: "None",
        trims: "Envelope Back Closure",
        moqTier: "500 pcs",
      },
      spec: "Matching print · Envelope back · No filling",
      size: '20×26"',
      moq: 500,
      composition: "100% Poly",
      certifications: ["GOTS"],
    },
    "2",
  );
  const alt = mk(
    {
      kind: "variant",
      srfRef: "SRF-1041",
      name: "Alt Quality Quilt",
      variantName: "Lightweight 120 GSM Wadding",
      variantId: "V-1041-LIGHT",
      options: {
        size: '90×96"',
        gsm: 120,
        fabricQuality: "100% Poly Microfiber",
        printType: "Rotary Screen Print",
        embroideryType: "None",
        trims: "Self-fabric Binding",
        moqTier: "500 pcs",
      },
      spec: "120 GSM wadding instead of 150 GSM",
      size: '90×96"',
      moq: 500,
      composition: "100% Poly",
      certifications: ["Oeko-Tex"],
    },
    "2A",
    sham.id,
  );

  // This quote left the building before the current rate movement, so its
  // snapshot is taken at the pre-drift index — that gap is what the risk
  // banner recomputes against live costing.
  const preDrift = (l: QuotationLine): QuotationLine => {
    const pull = costingPull(l.srfRef, {
      moq: l.moq,
      sizeInches: inchesFromSize(l.size),
      index: 1,
    });
    return {
      ...l,
      costAtQuoteInr: pull.grandInr,
      priceUsd: priceFor(DEFAULT_TARGET_MARGIN, pull.grandInr, pull.fxRate),
    };
  };

  const lines = [head, v1, v2, sham, alt].map(preDrift);

  const sent: Quotation = {
    id: "QT-2025-041",
    podId: "POD-2038",
    buyer: "CBI",
    buyerRef: "CBI-090-25-26",
    contact: "sourcing@cbi-home.com",
    status: "sent",
    version: 1,
    createdAt: at(70),
    updatedAt: at(52),
    createdBy: ME,
    validUntil: ahead(9),
    terms,
    lines,
    timeline: { costingDoneAt: at(84), approvedAt: at(58), sentAt: at(52) },
    response: { outcome: "none" },
    audit: [
      {
        id: "AU-SEED-3",
        at: at(52),
        by: ME,
        action: "Quote sent to buyer",
        version: 1,
      },
      {
        id: "AU-SEED-2",
        at: at(58),
        by: "Meera K.",
        action: "Approved for sending",
        version: 1,
      },
      {
        id: "AU-SEED-1",
        at: at(70),
        by: ME,
        action: "Quotation created from costing",
        version: 1,
      },
    ],
    versions: [],
  };

  const draft: Quotation = {
    id: "QT-2025-052",
    podId: "POD-2041",
    buyer: "Zara Home",
    buyerRef: "ZH-AW26-CUSH-01",
    contact: "sourcing.eu@zarahome.com",
    status: "draft",
    version: 1,
    createdAt: at(2),
    updatedAt: at(1),
    createdBy: ME,
    validUntil: ahead(28),
    terms: {
      incoterm: "FOB Nhava Sheva",
      payment: "TT 30/70",
      delivery: "75–90 days",
      certifications: ["GOTS", "BCI"],
    },
    lines: [
      mk(
        {
          kind: "article",
          articleId: "A-SRF-1035",
          srfRef: "SRF-1035",
          name: "Velvet Cushion — Emerald",
          variantName: "Emerald Velvet Premium (240 GSM)",
          variantId: "V-1035-PREM",
          options: {
            size: '18×18"',
            gsm: 240,
            fabricQuality: "100% Combed Cotton Velvet",
            printType: "Reactive Screen Print (6 Colors)",
            embroideryType: "Gold Metallic Thread Accent",
            trims: "Concealed YKK Zipper & Piped Edge",
            moqTier: "2,000 pcs",
          },
          spec: "Printed front · hidden zip · piped edge",
          size: '18×18"',
          moq: 2000,
          composition: "100% Cotton Velvet",
          certifications: ["GOTS"],
        },
        "1",
      ),
    ],
    timeline: { costingDoneAt: at(3) },
    response: { outcome: "none" },
    audit: [
      {
        id: "AU-SEED-D1",
        at: at(2),
        by: ME,
        action: "Quotation created from costing",
        version: 1,
      },
    ],
    versions: [],
  };

  return [sent, draft];
}

function loadInitial() {
  if (typeof window === "undefined") {
    quotations = seed();
    return;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      quotations = JSON.parse(raw) as Quotation[];
      return;
    }
  } catch {
    /* fall through to seed */
  }
  quotations = seed();
  persist();
}

loadInitial();

/** Stable list for SSR so hydration never mismatches a localStorage edit. */
const serverQuotations: Quotation[] = seed();

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export function useQuotations(): Quotation[] {
  return useSyncExternalStore(
    subscribe,
    () => quotations,
    () => serverQuotations,
  );
}

export function useQuotation(id: string): Quotation | undefined {
  return useQuotations().find((q) => q.id === id);
}

export function getQuotation(id: string) {
  return quotations.find((q) => q.id === id);
}

/** The open draft / revision for a POD, if one exists. */
export function draftForPod(podId: string): Quotation | undefined {
  return quotations.find(
    (q) => q.podId === podId && (q.status === "draft" || q.status === "needs_revision"),
  );
}

export function quotationsForPod(podId: string): Quotation[] {
  return quotations.filter((q) => q.podId === podId);
}

function nextNumber(): string {
  const year = new Date().getFullYear();
  const nums = quotations
    .map((q) => Number(q.id.split("-").pop()))
    .filter((n) => Number.isFinite(n)) as number[];
  const next = (nums.length ? Math.max(...nums) : 40) + 1;
  return `QT-${year}-${String(next).padStart(3, "0")}`;
}

/* ------------------------------------------------------------------ *
 * Writes
 * ------------------------------------------------------------------ */

export function createQuotation(input: {
  podId: string;
  articleIds?: string[];
  terms?: Partial<QuotationTerms>;
  by?: string;
}): Quotation {
  const pod = getPod(input.podId);
  const by = input.by ?? ME;
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 30);

  const q: Quotation = {
    id: nextNumber(),
    podId: input.podId,
    buyer: pod?.buyer ?? "—",
    buyerRef: pod?.buyerRef ?? "—",
    status: "draft",
    version: 1,
    createdAt: now(),
    updatedAt: now(),
    createdBy: by,
    validUntil: validUntil.toISOString(),
    terms: {
      incoterm: "FOB Chennai",
      payment: "30% Advance + 70% BL",
      delivery: "90–100 days",
      certifications: ["GOTS", "Oeko-Tex"],
      ...input.terms,
    },
    lines: [],
    timeline: { costingDoneAt: now() },
    response: { outcome: "none" },
    audit: [{ id: rid("AU"), at: now(), by, action: "Quotation created", version: 1 }],
    versions: [],
  };

  quotations = [q, ...quotations];
  emit();

  if (input.articleIds?.length && pod) addArticles(q.id, input.articleIds, by);
  return getQuotation(q.id)!;
}

/** Add POD articles / sets / kits. Kits expand into their component lines. */
export function addArticles(id: string, articleIds: string[], by = ME) {
  apply(id, (q) => {
    const pod = getPod(q.podId);
    if (!pod) return q;
    let lines = [...q.lines];
    let next = q;

    for (const articleId of articleIds) {
      const a = pod.articles.find((x) => x.id === articleId);
      if (!a) continue;
      if (lines.some((l) => l.articleId === a.id && !l.parentId)) continue;

      const head = buildLine(seedFromArticle(a), nextSr(lines));
      lines = [...lines, head];

      for (const item of a.kitItems ?? []) {
        const comp = buildLine(
          {
            kind: "kit_component",
            srfRef: item.srfRef ?? a.srfRef,
            name: item.name,
            spec: `Kit component · ${item.qty} per set`,
            size: item.size ?? a.size,
            moq: qtyFromMoq(item.moq ?? a.moq),
            composition: a.composition || "100% Cotton",
            certifications: ["Oeko-Tex"],
            image: item.image,
            unitsPerSet: item.qty,
          },
          componentSr(lines, head),
          head.id,
        );
        lines = [...lines, comp];
      }

      // A set is worth the sum of its parts — reconcile the kit line so the
      // subtotal it shows matches the components listed under it.
      if ((a.kitItems ?? []).length > 0) {
        const kitCost = liveCostOf(head, lines);
        lines = lines.map((l) =>
          l.id === head.id
            ? {
                ...l,
                costAtQuoteInr: kitCost,
                priceUsd: priceFor(DEFAULT_TARGET_MARGIN, kitCost, l.fxRate),
              }
            : l,
        );
      }

      next = log(next, { by, action: "Line added", lineLabel: a.name });
    }

    return { ...next, lines };
  });
}

/** Add an alternate MOQ / size / quality tier under an existing head line. */
export function addVariantLine(
  id: string,
  parentId: string,
  patch: { name: string; spec?: string; size?: string; moq?: number },
  by = ME,
) {
  apply(id, (q) => {
    const parent = q.lines.find((l) => l.id === parentId);
    if (!parent) return q;
    const line = buildLine(
      {
        kind: "variant",
        articleId: parent.articleId,
        srfRef: parent.srfRef,
        name: patch.name,
        spec: patch.spec ?? "Identical construction",
        size: patch.size ?? parent.size,
        moq: patch.moq ?? parent.moq,
        composition: parent.composition,
        certifications: parent.certifications,
        image: parent.image,
      },
      variantSr(q.lines, parent),
      parent.id,
    );
    const idx = lastIndexOfFamily(q.lines, parent.id);
    const lines = [...q.lines.slice(0, idx + 1), line, ...q.lines.slice(idx + 1)];
    return log({ ...q, lines }, { by, action: "Variant added", lineLabel: patch.name });
  });
}

function lastIndexOfFamily(lines: QuotationLine[], parentId: string): number {
  let idx = lines.findIndex((l) => l.id === parentId);
  for (let i = idx + 1; i < lines.length; i++) {
    if (lines[i].parentId === parentId) idx = i;
  }
  return idx;
}

export function setLinePrice(id: string, lineId: string, priceUsd: number, by = ME) {
  apply(id, (q) => {
    const line = q.lines.find((l) => l.id === lineId);
    if (!line) return q;
    const cost = liveCostOf(line, q.lines);
    const before = `$${line.priceUsd.toFixed(2)} · ${lineMargin(line, cost).toFixed(1)}%`;
    const nextLine: QuotationLine = { ...line, priceUsd: priceUsd, overrideOf: "price" };
    const after = `$${priceUsd.toFixed(2)} · ${lineMargin(nextLine, cost).toFixed(1)}%`;
    return log(
      { ...q, lines: q.lines.map((l) => (l.id === lineId ? nextLine : l)) },
      {
        by,
        action: "Price overridden",
        field: "Price",
        from: before,
        to: after,
        lineLabel: line.name,
      },
    );
  });
}

export function setLineMargin(id: string, lineId: string, marginPct: number, by = ME) {
  apply(id, (q) => {
    const line = q.lines.find((l) => l.id === lineId);
    if (!line) return q;
    const cost = liveCostOf(line, q.lines);
    const price = priceFor(marginPct, cost, line.fxRate);
    const before = `$${line.priceUsd.toFixed(2)} · ${lineMargin(line, cost).toFixed(1)}%`;
    const after = `$${price.toFixed(2)} · ${marginPct.toFixed(1)}%`;
    return log(
      {
        ...q,
        lines: q.lines.map((l) =>
          l.id === lineId ? { ...l, priceUsd: price, overrideOf: "margin" as const } : l,
        ),
      },
      {
        by,
        action: "Margin overridden",
        field: "Margin",
        from: before,
        to: after,
        lineLabel: line.name,
      },
    );
  });
}

/** Reject a line and route the article back to Costing. Reason is mandatory. */
export function rejectLine(id: string, lineId: string, reason: string, by = ME) {
  apply(id, (q) => {
    const line = q.lines.find((l) => l.id === lineId);
    if (!line) return q;
    if (line.articleId) updateArticle(q.podId, line.articleId, { status: "in_progress" });
    return log(
      {
        ...q,
        lines: q.lines.map((l) =>
          l.id === lineId || l.parentId === lineId
            ? { ...l, status: "rejected" as const, rejectReason: reason }
            : l,
        ),
      },
      { by, action: "Line sent back for recosting", reason, lineLabel: line.name },
    );
  });
}

export function restoreLine(id: string, lineId: string, by = ME) {
  apply(id, (q) => {
    const line = q.lines.find((l) => l.id === lineId);
    if (!line) return q;
    return log(
      {
        ...q,
        lines: q.lines.map((l) =>
          l.id === lineId || l.parentId === lineId
            ? { ...l, status: "active" as const, rejectReason: undefined }
            : l,
        ),
      },
      { by, action: "Line restored to quote", lineLabel: line.name },
    );
  });
}

export function removeLine(id: string, lineId: string, by = ME) {
  apply(id, (q) => {
    const line = q.lines.find((l) => l.id === lineId);
    if (!line) return q;
    return log(
      { ...q, lines: q.lines.filter((l) => l.id !== lineId && l.parentId !== lineId) },
      { by, action: "Line removed", lineLabel: line.name },
    );
  });
}

export function updateTerms(id: string, patch: Partial<QuotationTerms>, by = ME) {
  apply(id, (q) => {
    const field = Object.keys(patch)[0] ?? "terms";
    const from = String((q.terms as Record<string, unknown>)[field] ?? "");
    const to = String((patch as Record<string, unknown>)[field] ?? "");
    return log(
      { ...q, terms: { ...q.terms, ...patch } },
      { by, action: "Commercial terms updated", field, from, to },
    );
  });
}

export function updateHeader(
  id: string,
  patch: Partial<Pick<Quotation, "buyerRef" | "contact" | "validUntil">>,
  by = ME,
) {
  apply(id, (q) => log({ ...q, ...patch }, { by, action: "Quotation header updated" }));
}

export function sendForApproval(id: string, note?: string, by = ME) {
  apply(id, (q) => {
    if (validateForApproval(q).length) return q;
    return log(
      { ...q, status: "pending_approval", approvalNote: note },
      { by, action: "Sent for commercial approval", reason: note },
    );
  });
}

export function approveQuotation(id: string, by = "Meera K.") {
  apply(id, (q) =>
    log(
      { ...q, status: "sent", timeline: { ...q.timeline, approvedAt: now(), sentAt: now() } },
      { by, action: "Approved — quote released to buyer" },
    ),
  );
}

export function requestRevision(id: string, note: string, by = "Meera K.") {
  apply(id, (q) =>
    log(
      { ...q, status: "needs_revision", revisionNote: note },
      {
        by,
        action: "Revision requested by approver",
        reason: note,
      },
    ),
  );
}

export function recordBuyerResponse(id: string, response: BuyerResponse, by = ME) {
  apply(id, (q) => {
    const status: QuotationStatus =
      response.outcome === "accepted"
        ? "accepted"
        : response.outcome === "rejected"
          ? "rejected"
          : response.outcome === "countered"
            ? "needs_revision"
            : q.status;
    return log(
      {
        ...q,
        status,
        response: { ...response, at: now() },
        timeline: response.outcome === "none" ? q.timeline : { ...q.timeline, respondedAt: now() },
      },
      {
        by,
        action: `Buyer response recorded — ${response.outcome}`,
        to: response.counterPriceUsd
          ? `Counter $${response.counterPriceUsd.toFixed(2)}`
          : undefined,
        reason: response.comments,
      },
    );
  });
}

/**
 * Attach a buyer-returned document (redlined quote, counter sheet).
 *
 * The file itself is not the record — the audit entry is. The commercial
 * decision still has to be typed into Record Buyer Response, so an uploaded
 * PDF can never silently move the quote's status.
 */
export function logBuyerUpload(id: string, fileName: string, by = ME) {
  apply(id, (q) => log(q, { by, action: "Buyer response document uploaded", to: fileName }));
}

export function acceptRisk(id: string, reason: string, by = ME) {
  apply(id, (q) =>
    log(
      { ...q, riskAcceptedAt: now() },
      {
        by,
        action: "Cost risk accepted — proceeding at quoted terms",
        reason,
      },
    ),
  );
}

export function convertToOrder(id: string, by = ME) {
  apply(id, (q) => {
    if (q.response?.outcome !== "accepted") return q;
    return log(
      {
        ...q,
        status: "converted_to_order",
        timeline: { ...q.timeline, orderedAt: now() },
      },
      { by, action: "Converted to order" },
    );
  });
}

/** Archive the current state and open a new, editable version in place. */
export function reviseQuotation(id: string, note: string, by = ME) {
  apply(id, (q) => {
    const archived: QuotationVersion = {
      version: q.version,
      label: `v${q.version}`,
      createdAt: q.updatedAt,
      createdBy: q.createdBy,
      status: q.status,
      lines: q.lines,
      terms: q.terms,
      timeline: q.timeline,
      response: q.response,
      sentToBuyer: Boolean(q.timeline.sentAt),
      note,
    };
    const next: Quotation = {
      ...q,
      version: q.version + 1,
      status: "draft",
      versions: [archived, ...q.versions],
      timeline: { costingDoneAt: q.timeline.costingDoneAt },
      response: { outcome: "none" },
      riskAcceptedAt: undefined,
      revisionNote: undefined,
    };
    return log(next, {
      by,
      action: `Revision opened — v${next.version}`,
      from: `v${q.version}`,
      to: `v${next.version}`,
      reason: note,
    });
  });
}

/**
 * Requote — start from a chosen prior version, carry forward selected items,
 * and decide per item whether it goes back to Costing for a real rebuild or
 * is simply re-priced against current costing here.
 *
 * The source version is archived intact; nothing is overwritten.
 */
export function generateRequote(
  id: string,
  input: {
    fromVersion: number;
    lineIds: string[];
    mode: Record<string, RequoteMode>;
    note?: string;
    by?: string;
  },
) {
  apply(id, (q) => {
    const by = input.by ?? ME;
    const source =
      input.fromVersion === q.version
        ? { lines: q.lines, terms: q.terms }
        : q.versions.find((v) => v.version === input.fromVersion);
    if (!source) return q;

    const archived: QuotationVersion = {
      version: q.version,
      label: `v${q.version}`,
      createdAt: q.updatedAt,
      createdBy: q.createdBy,
      status: q.status,
      lines: q.lines,
      terms: q.terms,
      timeline: q.timeline,
      response: q.response,
      sentToBuyer: Boolean(q.timeline.sentAt),
      note: input.note,
    };

    const picked = source.lines.filter(
      (l) => input.lineIds.includes(l.id) || (l.parentId && input.lineIds.includes(l.parentId)),
    );

    const lines: QuotationLine[] = picked.map((l) => {
      const mode = input.mode[l.parentId ?? l.id] ?? "high_level_override";
      const pull = costingPull(l.srfRef, {
        moq: l.moq,
        sizeInches: inchesFromSize(l.size),
        index: costIndexFor(l.srfRef),
      });
      const targetMargin = marginFor(l.priceUsd, l.costAtQuoteInr, l.fxRate);
      return {
        ...l,
        id: rid("L"),
        parentId: undefined,
        costAtQuoteInr: pull.grandInr,
        fxRate: pull.fxRate,
        // Re-price at the margin the previous version was approved at.
        priceUsd: priceFor(targetMargin, pull.grandInr, pull.fxRate),
        status: "active",
        rejectReason: undefined,
        overrideOf: undefined,
        carriedFrom: { version: input.fromVersion, mode },
      };
    });

    // Re-link the family structure and renumber.
    const relinked = relink(picked, lines);

    // Items marked for a full rebuild go back to Costing.
    for (const l of picked) {
      const mode = input.mode[l.parentId ?? l.id];
      if (mode === "full_reconfiguration" && l.articleId) {
        updateArticle(q.podId, l.articleId, { status: "in_progress" });
      }
    }

    const next: Quotation = {
      ...q,
      version: q.version + 1,
      status: "draft",
      lines: relinked,
      versions: [archived, ...q.versions],
      timeline: { costingDoneAt: q.timeline.costingDoneAt },
      response: { outcome: "none" },
      riskAcceptedAt: undefined,
      requotedFrom: { quotationId: q.id, version: input.fromVersion },
    };

    return log(next, {
      by,
      action: `Requote generated — v${next.version} from v${input.fromVersion}`,
      from: `v${input.fromVersion}`,
      to: `v${next.version}`,
      reason: input.note,
    });
  });
}

/** Rebuild parent links + SR numbering after a requote copies lines. */
function relink(source: QuotationLine[], copies: QuotationLine[]): QuotationLine[] {
  const idMap = new Map<string, string>();
  source.forEach((s, i) => idMap.set(s.id, copies[i].id));

  const withParents = copies.map((c, i) => {
    const src = source[i];
    return src.parentId && idMap.has(src.parentId)
      ? { ...c, parentId: idMap.get(src.parentId) }
      : { ...c, parentId: undefined };
  });

  let headCount = 0;
  const srById = new Map<string, string>();
  return withParents.map((l) => {
    if (!l.parentId) {
      headCount += 1;
      const sr = String(headCount);
      srById.set(l.id, sr);
      return { ...l, sr };
    }
    const parentSr = srById.get(l.parentId) ?? "1";
    const siblings = withParents.filter((x) => x.parentId === l.parentId);
    const idx = siblings.findIndex((x) => x.id === l.id);
    const sr =
      l.kind === "kit_component"
        ? `${parentSr}.${idx + 1}`
        : `${parentSr}${String.fromCharCode(65 + idx)}`;
    srById.set(l.id, sr);
    return { ...l, sr };
  });
}

export function deleteQuotation(id: string) {
  quotations = quotations.filter((q) => q.id !== id);
  emit();
}

/* ------------------------------------------------------------------ *
 * Costing → Quotation handoff
 * ------------------------------------------------------------------ */

/**
 * "Send for Quotation Review" on a completed costing.
 *
 * Lands the article in the POD's open draft, or opens one if none exists, and
 * returns the quotation id so the caller can navigate straight into it. A user
 * inside the workspace can never tell which path a line arrived by.
 */
export function sendForQuotationReview(
  podId: string,
  articleId: string,
  by = ME,
): { quotationId: string; created: boolean } {
  const existing = draftForPod(podId);
  if (existing) {
    addArticles(existing.id, [articleId], by);
    updateArticle(podId, articleId, { status: "pending_approval" });
    return { quotationId: existing.id, created: false };
  }
  const q = createQuotation({ podId, articleIds: [articleId], by });
  updateArticle(podId, articleId, { status: "pending_approval" });
  return { quotationId: q.id, created: true };
}

/** Articles in a POD that are eligible to be added to a quotation. */
export function quotableArticles(pod: Pod, existing: Quotation | undefined): Article[] {
  const taken = new Set((existing?.lines ?? []).map((l) => l.articleId).filter(Boolean));
  return pod.articles.filter((a) => !taken.has(a.id));
}
