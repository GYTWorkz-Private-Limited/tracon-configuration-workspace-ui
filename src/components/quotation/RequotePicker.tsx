/**
 * "The buyer accepted, then came back."
 *
 * A requote is a new commercial cycle, not an edit of the document the buyer
 * agreed to. Two questions stand between the click and the work, asked in
 * order because the second only makes sense once the first is answered:
 *
 *   1. WHICH articles are being requoted? The rest stay on the sent version,
 *      untouched — that is the whole point of asking.
 *   2. WHERE does the change happen? Re-engineering the article is
 *      Configuration's job; moving the commercial position is the
 *      Quotation's. They are different amounts of work for different people,
 *      and deciding it here, once, is what stops the next person guessing how
 *      much of the costing they are allowed to touch.
 *
 * The sent quotation stays exactly as it was sent, whatever is chosen here.
 */

import { useState } from "react";
import { ArrowLeft, ArrowRight, Boxes, FileText, Package, Settings2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usd } from "@/lib/commercialProvisions";
import type { QuoteItem } from "@/lib/quoteDraftStore";

/** Where the selected articles are reworked. */
export type RequoteDestination = "configuration" | "quotation";

export function RequotePicker({
  quotationId,
  items,
  priceOf,
  /** the sent version the selected articles currently stand on */
  versionNo,
  statusLabel,
  onClose,
  onConfirm,
}: {
  quotationId: string;
  items: QuoteItem[];
  /** current quoted price of an item, for orientation while choosing */
  priceOf: (itemId: string) => number;
  versionNo?: number;
  statusLabel?: string;
  onClose: () => void;
  onConfirm: (itemIds: string[], destination: RequoteDestination) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<1 | 2>(1);
  const [destination, setDestination] = useState<RequoteDestination | null>(null);

  const allOn = picked.size === items.length && items.length > 0;

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const chosen = items.filter((i) => picked.has(i.id));
  const left = items.filter((i) => !picked.has(i.id));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="shrink-0 border-b border-hairline bg-surface px-6 py-3 lg:px-8">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-3">
          <div className="min-w-0">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
              {quotationId}
              {versionNo ? ` · V${versionNo}` : ""}
              {statusLabel ? ` · ${statusLabel}` : ""}
            </div>
            <h1 className="text-[19px] font-semibold tracking-tight text-ink-900">
              {step === 1 ? "Requote — select articles" : "Where would you like to make changes?"}
            </h1>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-md border border-hairline bg-surface p-2 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1100px] px-6 py-5 lg:px-8">
          {step === 1 ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <p className="min-w-0 flex-1 text-[12.5px] text-ink-500">
                  {quotationId} stays exactly as it was sent. Only the articles selected here move
                  to the new version — the rest remain on{" "}
                  <strong className="font-medium text-ink-700">
                    V{versionNo ?? 1}
                    {statusLabel ? ` (${statusLabel.toLowerCase()})` : ""}
                  </strong>
                  .
                </p>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPicked(allOn ? new Set() : new Set(items.map((i) => i.id)))}
                    className="shrink-0 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[11.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                  >
                    {allOn ? "Clear selection" : `Select all ${items.length}`}
                  </button>
                )}
              </div>

              <ul className="space-y-2">
                {items.map((item) => {
                  const on = picked.has(item.id);
                  return (
                    <li
                      key={item.id}
                      className={cn(
                        "rounded-xl border px-4 py-3 transition-colors",
                        on ? "border-brand-600 bg-brand-50/40" : "border-hairline bg-surface",
                      )}
                    >
                      <label className="flex cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(item.id)}
                          aria-label={`Requote ${item.name}`}
                          className="h-4 w-4 accent-[var(--color-brand-700)]"
                        />
                        {item.image ? (
                          <img
                            src={item.image}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-md border border-hairline object-cover"
                          />
                        ) : (
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-alt text-ink-400">
                            {item.kind === "kit" ? (
                              <Boxes className="h-4 w-4" />
                            ) : (
                              <Package className="h-4 w-4" />
                            )}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold text-ink-900">
                            {item.kind === "kit" ? `Kit — ${item.name}` : item.name}
                          </span>
                          <span className="block text-[11.5px] text-ink-500">
                            {item.srfRef} · quoted at {usd(priceOf(item.id))}
                          </span>
                        </span>
                        {/* Where this article stands today — the thing the
                            requote will move it off. */}
                        <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-[10.5px] font-medium text-ink-600">
                          {quotationId} · V{versionNo ?? 1}
                          {statusLabel ? ` · ${statusLabel}` : ""}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <>
              <p className="mb-1 text-[12.5px] text-ink-500">
                Applies to{" "}
                <strong className="font-medium text-ink-700">
                  {chosen.map((i) => i.name).join(", ")}
                </strong>
                {left.length > 0 && (
                  <>
                    {" — "}
                    {left.map((i) => i.name).join(", ")} {left.length === 1 ? "stays" : "stay"} on V
                    {versionNo ?? 1}.
                  </>
                )}
              </p>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <DestinationCard
                  active={destination === "configuration"}
                  onSelect={() => setDestination("configuration")}
                  icon={<Settings2 className="h-4.5 w-4.5" aria-hidden />}
                  title="Edit Configuration"
                  description="Modify materials, components, processes, consumption, MOQ, variants and scenarios. Starts from the costing again — hand-set cost and price are dropped, and the new quotation is generated once the costing is re-done."
                  path="Configuration → Costing Report → Quotation"
                />
                <DestinationCard
                  active={destination === "quotation"}
                  onSelect={() => setDestination("quotation")}
                  icon={<FileText className="h-4.5 w-4.5" aria-hidden />}
                  title="Edit Quotation"
                  description="Modify the quoted commercial values — selected scenario, MOQ, margin, selling price. The costing underneath stays as it stands; only the commercial position moves."
                  path="Straight to the new quotation"
                />
              </div>

              <p className="mt-4 rounded-lg bg-surface-alt/60 px-3.5 py-2.5 text-[12px] text-ink-500">
                Either way, V{versionNo ?? 1} and its approval history stay intact — the revised
                quotation is a new version and goes for approval on its own.
              </p>
            </>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-hairline bg-surface px-6 py-3 lg:px-8">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3">
          <span className="text-[12.5px] text-ink-500">
            {picked.size} of {items.length} article{items.length === 1 ? "" : "s"} selected
            {step === 2 && destination && (
              <>
                {" · "}
                {destination === "configuration"
                  ? "editing the configuration"
                  : "editing the quotation"}
              </>
            )}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {step === 2 ? (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3.5 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-hairline bg-surface px-3.5 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
              >
                Cancel
              </button>
            )}
            {step === 1 ? (
              <button
                type="button"
                disabled={picked.size === 0}
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue to Requote <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!destination}
                onClick={() => destination && onConfirm(Array.from(picked), destination)}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {destination === "configuration"
                  ? "Open Configuration"
                  : destination === "quotation"
                    ? "Open Quotation"
                    : "Create Requote"}
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

function DestinationCard({
  active,
  onSelect,
  icon,
  title,
  description,
  path,
}: {
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  path: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
        active
          ? "border-brand-600 bg-brand-50/40"
          : "border-hairline bg-surface hover:bg-surface-alt",
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md border",
            active
              ? "border-brand-600 bg-brand-50 text-brand-700"
              : "border-hairline bg-surface-alt text-ink-600",
          )}
        >
          {icon}
        </span>
        <span className="text-[14px] font-semibold text-ink-900">{title}</span>
      </span>
      <span className="text-[12px] leading-relaxed text-ink-600">{description}</span>
      <span className="mt-auto text-[11px] font-medium uppercase tracking-[0.08em] text-ink-400">
        {path}
      </span>
    </button>
  );
}
