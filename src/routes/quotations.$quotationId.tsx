/**
 * A quotation over several articles, at its own address.
 *
 * `QT-2601` is a document, not a view of an article, so it has a URL somebody
 * can send to a colleague — which is also what stops it being rendered inside
 * whichever article it was started from.
 */

import { createFileRoute } from "@tanstack/react-router";
import { MultiQuotationWorkspace } from "@/components/quotation/MultiQuotationWorkspace";

export const Route = createFileRoute("/quotations/$quotationId")({
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
  return <MultiQuotationWorkspace quotationId={quotationId} />;
}
