/**
 * A quotation over several articles, at its own address.
 *
 * `QT-2601` is a document, not a view of an article, so it has a URL somebody
 * can send to a colleague — which is also what stops it being rendered inside
 * whichever article it was started from.
 */

import { createFileRoute } from "@tanstack/react-router";
import { MultiQuotationWorkspace } from "@/components/quotation/MultiQuotationWorkspace";
import { GlobalNavFrame } from "@/components/layout/GlobalNav";

export const Route = createFileRoute("/quotations/$quotationId")({
  // The list's row actions land with intent: "requote" opens the requote
  // picker on arrival, "respond" is a plain open (the response panel is on
  // the page). Kept as a search param so the intent survives a refresh.
  validateSearch: (s: Record<string, unknown>) => ({
    action:
      s.action === "requote"
        ? ("requote" as const)
        : s.action === "respond"
          ? ("respond" as const)
          : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Quotation · Tracon" },
      {
        name: "description",
        content:
          "A quotation covering several costed articles — priced together, sent for approval as one document.",
      },
    ],
  }),
  component: MultiQuotationStep,
});

function MultiQuotationStep() {
  const { quotationId } = Route.useParams();
  const { action } = Route.useSearch();
  return (
    <GlobalNavFrame>
      <MultiQuotationWorkspace quotationId={quotationId} initialAction={action} />
    </GlobalNavFrame>
  );
}
