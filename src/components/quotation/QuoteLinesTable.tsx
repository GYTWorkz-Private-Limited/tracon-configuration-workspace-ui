// The quoted lines of one product or one kit.
//
// Every figure here is re-costed from Configuration on read — the Cost column
// is never typed and never stored. Only the commercial decisions (which
// scenario, which build, what quantity, what margin) belong to the quotation.

import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr, pct, usd } from "@/lib/commercialProvisions";
import type { PricedLine } from "@/lib/quotationPricing";
import type { BuildRef } from "@/lib/costingSelectionStore";
import { ConfigChips } from "./ConfigChips";

export type QuoteRow = {
  lineId: string;
  priced: PricedLine;
  /** the variant an option branched off, for the nested chip */
  parentBuild?: BuildRef;
  /** kit members carry their own identity; a product's lines share the card's */
  leading?: { name: string; image?: string; size?: string; unitsPerSet?: number };
};

export function QuoteLinesTable({
  rows,
  quotedLineId,
  onQuote,
  onRemove,
  onMargin,
  onMoq,
  showQuoteColumn = true,
  identityHeader = "Configuration",
}: {
  rows: QuoteRow[];
  /** the line the summary below is built from */
  quotedLineId?: string;
  onQuote?: (lineId: string) => void;
  onRemove?: (lineId: string) => void;
  onMargin: (lineId: string, marginPct: number) => void;
  onMoq: (lineId: string, moq: number) => void;
  showQuoteColumn?: boolean;
  identityHeader?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-hairline bg-surface-alt/60 text-[10px] uppercase tracking-[0.1em] text-ink-500">
            {showQuoteColumn && (
              <th scope="col" className="w-10 px-3 py-2 text-left font-medium">
                <span className="sr-only">Quoted position</span>
              </th>
            )}
            <th scope="col" className="min-w-[300px] px-3 py-2 text-left font-medium">
              {identityHeader}
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              MOQ
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Direct cost
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Commercials
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Final cost
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Selling price
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Margin
            </th>
            {onRemove && (
              <th scope="col" className="w-10 px-3 py-2 text-right font-medium">
                <span className="sr-only">Remove</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { priced } = row;
            const c = priced.commercial;
            const isQuoted = row.lineId === quotedLineId;
            const commercialsInr = c.totalPurchaseInr + c.totalSaleInr;

            return (
              <tr
                key={row.lineId}
                className={cn(
                  "border-b border-hairline/70 align-top transition-colors",
                  isQuoted ? "bg-brand-50/40" : "hover:bg-surface-alt/40",
                )}
              >
                {showQuoteColumn && (
                  <td className="px-3 py-2.5">
                    <input
                      type="radio"
                      checked={isQuoted}
                      onChange={() => onQuote?.(row.lineId)}
                      aria-label={`Quote ${priced.scenario.name}`}
                      title="Quote this position"
                      className="mt-1 h-3.5 w-3.5 accent-[var(--color-brand-700)]"
                    />
                  </td>
                )}

                <td className="px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    {row.leading && (
                      <>
                        {row.leading.image ? (
                          <img
                            src={row.leading.image}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded border border-hairline object-cover"
                          />
                        ) : null}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12.5px] font-semibold text-ink-900">
                              {row.leading.name}
                            </span>
                            {row.leading.unitsPerSet && row.leading.unitsPerSet > 1 && (
                              <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-ink-600">
                                ×{row.leading.unitsPerSet} / set
                              </span>
                            )}
                          </div>
                          <ConfigChips
                            className="mt-1"
                            scenario={priced.scenario}
                            build={priced.build}
                            parentBuild={row.parentBuild}
                            size={priced.sizeLabel}
                          />
                        </div>
                      </>
                    )}
                    {!row.leading && (
                      <ConfigChips
                        scenario={priced.scenario}
                        build={priced.build}
                        parentBuild={row.parentBuild}
                        size={priced.sizeLabel}
                      />
                    )}
                  </div>
                </td>

                <td className="px-3 py-2.5 text-right">
                  <input
                    type="number"
                    min={1}
                    step={100}
                    value={priced.moq}
                    onChange={(e) => onMoq(row.lineId, Number(e.target.value))}
                    aria-label="Quoted quantity"
                    className="w-24 rounded border border-transparent bg-transparent px-1.5 py-1 text-right text-[12px] tabular-nums text-ink-900 hover:border-hairline focus:border-brand-600 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                  />
                </td>

                <td className="px-3 py-2.5 text-right tabular-nums">
                  <div className="text-ink-900">{inr(priced.directCostInr)}</div>
                  <div className="text-[10.5px] text-ink-400">{usd(priced.directCostUsd)}</div>
                </td>

                <td className="px-3 py-2.5 text-right tabular-nums">
                  <div className="text-ink-700">{inr(commercialsInr)}</div>
                  <div className="text-[10.5px] text-ink-400">
                    {pct(c.totalPurchasePct + c.totalSalePct, 1)}
                  </div>
                </td>

                <td className="px-3 py-2.5 text-right tabular-nums">
                  <div className="font-medium text-ink-900">{inr(c.finalCostInr)}</div>
                  <div className="text-[10.5px] text-ink-400">{usd(c.finalCostUsd)}</div>
                </td>

                <td className="px-3 py-2.5 text-right tabular-nums">
                  <div className="text-[13px] font-semibold text-ink-900">{usd(c.sellingUsd)}</div>
                  <div className="text-[10.5px] text-ink-400">{inr(c.sellingInr)}</div>
                </td>

                <td className="px-3 py-2.5 text-right">
                  <span className="flex items-baseline justify-end">
                    <input
                      type="number"
                      step="0.5"
                      value={c.marginPct}
                      onChange={(e) => onMargin(row.lineId, Number(e.target.value))}
                      aria-label="Target margin percent"
                      className="w-14 rounded border border-transparent bg-transparent px-1 py-1 text-right text-[12px] font-medium tabular-nums text-ink-900 hover:border-hairline focus:border-brand-600 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                    />
                    <span className="pl-0.5 text-[12px] text-ink-500" aria-hidden>
                      %
                    </span>
                  </span>
                  <div className="pr-2 text-[10.5px] tabular-nums text-ink-400">
                    {inr(c.marginInr)}
                  </div>
                </td>

                {onRemove && (
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onRemove(row.lineId)}
                      aria-label={`Remove ${priced.scenario.name}`}
                      className="rounded p-1 text-ink-300 hover:bg-surface-alt hover:text-[#8f2c22] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
