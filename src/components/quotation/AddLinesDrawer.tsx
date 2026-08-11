// Add any mix of articles, sets and kits from the POD into this quotation.
//
// This is the manual entry path. It is deliberately not limited to items that
// were pushed in from Costing — anything in the POD with a costing reference
// can be quoted.

import { useMemo, useState } from "react";
import { X, Plus, Search, Package, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Article, Pod } from "@/lib/podsStore";
import { ARTICLE_STATUS_LABEL } from "@/lib/podsStore";

export function AddLinesDrawer({
  pod,
  taken,
  open,
  onClose,
  onAdd,
}: {
  pod: Pod | undefined;
  taken: Set<string>;
  open: boolean;
  onClose: () => void;
  onAdd: (articleIds: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const available = useMemo(() => {
    const list = (pod?.articles ?? []).filter((a) => !taken.has(a.id));
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((a) =>
      `${a.name} ${a.description ?? ""} ${a.size} ${a.style ?? ""}`.toLowerCase().includes(q),
    );
  }, [pod, taken, query]);

  if (!open) return null;

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Add items to quotation"
    >
      <button className="absolute inset-0 bg-ink-900/30" aria-label="Close" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[560px] flex-col border-l border-hairline bg-surface shadow-2xl">
        <header className="flex items-start gap-2 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-ink-900">Add items</h2>
            <p className="mt-0.5 text-[12px] text-ink-500">
              {pod ? `${pod.id} · ${pod.buyer}` : "No POD"} — articles, sets and kits with completed
              costing.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="border-b border-hairline px-5 py-3">
          <div className="flex items-center gap-2 rounded-md border border-hairline bg-surface px-2.5 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search articles"
              placeholder="Search articles, sets, kits…"
              className="w-full bg-transparent text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:outline-none"
            />
          </div>
        </div>

        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {available.map((a) => (
            <ArticleRow
              key={a.id}
              article={a}
              checked={picked.has(a.id)}
              onToggle={() => toggle(a.id)}
            />
          ))}
          {available.length === 0 && (
            <li className="py-12 text-center text-[13px] text-ink-500">
              {taken.size > 0
                ? "Every article in this POD is already on the quotation."
                : "No articles found."}
            </li>
          )}
        </ul>

        <footer className="flex items-center gap-2 border-t border-hairline px-5 py-3.5">
          <p className="text-[12px] text-ink-500">{picked.size} selected</p>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
            >
              Cancel
            </button>
            <button
              disabled={picked.size === 0}
              onClick={() => {
                onAdd(Array.from(picked));
                setPicked(new Set());
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Add to quotation
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function ArticleRow({
  article,
  checked,
  onToggle,
}: {
  article: Article;
  checked: boolean;
  onToggle: () => void;
}) {
  const isKit = article.type === "kit";
  return (
    <li>
      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors",
          checked
            ? "border-brand-600 bg-brand-50/30"
            : "border-hairline bg-surface hover:bg-surface-alt",
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand-700)]"
        />
        {article.image ? (
          <img
            src={article.image}
            alt=""
            className="h-10 w-10 shrink-0 rounded-md border border-hairline object-cover"
          />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-alt text-ink-400">
            {isKit ? <Layers className="h-4 w-4" /> : <Package className="h-4 w-4" />}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] font-semibold text-ink-900">{article.name}</span>
            {isKit && (
              <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-brand-700">
                Kit · {article.kitItems?.length ?? 0} items
              </span>
            )}
            <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-600">
              {ARTICLE_STATUS_LABEL[article.status]}
            </span>
          </span>
          <span className="mt-0.5 block text-[11.5px] text-ink-500">
            {article.size} · MOQ {article.moq} · {article.srfRef}
          </span>
        </span>
      </label>
    </li>
  );
}
