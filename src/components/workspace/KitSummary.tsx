/**
 * Kit Summary — the consolidation tab.
 *
 * Reads every member's live roll-up and adds them up per SET, then applies the
 * commercial stack once to that figure. It re-costs nothing: the numbers are
 * the same ones each member tab is showing, so opening this tab can never
 * disagree with the sheets behind it.
 *
 *   PLACEMAT  direct  ₹272 / pc
 *   RUNNER    direct  ₹576 / pc
 *   ─────────────────────────────
 *   KIT DIRECT COST / SET  ₹848
 *     → commercial provisions → final kit cost → selling price → margin
 */

import { useMemo, useState } from "react";
import { Boxes, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Article, KitItem } from "@/lib/podsStore";
import type { ArticleCosting } from "@/components/workspace/ArticleCostingWorkspace";
import {
  computeKitCommercials,
  DEFAULT_PROVISIONS,
  inr,
  pct,
  usd,
} from "@/lib/commercialProvisions";
import { CommercialBreakdown } from "@/components/quotation/CommercialBreakdown";

const CATEGORY_ROWS = [
  { key: "rawMaterial", label: "Raw material" },
  { key: "process", label: "Process" },
  { key: "accessories", label: "Accessories / trims" },
  { key: "packaging", label: "Packaging" },
  { key: "testing", label: "Testing & certification" },
] as const;

export function KitSummary({
  kit,
  members,
  costed,
}: {
  kit: Article;
  members: KitItem[];
  costed: Record<string, ArticleCosting>;
}) {
  const priced = members
    .map((m) => ({ member: m, costing: costed[m.id] }))
    .filter((x): x is { member: KitItem; costing: ArticleCosting } => Boolean(x.costing));

  const [marginPct, setMarginPct] = useState(26);

  const fxRate = priced[0]?.costing.fxRate ?? 90;

  const result = useMemo(
    () =>
      computeKitCommercials(
        priced.map((p) => ({
          directCostInr: p.costing.rollup.directCost,
          unitsPerSet: p.member.qty > 0 ? p.member.qty : 1,
        })),
        {
          rates: DEFAULT_PROVISIONS,
          fxRate,
          targetMarginPct: marginPct,
          buyerTargetUsd: priced.reduce(
            (t, p) => t + p.costing.sellingUsd * (p.member.qty > 0 ? p.member.qty : 1),
            0,
          ),
        },
      ),
    [priced, fxRate, marginPct],
  );

  // Sets are limited by the scarcest member — you cannot ship more sets than
  // the smallest component run allows.
  const sets = priced.length
    ? Math.min(...priced.map((p) => Math.floor(p.costing.moq / Math.max(1, p.member.qty))))
    : 0;

  if (priced.length === 0) {
    return (
      <div className="mx-auto max-w-[1100px] px-6 py-14 text-center">
        <p className="text-[13px] text-ink-500">
          Open each article tab once so its costing runs — the summary consolidates them live.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-4 px-6 py-5 lg:px-8">
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-cfg-soft)] text-[var(--color-cfg-strong)]">
          <Boxes className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold text-ink-900">{kit.name} — Kit Summary</h2>
          <p className="text-[12px] text-ink-500">
            Consolidated from each article's live costing. Change any member's configuration and
            this moves with it.
          </p>
        </div>
      </header>

      {/* per-member direct cost + category totals */}
      <section className="overflow-hidden rounded-xl border border-hairline bg-surface">
        <div className="border-b border-hairline px-4 py-2.5">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-600">
            Product-level direct costs
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[12px]">
            <thead>
              <tr className="border-b border-hairline bg-surface-alt/60 text-[10px] uppercase tracking-[0.1em] text-ink-500">
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Article
                </th>
                {CATEGORY_ROWS.map((c) => (
                  <th key={c.key} scope="col" className="px-3 py-2 text-right font-medium">
                    {c.label}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  Direct / pc
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium">
                  Direct / set
                </th>
              </tr>
            </thead>
            <tbody>
              {priced.map(({ member, costing }) => {
                const units = member.qty > 0 ? member.qty : 1;
                return (
                  <tr key={member.id} className="border-b border-hairline/70">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal">
                      <span className="flex items-center gap-2.5">
                        {member.image && (
                          <img
                            src={member.image}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded border border-hairline object-cover"
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block text-[12.5px] font-semibold text-ink-900">
                            {member.name}
                            {units > 1 && (
                              <span className="ml-1 text-[10.5px] font-normal tabular-nums text-ink-500">
                                ×{units}
                              </span>
                            )}
                          </span>
                          <span className="block text-[10.5px] text-ink-500">
                            {costing.scenarioName} · {costing.variantName} · {costing.sizeLabel} ·
                            MOQ {costing.moq.toLocaleString("en-IN")}
                          </span>
                        </span>
                      </span>
                    </th>
                    {CATEGORY_ROWS.map((c) => (
                      <td key={c.key} className="px-3 py-2.5 text-right tabular-nums text-ink-600">
                        {inr(costing.rollup[c.key])}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-700">
                      {inr(costing.rollup.directCost)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-ink-900">
                      {inr(costing.rollup.directCost * units)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-ink-200 bg-surface-alt/40">
                <th
                  scope="row"
                  className="px-4 py-3 text-left text-[13px] font-semibold text-ink-900"
                >
                  Kit direct cost / set
                </th>
                {CATEGORY_ROWS.map((c) => (
                  <td
                    key={c.key}
                    className="px-3 py-3 text-right text-[11.5px] font-medium tabular-nums text-ink-700"
                  >
                    {inr(
                      priced.reduce(
                        (t, p) => t + p.costing.rollup[c.key] * Math.max(1, p.member.qty),
                        0,
                      ),
                    )}
                  </td>
                ))}
                <td />
                <td className="px-4 py-3 text-right text-[16px] font-semibold tabular-nums text-ink-900">
                  {inr(result.directCostInr)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* commercial stack, applied once to the set */}
      <CommercialBreakdown
        result={result}
        defaultOpen
        title="Kit Commercial Overheads & Provisions"
        caption="Applied once to the combined set cost — not separately to each article."
      />

      {/* final kit position */}
      <section className="overflow-hidden rounded-xl border-2 border-[var(--color-cfg)] bg-surface">
        <header className="flex flex-wrap items-center gap-3 bg-[var(--color-cfg-soft)] px-4 py-3">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--color-cfg-strong)]">
            Final kit costing
          </h3>
          <label className="ml-auto flex items-center gap-2 text-[11.5px] text-ink-600">
            Target margin
            <span className="flex items-baseline">
              <input
                type="number"
                step="0.5"
                value={marginPct}
                onChange={(e) => setMarginPct(Number(e.target.value))}
                aria-label="Kit target margin percent"
                className="w-16 rounded-md border border-hairline bg-surface px-2 py-1 text-right text-[12px] tabular-nums text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              />
              <span className="pl-1" aria-hidden>
                %
              </span>
            </span>
          </label>
        </header>

        <dl className="grid grid-cols-2 gap-px bg-hairline sm:grid-cols-3 lg:grid-cols-4">
          <Cell label="Combined direct cost / set" value={inr(result.directCostInr)} />
          <Cell label="Commercial overheads" value={inr(result.commercialOverheadsInr)} />
          <Cell label="Supplier margins" value={inr(result.supplierMarginsInr)} />
          <Cell label="Other indirect costs" value={inr(result.otherIndirectInr)} />
          <Cell label="Provisions" value={inr(result.provisionsInr)} />
          <Cell label="Final kit cost / set" value={inr(result.finalCostInr)} strong />
          <Cell label="Selling price / set" value={inr(result.sellingInr)} strong />
          <Cell label="Selling price USD / set" value={usd(result.sellingUsd)} strong />
          <Cell label="Margin INR / set" value={inr(result.marginInr)} />
          <Cell label="Margin %" value={pct(result.marginPct, 1)} />
          <Cell label="MOQ" value={`${sets.toLocaleString("en-IN")} sets`} />
          <Cell label="Order value" value={usd(result.sellingUsd * sets, 0)} strong />
        </dl>

        <p className="flex items-start gap-2 border-t border-hairline bg-surface-alt/40 px-4 py-2.5 text-[11.5px] text-ink-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
          MOQ is capped by the scarcest member — {sets.toLocaleString("en-IN")} sets is the most
          this kit can ship at the quantities each article is costed on. This is the figure
          Quotation picks up.
        </p>
      </section>
    </div>
  );
}

function Cell({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="bg-surface px-4 py-2.5">
      <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-500">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 tabular-nums",
          strong ? "text-[15px] font-semibold text-ink-900" : "text-[13px] text-ink-700",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
