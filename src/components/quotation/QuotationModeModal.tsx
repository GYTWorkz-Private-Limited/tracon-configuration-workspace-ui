/**
 * "Am I quoting this one article, or several?"
 *
 * The first of the two questions that stand between a finished costing and a
 * quotation. It exists because the two answers lead to genuinely different
 * work — one goes straight to the quotation already generated for the article
 * in hand, the other needs the user to say WHICH items belong on the quote —
 * and guessing wrong wastes the user's time either way.
 *
 * It decides nothing about the quotation itself: both routes end in the same
 * quotation experience, holding one item or several.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Boxes, Lock, Package, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NOT_READY_LABEL } from "@/lib/quotationReadiness";

export type QuotationMode = "single" | "multiple";

export function QuotationModeModal({
  open,
  onClose,
  onContinue,
  articleName,
  /** the article the user came in from is quotable on its own */
  singleAvailable = true,
  eligibleCount,
}: {
  open: boolean;
  onClose: () => void;
  onContinue: (mode: QuotationMode) => void;
  articleName?: string;
  singleAvailable?: boolean;
  /** how many items in this costing workspace could join a multi-item quote */
  eligibleCount?: number;
}) {
  const [mode, setMode] = useState<QuotationMode>("single");
  const closeRef = useRef<HTMLButtonElement>(null);

  // Opening fresh must not inherit the previous answer, and an article that
  // cannot be quoted on its own must not leave "Single Product" preselected.
  useEffect(() => {
    if (!open) return;
    setMode(singleAvailable ? "single" : "multiple");
    closeRef.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="What are you quoting?"
    >
      <button className="absolute inset-0 bg-ink-900/40" aria-label="Close" onClick={onClose} />

      <div className="relative flex w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl">
        <header className="flex shrink-0 items-start gap-3 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-ink-900">What are you quoting?</h2>
            <p className="mt-0.5 text-[12px] text-ink-500">
              One quotation can carry a single article, or any mix of articles and bundles from this
              POD.
            </p>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="ml-auto shrink-0 rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-2 px-5 py-4">
          <ModeOption
            value="single"
            checked={mode === "single"}
            onSelect={() => setMode("single")}
            disabled={!singleAvailable}
            icon={<Package className="h-4 w-4" aria-hidden />}
            title="This article on its own"
            description={
              singleAvailable
                ? `Quote ${articleName ?? "this article"} on its own, exactly as it is costed today.`
                : `${articleName ?? "This article"} is ${NOT_READY_LABEL} — mark its costing ready first.`
            }
          />
          <ModeOption
            value="multiple"
            checked={mode === "multiple"}
            onSelect={() => setMode("multiple")}
            icon={<Boxes className="h-4 w-4" aria-hidden />}
            title="Several articles / a bundle"
            description={
              eligibleCount !== undefined
                ? `Choose which articles and bundles from this POD go on one quotation — ${eligibleCount} ready to pick, or take them all.`
                : "Choose which articles and bundles from this POD go on one quotation."
            }
          />
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-hairline bg-surface-alt/40 px-5 py-3.5">
          <button
            onClick={onClose}
            className="rounded-md border border-hairline bg-surface px-3.5 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            Cancel
          </button>
          <button
            onClick={() => onContinue(mode)}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </footer>
      </div>
    </div>
  );
}

function ModeOption({
  value,
  checked,
  onSelect,
  disabled,
  icon,
  title,
  description,
}: {
  value: QuotationMode;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  const className = cn(
    "flex items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors",
    checked
      ? "border-brand-600 bg-brand-50/40"
      : disabled
        ? "border-hairline bg-surface-alt/40"
        : "cursor-pointer border-hairline bg-surface hover:bg-surface-alt",
  );

  const body = (
    <>
      <input
        type="radio"
        name="quotation-mode"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand-700)] disabled:cursor-not-allowed"
      />
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface",
          disabled ? "text-ink-300" : "text-ink-600",
        )}
      >
        {disabled ? <Lock className="h-4 w-4" aria-hidden /> : icon}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[13.5px] font-semibold",
            disabled ? "text-ink-500" : "text-ink-900",
          )}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-[12px] text-ink-500">{description}</span>
      </span>
    </>
  );

  // A disabled option must not be a <label>: clicking it would read as an
  // affordance that silently does nothing.
  return disabled ? (
    <div className={className}>{body}</div>
  ) : (
    <label className={className}>{body}</label>
  );
}
