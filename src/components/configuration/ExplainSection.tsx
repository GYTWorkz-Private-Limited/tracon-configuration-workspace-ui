import { useState } from "react";
import { ChevronDown, FunctionSquare, Info } from "lucide-react";
import type { CardExplain } from "@/lib/configExplain";

/**
 * Collapsed-by-default "Calculation & business rule" block.
 * Same content the Costing side panel shows, surfaced while configuring.
 */
export function ExplainSection({
  explain,
  defaultOpen = false,
}: {
  explain: CardExplain;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-hairline">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 bg-surface-alt/60 px-3.5 py-2.5 text-left hover:bg-surface-alt"
      >
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-500">
          <FunctionSquare className="h-3 w-3" /> Calculation &amp; business rule
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-ink-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-hairline px-3.5 py-3">
          <p className="text-[12.5px] leading-relaxed text-ink-600">{explain.summary}</p>

          {explain.rows.length > 0 && (
            <dl className="mt-3 divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
              {explain.rows.map((r, i) => (
                <div
                  key={r.label}
                  className={`flex items-center justify-between gap-3 px-3 py-2 text-[12.5px] ${
                    i === explain.rows.length - 1 ? "bg-surface-alt/60" : "bg-surface"
                  }`}
                >
                  <dt className="text-ink-500">{r.label}</dt>
                  <dd className="shrink-0 tabular-nums font-medium text-ink-900">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {explain.rule && (
            <div className="mt-3 rounded-lg border border-hairline bg-brand-50/50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-brand-700">
                <Info className="h-3 w-3" /> Business rule
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-600">{explain.rule}</p>
            </div>
          )}

          {explain.source && (
            <div className="mt-3 flex items-center justify-between gap-2 text-[11.5px]">
              <span className="uppercase tracking-[0.12em] text-ink-400">Source</span>
              <span className="text-ink-700">{explain.source}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
