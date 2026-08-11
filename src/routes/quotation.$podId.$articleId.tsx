/**
 * Flow entry into Quotation from the workflow stepper.
 *
 * Quotation is POD-level, not article-level: a buyer gets one quote covering a
 * mix of articles, sets and kits. This route resolves the POD's open quotation
 * (creating one seeded with this article if there is none) and hands over to
 * the single Quotation Workspace, so a user can never end up on two different
 * quotation surfaces.
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { QuotationWorkspace } from "@/components/quotation/QuotationWorkspace";
import {
  draftForPod,
  quotationsForPod,
  sendForQuotationReview,
  useQuotation,
} from "@/lib/quotationsStore";

export const Route = createFileRoute("/quotation/$podId/$articleId")({
  head: () => ({
    meta: [
      { title: "Quotation · Tracon" },
      { name: "description", content: "Commercial quotation for this POD." },
    ],
  }),
  component: QuotationFlowEntry,
});

function QuotationFlowEntry() {
  const { podId, articleId } = Route.useParams();
  const navigate = useNavigate();
  const [resolvedId, setResolvedId] = useState<string | null>(null);
  const quotation = useQuotation(resolvedId ?? "");

  useEffect(() => {
    const open = draftForPod(podId) ?? quotationsForPod(podId)[0];
    if (open) {
      setResolvedId(open.id);
      return;
    }
    const { quotationId } = sendForQuotationReview(podId, articleId);
    setResolvedId(quotationId);
  }, [podId, articleId]);

  useEffect(() => {
    if (resolvedId) {
      navigate({ to: "/quotations/$id", params: { id: resolvedId }, replace: true });
    }
  }, [resolvedId, navigate]);

  return (
    <AppShell>
      {quotation ? (
        <QuotationWorkspace quotation={quotation} />
      ) : (
        <div className="mx-auto max-w-[640px] py-20 text-center text-[13px] text-ink-500">
          Opening the quotation for {podId}…
        </div>
      )}
    </AppShell>
  );
}
