// AddComponentModal — searchable component catalogue.
//
// Same centred-popup pattern as every other modal in the workspace. A preset
// is added as a real, fully-costed component (material relationship, making
// spec, consumption rule and a cutting process), never a blank placeholder
// row that would show ₹0.00 and mean nothing.

import { useEffect, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentPreset } from "@/lib/costingModelData";

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (preset: ComponentPreset) => void;
  /** this product's own preset catalogue — never a shared/global list */
  presets: ComponentPreset[];
  /** names already on the variant — presets already used are shown as added */
  existingNames: string[];
};

export function AddComponentModal({ open, onClose, onAdd, presets, existingNames }: Props) {
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");

  useEffect(() => {
    if (open) {
      setQuery("");
      setCustom("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const filtered = presets.filter((p) =>
    `${p.name} ${p.type} ${p.usage} ${p.description}`.toLowerCase().includes(q),
  );

  const addCustom = () => {
    const name = custom.trim();
    if (!name) return;
    onAdd({
      name,
      type: "Trim / Self Fabric",
      usage: "To be defined",
      description: `${name} — added by the costing team.`,
      selfFabric: true,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add component"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 px-4"
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative flex max-h-[86vh] w-[560px] max-w-full flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
              Product Components
            </div>
            <h2 className="text-[16px] font-semibold text-ink-900">Add a component</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="relative mb-4">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
              aria-hidden
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${presets.length} component types…`}
              aria-label="Search component types"
              className="w-full rounded-md border border-hairline bg-surface py-2 pl-8 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-700 focus:ring-2 focus:ring-brand-700/15"
            />
          </div>

          <div className="space-y-2">
            {filtered.map((p) => {
              const added = existingNames.includes(p.name);
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => onAdd(p)}
                  className="w-full rounded-lg border border-hairline bg-surface p-3 text-left transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13.5px] font-medium text-ink-900">
                          {p.name}
                        </span>
                        {added && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.08em] text-brand-700">
                            <Check className="h-2.5 w-2.5" /> on variant
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[12px] text-ink-500">{p.description}</div>
                    </div>
                    <span className="shrink-0 rounded bg-surface-alt px-1.5 py-0.5 text-[11px] text-ink-600">
                      {p.type}
                    </span>
                  </div>
                  <div className="mt-2 border-t border-hairline pt-2 text-[11px] text-ink-400">
                    {p.usage} ·{" "}
                    {p.selfFabric
                      ? "inherits the body fabric material and rate"
                      : "material assigned after adding"}
                  </div>
                </button>
              );
            })}
            {!filtered.length && (
              <p className="py-2 text-[12.5px] text-ink-400">
                No preset matches "{query}". Add it as a custom component below.
              </p>
            )}
          </div>

          <div className="mt-5 rounded-lg border border-dashed border-hairline p-3">
            <label
              htmlFor="custom-component"
              className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-400"
            >
              Custom component
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="custom-component"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCustom();
                }}
                placeholder="e.g. Corner Reinforcement"
                className="min-w-0 flex-1 rounded-md border border-hairline bg-surface px-2.5 py-2 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-700 focus:ring-2 focus:ring-brand-700/15"
              />
              <button
                type="button"
                onClick={addCustom}
                disabled={!custom.trim()}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-[12.5px] font-medium transition-colors",
                  custom.trim()
                    ? "bg-brand-700 text-white hover:bg-brand-800"
                    : "cursor-not-allowed bg-ink-100 text-ink-400",
                )}
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
