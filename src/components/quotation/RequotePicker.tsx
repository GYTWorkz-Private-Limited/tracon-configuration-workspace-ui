/**
 * "The buyer accepted, then came back."
 *
 * A requote is a new commercial cycle, not an edit of the document the buyer
 * agreed to — so this picks what carries forward into a NEW quotation and
 * leaves the accepted one exactly as it was sent.
 *
 * The per-article choice is the point of the screen. "Full reconfiguration"
 * and "high-level override only" are different amounts of work for different
 * teams, and deciding it here, once, is what stops the next person having to
 * guess how much of the costing they are allowed to touch.
 */

import { useState } from "react";
import { ArrowRight, Boxes, Package, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usd } from "@/lib/commercialProvisions";
import type { QuoteItem } from "@/lib/quoteDraftStore";

export type RequoteScope = "full" | "override";

export function RequotePicker({
  quotationId,
  items,
  priceOf,
  onClose,
  onConfirm,
}: {
  quotationId: string;
  items: QuoteItem[];
  /** current quoted price of an item, for orientation while choosing */
  priceOf: (itemId: string) => number;
  onClose: () => void;
  onConfirm: (picks: { itemId: string; scope: RequoteScope }[]) => void;
}) {
  const [picked, setPicked] = useState<Map<string, RequoteScope>>(new Map());

  const toggle = (id: string) => {
    const next = new Map(picked);
    if (next.has(id)) next.delete(id);
    // Most requotes are a price conversation, not a re-engineering job, so the
    // cheaper answer is the default and the expensive one is a deliberate pick.
    else next.set(id, "override");
    setPicked(next);
  };

  const setScope = (id: string, scope: RequoteScope) => {
    const next = new Map(picked);
    next.set(id, scope);
    setPicked(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas">
      <header className="shrink-0 border-b border-hairline bg-surface px-6 py-3 lg:px-8">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-3">
          <div className="min-w-0">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-500">
              {quotationId}
            </div>
            <h1 className="text-[19px] font-semibold tracking-tight text-ink-900">
              Requote — select articles to carry forward
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
          <p className="mb-3 text-[12.5px] text-ink-500">
            {quotationId} stays exactly as it was sent. Everything picked here is copied into a new
            quotation, linked back to it.
          </p>

          <ul className="space-y-2">
            {items.map((item) => {
              const scope = picked.get(item.id);
              const on = scope !== undefined;
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
                  </label>

                  {/* Only once it is coming forward is there a question about
                      how much of it to redo. */}
                  {on && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-hairline pt-2.5">
                      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-ink-500">
                        Redo
                      </span>
                      <div className="inline-flex rounded-lg border border-hairline bg-surface p-0.5">
                        {[
                          { id: "full" as RequoteScope, label: "Full reconfiguration" },
                          { id: "override" as RequoteScope, label: "High-level override only" },
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setScope(item.id, t.id)}
                            aria-pressed={scope === t.id}
                            className={cn(
                              "rounded-md px-3 py-1 text-[11.5px] font-medium transition-colors",
                              scope === t.id
                                ? "bg-ink-900 text-white"
                                : "text-ink-600 hover:text-ink-900",
                            )}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <span className="text-[11px] text-ink-500">
                        {scope === "full"
                          ? "Starts from the costing again — hand-set cost and price are dropped."
                          : "Keeps the costing as it stands; only the commercial position moves."}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <footer className="shrink-0 border-t border-hairline bg-surface px-6 py-3 lg:px-8">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3">
          <span className="text-[12.5px] text-ink-500">
            {picked.size} of {items.length} article{items.length === 1 ? "" : "s"} carried forward
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-hairline bg-surface px-3.5 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={picked.size === 0}
              onClick={() =>
                onConfirm(Array.from(picked, ([itemId, scope]) => ({ itemId, scope })))
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Create Requote <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
