/**
 * The costing's quotation status, as a status the user SETS.
 *
 * Readiness is a decision that gets made and un-made — a costing that has
 * changed is no longer signed off — so it is a status control, not a one-way
 * button. Showing the current value on the trigger means the report always
 * says where it stands, rather than only offering the action that would change
 * it.
 *
 * The status itself lives in `quotationReadiness`; this is only the way to
 * move it.
 */

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, CircleDot, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  NOT_READY_LABEL,
  READY_LABEL,
  clearReadyForQuotation,
  markReadyForQuotation,
  useIsReadyForQuotation,
} from "@/lib/quotationReadiness";

export function QuotationStatusMenu({
  podId,
  articleId,
  articleName,
  className,
}: {
  podId?: string;
  articleId?: string;
  articleName: string;
  className?: string;
}) {
  const ready = useIsReadyForQuotation(podId, articleId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const disabled = !podId || !articleId;

  const set = (next: boolean) => {
    if (!podId || !articleId) return;
    setOpen(false);
    if (next === ready) return;
    if (next) {
      markReadyForQuotation(podId, articleId);
      toast.success(`${articleName} is ${READY_LABEL}`);
    } else {
      clearReadyForQuotation(podId, articleId);
      toast(`${articleName} is ${NOT_READY_LABEL}`);
    }
  };

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Set whether this costing is ready to be quoted"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
          ready
            ? "border-brand-600 bg-brand-50 text-brand-700 hover:bg-brand-100"
            : "border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
        )}
      >
        {ready ? (
          <CircleDot className="h-4 w-4" aria-hidden />
        ) : (
          <Lock className="h-4 w-4 text-ink-400" aria-hidden />
        )}
        <span className="hidden sm:inline">{ready ? READY_LABEL : NOT_READY_LABEL}</span>
        <span className="sm:hidden">Status</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-40 mt-1.5 w-[300px] overflow-hidden rounded-lg border border-hairline bg-surface shadow-lg"
        >
          <div className="border-b border-hairline px-3 py-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500">
              Quotation status
            </h4>
            <p className="mt-0.5 text-[11px] text-ink-500">
              Only a costing marked ready can be carried into a quotation.
            </p>
          </div>

          <StatusOption
            selected={ready}
            title={READY_LABEL}
            description="The configuration and costing have been reviewed and can be quoted."
            onSelect={() => set(true)}
          />
          <StatusOption
            selected={!ready}
            title={NOT_READY_LABEL}
            description="Still being worked on. Anything already quoted keeps the figures it was quoted with."
            onSelect={() => set(false)}
          />
        </div>
      )}
    </div>
  );
}

function StatusOption({
  selected,
  title,
  description,
  onSelect,
}: {
  selected: boolean;
  title: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className="flex w-full items-start gap-2.5 border-b border-hairline px-3 py-2.5 text-left last:border-b-0 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700"
    >
      <Check
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          selected ? "text-brand-700" : "text-transparent",
        )}
        aria-hidden
      />
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-ink-900">{title}</span>
        <span className="mt-0.5 block text-[11px] text-ink-500">{description}</span>
      </span>
    </button>
  );
}
