// MasterLibraryPanel — searchable, attribute-rich master component library.
// Tabbed browser (Fabrics · Process · Trims). Clicking a card applies the
// component's patch to the active variant and pulse-highlights every graph
// node it affects.

import { useMemo, useState } from "react";
import { Search, BookOpen, Settings, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CushionInputs } from "@/lib/cushionCosting";
import {
  MASTER_COMPONENTS,
  nodesForInputPatch,
  type MasterComponent,
  type MasterTab,
} from "@/lib/componentLibrary";

type Props = {
  activeVariantKind: string;
  onApply: (patch: Partial<CushionInputs>, nodes: string[]) => void;
  className?: string;
};

const TABS: MasterTab[] = ["Fabrics", "Process", "Trims"];

const TAG_STYLES: Record<string, string> = {
  recommended: "bg-emerald-100 text-emerald-700",
  premium: "bg-indigo-100 text-indigo-700",
  budget: "bg-amber-100 text-amber-700",
  sustainable: "bg-teal-100 text-teal-700",
  fast: "bg-sky-100 text-sky-700",
};

export function MasterLibraryPanel({ activeVariantKind, onApply, className }: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<MasterTab>("Fabrics");
  const [appliedId, setAppliedId] = useState<string | null>(null);

  const contextHint = useMemo(() => {
    if (activeVariantKind === "value") return "value";
    if (activeVariantKind === "premium") return "premium";
    return "default";
  }, [activeVariantKind]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = MASTER_COMPONENTS.filter((m) => {
      if (m.tab !== tab) return false;
      if (!q) return true;
      const hay = [m.name, m.meta ?? "", m.price, ...m.attributes.flatMap((a) => [a.key, a.value])]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
    return filtered.sort((a, b) => {
      const aRec = a.contextTags?.includes(contextHint) ? 0 : 1;
      const bRec = b.contextTags?.includes(contextHint) ? 0 : 1;
      if (aRec !== bRec) return aRec - bRec;
      const aTag = a.tag === "recommended" ? 0 : 1;
      const bTag = b.tag === "recommended" ? 0 : 1;
      if (aTag !== bTag) return aTag - bTag;
      return a.name.localeCompare(b.name);
    });
  }, [query, tab, contextHint]);

  const handleApply = (m: MasterComponent) => {
    onApply(m.patch, nodesForInputPatch(m.patch, [m.nodeId, ...(m.affectedNodes ?? [])]));
    setAppliedId(m.id);
    window.setTimeout(() => setAppliedId((id) => (id === m.id ? null : id)), 1800);
  };

  return (
    <section
      className={cn(
        "flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-hairline bg-white",
        className,
      )}
    >
      {/* Dark header */}
      <div className="flex items-center gap-2 bg-slate-800 px-3.5 py-2.5 text-white">
        <BookOpen className="h-4 w-4 text-amber-300" />
        <span className="text-[13px] font-semibold">Component Library</span>
        <span className="ml-auto rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/75">
          {MASTER_COMPONENTS.length}
        </span>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search fabrics, yarns, processes…"
            className="w-full bg-transparent text-[12.5px] outline-none placeholder:text-ink-400"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-2 flex gap-6 border-b border-hairline px-3">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 pb-2 pt-1 text-[12.5px] font-medium transition-colors",
              tab === t
                ? "border-brand-700 text-brand-700"
                : "border-transparent text-ink-500 hover:text-ink-800",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3 scrollbar-thin scrollbar-thumb-ink-200 scrollbar-track-transparent">
        {items.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => handleApply(m)}
            title={`Use ${m.name}`}
            className={cn(
              "group w-full rounded-lg border bg-white p-2 text-left transition-all hover:border-brand-300 hover:bg-brand-50/25 hover:shadow-sm active:scale-[0.99]",
              appliedId === m.id ? "border-emerald-300 ring-2 ring-emerald-100" : "border-hairline",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[12.5px] font-semibold text-ink-900">{m.name}</span>
                  {m.tag && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide",
                        TAG_STYLES[m.tag],
                      )}
                    >
                      {m.tag}
                    </span>
                  )}
                </div>
                {m.meta && <div className="mt-0.5 text-[11px] text-ink-500">{m.meta}</div>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="whitespace-nowrap text-[12px] font-semibold text-emerald-700">
                  {m.price}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-medium text-white transition-colors",
                    appliedId === m.id ? "bg-emerald-600" : "bg-ink-900 group-hover:bg-brand-700",
                  )}
                >
                  {appliedId === m.id && <Check className="h-3 w-3" />}
                  {appliedId === m.id ? "Applied" : "Use"}
                </span>
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {m.attributes.slice(0, 3).map((a) => (
                <span
                  key={`${m.id}-${a.key}`}
                  className="rounded-full border border-hairline bg-surface-alt px-1.5 py-0.5 text-[10px] text-ink-600"
                >
                  {a.key}: <span className="text-ink-900">{a.value}</span>
                </span>
              ))}
            </div>
          </button>
        ))}
        {items.length === 0 && (
          <div className="px-2 py-6 text-center text-[11.5px] text-ink-500">
            No components match "{query}"
          </div>
        )}
      </div>

      {/* Tech note */}
      <div className="mx-3 mb-3 flex shrink-0 items-start gap-1.5 rounded-md border border-dashed border-amber-300 bg-amber-50/60 px-2.5 py-2 text-[11px] text-ink-700">
        <Settings className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
        <span>
          <span className="font-semibold">TECH NOTE:</span> Rates from Ready Reckoner. Last updated
          12 days ago · 3-month avg shown.
        </span>
      </div>
    </section>
  );
}
