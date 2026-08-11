// ComponentOptionModal — the single popup used to configure any raw-material
// component (Main Body excepted — it's derived from the fabric cards).
// Same interaction as every other "options" card in the workspace: search,
// pick from the full catalog, see the calculation rule, apply. Centered
// popup, not a stacked panel, so it never competes for width with the canvas.

import { useEffect, useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/fabricConfig";
import { optionCatalogFor, type ComponentOptionSpec, type FabricComponent } from "@/lib/configTree";

type Props = {
  component: FabricComponent | null;
  onClose: () => void;
  onApply: (id: string, patch: Partial<FabricComponent>) => void;
  onClear: (id: string) => void;
};

export function ComponentOptionModal({ component, onClose, onApply, onClear }: Props) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery("");
  }, [component?.id]);

  useEffect(() => {
    if (!component) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [component, onClose]);

  const catalog = useMemo(() => (component ? optionCatalogFor(component) : []), [component]);
  const filtered = catalog.filter((o) =>
    (o.label + " " + o.spec).toLowerCase().includes(query.toLowerCase()),
  );

  if (!component) return null;

  const pick = (opt: ComponentOptionSpec) => {
    onApply(component.id, {
      optionId: opt.id,
      spec: opt.spec,
      width: opt.width,
      consumption: opt.consumption,
      wastage: opt.wastage,
      rate: opt.rate,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Configure ${component.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 px-4"
    >
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative flex max-h-[86vh] w-[560px] max-w-full flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
              Component
            </div>
            <h2 className="text-[16px] font-semibold text-ink-900">Configure {component.name}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${catalog.length} options…`}
              className="w-full rounded-md border border-hairline bg-surface py-2 pl-8 pr-3 text-[13px] text-ink-900 placeholder:text-ink-400 outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-700/15"
            />
          </div>

          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-400">
            All options
          </div>
          <div className="space-y-2.5">
            {filtered.map((o) => {
              const isCurrent = component.optionId === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => pick(o)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    isCurrent
                      ? "border-brand-700 bg-brand-50"
                      : "border-hairline bg-surface hover:bg-surface-alt",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isCurrent && <Check className="h-3.5 w-3.5 shrink-0 text-brand-700" />}
                        <span className="truncate text-[13.5px] font-medium text-ink-900">
                          {o.label}
                        </span>
                        {isCurrent && (
                          <span className="shrink-0 rounded-full bg-ink-100 px-1.5 py-0.5 text-[9.5px] uppercase tracking-[0.08em] text-ink-600">
                            current
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[12px] text-ink-500">{o.spec}</div>
                    </div>
                    <span className="shrink-0 text-[13px] tabular-nums text-ink-900">
                      {inr(o.rate)} / m
                    </span>
                  </div>

                  <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-hairline pt-2.5 text-[11.5px]">
                    <div className="col-span-2 flex items-start justify-between gap-2">
                      <dt className="shrink-0 text-ink-400">Calculation rule</dt>
                      <dd className="text-right text-ink-800">{o.calc}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-ink-400">Consumption</dt>
                      <dd className="text-ink-800">{o.consumption.toFixed(3)} m</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-ink-400">Wastage</dt>
                      <dd className="text-ink-800">{o.wastage}%</dd>
                    </div>
                  </dl>
                </button>
              );
            })}
            {!filtered.length && <p className="text-[12.5px] text-ink-400">No matches.</p>}
          </div>
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-hairline px-5 py-3">
          {component.optionId ? (
            <button
              onClick={() => onClear(component.id)}
              className="rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-600 hover:bg-surface-alt"
            >
              Clear
            </button>
          ) : (
            <button
              onClick={onClose}
              className="rounded-md border border-hairline px-3 py-2 text-[13px] text-ink-600 hover:bg-surface-alt"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-800"
          >
            <Check className="h-3.5 w-3.5" /> Done
          </button>
        </footer>
      </div>
    </div>
  );
}
