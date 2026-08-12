/**
 * The two-step gate between a finished costing and a quotation.
 *
 *   not ready →  [ Mark as Ready ]
 *   ready     →  Ready · [ Generate Quotation → ]
 *
 * Deliberately one button at a time rather than a status picker: at this point
 * in the workflow there is exactly one thing worth doing, and making the user
 * choose it from a list of states is asking them to operate the data model
 * instead of the work.
 *
 * Readiness stays reversible — a costing that has changed is no longer signed
 * off — but undoing it is a quiet secondary affordance, not the main path.
 */

import { ArrowRight, CheckCircle2, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import {
  NOT_READY_LABEL,
  READY_LABEL,
  clearReadyForQuotation,
  markReadyForQuotation,
  useIsReadyForQuotation,
} from "@/lib/quotationReadiness";

export function QuotationReadyAction({
  podId,
  articleId,
  articleName,
  onGenerate,
}: {
  podId?: string;
  articleId?: string;
  articleName: string;
  onGenerate: () => void;
}) {
  const ready = useIsReadyForQuotation(podId, articleId);
  const disabled = !podId || !articleId;

  if (!ready) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!podId || !articleId) return;
          markReadyForQuotation(podId, articleId);
          toast.success(`${articleName} is ${READY_LABEL}`);
        }}
        title="Confirm this configuration and costing are ready to be quoted"
        className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        <CheckCircle2 className="h-4 w-4" /> Mark as Ready
      </button>
    );
  }

  return (
    <>
      <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-600 bg-brand-50 px-2.5 py-2 text-[13px] font-medium text-brand-700">
        <CheckCircle2 className="h-4 w-4" aria-hidden /> Ready
        <button
          type="button"
          onClick={() => {
            if (!podId || !articleId) return;
            clearReadyForQuotation(podId, articleId);
            toast(`${articleName} is ${NOT_READY_LABEL}`);
          }}
          aria-label={`Mark ${articleName} not ready`}
          title="This costing has changed — mark it not ready"
          className="rounded p-0.5 text-brand-700/60 hover:bg-brand-100 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </span>

      <button
        type="button"
        disabled={disabled}
        onClick={onGenerate}
        title="Choose what to quote"
        className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        <Send className="h-4 w-4" /> Generate Quotation
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </>
  );
}
