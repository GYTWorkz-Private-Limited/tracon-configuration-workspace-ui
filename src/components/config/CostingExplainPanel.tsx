// Read-only costing explanation panel — same shell as the Configuration drawer.
// No inputs, no Apply: it only explains where a value came from.

import { X, Info, FunctionSquare, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { CostCard } from "@/lib/costingSheet";

export function CostingExplainPanel({
  card,
  onClose,
  navPodId,
  navArticleId,
}: {
  card: CostCard;
  onClose: () => void;
  navPodId?: string;
  navArticleId?: string;
}) {
  return (
    <aside className="flex h-full w-full flex-col border-l border-hairline bg-surface">
      <header className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-3.5">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.12em] text-ink-400">
            Costing <span className="text-ink-300">/</span>{" "}
            <span className="text-brand-700">{card.label}</span>
          </div>
          <h2 className="mt-0.5 truncate text-[15px] font-medium text-ink-900">
            How this is calculated
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="rounded-md p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="rounded-xl border border-hairline bg-surface-alt/50 px-4 py-3">
          <div className="text-[10.5px] uppercase tracking-[0.12em] text-ink-400">{card.label}</div>
          <div className="mt-0.5 text-[22px] font-semibold tabular-nums tracking-tight text-ink-900">
            {card.value}
          </div>
          {card.desc && <div className="mt-1 text-[11.5px] text-ink-500">{card.desc}</div>}
        </div>

        <p className="mt-4 text-[12.5px] leading-relaxed text-ink-600">{card.explain.summary}</p>

        {card.explain.rows.length > 0 && (
          <section className="mt-4">
            <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-ink-400">
              <FunctionSquare className="h-3 w-3" /> Calculation
            </div>
            <dl className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
              {card.explain.rows.map((r, i) => (
                <div
                  key={r.label}
                  className={`flex items-center justify-between gap-3 px-3 py-2 text-[12.5px] ${
                    i === card.explain.rows.length - 1 ? "bg-surface-alt/60" : "bg-surface"
                  }`}
                >
                  <dt className="text-ink-500">{r.label}</dt>
                  <dd className="shrink-0 tabular-nums font-medium text-ink-900">{r.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {card.explain.rule && (
          <section className="mt-4 rounded-xl border border-hairline bg-brand-50/50 px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-brand-700">
              <Info className="h-3 w-3" /> Business rule
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-600">{card.explain.rule}</p>
          </section>
        )}

        {card.explain.source && (
          <section className="mt-4">
            <div className="text-[10.5px] uppercase tracking-[0.12em] text-ink-400">Source</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-[12.5px] text-ink-800">{card.explain.source}</span>
              {navPodId && navArticleId && card.explain.source.startsWith("Configuration") && (
                <Link
                  to="/config/$podId/$articleId"
                  params={{ podId: navPodId, articleId: navArticleId }}
                  search={{ sel: undefined }}
                  className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface px-2 py-1 text-[11.5px] font-medium text-ink-700 hover:bg-surface-alt hover:text-ink-900"
                >
                  Open module <ArrowUpRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </section>
        )}

        <p className="mt-5 text-[11.5px] leading-relaxed text-ink-400">
          Costing is read-only. To change a value, return to Configuration, update the module and
          regenerate costing — this workspace updates automatically.
        </p>
      </div>
    </aside>
  );
}
