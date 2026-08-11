// Version history + field-level audit log, as a side panel so the preparer
// never leaves the quotation to answer "who changed this, and why?".
//
// Prior versions are kept in full — you can read the whole version, not a diff
// — and the version that actually reached the buyer is marked.

import { useState } from "react";
import { X, GitBranch, ScrollText, Send, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  liveCostInr,
  lineMargin,
  STATUS_LABEL,
  type Quotation,
  type QuotationLine,
  type QuotationVersion,
} from "@/lib/quotationsStore";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function QuotationHistoryPanel({
  quotation,
  open,
  onClose,
}: {
  quotation: Quotation;
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"versions" | "audit">("versions");
  const [openVersion, setOpenVersion] = useState<number | null>(null);

  if (!open) return null;

  const current: QuotationVersion = {
    version: quotation.version,
    label: `v${quotation.version}`,
    createdAt: quotation.updatedAt,
    createdBy: quotation.createdBy,
    status: quotation.status,
    lines: quotation.lines,
    terms: quotation.terms,
    timeline: quotation.timeline,
    response: quotation.response,
    sentToBuyer: Boolean(quotation.timeline.sentAt),
  };
  const versions = [current, ...quotation.versions];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Version history and audit log"
    >
      <button
        className="absolute inset-0 bg-ink-900/30 backdrop-blur-[1px]"
        aria-label="Close history"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-full max-w-[560px] flex-col border-l border-hairline bg-surface shadow-2xl">
        <header className="flex items-center gap-2 border-b border-hairline px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink-900">History & audit</h2>
            <p className="text-[11.5px] text-ink-500">
              {quotation.id} · {versions.length} version{versions.length === 1 ? "" : "s"} ·{" "}
              {quotation.audit.length} logged change{quotation.audit.length === 1 ? "" : "s"}
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

        <div className="flex gap-1 border-b border-hairline px-3 py-2">
          <TabBtn active={tab === "versions"} onClick={() => setTab("versions")}>
            <GitBranch className="h-3.5 w-3.5" /> Versions
          </TabBtn>
          <TabBtn active={tab === "audit"} onClick={() => setTab("audit")}>
            <ScrollText className="h-3.5 w-3.5" /> Audit log
          </TabBtn>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "versions" ? (
            <ol className="space-y-3">
              {versions.map((v, i) => (
                <li
                  key={v.version}
                  className={cn(
                    "rounded-lg border bg-surface",
                    i === 0 ? "border-brand-600" : "border-hairline",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2 px-3.5 py-3">
                    <span className="text-[13px] font-semibold text-ink-900">{v.label}</span>
                    {i === 0 && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10.5px] font-medium text-brand-700">
                        Current
                      </span>
                    )}
                    {v.sentToBuyer && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10.5px] font-medium text-sky-700">
                        <Send className="h-2.5 w-2.5" /> Sent to buyer
                      </span>
                    )}
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10.5px] font-medium text-ink-600">
                      {STATUS_LABEL[v.status]}
                    </span>
                    <button
                      onClick={() => setOpenVersion(openVersion === v.version ? null : v.version)}
                      className="ml-auto text-[12px] font-medium text-brand-700 hover:text-brand-800"
                    >
                      {openVersion === v.version ? "Hide" : "View full version"}
                    </button>
                  </div>
                  <p className="px-3.5 pb-3 text-[11.5px] text-ink-500">
                    {when(v.createdAt)} · {v.createdBy} · {v.lines.length} line
                    {v.lines.length === 1 ? "" : "s"}
                    {v.note ? ` · ${v.note}` : ""}
                  </p>

                  {openVersion === v.version && <VersionDetail version={v} />}
                </li>
              ))}
            </ol>
          ) : (
            <ol className="space-y-2">
              {quotation.audit.map((a) => (
                <li key={a.id} className="rounded-lg border border-hairline bg-surface px-3.5 py-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[12.5px] font-semibold text-ink-900">{a.action}</span>
                    <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-600">
                      v{a.version}
                    </span>
                    {a.lineLabel && (
                      <span className="text-[11.5px] text-ink-500">— {a.lineLabel}</span>
                    )}
                  </div>
                  {(a.from || a.to) && (
                    <p className="mt-1 text-[12px] tabular-nums text-ink-600">
                      {a.field ? `${a.field}: ` : ""}
                      {a.from && <span className="text-ink-400 line-through">{a.from}</span>}
                      {a.from && a.to && <span aria-hidden> → </span>}
                      {a.to && <span className="font-medium text-ink-900">{a.to}</span>}
                    </p>
                  )}
                  {a.reason && (
                    <p className="mt-1 text-[12px] italic leading-snug text-ink-600">
                      “{a.reason}”
                    </p>
                  )}
                  <p className="mt-1.5 text-[11px] text-ink-400">
                    {a.by} · {when(a.at)}
                  </p>
                </li>
              ))}
              {quotation.audit.length === 0 && (
                <li className="py-10 text-center text-[13px] text-ink-500">Nothing logged yet.</li>
              )}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}

function VersionDetail({ version }: { version: QuotationVersion }) {
  return (
    <div className="border-t border-hairline bg-surface-alt/40 px-3.5 py-3">
      <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px]">
        <Row label="Incoterm" value={version.terms.incoterm} />
        <Row label="Payment" value={version.terms.payment} />
        <Row label="Delivery" value={version.terms.delivery} />
        <Row label="Certifications" value={version.terms.certifications.join(", ") || "—"} />
      </dl>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-hairline text-left text-[10px] uppercase tracking-[0.08em] text-ink-500">
            <th className="py-1.5 pr-2 font-medium">SR</th>
            <th className="py-1.5 pr-2 font-medium">Product</th>
            <th className="py-1.5 pr-2 text-right font-medium">MOQ</th>
            <th className="py-1.5 pr-2 text-right font-medium">Price</th>
            <th className="py-1.5 text-right font-medium">Margin</th>
          </tr>
        </thead>
        <tbody>
          {version.lines.map((l: QuotationLine) => (
            <tr key={l.id} className="border-b border-hairline/50 last:border-b-0">
              <td className="py-1.5 pr-2 text-[11.5px] tabular-nums text-ink-600">{l.sr}</td>
              <td className="py-1.5 pr-2 text-[11.5px] text-ink-900">
                {l.name}
                {l.status === "rejected" && (
                  <span className="ml-1 text-[10px] font-medium text-rose-600">rejected</span>
                )}
              </td>
              <td className="py-1.5 pr-2 text-right text-[11.5px] tabular-nums text-ink-600">
                {l.moq.toLocaleString("en-IN")}
              </td>
              <td className="py-1.5 pr-2 text-right text-[11.5px] font-medium tabular-nums text-ink-900">
                ${l.priceUsd.toFixed(2)}
              </td>
              <td className="py-1.5 text-right text-[11.5px] tabular-nums text-ink-600">
                {lineMargin(l, liveCostInr(l)).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {version.response?.outcome && version.response.outcome !== "none" && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded bg-ink-100 px-2 py-1 text-[11.5px] text-ink-700">
          <Check className="h-3 w-3" /> Buyer {version.response.outcome}
          {version.response.counterPriceUsd
            ? ` at $${version.response.counterPriceUsd.toFixed(2)}`
            : ""}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-ink-400">{label}</dt>
      <dd className="text-ink-900">{value}</dd>
    </>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
        active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-surface-alt",
      )}
    >
      {children}
    </button>
  );
}
