/**
 * "What exactly are we rejecting?"
 *
 * Rejecting is rarely about one line. A buyer who pushes back usually pushes
 * back on the quotation, and a dialog that could only reject the article you
 * happened to click made the common case the laborious one — reject, close,
 * find the next card, reject again, retype the same reason.
 *
 * So the scope is part of the question. Opened from the quotation it starts
 * with everything selected, because "the whole order" is the default reading of
 * a rejection; opened from one article it starts with that one. Either way
 * every line can be ticked or unticked before anything happens, and the count
 * says plainly what is about to go back.
 */

import { useEffect, useState } from "react";
import { Boxes, Package, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuoteItem } from "@/lib/quoteDraftStore";

export function RejectDialog({
  quotationId,
  items,
  /** ids ticked when it opens — all of them when the whole quotation is meant */
  preselect,
  onClose,
  onConfirm,
}: {
  quotationId: string;
  items: QuoteItem[];
  preselect: string[];
  onClose: () => void;
  onConfirm: (itemIds: string[], reason: string) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(preselect));
  const [reason, setReason] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const all = picked.size === items.length && items.length > 0;
  const whole = all && items.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reject for recosting"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <button className="absolute inset-0 bg-ink-900/40" aria-label="Cancel" onClick={onClose} />

      <div className="relative flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl">
        <header className="flex shrink-0 items-start gap-3 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-ink-900">Reject for recosting</h2>
            <p className="mt-0.5 text-[12px] text-ink-500">
              Everything rejected stays on {quotationId}, frozen, and goes back to Costing as a
              status with your reason. {quotationId} cannot be sent until it returns.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto shrink-0 rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h3 className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-500">
              What is going back
            </h3>
            <span className="text-[12px] text-ink-500">
              {picked.size} of {items.length}
              {whole && " — the whole quotation"}
            </span>
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => setPicked(all ? new Set() : new Set(items.map((i) => i.id)))}
                className="ml-auto rounded-md border border-hairline bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                {all ? "Clear selection" : "Select all"}
              </button>
            )}
          </div>

          <ul className="mt-2.5 space-y-1.5">
            {items.map((item) => {
              const on = picked.has(item.id);
              const already = Boolean(item.rejected);
              return (
                <li key={item.id}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                      on ? "border-[#8f2c22]/50 bg-[#8f2c22]/5" : "border-hairline bg-surface",
                      already && "opacity-60",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={already}
                      onChange={() => toggle(item.id)}
                      className="h-4 w-4 accent-[#8f2c22] disabled:cursor-not-allowed"
                    />
                    {item.kind === "kit" ? (
                      <Boxes className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                    ) : (
                      <Package className="h-4 w-4 shrink-0 text-ink-400" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-medium text-ink-900">
                        {item.kind === "kit" ? `Kit — ${item.name}` : item.name}
                      </span>
                      {/* A kit goes back as a whole: a set cannot be re-costed
                          in halves. */}
                      {item.kind === "kit" && (
                        <span className="block text-[11px] text-ink-500">
                          {item.members.map((m) => m.name).join(" + ")} — all of them
                        </span>
                      )}
                    </span>
                    {already && (
                      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-900">
                        Already out
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>

          <label
            htmlFor="reject-reason"
            className="mt-4 block text-[11.5px] font-medium text-ink-700"
          >
            Reason
          </label>
          <textarea
            id="reject-reason"
            rows={3}
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What has to change before this can be quoted?"
            className="mt-1 w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
          />
          <p className="mt-1 text-[11px] text-ink-500">
            The same reason goes to every article selected above.
          </p>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-hairline bg-surface-alt/40 px-5 py-3.5">
          <button
            onClick={onClose}
            className="rounded-md border border-hairline bg-surface px-3.5 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            Cancel
          </button>
          <button
            disabled={picked.size === 0 || !reason.trim()}
            onClick={() => onConfirm(Array.from(picked), reason)}
            className="rounded-md bg-[#8f2c22] px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[#7a251c] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            Send {picked.size === items.length && items.length > 1 ? "all" : picked.size} back
          </button>
        </footer>
      </div>
    </div>
  );
}
