/**
 * Demo pipeline seed — two quotations under every status.
 *
 * The Quotations control center is a pipeline view, and a pipeline with one
 * lane occupied reads as broken. This seeder walks the REAL workflow for each
 * quotation — create → submit → approve → buyer answers — through the same
 * store actions the screens call, so every seeded quotation is a genuine
 * document the detail page can open, price and requote. Nothing here writes a
 * shape the app could not have produced itself.
 *
 * Runs once per browser (localStorage flag), and only against articles that
 * actually exist in the pods store at the time — a deleted POD is respected,
 * not resurrected.
 */

import { addLibraryArticles, getPods, type Article } from "./podsStore";
import { isReadyForQuotation, markReadyForQuotation } from "./quotationReadiness";
import { createQuotation, getQuotation, quotationForArticle, type QuoteDraft } from "./quoteDraftStore";
import { viewQuote, totalsOf, type ViewedItem } from "./quotationView";
import {
  REVIEW_TEAMS,
  approveQuotation,
  submitQuotationForApproval,
  toggleReviewer,
} from "./quotationApprovalStore";
import { sendVersionForApproval, type VersionLine } from "./quotationHistory";
import { markConvertedToOrder, recordBuyerResponse } from "./buyerResponseStore";
import { VALIDITY_DAYS } from "./quotationPipeline";

const SEED_FLAG = "tracon.quotationDemo.v1";

/** The same flattening the approval screen stores when a version is sent. */
function lineOf(v: ViewedItem): VersionLine {
  const c = v.priced.commercial;
  if (v.kind === "kit") {
    return {
      name: `Kit — ${v.item.name}`,
      kind: "kit",
      quantity: v.priced.sets,
      quantityLabel: `${v.priced.sets.toLocaleString("en-IN")} sets`,
      finalCostInr: c.finalCostInr,
      sellingUsd: c.sellingUsd,
      marginPct: c.marginPct,
      orderValueUsd: v.priced.orderValueUsd,
    };
  }
  return {
    name: v.item.name,
    kind: "product",
    quantity: v.priced.moq,
    quantityLabel: `${v.priced.moq.toLocaleString("en-IN")} pcs`,
    finalCostInr: c.finalCostInr,
    sellingUsd: c.sellingUsd,
    marginPct: c.marginPct,
    orderValueUsd: v.priced.orderValueUsd,
  };
}

/** Assign the first reviewer of every team — the minimum a send requires. */
function assignReviewers(quotationId: string) {
  for (const team of REVIEW_TEAMS) {
    const person = team.members[0];
    if (person) toggleReviewer(quotationId, team.id, person);
  }
}

/** Submit + freeze a version, optionally backdated so the offer has lapsed. */
function send(quotationId: string, draft: QuoteDraft, daysAgo = 0) {
  const views = viewQuote(draft, {});
  const totals = totalsOf(views);
  assignReviewers(quotationId);
  submitQuotationForApproval(quotationId);
  sendVersionForApproval(
    quotationId,
    {
      lines: views.map(lineOf),
      orderValueUsd: totals.orderValueUsd,
      blendedMarginPct: totals.blendedMarginPct,
    },
    "Gautam Kitclu",
    undefined,
    new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
  );
}

type Stage =
  | "draft"
  | "pending"
  | "sent"
  | "accepted"
  | "converted"
  | "revised"
  | "rejected"
  | "expired";

function drive(quotationId: string, draft: QuoteDraft, stage: Stage) {
  if (stage === "draft") return;

  // An expired offer went out long enough ago that its validity has passed.
  send(quotationId, draft, stage === "expired" ? VALIDITY_DAYS + 4 : 2);

  if (stage === "pending") return;

  // Everything past this point reached the buyer — including the lapsed
  // offer, which expires only BECAUSE it was approved and sent.
  approveQuotation(quotationId);
  if (stage === "sent" || stage === "expired") return;

  const views = viewQuote(draft, {});
  const priceUsd = views[0]?.priced.commercial.sellingUsd ?? 0;

  if (stage === "accepted") {
    recordBuyerResponse(quotationId, {
      outcome: "counter",
      counterPriceUsd: Math.round(priceUsd * 0.96 * 100) / 100,
      comments: "Will confirm the order at this price for the full programme.",
      recordedBy: "Sana V.",
    });
  } else if (stage === "converted") {
    recordBuyerResponse(quotationId, {
      outcome: "accepted",
      comments: "PO to follow this week.",
      recordedBy: "Sana V.",
    });
    markConvertedToOrder(quotationId, totalsOf(views).orderValueUsd);
  } else if (stage === "revised") {
    recordBuyerResponse(quotationId, {
      outcome: "revision",
      comments: "Asked to re-look at the trims spec and quote a 500-pc break.",
      recordedBy: "Karthik R.",
    });
  } else if (stage === "rejected") {
    recordBuyerResponse(quotationId, {
      outcome: "rejected_price",
      comments: "Competitor landed 8% under us on the same construction.",
      recordedBy: "Meera K.",
    });
  }
}

/** Two of each stage, walked oldest-outcome first so ids read in order. */
const PLAN: Stage[] = [
  "converted",
  "converted",
  "rejected",
  "rejected",
  "expired",
  "expired",
  "revised",
  "revised",
  "accepted",
  "accepted",
  "sent",
  "sent",
  "pending",
  "pending",
  "draft",
  "draft",
];

/**
 * Populate the pipeline once. Reuses whatever articles the workspace has —
 * an article re-quoted across an old rejected quote and a fresh draft is how
 * the register looks in real life, so articles cycle rather than gate the
 * seed on having sixteen of them.
 */
export function ensureQuotationDemoData() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(SEED_FLAG)) return;
  } catch {
    return;
  }

  // Standalone articles only: kit quotations need their members costed, which
  // the seeder cannot guarantee for every pod state. Each quotation needs its
  // OWN article — `createQuotation` MOVES an article's item off its previous
  // quotation, so reusing one would hollow out the earlier seed. Two further
  // guards keep the seeder off anything the USER owns: an article already on
  // a quotation is theirs, and an article the readiness demo deliberately
  // left unsigned stays unsigned — the seeder never forges a sign-off.
  const candidates: { podId: string; article: Article }[] = getPods().flatMap((p) =>
    p.articles
      .filter(
        (a) =>
          a.type !== "kit" &&
          isReadyForQuotation(p.id, a.id) &&
          !quotationForArticle(p.id, a.id),
      )
      .map((article) => ({ podId: p.id, article })),
  );

  if (candidates.length < PLAN.length) {
    const podId = candidates[0]?.podId ?? getPods()[0]?.id;
    if (!podId) return;
    const presets = [
      { name: "Cushion Cover (Piped)", style: "Cushion Cover", size: "50×50 cm", moq: "1,000 pcs" },
      { name: "Beach Towel", style: "Bath Towel", size: "90×180 cm", moq: "600 pcs" },
      { name: "Hand Towel", style: "Hand Towel", size: "40×60 cm", moq: "2,000 pcs" },
      { name: "Throw Blanket", style: "Throw", size: "130×170 cm", moq: "500 pcs" },
      { name: "Table Cloth", style: "Throw", size: "150×250 cm", moq: "500 pcs" },
      { name: "Curtain Panel", style: "Curtain", size: "140×240 cm", moq: "800 pcs" },
      { name: "Silk Scarf", style: "Scarf", size: "90×90 cm", moq: "1,000 pcs" },
      { name: "Duvet Cover", style: "Bedding Set", size: "220×240 cm", moq: "400 pcs" },
      { name: "Fitted Sheet", style: "Bedding Set", size: "160×200 cm", moq: "500 pcs" },
      { name: "Kitchen Towel", style: "Hand Towel", size: "45×65 cm", moq: "2,500 pcs" },
      { name: "Napkin Set", style: "Table Top", size: "45×45 cm", moq: "2,000 pcs" },
      { name: "Apron", style: "Cushion Cover", size: "70×85 cm", moq: "1,000 pcs" },
    ];
    const created = addLibraryArticles(podId, presets.slice(0, PLAN.length - candidates.length));
    for (const article of created) markReadyForQuotation(podId, article.id);
    candidates.push(...created.map((article) => ({ podId, article })));
  }
  if (candidates.length === 0) return;

  // Latest-created wins an article's "current quotation", so the plan runs
  // closed outcomes first and drafts last — the article page then shows the
  // still-open document, not a rejected one from three rounds ago.
  PLAN.forEach((stage, i) => {
    const pick = candidates[i];
    if (!pick) return;
    const id = createQuotation(pick.podId, [pick.article.id], "single");
    if (!id) return;
    const draft = getQuotation(id);
    if (draft) drive(id, draft, stage);
  });

  try {
    window.localStorage.setItem(SEED_FLAG, "done");
  } catch {
    // ignore
  }
}
