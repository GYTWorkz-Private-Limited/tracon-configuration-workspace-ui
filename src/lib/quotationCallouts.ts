/**
 * Costing comments, surfaced on the quotation.
 *
 * The Price Working Sheet keeps a "Costing comments" column beside the money:
 * the one or two sentences the costing team wrote about why a line prices the
 * way it does — a fabric that could be rotated, a price that had to be quoted
 * individually. They are the difference between a reviewer seeing a bad margin
 * and a reviewer knowing what to do about it.
 *
 * So they belong in the summary, not buried in the drill-down. This module is
 * where they come from: whatever Configuration recorded against the article,
 * plus the observations the costing engine can make for itself.
 */

import type { Article, Pod } from "./podsStore";

export type CalloutSource = "costing" | "configuration" | "fabric";

export type Callout = {
  id: string;
  articleId: string;
  /** one or two sentences, as the costing team would write them */
  text: string;
  source: CalloutSource;
};

export const CALLOUT_SOURCE_LABEL: Record<CalloutSource, string> = {
  costing: "Costing",
  configuration: "Configuration",
  fabric: "Fabric",
};

/**
 * Observations the costing team left against specific articles.
 *
 * Held here rather than on the article record because they are commentary on a
 * costing round, not a property of the product — the article stays the same
 * when the comment is answered.
 */
const SEEDED: Record<string, Omit<Callout, "id" | "articleId">[]> = {
  "A-PLACEMAT": [
    {
      source: "fabric",
      text:
        "Base fabric can be rotated width-wise — three panels print across the width instead of two, " +
        "which brings the fabric cost down. It is a full blotch print, so the rotation is not visible " +
        "in the finished piece.",
    },
  ],
  "A-RUNNER": [
    {
      source: "costing",
      text:
        "Quoted as an individual price. The runner does not carry the set-of-four packing, so the " +
        "per-piece packing charge applies in full rather than being spread across the set.",
    },
  ],
};

/** Every call-out on one article, newest thinking first. */
export function calloutsFor(pod: Pod | undefined, articleId: string): Callout[] {
  const article = pod?.articles.find((a) => a.id === articleId);
  const seeded = (SEEDED[articleId] ?? []).map((c, i) => ({
    ...c,
    id: `${articleId}-c${i}`,
    articleId,
  }));

  // Anything Configuration recorded against the article itself travels too —
  // a remark typed on the cost sheet is a costing comment by another name.
  const remark = article?.remarks?.trim();
  return remark
    ? [...seeded, { id: `${articleId}-remark`, articleId, text: remark, source: "configuration" }]
    : seeded;
}

/** Call-outs across a whole quoted item, including a kit's members. */
export function calloutsForItem(pod: Pod | undefined, articleIds: string[]): Callout[] {
  return articleIds.flatMap((id) => calloutsFor(pod, id));
}

/** The article record behind a call-out, for the "open the context" jump. */
export const articleOf = (pod: Pod | undefined, articleId: string): Article | undefined =>
  pod?.articles.find((a) => a.id === articleId);
