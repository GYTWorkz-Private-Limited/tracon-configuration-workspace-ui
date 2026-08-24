/**
 * The two questions between a finished costing and a quotation.
 *
 *   1. This article alone, or several articles / a bundle?  (QuotationModeModal)
 *   2. If multiple — which of them?                    (ArticleSelectionModal)
 *
 * Kept in one component so every entry point into Quotation — the Costing
 * Report's "Generate Quotation" and the Approval step's — asks the same
 * questions in the same order.
 *
 * The two answers go to two different places, and that is the point:
 *
 *   single   → the article's own Quotation step, exactly as it already works
 *   multiple → a parent quotation with its own number and its own workspace,
 *              rather than several articles' quotations stacked under whichever
 *              article the user happened to start from
 */

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { usePod } from "@/lib/podsStore";
import { isReadyIn, useReadiness } from "@/lib/quotationReadiness";
import { createQuotation, useQuotationForArticle } from "@/lib/quoteDraftStore";
import { QuotationModeModal, type QuotationMode } from "./QuotationModeModal";
import { ArticleSelectionModal } from "./ArticleSelectionModal";

export function QuotationEntryFlow({
  open,
  onClose,
  podId,
  articleId,
  articleName,
}: {
  open: boolean;
  onClose: () => void;
  podId: string;
  /** the article the user came in from */
  articleId?: string;
  articleName?: string;
}) {
  const navigate = useNavigate();
  const pod = usePod(podId);
  const readiness = useReadiness();
  const existing = useQuotationForArticle(podId, articleId ?? "");
  const [step, setStep] = useState<"mode" | "items">("mode");

  // Every fresh entry starts at the first question, never half-way through the
  // previous one.
  useEffect(() => {
    if (open) setStep("mode");
  }, [open]);

  const articles = pod?.articles ?? [];
  const singleAvailable = Boolean(articleId && isReadyIn(readiness, podId, articleId));
  const eligible = articles.filter((a) => isReadyIn(readiness, podId, a.id));

  /**
   * This article is already on a quotation, so there is no question to ask —
   * open what it is on rather than making the user re-declare a decision they
   * have already made.
   */
  useEffect(() => {
    if (!open || !existing || !articleId) return;
    onClose();
    if (existing.mode === "multiple") {
      navigate({
        to: "/quotations/$quotationId",
        params: { quotationId: existing.id },
        search: { action: undefined },
      });
    } else {
      navigate({
        to: "/quotation/$podId/$articleId",
        params: { podId, articleId },
        search: { sel: undefined },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  const go = (ids: string[], mode: QuotationMode) => {
    if (ids.length === 0) return;
    const quotationId = createQuotation(podId, ids, mode);
    if (!quotationId) return;
    onClose();

    // A quotation over several articles is its own document with its own
    // number, so it gets its own workspace. One article stays where it has
    // always been shown: on that article's Quotation step.
    if (mode === "multiple") {
      navigate({
        to: "/quotations/$quotationId",
        params: { quotationId },
        search: { action: undefined },
      });
      return;
    }
    navigate({
      to: "/quotation/$podId/$articleId",
      params: { podId, articleId: ids[0] },
      search: { sel: undefined },
    });
  };

  if (!open || existing) return null;

  return (
    <>
      <QuotationModeModal
        open={step === "mode"}
        onClose={onClose}
        articleName={articleName}
        singleAvailable={singleAvailable}
        eligibleCount={eligible.length}
        onContinue={(mode) => {
          if (mode === "single" && articleId) go([articleId], "single");
          else setStep("items");
        }}
      />

      <ArticleSelectionModal
        open={step === "items"}
        onClose={onClose}
        podId={podId}
        articles={articles}
        // Nothing is "already quoted" here: this selection defines what the new
        // quotation contains, and an article can be moved onto it from an
        // earlier quotation, keeping the work already done on it.
        preselect={articleId ? [articleId] : undefined}
        title="Select Products & Kits for this Quotation"
        confirmLabel="Continue"
        onConfirm={(ids) => go(ids, "multiple")}
      />
    </>
  );
}
