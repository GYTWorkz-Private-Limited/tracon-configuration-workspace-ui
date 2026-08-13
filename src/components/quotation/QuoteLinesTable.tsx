// The quoted lines of one product or one kit.
//
// Every figure here is re-costed from Configuration on read — the Cost column
// is never typed and never stored. Only the commercial decisions (which
// scenario, which build, what quantity, what margin) belong to the quotation.

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, RotateCcw, Trash2 } from "lucide-react";
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
  /**
   * The variant this row quotes, and the options that branch off it.
   *
   * An option is one parameter changed inside a variant, so it is NOT a row of
   * its own — it is picked on the variant's row, which is where the price it
   * moves is already shown.
   */
  variant?: BuildRef;
  options?: BuildRef[];
  /** the quantity on this row was typed, not inherited from the costing */
  moqOverridden?: boolean;
  /** this configuration is out for recosting — shown, frozen, not priceable */
  rejected?: boolean;
};

/**
 * A figure the commercial team may type straight into the table.
 *
 * Editing in place matters here: the row is the comparison, and making the
 * user open a panel to change one number means losing sight of the three
 * numbers they were comparing it against.
 */
function InlineMoney({
  value,
  secondary,
  edited,
  disabled,
  format,
  onSave,
  label,
}: {
  value: number;
  secondary: string;
  edited?: boolean;
  disabled?: boolean;
  format: (n: number) => string;
  onSave: (n: number) => void;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [savedAt, setSavedAt] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  // "Saved" is a receipt, not a state — it fades.
  useEffect(() => {
    if (!savedAt) return;
    const t = window.setTimeout(() => setSavedAt(0), 2500);
    return () => window.clearTimeout(t);
  }, [savedAt]);

  const typed = Number(draft.replace(/[^\d.]/g, ""));
  const commit = () => {
    if (Number.isFinite(typed) && typed > 0) {
      onSave(Math.round(typed * 100) / 100);
      setSavedAt(Date.now());
    }
    setEditing(false);
  };

  if (disabled) {
    return (
      <>
        <div className="text-[13px] font-semibold text-ink-400">{format(value)}</div>
        <div className="text-[10.5px] text-ink-300">{secondary}</div>
      </>
    );
  }

  if (editing) {
    return (
      <input
        ref={ref}
        type="number"
        min={0}
        step="0.01"
        value={draft}
        aria-label={label}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-24 rounded border border-brand-600 bg-surface px-1.5 py-1 text-right text-[12px] font-semibold tabular-nums text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
      />
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
        title={`Edit ${label}`}
        className="group inline-flex items-center gap-1 rounded text-[13px] font-semibold text-ink-900 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        {format(value)}
        <Pencil
          className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      </button>
      <div className="flex items-center justify-end gap-1 text-[10.5px] text-ink-400">
        {secondary}
        {savedAt > 0 && (
          <span className="inline-flex items-center gap-0.5 font-semibold text-brand-700">
            <Check className="h-3 w-3" aria-hidden /> Saved
          </span>
        )}
        {edited && savedAt === 0 && (
          <span className="font-semibold uppercase tracking-[0.06em] text-ink-500">Override</span>
        )}
      </div>
    </>
  );
}

/**
 * The row-level counterpart of the card's "Sent back for recosting" badge: on a
 * scoped rejection the article stays priceable, so the row itself has to say
 * which configuration is the one that left.
 */
function OutPill({ on }: { on?: boolean }) {
  if (!on) return null;
  return (
    <span className="mt-1 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-900">
      Out for recosting
    </span>
  );
}

export function QuoteLinesTable({
  rows,
  quotedLineId,
  onQuote,
  onRemove,
  onMargin,
  onMoq,
  onBuild,
  onResetMoq,
  onSellingPrice,
  frozen = false,
  showQuoteColumn = true,
  identityHeader = "Configuration",
  readOnly = false,
}: {
  rows: QuoteRow[];
  /** the line the summary below is built from */
  quotedLineId?: string;
  onQuote?: (lineId: string) => void;
  onRemove?: (lineId: string) => void;
  onMargin: (lineId: string, marginPct: number) => void;
  onMoq: (lineId: string, moq: number) => void;
  /** pick an option on a row, or clear back to the plain variant */
  onBuild?: (lineId: string, buildId: string) => void;
  /** hand the quantity back to the costing's own MOQ */
  onResetMoq?: (lineId: string) => void;
  /** fix the selling price by hand, $ / pc — margin follows from it */
  onSellingPrice?: (lineId: string, sellingUsd: number) => void;
  /** the whole item has been sent back for recosting: shown, frozen */
  frozen?: boolean;
  showQuoteColumn?: boolean;
  identityHeader?: string;
  /** a sent version is a record, so every control on it is frozen */
  readOnly?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cn("w-full min-w-[900px] border-collapse text-[12px]", frozen && "opacity-60")}
      >
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
              MOQ (pcs)
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Direct cost ₹/pc
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Commercials ₹/pc
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Final cost ₹/pc
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Selling price $/pc
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
            // Only the configuration that was questioned is frozen. The rest of
            // the article is still quotable.
            const rowFrozen = frozen || Boolean(row.rejected);

            return (
              <tr
                key={row.lineId}
                className={cn(
                  "border-b border-hairline/70 align-top transition-colors",
                  isQuoted ? "bg-brand-50/40" : "hover:bg-surface-alt/40",
                  rowFrozen && "opacity-60",
                )}
              >
                {showQuoteColumn && (
                  <td className="px-3 py-2.5">
                    <input
                      type="radio"
                      checked={isQuoted}
                      disabled={readOnly}
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
                            <OutPill on={row.rejected} />
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
                      <div className="min-w-0">
                        <ConfigChips
                          scenario={priced.scenario}
                          build={priced.build}
                          parentBuild={row.parentBuild}
                          size={priced.sizeLabel}
                        />
                        <OptionPicker
                          row={row}
                          onBuild={readOnly || rowFrozen ? undefined : onBuild}
                        />
                        <OutPill on={row.rejected} />
                      </div>
                    )}
                  </div>
                  {row.leading && (
                    <OptionPicker row={row} onBuild={readOnly || rowFrozen ? undefined : onBuild} />
                  )}
                </td>

                <td className="px-3 py-2.5 text-right">
                  <input
                    type="number"
                    min={1}
                    step={100}
                    value={priced.moq}
                    disabled={readOnly || rowFrozen}
                    onChange={(e) => onMoq(row.lineId, Number(e.target.value))}
                    aria-label="Quoted quantity"
                    className={cn(
                      "w-24 rounded border bg-transparent px-1.5 py-1 text-right text-[12px] tabular-nums text-ink-900 hover:border-hairline focus:border-brand-600 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-700/20",
                      row.moqOverridden ? "border-ink-200 bg-surface" : "border-transparent",
                    )}
                  />
                  {/* An override the user cannot undo is a trap, so the way
                      back to the costing's own MOQ is offered next to it. */}
                  {row.moqOverridden && !readOnly && (
                    <span className="mt-0.5 flex items-center justify-end gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                        Override
                      </span>
                      {onResetMoq && (
                        <button
                          type="button"
                          onClick={() => onResetMoq(row.lineId)}
                          aria-label="Use the costed MOQ"
                          title="Use the costed MOQ"
                          className="rounded p-0.5 text-ink-400 hover:bg-surface-alt hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      )}
                    </span>
                  )}
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
                  {onSellingPrice && !readOnly ? (
                    <InlineMoney
                      value={c.sellingUsd}
                      secondary={inr(c.sellingInr)}
                      edited={c.sellingPriceEdited}
                      disabled={rowFrozen}
                      format={(n) => usd(n)}
                      label="Selling price"
                      onSave={(n) => onSellingPrice(row.lineId, n)}
                    />
                  ) : (
                    <>
                      <div className="text-[13px] font-semibold text-ink-900">
                        {usd(c.sellingUsd)}
                      </div>
                      <div className="text-[10.5px] text-ink-400">{inr(c.sellingInr)}</div>
                      {(c.sellingPriceEdited || c.finalCostEdited) && (
                        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                          {c.sellingPriceEdited ? "Price override" : "Cost override"}
                        </div>
                      )}
                    </>
                  )}
                </td>

                <td className="px-3 py-2.5 text-right">
                  <span className="flex items-baseline justify-end">
                    <input
                      type="number"
                      step="0.5"
                      value={c.marginPct}
                      disabled={readOnly || rowFrozen}
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

                {onRemove && !readOnly && (
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

/**
 * The options branching off this row's variant, picked in place.
 *
 * An option changes one parameter inside the variant, so switching it moves
 * THIS row's cost and price — which is why it belongs on the row rather than
 * adding a second row that looks like a separate quotation position. "None"
 * is always offered, so a picked option can always be put back.
 */
function OptionPicker({
  row,
  onBuild,
}: {
  row: QuoteRow;
  onBuild?: (lineId: string, buildId: string) => void;
}) {
  const options = row.options ?? [];
  if (!onBuild || !row.variant || options.length === 0) return null;

  const activeId = row.priced.build.id;

  const chip = (selected: boolean) =>
    cn(
      "rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
      selected
        ? "border-[var(--color-cfg-strong)] bg-[var(--color-cfg-soft)] text-[var(--color-cfg-strong)]"
        : "border-hairline bg-surface text-ink-600 hover:bg-surface-alt hover:text-ink-900",
    );

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-400">
        Options
      </span>
      <button
        type="button"
        onClick={() => onBuild(row.lineId, row.variant!.id)}
        className={chip(activeId === row.variant.id)}
        aria-pressed={activeId === row.variant.id}
      >
        None
      </button>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onBuild(row.lineId, o.id)}
          className={chip(activeId === o.id)}
          aria-pressed={activeId === o.id}
          title={o.description ?? `Apply ${o.name} to this row`}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}
