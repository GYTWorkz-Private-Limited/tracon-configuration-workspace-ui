// NodeConfigModal — right-side drawer that opens when a graph node is clicked.
// Shows the component library entry for that node with search, sort, and a
// preview panel. Applying a variant patches CushionInputs.

import { useEffect, useMemo, useState } from "react";
import { X, Check, Sparkles, Layers, Search, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CushionInputs } from "@/lib/cushionCosting";
import { computeCushion } from "@/lib/cushionCosting";
import { libraryFor, nodesForInputPatch, type ComponentVariant } from "@/lib/componentLibrary";

type Props = {
  nodeId: string | null;
  inputs: CushionInputs;
  onClose: () => void;
  onApply: (patch: Partial<CushionInputs>, nodes: string[]) => void;
};

type SortKey = "recommended" | "cost-asc" | "cost-desc" | "alpha";

const TAG_STYLES: Record<string, string> = {
  recommended: "bg-emerald-100 text-emerald-700",
  premium: "bg-indigo-100 text-indigo-700",
  budget: "bg-amber-100 text-amber-700",
  sustainable: "bg-teal-100 text-teal-700",
  fast: "bg-sky-100 text-sky-700",
};

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recommended", label: "Recommended" },
  { key: "cost-asc", label: "Cost · low → high" },
  { key: "cost-desc", label: "Cost · high → low" },
  { key: "alpha", label: "Alphabetical" },
];

export function NodeConfigModal({ nodeId, inputs, onClose, onApply }: Props) {
  const spec = nodeId ? libraryFor(nodeId) : undefined;
  const baseMetrics = useMemo(() => computeCushion(inputs), [inputs]);

  const currentValue = useMemo(() => {
    if (!spec) return null;
    for (const v of spec.variants) {
      const [k, val] = Object.entries(v.patch)[0] ?? [];
      if (k && (inputs as Record<string, unknown>)[k] === val) return v.id;
    }
    return null;
  }, [spec, inputs]);

  const [selected, setSelected] = useState<string | null>(currentValue);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recommended");

  useEffect(() => {
    setSelected(currentValue);
    setQuery("");
  }, [currentValue, nodeId]);

  // Precompute quote for each variant (used for sort + row hint).
  const variantQuotes = useMemo(() => {
    const map = new Map<string, number>();
    if (!spec) return map;
    for (const v of spec.variants) {
      map.set(v.id, computeCushion({ ...inputs, ...v.patch }).suggestedQuoteUsd);
    }
    return map;
  }, [spec, inputs]);

  const visibleVariants = useMemo(() => {
    if (!spec) return [];
    const q = query.trim().toLowerCase();
    const filtered = spec.variants.filter((v) => {
      if (!q) return true;
      const hay = [v.label, v.note ?? "", v.tag ?? ""].join(" ").toLowerCase();
      return hay.includes(q);
    });
    const arr = [...filtered];
    switch (sort) {
      case "cost-asc":
        arr.sort((a, b) => (variantQuotes.get(a.id) ?? 0) - (variantQuotes.get(b.id) ?? 0));
        break;
      case "cost-desc":
        arr.sort((a, b) => (variantQuotes.get(b.id) ?? 0) - (variantQuotes.get(a.id) ?? 0));
        break;
      case "alpha":
        arr.sort((a, b) => a.label.localeCompare(b.label));
        break;
      case "recommended":
      default:
        arr.sort((a, b) => {
          const ar = a.tag === "recommended" ? 0 : 1;
          const br = b.tag === "recommended" ? 0 : 1;
          if (ar !== br) return ar - br;
          return a.label.localeCompare(b.label);
        });
    }
    return arr;
  }, [spec, query, sort, variantQuotes]);

  if (!spec) return null;

  const previewVariant = spec.variants.find((v) => v.id === selected);
  const previewMetrics = previewVariant
    ? computeCushion({ ...inputs, ...previewVariant.patch })
    : baseMetrics;
  const quoteDelta = previewMetrics.suggestedQuoteUsd - baseMetrics.suggestedQuoteUsd;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-ink-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-[520px] flex-col bg-white shadow-2xl animate-surface-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`${spec.title} — component library`}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-hairline px-5 py-4">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <Layers className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500">
              {spec.category} · Component library
            </div>
            <h2 className="text-[17px] font-medium text-ink-900">{spec.title}</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-500">{spec.description}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search + sort */}
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
          <div className="flex flex-1 items-center gap-1.5 rounded-lg border border-hairline bg-white px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${spec.variants.length} options…`}
              className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-ink-400"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="rounded p-0.5 text-ink-400 hover:bg-surface-alt hover:text-ink-700"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="appearance-none rounded-lg border border-hairline bg-white py-1.5 pl-7 pr-6 text-[12px] text-ink-800 outline-none hover:bg-surface-alt"
              aria-label="Sort variants"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <ArrowUpDown className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
          </div>
        </div>

        {/* Preview strip */}
        <div className="flex items-center justify-between border-b border-hairline bg-surface-alt/40 px-5 py-3">
          <div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-500">
              Preview quote
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-[22px] font-semibold tabular-nums text-ink-900">
                ${previewMetrics.suggestedQuoteUsd.toFixed(2)}
              </div>
              <div
                className={cn(
                  "text-[11.5px] tabular-nums",
                  quoteDelta === 0
                    ? "text-ink-500"
                    : quoteDelta > 0
                      ? "text-danger"
                      : "text-emerald-700",
                )}
              >
                {quoteDelta === 0
                  ? "no change"
                  : `${quoteDelta > 0 ? "+" : ""}$${quoteDelta.toFixed(2)}`}
              </div>
            </div>
          </div>
          <dl className="flex items-center gap-4 text-[11px]">
            <MiniStat label="Total ₹/pc" value={`₹${previewMetrics.totalPc.toFixed(0)}`} />
            <MiniStat label="Fabric" value={`₹${previewMetrics.fabricSubtotal.toFixed(0)}`} />
            <MiniStat label="Making" value={`₹${previewMetrics.makingSubtotal.toFixed(0)}`} />
            <MiniStat
              label="Margin"
              value={`${(previewMetrics.quoteMarginPct * 100).toFixed(0)}%`}
            />
          </dl>
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-4">
          {visibleVariants.map((v) => {
            const isSel = v.id === selected;
            const isCurrent = v.id === currentValue;
            const quote = variantQuotes.get(v.id) ?? 0;
            const d = quote - baseMetrics.suggestedQuoteUsd;
            return (
              <button
                key={v.id}
                onClick={() => setSelected(v.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                  isSel
                    ? "border-ink-900 bg-ink-900/[0.03] shadow-sm"
                    : "border-hairline bg-white hover:border-ink-300",
                )}
              >
                <span
                  className={cn(
                    "mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    isSel ? "border-ink-900 bg-ink-900 text-white" : "border-ink-300 bg-white",
                  )}
                >
                  {isSel && <Check className="h-2.5 w-2.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-ink-900">{v.label}</span>
                    {v.tag && (
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                          TAG_STYLES[v.tag],
                        )}
                      >
                        {v.tag}
                      </span>
                    )}
                    {isCurrent && (
                      <span className="rounded-full bg-surface-alt px-1.5 py-0.5 text-[10px] text-ink-500">
                        current
                      </span>
                    )}
                  </div>
                  {v.note && <div className="text-[11.5px] text-ink-500">{v.note}</div>}
                </div>
                <div className="text-right">
                  <div className="text-[12px] font-medium tabular-nums text-ink-900">
                    ${quote.toFixed(2)}
                  </div>
                  <div
                    className={cn(
                      "text-[10.5px] tabular-nums",
                      d === 0 ? "text-ink-400" : d > 0 ? "text-danger" : "text-emerald-700",
                    )}
                  >
                    {d === 0 ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(2)}`}
                  </div>
                </div>
              </button>
            );
          })}
          {visibleVariants.length === 0 && (
            <div className="px-2 py-10 text-center text-[12px] text-ink-500">
              No variants match "{query}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-hairline px-5 py-3">
          <div className="text-[11.5px] text-ink-500">
            {visibleVariants.length} of {spec.variants.length} · applies to active scenario
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-hairline px-3 py-1.5 text-[12.5px] text-ink-700 hover:bg-surface-alt"
            >
              Cancel
            </button>
            <button
              disabled={!previewVariant || previewVariant.id === currentValue}
              onClick={() => {
                if (!previewVariant) return;
                onApply(
                  previewVariant.patch,
                  nodesForInputPatch(previewVariant.patch, [spec.nodeId]),
                );
                onClose();
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium",
                previewVariant && previewVariant.id !== currentValue
                  ? "bg-brand-700 text-white hover:bg-brand-800"
                  : "bg-ink-200 text-white",
              )}
            >
              <Sparkles className="h-3.5 w-3.5" /> Apply variant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="text-[9.5px] font-medium uppercase tracking-wide text-ink-400">{label}</div>
      <div className="tabular-nums text-ink-900">{value}</div>
    </div>
  );
}

// Kept for backwards compatibility with any external importer.
export function _VariantPriceHint({
  variant,
  inputs,
  baseQuote,
}: {
  variant: ComponentVariant;
  inputs: CushionInputs;
  baseQuote: number;
}) {
  const q = computeCushion({ ...inputs, ...variant.patch }).suggestedQuoteUsd;
  const d = q - baseQuote;
  return (
    <div className="text-right">
      <div className="text-[12px] font-medium tabular-nums text-ink-900">${q.toFixed(2)}</div>
      <div
        className={cn(
          "text-[10.5px] tabular-nums",
          d === 0 ? "text-ink-400" : d > 0 ? "text-danger" : "text-emerald-700",
        )}
      >
        {d === 0 ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(2)}`}
      </div>
    </div>
  );
}
