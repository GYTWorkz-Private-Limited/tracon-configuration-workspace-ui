/**
 * Quotation — the step after Costing Report.
 *
 * This is a workflow destination, not a module: it lives on the POD/article
 * route the rest of the workflow uses, keeps the same header, workflow band
 * and bottom article bar, and carries the costing forward rather than asking
 * the user to find it again.
 */

import { createFileRoute } from "@tanstack/react-router";
import { QuoteWorkspace } from "@/components/quotation/QuoteWorkspace";
import { GlobalNavFrame } from "@/components/layout/GlobalNav";

export const Route = createFileRoute("/quotation/$podId/$articleId")({
  validateSearch: (s: Record<string, unknown>) => ({
    sel: typeof s.sel === "string" ? s.sel : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Quotation · Tracon" },
      {
        name: "description",
        content:
          "Quote the commercially selected version of a costing — scenarios, variants, options, MOQs, kits and the full commercial stack.",
      },
    ],
  }),
  component: QuotationStep,
});

function QuotationStep() {
  const { podId, articleId } = Route.useParams();
  const { sel } = Route.useSearch();
  return (
    <GlobalNavFrame>
      <QuoteWorkspace podId={podId} articleId={articleId} sel={sel} />
    </GlobalNavFrame>
  );
}
