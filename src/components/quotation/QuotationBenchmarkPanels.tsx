// Historical Pricing / Benchmarking — internal only.
//
// Sits at the bottom of the Quotation Workspace, after the commercial
// calculations, so the commercial team can sanity-check a price against what
// this buyer has accepted before and what the same construction goes for
// elsewhere. It is deliberately NOT part of `QuotationPreview` — nothing here
// is something a buyer should ever see.

import { Info, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  OUTCOME_TONE,
  buyerInsight,
  marketInsight,
  previousQuotesToBuyer,
  similarQuotesToOtherBuyers,
  type BuyerOutcome,
} from "@/lib/quotationBenchmarking";

export function QuotationBenchmarkPanels({
  buyer,
  srfRef,
  productName,
  sizeLabel,
  moq,
  currentPriceUsd,
  inputCostDriftPct = 0,
}: {
  buyer: string;
  srfRef: string;
  productName: string;
  sizeLabel: string;
  moq: number;
  currentPriceUsd: number;
  /** % input costs have moved since the last accepted quote, when known */
  inputCostDriftPct?: number;
}) {
  const previous = previousQuotesToBuyer(buyer, srfRef, sizeLabel, moq);
  const similar = similarQuotesToOtherBuyers(srfRef, productName, sizeLabel, buyer);

  return (
    <section aria-label="Internal pricing benchmarks" className="mt-6 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-[13px] font-semibold text-ink-900">
          Historical Pricing & Benchmarking
        </h2>
        <span
          title="Internal only — never shown to the buyer"
          className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-600"
        >
          <Lock className="h-2.5 w-2.5" aria-hidden /> Internal only
        </span>
      </div>

      <BenchmarkTable
        title={`Previous Quotes to ${buyer} — Same Article`}
        caption={`${productName} · ${srfRef}`}
      >
        <table className="w-full min-w-[640px] text-[12px]">
          <thead>
            <tr className="border-b border-hairline bg-surface-alt/60 text-[10px] uppercase tracking-[0.1em] text-ink-500">
              <th scope="col" className="px-4 py-2 text-left font-medium">
                Quote #
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Date
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Size
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                MOQ
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Price
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Outcome
              </th>
            </tr>
          </thead>
          <tbody>
            {previous.map((r, i) => (
              <tr key={`${r.quoteNo}-${i}`} className="border-b border-hairline/70">
                <th scope="row" className="px-4 py-2 text-left font-medium text-ink-900">
                  {r.quoteNo}
                </th>
                <td className="px-3 py-2 text-left text-ink-600">{r.date}</td>
                <td className="px-3 py-2 text-left text-ink-600">{r.size}</td>
                <td className="px-3 py-2 text-right tabular-nums text-ink-600">{r.moq}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-ink-900">
                  ${r.priceUsd.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right">
                  <OutcomePill outcome={r.outcome} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Insight text={buyerInsight(previous, currentPriceUsd, buyer, inputCostDriftPct)} />
      </BenchmarkTable>

      <BenchmarkTable
        title="Similar Quotes to Other Buyers"
        caption={`${productName} · same construction`}
      >
        <table className="w-full min-w-[640px] text-[12px]">
          <thead>
            <tr className="border-b border-hairline bg-surface-alt/60 text-[10px] uppercase tracking-[0.1em] text-ink-500">
              <th scope="col" className="px-4 py-2 text-left font-medium">
                Buyer
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Quote #
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Product
              </th>
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Size
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Price
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {similar.map((r, i) => (
              <tr key={`${r.buyer}-${r.quoteNo}-${i}`} className="border-b border-hairline/70">
                <th scope="row" className="px-4 py-2 text-left font-medium text-ink-900">
                  {r.buyer}
                </th>
                <td className="px-3 py-2 text-left text-ink-600">{r.quoteNo}</td>
                <td className="px-3 py-2 text-left text-ink-600">{r.product}</td>
                <td className="px-3 py-2 text-left text-ink-600">{r.size}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-ink-900">
                  ${r.priceUsd.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right">
                  <OutcomePill outcome={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Insight text={marketInsight(similar, currentPriceUsd)} />
      </BenchmarkTable>
    </section>
  );
}

function BenchmarkTable({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <div className="border-b border-hairline px-4 py-2.5">
        <h3 className="text-[12.5px] font-semibold text-ink-900">{title}</h3>
        <p className="text-[11px] text-ink-500">{caption}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function Insight({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 border-t border-hairline bg-surface-alt/40 px-4 py-2.5 text-[12px] text-ink-700">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
      {text}
    </p>
  );
}

function OutcomePill({ outcome }: { outcome: BuyerOutcome }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium",
        OUTCOME_TONE[outcome],
      )}
    >
      {outcome === "Order" ? "→ Order" : outcome}
    </span>
  );
}
