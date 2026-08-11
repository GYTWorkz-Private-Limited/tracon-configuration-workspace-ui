import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { QuotationWorkspace } from "@/components/quotation/QuotationWorkspace";
import { useQuotation } from "@/lib/quotationsStore";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/quotations/$id")({
  head: () => ({
    meta: [
      { title: "Quotation · Tracon" },
      {
        name: "description",
        content:
          "Commercial quotation workspace — quoted lines, cost-drift risk, buyer response, approval and versioning.",
      },
    ],
  }),
  component: QuotationDetail,
});

function QuotationDetail() {
  const { id } = Route.useParams();
  const quotation = useQuotation(id);

  if (!quotation) {
    return (
      <AppShell>
        <div className="mx-auto max-w-[640px] rounded-lg border border-hairline bg-surface px-6 py-14 text-center">
          <FileText className="mx-auto h-6 w-6 text-ink-300" aria-hidden />
          <h1 className="mt-3 text-[18px] font-semibold text-ink-900">Quotation not found</h1>
          <p className="mt-1 text-[13px] text-ink-500">
            {id} does not exist, or it was removed from this workspace.
          </p>
          <Link
            to="/quotations"
            className="mt-4 inline-flex rounded-md bg-ink-900 px-3 py-2 text-[12.5px] font-medium text-white hover:bg-ink-700"
          >
            Back to Quotations
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <QuotationWorkspace quotation={quotation} />
    </AppShell>
  );
}
