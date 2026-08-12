/**
 * The two questions between a finished costing and a quotation.
 *
 *   1. Single Product, or Multiple Products / Kit?     (QuotationModeModal)
 *   2. If multiple — which of them?                    (ArticleSelectionModal)
 *
 * Kept in one component so every entry point into Quotation — the Costing
 * Report's "Continue to Quotation" and the Approval step's "Generate
 * Quotation" — asks the same questions in the same order and lands on the same
 * quotation. Single skips step 2: the article the user is standing on IS the
 * answer, and it goes straight to the quotation already generated for it.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { usePod } from "@/lib/podsStore";
import { isReadyIn, useReadiness } from "@/lib/quotationReadiness";
import { startQuotation, useQuoteDraft } from "@/lib/quoteDraftStore";
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
  const draft = useQuoteDraft(podId);
  const [step, setStep] = useState<"mode" | "items">("mode");

  // Every fresh entry starts at the first question, never half-way through the
  // previous one.
  useEffect(() => {
    if (open) setStep("mode");
  }, [open]);

  const articles = pod?.articles ?? [];
  const singleAvailable = Boolean(articleId && isReadyIn(readiness, podId, articleId));
  const eligible = articles.filter((a) => isReadyIn(readiness, podId, a.id));
  const eligibleCount = eligible.length;

  const quotedIds = new Set((draft?.items ?? []).map((i) => i.articleId));

  /**
   * Everything quotable is already on the quotation, so there is nothing to
   * decide — asking "single or multiple?" about a set that cannot change is a
   * question with one answer. Go straight to the quotation instead.
   */
  const nothingLeftToChoose =
    eligibleCount > 0 && quotedIds.size > 0 && eligible.every((a) => quotedIds.has(a.id));

  useEffect(() => {
    if (!open || !nothingLeftToChoose) return;
    onClose();
    navigate({
      to: "/quotation/$podId/$articleId",
      params: { podId, articleId: articleId ?? eligible[0].id },
      search: { sel: undefined },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nothingLeftToChoose]);

  /** Open the quotation holding exactly the chosen items. */
  const go = (ids: string[], mode: QuotationMode) => {
    if (ids.length === 0) return;
    startQuotation(podId, ids, mode);
    onClose();
    navigate({
      to: "/quotation/$podId/$articleId",
      params: { podId, articleId: ids[0] },
      // What the quotation contains is held on the draft, and the workspace
      // navigates it there. `sel` scopes the workflow's own article bar and is
      // deliberately left alone, so quoting one product does not narrow the
      // rest of the workflow to it.
      search: { sel: undefined },
    });
  };

  if (!open || nothingLeftToChoose) return null;

  return (
    <>
      <QuotationModeModal
        open={step === "mode"}
        onClose={onClose}
        articleName={articleName}
        singleAvailable={singleAvailable}
        eligibleCount={eligibleCount}
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
        // Nothing is "already quoted" here: this selection defines what the
        // quotation contains, so an item on the current draft may be picked
        // again — it simply keeps the work already done on it.
        preselect={articleId ? [articleId] : undefined}
        title="Select Products & Kits for this Quotation"
        confirmLabel="Continue"
        onConfirm={(ids) => go(ids, "multiple")}
      />
    </>
  );
}
