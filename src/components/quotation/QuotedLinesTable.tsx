// Quoted Lines — the core of the quotation screen.
//
// One row per article / variant / kit component. Variants sit under their
// parent with sub-numbering (1, 1A, 1B) so alternate MOQs, sizes and quality
// tiers stay visually linked to the article they belong to.
//
// Cost is never typed: it is the live costing pull. Only Price and Margin are
// editable, and editing either recalculates the other against the fixed cost.

import { useState } from "react";
import {
  Download,
  Upload,
  RefreshCw,
  Undo2,
  Plus,
  Pencil,
  X,
  AlertTriangle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  liveCostOf,
  lineMargin,
  quotedCostOf,
  type Quotation,
  type QuotationLine,
} from "@/lib/quotationsStore";

const inr0 = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

type Props = {
  quotation: Quotation;
  editable: boolean;
  onPrice: (lineId: string, price: number) => void;
  onMargin: (lineId: string, margin: number) => void;
  onReject: (lineId: string, reason: string) => void;
  onRestore: (lineId: string) => void;
  onAddItems: () => void;
  onAddVariant: (parentId: string) => void;
  onRevise: () => void;
  onDownload: () => void;
  onUpload: () => void;
  onInspect: (line: QuotationLine) => void;
};

export function QuotedLinesTable(props: Props) {
  const { quotation: q, editable } = props;
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const variantCount = q.lines.filter((l) => !l.parentId).length;

  return (
    <section className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <header className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3">
        <h2 className="text-[15px] font-semibold text-ink-900">
          Quoted Lines — {q.lines.length} line{q.lines.length === 1 ? "" : "s"}
          <span className="ml-1.5 text-[12.5px] font-normal text-ink-400">
            {variantCount} article{variantCount === 1 ? "" : "s"}
          </span>
        </h2>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {editable && (
            <button
              onClick={props.onAddItems}
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
            >
              <Plus className="h-3.5 w-3.5" /> Add items
            </button>
          )}
          <button
            onClick={props.onDownload}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
          >
            <Download className="h-3.5 w-3.5" /> Download Quote PDF
          </button>
          <button
            onClick={props.onUpload}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
          >
            <Upload className="h-3.5 w-3.5" /> Upload Buyer Response
          </button>
          <button
            onClick={props.onRevise}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-amber-600"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Revise Quote
          </button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse">
          <thead className="sticky top-0 z-10 bg-surface-alt/95 backdrop-blur">
            <tr className="border-b border-hairline text-left text-[10.5px] uppercase tracking-[0.1em] text-ink-500">
              <Th className="w-[64px]">SR #</Th>
              <Th className="min-w-[280px]">Product / Description</Th>
              <Th className="w-[110px]">Size</Th>
              <Th className="w-[90px] text-right">MOQ</Th>
              <Th className="w-[130px]">Composition</Th>
              <Th className="w-[120px] text-right">Cost INR</Th>
              <Th className="w-[130px] text-right">Price USD</Th>
              <Th className="w-[110px] text-right">Margin</Th>
              <Th className="w-[120px]">Certifications</Th>
              <Th className="w-[92px]" />
            </tr>
          </thead>
          <tbody>
            {q.lines.map((line) => (
              <Row
                key={line.id}
                line={line}
                allLines={q.lines}
                editable={editable}
                onPrice={props.onPrice}
                onMargin={props.onMargin}
                onAddVariant={props.onAddVariant}
                onRestore={props.onRestore}
                onInspect={props.onInspect}
                onStartReject={(id) => {
                  setRejecting(id);
                  setReason("");
                }}
                rejecting={rejecting === line.id}
                reason={reason}
                setReason={setReason}
                onCancelReject={() => setRejecting(null)}
                onConfirmReject={(id, r) => {
                  props.onReject(id, r);
                  setRejecting(null);
                }}
              />
            ))}

            {q.lines.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-14 text-center">
                  <p className="text-[13px] text-ink-500">
                    No lines yet. Add any mix of articles, sets and kits from this POD.
                  </p>
                  {editable && (
                    <button
                      onClick={props.onAddItems}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-ink-900 px-3 py-2 text-[12.5px] font-medium text-white hover:bg-ink-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add items
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="flex items-center gap-2 border-t border-hairline bg-surface-alt/50 px-4 py-2.5 text-[11.5px] text-ink-500">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Cost is pulled live from Costing (direct cost + commercial overheads) and cannot be typed.
        Editing Price recalculates Margin, and vice versa — every override is logged.
      </footer>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Row({
  line,
  allLines,
  editable,
  onPrice,
  onMargin,
  onAddVariant,
  onRestore,
  onInspect,
  onStartReject,
  rejecting,
  reason,
  setReason,
  onCancelReject,
  onConfirmReject,
}: {
  line: QuotationLine;
  allLines: QuotationLine[];
  editable: boolean;
  onPrice: (id: string, v: number) => void;
  onMargin: (id: string, v: number) => void;
  onAddVariant: (parentId: string) => void;
  onRestore: (id: string) => void;
  onInspect: (line: QuotationLine) => void;
  onStartReject: (id: string) => void;
  rejecting: boolean;
  reason: string;
  setReason: (v: string) => void;
  onCancelReject: () => void;
  onConfirmReject: (id: string, reason: string) => void;
}) {
  const cost = liveCostOf(line, allLines);
  const quoted = quotedCostOf(line, allLines);
  const margin = lineMargin(line, cost);
  const drift = cost - quoted;
  const driftPct = quoted > 0 ? (drift / quoted) * 100 : 0;
  const isChild = Boolean(line.parentId);
  const rejected = line.status === "rejected";
  const canEdit = editable && !rejected;

  return (
    <>
      <tr
        className={cn(
          "border-b border-hairline/70 align-top last:border-b-0 cursor-pointer transition-colors",
          rejected ? "bg-rose-50/40" : "hover:bg-brand-50/20",
        )}
        onClick={(e) => {
          // Prevent opening inspect drawer when interacting with input elements or buttons inside the row
          const target = e.target as HTMLElement;
          if (target.closest("button") || target.closest("input")) return;
          onInspect(line);
        }}
      >
        <Td className="pt-3.5 text-[12.5px] font-semibold tabular-nums text-ink-900">{line.sr}</Td>

        <Td className={cn("pt-3", isChild && "pl-7")}>
          <div className="flex items-start gap-2">
            {isChild && (
              <span
                className="mt-1.5 h-3 w-3 shrink-0 rounded-bl border-b border-l border-ink-200"
                aria-hidden
              />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "text-[13px] font-semibold text-ink-900 hover:text-brand-700",
                    rejected && "line-through decoration-rose-400",
                  )}
                >
                  {line.name}
                </span>
                {line.variantName && (
                  <span className="rounded bg-brand-50 border border-brand-200 px-1.5 py-0.5 text-[11px] font-medium text-brand-800">
                    Variant: {line.variantName}
                  </span>
                )}
                {line.kind === "kit" && <Tag tone="brand">Kit</Tag>}
                {line.kind === "kit_component" && <Tag>Component</Tag>}
                {line.carriedFrom && (
                  <Tag tone="amber">
                    {line.carriedFrom.mode === "full_reconfiguration"
                      ? "Reconfigured"
                      : "Re-priced"}{" "}
                    from v{line.carriedFrom.version}
                  </Tag>
                )}
                {line.overrideOf && <Tag tone="amber">Overridden</Tag>}
              </div>
              <p className="mt-0.5 text-[11.5px] leading-snug text-ink-500">{line.spec}</p>

              {line.options && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {line.options.gsm && (
                    <span className="rounded bg-surface-alt px-1.5 py-0.5 text-[10.5px] font-medium text-ink-700 border border-hairline">
                      {line.options.gsm} GSM
                    </span>
                  )}
                  {line.options.fabricQuality && (
                    <span className="rounded bg-surface-alt px-1.5 py-0.5 text-[10.5px] font-medium text-ink-700 border border-hairline">
                      {line.options.fabricQuality}
                    </span>
                  )}
                  {line.options.printType && (
                    <span className="rounded bg-surface-alt px-1.5 py-0.5 text-[10.5px] font-medium text-ink-700 border border-hairline">
                      {line.options.printType}
                    </span>
                  )}
                  {line.options.embroideryType && line.options.embroideryType !== "None" && (
                    <span className="rounded bg-surface-alt px-1.5 py-0.5 text-[10.5px] font-medium text-ink-700 border border-hairline">
                      Embroidery: {line.options.embroideryType}
                    </span>
                  )}
                  {line.options.trims && (
                    <span className="rounded bg-surface-alt px-1.5 py-0.5 text-[10.5px] font-medium text-ink-700 border border-hairline">
                      {line.options.trims}
                    </span>
                  )}
                </div>
              )}

              {rejected && (
                <p className="mt-1 inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-medium text-rose-800">
                  <AlertTriangle className="h-3 w-3" /> Sent back for recosting —{" "}
                  {line.rejectReason}
                </p>
              )}
            </div>
          </div>
        </Td>

        <Td className="pt-3.5 text-[12.5px] tabular-nums text-ink-700">{line.size}</Td>
        <Td className="pt-3.5 text-right text-[12.5px] tabular-nums text-ink-700">
          {line.moq.toLocaleString("en-IN")}
        </Td>
        <Td className="pt-3.5 text-[12px] text-ink-600">{line.composition}</Td>

        <Td className="pt-3 text-right">
          <button
            onClick={() => onInspect(line)}
            className="group inline-flex flex-col items-end rounded px-1 py-0.5 hover:bg-surface-alt"
            title="Cost build-up — live from Costing"
          >
            <span className="text-[13px] font-medium tabular-nums text-ink-900">{inr0(cost)}</span>
            {Math.abs(driftPct) >= 0.5 && (
              <span
                className={cn(
                  "text-[10.5px] tabular-nums",
                  drift > 0 ? "text-rose-600" : "text-emerald-600",
                )}
              >
                {drift > 0 ? "+" : ""}
                {driftPct.toFixed(1)}% vs quoted
              </span>
            )}
          </button>
        </Td>

        <Td className="pt-3 text-right">
          <NumberCell
            value={line.priceUsd}
            editable={canEdit}
            format={(v) => `$${v.toFixed(2)}`}
            step={0.05}
            min={0}
            label={`Price for ${line.name}`}
            tone="price"
            onCommit={(v) => onPrice(line.id, v)}
          />
        </Td>

        <Td className="pt-3 text-right">
          <NumberCell
            value={margin}
            editable={canEdit}
            format={(v) => `${v.toFixed(1)}%`}
            step={0.5}
            min={-100}
            label={`Margin for ${line.name}`}
            tone={margin < 10 ? "warn" : "plain"}
            onCommit={(v) => onMargin(line.id, v)}
          />
        </Td>

        <Td className="pt-3">
          <div className="flex flex-wrap gap-1">
            {line.certifications.map((c) => (
              <span
                key={c}
                className="rounded bg-sky-50 px-1.5 py-0.5 text-[10.5px] font-medium text-sky-700"
              >
                {c}
              </span>
            ))}
          </div>
        </Td>

        <Td className="pt-3">
          {/* Kit components are governed by their set — they are not
              individually rejected or given alternate tiers. */}
          {editable && line.kind !== "kit_component" && (
            <div className="flex items-center justify-end gap-1">
              {!isChild && !rejected && (
                <IconBtn label="Add alternate MOQ / size" onClick={() => onAddVariant(line.id)}>
                  <Plus className="h-3.5 w-3.5" />
                </IconBtn>
              )}
              {rejected ? (
                <IconBtn label="Restore line to quote" onClick={() => onRestore(line.id)}>
                  <Undo2 className="h-3.5 w-3.5" />
                </IconBtn>
              ) : (
                <IconBtn
                  label="Reject line and send back for recosting"
                  tone="danger"
                  onClick={() => onStartReject(line.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </IconBtn>
              )}
            </div>
          )}
        </Td>
      </tr>

      {rejecting && (
        <tr className="border-b border-hairline/70 bg-rose-50/60">
          <td colSpan={10} className="px-4 py-3">
            <label htmlFor={`reject-${line.id}`} className="text-[12px] font-medium text-rose-900">
              Why is “{line.name}” going back to Costing? (required)
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                id={`reject-${line.id}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Margin below floor at this MOQ — re-cost with 120 GSM wadding."
                className="min-w-[280px] flex-1 rounded-md border border-hairline bg-surface px-2.5 py-2 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
              <button
                disabled={reason.trim().length < 4}
                onClick={() => onConfirmReject(line.id, reason.trim())}
                className="rounded-md bg-rose-600 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send back for recosting
              </button>
              <button
                onClick={onCancelReject}
                className="rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function NumberCell({
  value,
  editable,
  format,
  onCommit,
  step,
  min,
  label,
  tone = "plain",
}: {
  value: number;
  editable: boolean;
  format: (v: number) => string;
  onCommit: (v: number) => void;
  step: number;
  min: number;
  label: string;
  tone?: "plain" | "price" | "warn";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (editing) {
    const commit = () => {
      const n = Number(draft);
      if (Number.isFinite(n) && n >= min) onCommit(n);
      setEditing(false);
    };
    return (
      <input
        autoFocus
        type="number"
        step={step}
        aria-label={label}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-[92px] rounded-md border border-brand-600 bg-surface px-2 py-1 text-right text-[13px] tabular-nums text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
      />
    );
  }

  const text = format(value);
  if (!editable) {
    return (
      <span
        className={cn(
          "text-[13px] font-medium tabular-nums",
          tone === "price"
            ? "text-emerald-700"
            : tone === "warn"
              ? "text-rose-600"
              : "text-ink-900",
        )}
      >
        {text}
      </span>
    );
  }

  return (
    <button
      onClick={() => {
        setDraft(value.toFixed(2));
        setEditing(true);
      }}
      aria-label={`${label} — ${text}, click to edit`}
      className="group inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-surface-alt"
    >
      <span
        className={cn(
          "text-[13px] font-semibold tabular-nums",
          tone === "price"
            ? "text-emerald-700"
            : tone === "warn"
              ? "text-rose-600"
              : "text-ink-900",
        )}
      >
        {text}
      </span>
      <Pencil
        className="h-3 w-3 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
    </button>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-2.5 font-medium", className)}>{children}</th>;
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 pb-3", className)}>{children}</td>;
}

function Tag({
  children,
  tone = "ink",
}: {
  children: React.ReactNode;
  tone?: "ink" | "brand" | "amber";
}) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em]",
        tone === "brand"
          ? "bg-brand-50 text-brand-700"
          : tone === "amber"
            ? "bg-amber-100 text-amber-800"
            : "bg-ink-100 text-ink-600",
      )}
    >
      {children}
    </span>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  tone = "plain",
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "plain" | "danger";
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "rounded-md border border-hairline bg-surface p-1.5 transition-colors",
        tone === "danger"
          ? "text-ink-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          : "text-ink-500 hover:bg-surface-alt hover:text-ink-900",
      )}
    >
      {children}
    </button>
  );
}
