/**
 * Why did the price move between versions?
 *
 * A re-quote's number differs from its predecessor's, and "the masters moved"
 * is only an answer when you can show WHICH masters and by how much. This
 * compares the input rates the two versions' snapshots recorded — shared
 * masters only, because a master present in one version and not the other is
 * a configuration change, not a rate movement, and belongs to a different
 * conversation.
 */

import { inr } from "@/lib/commercialProvisions";
import { cn } from "@/lib/utils";
import { useSnapshot } from "@/lib/masterSnapshot";

export function VersionInputCompare({
  quotationId,
  requoteOfId,
}: {
  quotationId: string;
  requoteOfId?: string;
}) {
  const current = useSnapshot(quotationId);
  const previous = useSnapshot(requoteOfId);

  // Without both snapshots there is nothing truthful to compare — never show
  // a half-table that implies the other version priced at zero.
  if (!current || !previous) return null;

  const prevById = new Map(previous.refs.map((r) => [r.masterId, r]));
  const rows = current.refs
    .filter((r) => prevById.has(r.masterId))
    .map((r) => {
      const prev = prevById.get(r.masterId)!;
      const deltaPct = prev.rateUsed > 0 ? ((r.rateUsed - prev.rateUsed) / prev.rateUsed) * 100 : 0;
      return { ref: r, prev, deltaPct };
    });

  if (rows.length === 0) return null;

  return (
    <section
      className="rounded-lg border border-hairline bg-surface px-3.5 py-2.5"
      aria-label="Input costs vs previous version"
    >
      <h3 className="text-[12.5px] font-semibold text-ink-900">Input costs vs previous version</h3>
      <table className="mt-1.5 w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-ink-500">
            <th className="py-1.5 pr-3 font-medium">Master</th>
            <th className="py-1.5 pr-3 text-right font-medium">V1</th>
            <th className="py-1.5 pr-3 text-right font-medium">V2</th>
            <th className="py-1.5 text-right font-medium">Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ ref, prev, deltaPct }) => (
            <tr key={ref.masterId} className="border-t border-hairline/70">
              <td className="py-1.5 pr-3">
                <span className="font-medium text-ink-900">{ref.name}</span>{" "}
                <span className="text-[11px] text-ink-500">{ref.code}</span>
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-ink-700">
                {inr(prev.rateUsed)}
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-ink-900">
                {inr(ref.rateUsed)}
              </td>
              <td
                className={cn(
                  "py-1.5 text-right font-semibold tabular-nums",
                  // Only a rise is coloured — a cheaper input is not a warning.
                  deltaPct > 0 ? "text-red-700" : "text-ink-500",
                )}
              >
                {deltaPct > 0 ? "+" : ""}
                {deltaPct.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
