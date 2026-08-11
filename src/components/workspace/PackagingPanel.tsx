// PackagingPanel — packaging is a direct-cost category with no component of
// its own, so selecting Packaging in the cost strip swaps the component table
// for this list rather than showing an empty table.

import type { MoneyFormatter } from "@/lib/money";
import { finalOf, packagingCost, type PackagingItem } from "@/lib/costingModel";

export function PackagingPanel({
  items,
  money,
}: {
  items: PackagingItem[];
  money: MoneyFormatter;
}) {
  const total = items.reduce((t, p) => t + packagingCost(p), 0);

  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-sm">
      <header className="shrink-0 border-b border-hairline px-5 py-3.5">
        <h2 className="text-[13.5px] font-semibold uppercase tracking-[0.08em] text-ink-900">
          Packaging
        </h2>
        <p className="mt-0.5 text-[12px] text-ink-500">
          Product-level packaging — labels, polybag and allocated carton cost
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead className="sticky top-0 bg-surface-alt">
            <tr className="border-b border-hairline">
              {["Type", "Subtype", "Specification", "Qty", "Rate / Unit", "Cost / pc"].map(
                (h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={`px-4 py-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-500 ${
                      i >= 3 ? "text-right" : ""
                    }`}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b border-hairline">
                <td className="px-4 py-3 text-[12.5px] font-medium text-ink-900">
                  {p.packagingType}
                </td>
                <td className="px-4 py-3 text-[12.5px] text-ink-700">{p.subtype}</td>
                <td className="px-4 py-3 text-[12px] text-ink-500">{p.specification}</td>
                <td className="px-4 py-3 text-right text-[12.5px] tabular-nums text-ink-700">
                  {p.quantity}
                </td>
                <td className="px-4 py-3 text-right text-[12.5px] tabular-nums text-ink-700">
                  {money(finalOf(p.rate))} / {p.rateUnit.replace("per ", "")}
                </td>
                <td className="px-4 py-3 text-right text-[13px] font-semibold tabular-nums text-ink-900">
                  {money(packagingCost(p))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t border-hairline bg-surface-alt px-5 py-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-600">
          Packaging total (per pc)
        </span>
        <span className="text-[18px] font-semibold tabular-nums text-ink-900">{money(total)}</span>
      </footer>
    </section>
  );
}
