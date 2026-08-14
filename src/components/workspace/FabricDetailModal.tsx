/**
 * FabricDetailModal — the working behind a fabric rollup row's numbers.
 *
 * The rollup states a conclusion: metres, tier, cost. A merchandiser being
 * asked "why this rate?" needs the derivation — which components drink the
 * cloth, what each contributes, and where the total lands on the mill's
 * ladder. The math is written out ("perPiece × MOQ = metres") because the
 * point of this view is auditability: a stated equation can be checked with a
 * calculator, a bare number cannot.
 */

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fabricCost, metres, tierLabel, type FabricRequirement } from "@/lib/fabricRequirement";

const HEAD =
  "px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400 whitespace-nowrap";
const CELL = "px-3 py-2 text-[12px] text-ink-700";
const NUM = "text-right tabular-nums whitespace-nowrap";

export function FabricDetailModal({
  req,
  onClose,
}: {
  req: FabricRequirement;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Component costs are stated at the APPLIED rate, not each line's own base
  // rate — the whole point of pooling metres is that every line buys at the
  // tier the pool reached, and the table must add up to the rollup figure.
  const rate = req.tier.rate;
  const totalMetres = req.uses.reduce((t, u) => t + u.metres, 0);
  const totalCost = req.uses.reduce((t, u) => t + u.metres * rate, 0);

  // A per-article view only says something when there is more than one
  // article — for a single article it would repeat the summary strip.
  const byArticle = new Map<string, { name: string; metres: number }>();
  for (const u of req.uses) {
    const a = byArticle.get(u.articleId) ?? { name: u.articleName, metres: 0 };
    a.metres += u.metres;
    byArticle.set(u.articleId, a);
  }
  const multiArticle = byArticle.size > 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${req.name} fabric requirement details`}
    >
      <button className="absolute inset-0 bg-ink-900/40" aria-label="Close" onClick={onClose} />

      <div className="relative flex max-h-[85vh] w-full max-w-[680px] flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl">
        <header className="flex shrink-0 items-start gap-3 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-ink-900">{req.name}</h2>
            <p className="mt-0.5 text-[12px] text-ink-500">
              {req.code} · POD-level fabric requirement
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

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* The four numbers the rollup line compresses, side by side. */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-4">
            <SummaryCell label="Total required" value={metres(req.metres)} />
            <SummaryCell label="MOQ tier" value={tierLabel(req.tier)} />
            <SummaryCell label="Rate" value={`₹${req.tier.rate}/m`} />
            <SummaryCell label="Total fabric cost" value={fabricCost(req.costInr)} strong />
          </div>

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600">
              Where the metres come from
            </h3>
            <div className="overflow-x-auto rounded-lg border border-hairline">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead className="bg-surface-alt">
                  <tr className="border-b border-hairline">
                    <th scope="col" className={HEAD}>
                      Component
                    </th>
                    <th scope="col" className={HEAD}>
                      Article
                    </th>
                    <th scope="col" className={cn(HEAD, "text-right")}>
                      MOQ (pcs)
                    </th>
                    <th scope="col" className={cn(HEAD, "text-right")}>
                      Per piece × MOQ = metres
                    </th>
                    <th scope="col" className={cn(HEAD, "text-right")}>
                      Cost @ ₹{rate}/m
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {req.uses.map((u, i) => (
                    <tr
                      key={`${u.articleId}-${u.componentName}-${i}`}
                      className="border-b border-hairline"
                    >
                      <td className={cn(CELL, "font-medium text-ink-900")}>{u.componentName}</td>
                      <td className={CELL}>{u.articleName}</td>
                      <td className={cn(CELL, NUM)}>{u.moq.toLocaleString("en-IN")}</td>
                      <td className={cn(CELL, NUM)}>
                        <span className="text-ink-500">
                          {u.perPiece.toFixed(3)} m × {u.moq.toLocaleString("en-IN")} ={" "}
                        </span>
                        {metres(u.metres)}
                      </td>
                      <td className={cn(CELL, NUM, "font-medium text-ink-900")}>
                        {fabricCost(u.metres * rate)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-surface-alt/50">
                    <td className={cn(CELL, "font-semibold text-ink-900")} colSpan={3}>
                      Total
                    </td>
                    <td className={cn(CELL, NUM, "font-semibold text-ink-900")}>
                      {metres(totalMetres)}
                    </td>
                    <td className={cn(CELL, NUM, "font-semibold text-ink-900")}>
                      {fabricCost(totalCost)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600">
              MOQ tier ladder
            </h3>
            <div className="overflow-x-auto rounded-lg border border-hairline">
              <table className="w-full border-collapse text-left">
                <thead className="bg-surface-alt">
                  <tr className="border-b border-hairline">
                    <th scope="col" className={HEAD}>
                      Minimum metres
                    </th>
                    <th scope="col" className={cn(HEAD, "text-right")}>
                      Rate (₹/m)
                    </th>
                    <th scope="col" className={cn(HEAD, "text-right")}>
                      <span className="sr-only">Applied</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...req.tiers]
                    .sort((a, b) => a.minMetres - b.minMetres)
                    .map((t) => {
                      const applied = t.minMetres === req.tier.minMetres;
                      return (
                        <tr
                          key={t.minMetres}
                          className={cn("border-b border-hairline", applied && "bg-brand-50")}
                        >
                          <td className={cn(CELL, applied && "font-medium text-brand-800")}>
                            {metres(t.minMetres)}
                          </td>
                          <td className={cn(CELL, NUM, applied && "font-semibold text-brand-800")}>
                            ₹{t.rate}
                          </td>
                          <td className={cn(CELL, "text-right")}>
                            {applied && (
                              <span className="inline-flex rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-white">
                                Applied
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>

          {multiArticle && (
            <section>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600">
                Per-article breakdown
              </h3>
              <div className="overflow-x-auto rounded-lg border border-hairline">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-surface-alt">
                    <tr className="border-b border-hairline">
                      <th scope="col" className={HEAD}>
                        Article
                      </th>
                      <th scope="col" className={cn(HEAD, "text-right")}>
                        Metres
                      </th>
                      <th scope="col" className={cn(HEAD, "text-right")}>
                        Cost @ ₹{rate}/m
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(byArticle.entries()).map(([id, a]) => (
                      <tr key={id} className="border-b border-hairline">
                        <td className={cn(CELL, "font-medium text-ink-900")}>{a.name}</td>
                        <td className={cn(CELL, NUM)}>{metres(a.metres)}</td>
                        <td className={cn(CELL, NUM)}>{fabricCost(a.metres * rate)}</td>
                      </tr>
                    ))}
                    <tr className="bg-surface-alt/50">
                      <td className={cn(CELL, "font-semibold text-ink-900")}>Total</td>
                      <td className={cn(CELL, NUM, "font-semibold text-ink-900")}>
                        {metres(totalMetres)}
                      </td>
                      <td className={cn(CELL, NUM, "font-semibold text-ink-900")}>
                        {fabricCost(totalCost)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <footer className="shrink-0 border-t border-hairline bg-surface-alt/40 px-5 py-3">
          <p className="text-[11px] text-ink-500">
            Metres are POD-level — every article drawing on this cloth contributes to the tier.
          </p>
        </footer>
      </div>
    </div>
  );
}

function SummaryCell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="bg-surface px-3.5 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-[13.5px] tabular-nums",
          strong ? "font-semibold text-ink-900" : "font-medium text-ink-800",
        )}
      >
        {value}
      </div>
    </div>
  );
}
