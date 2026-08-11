// Historical context — two read-only lenses on the pricing decision.
// They inform the number; they never change it.

import { useMemo, useState } from "react";
import { History, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buyerInsight, marketInsight, previousQuotes, similarQuotes } from "@/lib/quotationHistory";
import type { Quotation, QuotationLine } from "@/lib/quotationsStore";

export function QuotationContextPanels({
  quotation,
  lines,
}: {
  quotation: Quotation;
  lines: QuotationLine[];
}) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const focus = lines.find((l) => l.id === focusId) ?? lines[0];

  const history = useMemo(
    () => (focus ? previousQuotes(quotation.buyer, focus) : []),
    [quotation.buyer, focus],
  );
  const market = useMemo(() => (focus ? similarQuotes(focus) : []), [focus]);
  const bInsight = useMemo(
    () => (focus ? buyerInsight(quotation.buyer, focus, history) : null),
    [quotation.buyer, focus, history],
  );
  const mInsight = useMemo(() => (focus ? marketInsight(focus, market) : null), [focus, market]);

  if (!focus) return null;

  return (
    <div className="space-y-3">
      {lines.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.12em] text-ink-400">Context for</span>
          {lines.map((l) => (
            <button
              key={l.id}
              onClick={() => setFocusId(l.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors",
                l.id === focus.id
                  ? "bg-ink-900 text-white"
                  : "border border-hairline bg-surface text-ink-600 hover:bg-surface-alt",
              )}
            >
              {l.sr} · {l.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Previous quotes to this buyer */}
        <Panel
          icon={<History className="h-4 w-4 text-ink-400" aria-hidden />}
          title={`Previous Quotes to ${quotation.buyer} — Same Article`}
        >
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-hairline text-left text-[10.5px] uppercase tracking-[0.1em] text-ink-500">
                <th className="px-3 py-2 font-medium">Quote #</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 text-right font-medium">MOQ</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.quoteNo} className="border-b border-hairline/60 last:border-b-0">
                  <td className="px-3 py-2 text-[12.5px] text-ink-900">{h.quoteNo}</td>
                  <td className="px-3 py-2 text-[12.5px] text-ink-600">{h.date}</td>
                  <td className="px-3 py-2 text-[12.5px] tabular-nums text-ink-600">{h.size}</td>
                  <td className="px-3 py-2 text-right text-[12.5px] tabular-nums text-ink-600">
                    {h.moq.toLocaleString("en-IN")}
                  </td>
                  <td className="px-3 py-2 text-right text-[12.5px] font-medium tabular-nums text-ink-900">
                    ${h.priceUsd.toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    <Outcome kind={h.outcome} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bInsight && (
            <Insight tone={bInsight.justified ? "good" : "warn"}>{bInsight.text}</Insight>
          )}
        </Panel>

        {/* Same construction, other buyers */}
        <Panel
          icon={<Globe2 className="h-4 w-4 text-ink-400" aria-hidden />}
          title="Similar Quotes to Other Buyers"
        >
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-hairline text-left text-[10.5px] uppercase tracking-[0.1em] text-ink-500">
                <th className="px-3 py-2 font-medium">Buyer</th>
                <th className="px-3 py-2 font-medium">Quote #</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 text-right font-medium">Price</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {market.map((m) => (
                <tr
                  key={m.quoteNo + m.buyer}
                  className="border-b border-hairline/60 last:border-b-0"
                >
                  <td className="px-3 py-2 text-[12.5px] font-medium text-ink-900">{m.buyer}</td>
                  <td className="px-3 py-2 text-[12.5px] text-ink-600">{m.quoteNo}</td>
                  <td className="px-3 py-2 text-[12.5px] text-ink-600">{m.product}</td>
                  <td className="px-3 py-2 text-[12.5px] tabular-nums text-ink-600">{m.size}</td>
                  <td className="px-3 py-2 text-right text-[12.5px] font-medium tabular-nums text-ink-900">
                    ${m.priceUsd.toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    <Outcome
                      kind={
                        m.status === "order"
                          ? "order"
                          : m.status === "lost"
                            ? "rejected"
                            : "no_response"
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {mInsight && (
            <Insight tone={mInsight.position === "above" ? "warn" : "good"}>
              {mInsight.text}
            </Insight>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface">
      <header className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        {icon}
        <h3 className="text-[14px] font-semibold text-ink-900">{title}</h3>
        <span className="ml-auto rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-500">
          Read only
        </span>
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function Outcome({ kind }: { kind: "order" | "rejected" | "no_response" }) {
  const map = {
    order: { label: "→ Order", cls: "bg-emerald-50 text-emerald-700" },
    rejected: { label: "Lost", cls: "bg-rose-50 text-rose-700" },
    no_response: { label: "Quoted", cls: "bg-ink-100 text-ink-600" },
  } as const;
  const it = map[kind];
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", it.cls)}>
      {it.label}
    </span>
  );
}

function Insight({ tone, children }: { tone: "good" | "warn"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "border-t border-hairline px-4 py-3 text-[12px] leading-relaxed",
        tone === "good" ? "text-ink-600" : "text-amber-800",
      )}
    >
      {children}
    </p>
  );
}
