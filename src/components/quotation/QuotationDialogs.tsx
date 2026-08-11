// Small focused dialogs for the quotation workspace: the live cost build-up,
// adding an alternate tier under an article, and the send-for-approval gate.

import { useState } from "react";
import { X, Send, AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { costingPull, inchesFromSize } from "@/lib/quotationCosting";
import { costIndexFor, lineMargin, liveCostInr, type QuotationLine } from "@/lib/quotationsStore";

const inr = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ------------------------------------------------------------------ *
 * Cost build-up — proves the Cost column comes from Costing, not typing
 * ------------------------------------------------------------------ */

export function CostInspector({
  line,
  podId,
  articleId,
  onClose,
}: {
  line: QuotationLine | null;
  podId: string;
  articleId?: string;
  onClose: () => void;
}) {
  if (!line) return null;

  const pull = costingPull(line.srfRef, {
    moq: line.moq,
    sizeInches: inchesFromSize(line.size),
    index: costIndexFor(line.srfRef),
  });
  const cost = liveCostInr(line);
  const drift = cost - line.costAtQuoteInr;
  const margin = lineMargin(line, cost);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Detailed Calculation & Configuration"
    >
      <button className="absolute inset-0 bg-ink-900/40 backdrop-blur-xs" aria-label="Close" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[620px] flex-col border-l border-hairline bg-surface shadow-2xl">
        {/* Drawer Header */}
        <header className="flex items-start justify-between gap-3 border-b border-hairline bg-surface px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-900">
                {line.sr}
              </span>
              <h2 className="text-[16px] font-semibold text-ink-900">{line.name}</h2>
            </div>
            <p className="mt-1 text-[12px] text-ink-500">
              Ref: <span className="font-mono font-medium text-ink-700">{line.srfRef}</span> · {line.variantName ?? "Standard Config"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Drawer Content */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Section 1: Detailed Configuration & Variant Options */}
          <section className="rounded-lg border border-hairline bg-surface-alt/40 p-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-500 mb-3">
              1. Product Configuration & Variant Options
            </h3>
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="rounded border border-hairline bg-surface p-2.5">
                <span className="text-[11px] text-ink-400 block">Variant Name</span>
                <span className="font-medium text-ink-900">{line.variantName ?? "Base Article"}</span>
              </div>
              <div className="rounded border border-hairline bg-surface p-2.5">
                <span className="text-[11px] text-ink-400 block">Size / Geometry</span>
                <span className="font-medium text-ink-900">{line.size}</span>
              </div>
              <div className="rounded border border-hairline bg-surface p-2.5">
                <span className="text-[11px] text-ink-400 block">Fabric Quality</span>
                <span className="font-medium text-ink-900">{line.options?.fabricQuality ?? line.composition}</span>
              </div>
              <div className="rounded border border-hairline bg-surface p-2.5">
                <span className="text-[11px] text-ink-400 block">MOQ Tier</span>
                <span className="font-medium text-ink-900">{line.moq.toLocaleString("en-IN")} pcs</span>
              </div>
              <div className="rounded border border-hairline bg-surface p-2.5 col-span-2">
                <span className="text-[11px] text-ink-400 block">Printing & Dyeing</span>
                <span className="font-medium text-ink-900">{line.options?.printType ?? "Reactive Screen Print"}</span>
              </div>
              <div className="rounded border border-hairline bg-surface p-2.5 col-span-2">
                <span className="text-[11px] text-ink-400 block">Trims & Packaging Options</span>
                <span className="font-medium text-ink-900">{line.options?.trims ?? "Standard Packaging & Branding"}</span>
              </div>
            </div>
          </section>

          {/* Section 2: Direct Product Cost Breakdown */}
          <section className="space-y-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-500">
              2. Direct Product Cost Breakdown ( ₹ / pc )
            </h3>
            <div className="rounded-lg border border-hairline bg-surface overflow-hidden">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-surface-alt text-[10.5px] uppercase tracking-wider text-ink-500 border-b border-hairline">
                  <tr>
                    <th className="px-3.5 py-2 font-medium">Cost Component</th>
                    <th className="px-3.5 py-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {pull.directBuckets.map((b) => (
                    <tr key={b.label} className="hover:bg-surface-alt/30">
                      <td className="px-3.5 py-2 text-ink-700">{b.label}</td>
                      <td className="px-3.5 py-2 text-right font-mono text-ink-900">{inr(b.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-ink-50/50 font-semibold text-ink-900">
                    <td className="px-3.5 py-2.5">Subtotal Direct Product Cost</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-emerald-700">{inr(pull.directInr)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 3: Compliance & Commercial Overheads Breakdown */}
          <section className="space-y-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-500">
              3. Compliance & Commercial Overheads (Applied at Quotation)
            </h3>
            <div className="rounded-lg border border-hairline bg-surface overflow-hidden">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-surface-alt text-[10.5px] uppercase tracking-wider text-ink-500 border-b border-hairline">
                  <tr>
                    <th className="px-3.5 py-2 font-medium">Overhead / Compliance Item</th>
                    <th className="px-3.5 py-2 font-medium text-center">Rate</th>
                    <th className="px-3.5 py-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {pull.complianceBuckets.map((b) => (
                    <tr key={b.label} className="hover:bg-surface-alt/30">
                      <td className="px-3.5 py-2 text-ink-700">{b.label}</td>
                      <td className="px-3.5 py-2 text-center text-ink-400 font-mono text-[11px]">{b.rate ?? "—"}</td>
                      <td className="px-3.5 py-2 text-right font-mono text-ink-900">{inr(b.amount)}</td>
                    </tr>
                  ))}
                  {pull.overheadBuckets.map((b) => (
                    <tr key={b.label} className="hover:bg-surface-alt/30">
                      <td className="px-3.5 py-2 text-ink-700">{b.label}</td>
                      <td className="px-3.5 py-2 text-center text-ink-400 font-mono text-[11px]">{b.rate ?? "—"}</td>
                      <td className={cn("px-3.5 py-2 text-right font-mono", b.amount < 0 ? "text-emerald-600" : "text-ink-900")}>
                        {b.amount < 0 ? `- ₹${Math.abs(b.amount).toFixed(2)}` : inr(b.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-amber-50/50 font-semibold text-amber-900">
                    <td colSpan={2} className="px-3.5 py-2.5">Total Overheads & Compliance Costs</td>
                    <td className="px-3.5 py-2.5 text-right font-mono">{inr(pull.complianceInr + pull.overheadInr)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 4: Final Commercial Calculation & Pricing */}
          <section className="rounded-lg border border-hairline bg-surface p-4 space-y-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-500">
              4. Loaded Cost Build-up & Commercial Margin
            </h3>

            <dl className="space-y-2 text-[12.5px]">
              <Line label="Direct Product Cost (₹/pc)" value={inr(pull.directInr)} />
              <Line label="Compliance & Overheads (₹/pc)" value={`+ ${inr(pull.complianceInr + pull.overheadInr)}`} />
              <div className="flex items-center justify-between border-t border-hairline pt-2 text-[13.5px] font-bold text-ink-900">
                <dt>Fully Loaded Cost per piece</dt>
                <dd className="font-mono text-brand-700">{inr(cost)}</dd>
              </div>
              <Line label="Cost at moment of quote" value={inr(line.costAtQuoteInr)} />
              <Line
                label="Movement / Cost drift"
                value={`${drift >= 0 ? "+" : ""}${inr(drift)}`}
                tone={Math.abs(drift) < 0.01 ? "plain" : drift > 0 ? "bad" : "good"}
              />
              <Line label="Exchange Rate" value={`₹${line.fxRate.toFixed(2)} / $`} />
              <Line label="Loaded Cost (USD)" value={`$${(cost / line.fxRate).toFixed(2)}`} />
              <Line
                label="Quoted Margin"
                value={`${margin.toFixed(1)}%`}
                tone={margin < 10 ? "bad" : "good"}
              />
              <div className="flex items-center justify-between border-t border-hairline pt-2.5 text-[14px] font-bold">
                <dt className="text-ink-900">Quoted Selling Price (USD)</dt>
                <dd className="font-mono text-emerald-700 text-[16px]">${line.priceUsd.toFixed(2)}</dd>
              </div>
            </dl>
          </section>

          {articleId && (
            <Link
              to="/config/$podId/$articleId"
              params={{ podId, articleId }}
              search={{ sel: undefined }}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface py-2.5 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
            >
              Open in Configuration & Costing Workspace <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </aside>
    </div>
  );
}

function Line({
  label,
  value,
  tone = "plain",
}: {
  label: string;
  value: string;
  tone?: "plain" | "good" | "bad";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          tone === "bad" ? "text-rose-600" : tone === "good" ? "text-emerald-700" : "text-ink-900",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Add an alternate tier under an article
 * ------------------------------------------------------------------ */

export function AddVariantModal({
  parent,
  onClose,
  onAdd,
}: {
  parent: QuotationLine | null;
  onClose: () => void;
  onAdd: (patch: { name: string; spec: string; size: string; moq: number }) => void;
}) {
  const [name, setName] = useState("Same — Higher MOQ");
  const [spec, setSpec] = useState("Identical construction");
  const [size, setSize] = useState(parent?.size ?? "");
  const [moq, setMoq] = useState(String((parent?.moq ?? 500) * 2));

  if (!parent) return null;
  const moqNum = Number(moq);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add alternate tier"
    >
      <button className="absolute inset-0 bg-ink-900/40" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-[440px] rounded-xl border border-hairline bg-surface shadow-2xl">
        <header className="flex items-start gap-2 border-b border-hairline px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink-900">Add alternate tier</h2>
            <p className="mt-0.5 text-[12px] text-ink-500">
              Grouped under {parent.sr} · {parent.name}
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

        <div className="space-y-3 px-5 py-4">
          <Field label="Label" id="variant-name">
            <input
              id="variant-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Spec note" id="variant-spec">
            <input
              id="variant-spec"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Size" id="variant-size">
              <input
                id="variant-size"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="MOQ" id="variant-moq">
              <input
                id="variant-moq"
                type="number"
                min={1}
                value={moq}
                onChange={(e) => setMoq(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <p className="text-[11.5px] text-ink-500">
            Cost and price are pulled fresh for this size and MOQ — setup amortisation changes with
            quantity.
          </p>
        </div>

        <footer className="flex justify-end gap-2 border-t border-hairline px-5 py-3.5">
          <button
            onClick={onClose}
            className="rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
          >
            Cancel
          </button>
          <button
            disabled={!name.trim() || !(moqNum > 0)}
            onClick={() => onAdd({ name: name.trim(), spec: spec.trim(), size, moq: moqNum })}
            className="rounded-md bg-brand-700 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add tier
          </button>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Send for approval — commercial approval of price only
 * ------------------------------------------------------------------ */

export function SendForApprovalModal({
  open,
  problems,
  lineCount,
  orderValueUsd,
  marginPct,
  onClose,
  onSubmit,
}: {
  open: boolean;
  problems: string[];
  lineCount: number;
  orderValueUsd: number;
  marginPct: number;
  onClose: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  if (!open) return null;
  const blocked = problems.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Send for approval"
    >
      <button className="absolute inset-0 bg-ink-900/40" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-[480px] rounded-xl border border-hairline bg-surface shadow-2xl">
        <header className="border-b border-hairline px-5 py-4">
          <h2 className="text-[16px] font-semibold text-ink-900">Send for approval</h2>
          <p className="mt-0.5 text-[12px] text-ink-500">
            Commercial approval of price only — manufacturing cost was already approved at the
            costing stage.
          </p>
        </header>

        <div className="space-y-4 px-5 py-4">
          <dl className="grid grid-cols-3 gap-3">
            <Stat label="Lines" value={String(lineCount)} />
            <Stat
              label="Order value"
              value={`$${orderValueUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            />
            <Stat label="Blended margin" value={`${marginPct.toFixed(1)}%`} />
          </dl>

          {blocked ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-rose-800">
                <AlertTriangle className="h-3.5 w-3.5" /> Resolve before sending
              </p>
              <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[12px] text-rose-800">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="approval-note" className="text-[12px] font-medium text-ink-700">
                  Note for the approver (optional)
                </label>
                <textarea
                  id="approval-note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Anything the approver should weigh — buyer target, competitive pressure, volume commitment."
                  className={cn(inputCls, "mt-1.5")}
                />
              </div>
              <p className="text-[11.5px] text-ink-500">
                On submit the quotation becomes read-only to you until an approver releases it or
                requests a revision.
              </p>
            </>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-hairline px-5 py-3.5">
          <button
            onClick={onClose}
            className="rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
          >
            Cancel
          </button>
          <button
            disabled={blocked}
            onClick={() => onSubmit(note.trim())}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-3.5 w-3.5" /> Send for approval
          </button>
        </footer>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20";

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-400"
      >
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-alt/50 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-[0.1em] text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink-900">{value}</dd>
    </div>
  );
}
