// ConfigurationRail — the left column: what drives the cost, and what the
// cost becomes commercially.
//
// Permanent rather than toggled: these parameters govern the entire build, so
// hiding them behind a control would mean the numbers in the centre column
// could change for reasons the user cannot see.
//
// Everything below "Commercial Variables" is applied ON TOP of direct cost and
// never feeds back into it — the component table and the cost strip remain a
// pure manufacturing roll-up.

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MoneyFormatter } from "@/lib/money";
import {
  selectedOption,
  type CommercialInputs,
  type CommercialOutput,
  type ParameterId,
  type ParameterOption,
  type VariantParameter,
} from "@/lib/pricingVariants";

type Props = {
  scenarioName: string;
  productContext: string;
  parameters: VariantParameter[];
  commercial: CommercialInputs;
  output: CommercialOutput;
  money: MoneyFormatter;
  onSelect: (id: ParameterId, optionId: string) => void;
  onAddCustom: (id: ParameterId, option: ParameterOption) => void;
  onCommercialChange: (patch: Partial<CommercialInputs>) => void;
  onRecalculate: () => void;
  /** true while a recalculation is settling */
  live?: boolean;
};

export function ConfigurationRail({
  scenarioName,
  productContext,
  parameters,
  commercial,
  output,
  money,
  onSelect,
  onAddCustom,
  onCommercialChange,
  onRecalculate,
  live,
}: Props) {
  return (
    <aside
      aria-label="Configuration and commercials"
      className="flex h-full w-[300px] shrink-0 flex-col border-r border-hairline bg-surface"
    >
      <header className="shrink-0 border-b border-hairline px-4 py-3">
        <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-600">
          Configuration &amp; Commercials
        </h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="px-1">
          <h3 className="text-[13px] font-semibold text-ink-900">Pricing Variants</h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">
            Applies to <span className="font-medium text-ink-700">{scenarioName}</span> ·{" "}
            {productContext}
          </p>
        </div>

        <div className="mt-3 space-y-2">
          {parameters.map((p, i) => (
            <ParameterGroup
              key={p.id}
              parameter={p}
              // The first group opens by default; the rest stay collapsed so the
              // rail shows its current values without becoming a wall of chips.
              defaultOpen={i === 0}
              onSelect={(optionId) => onSelect(p.id, optionId)}
              onAddCustom={(o) => onAddCustom(p.id, o)}
            />
          ))}
        </div>

        <section className="mt-5">
          <h3 className="px-1 text-[13px] font-semibold text-ink-900">Commercial Variables</h3>
          <p className="mt-0.5 px-1 text-[10.5px] leading-relaxed text-ink-400">
            Applied on top of direct cost. Nothing here feeds back into the roll-up.
          </p>
          <div className="mt-2 space-y-0.5">
            <NumberRow
              label="FX rate"
              prefix="₹"
              suffix="/ $"
              value={commercial.fxRate}
              step={0.5}
              min={1}
              onChange={(fxRate) => onCommercialChange({ fxRate })}
            />
            <NumberRow
              label="Target margin"
              suffix="%"
              value={commercial.targetMarginPct}
              step={1}
              min={0}
              max={95}
              onChange={(targetMarginPct) => onCommercialChange({ targetMarginPct })}
            />
            <NumberRow
              label="Buyer target"
              prefix="$"
              value={commercial.buyerTargetUsd}
              step={0.1}
              min={0}
              decimals={2}
              onChange={(buyerTargetUsd) => onCommercialChange({ buyerTargetUsd })}
            />
          </div>
        </section>
      </div>

      {/* ---- live output ---- */}
      <div
        aria-live="polite"
        className={cn(
          "shrink-0 border-t px-4 py-3",
          output.onTarget ? "border-brand-500/40 bg-brand-50" : "border-gold-500/40 bg-gold-50",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-600">
            Live Output
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              output.onTarget ? "bg-brand-100 text-brand-800" : "bg-gold-100 text-gold-700",
            )}
          >
            {output.onTarget ? "On target" : "Above target"}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <Output
            label="Total cost"
            value={money(output.totalCostInr)}
            sub="/ pc direct"
            live={live}
          />
          <Output
            label="Selling price"
            value={`$${output.sellingUsd.toFixed(2)}`}
            sub={`tgt $${output.buyerTargetUsd.toFixed(2)}`}
          />
          <Output label="Margin" value={`${output.marginPct}%`} sub="on plan" />
        </div>

        <p className="mt-1.5 text-[10.5px] text-ink-600">
          {output.onTarget
            ? `$${Math.abs(output.headroomUsd).toFixed(2)} under the buyer target.`
            : `$${Math.abs(output.headroomUsd).toFixed(2)} over target — reduce cost or margin.`}
        </p>
      </div>

      <div className="shrink-0 border-t border-hairline p-3">
        <button
          type="button"
          onClick={onRecalculate}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-800 px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-1"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", live && "animate-spin")} aria-hidden />
          Recalculate Costs
        </button>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ *
 * Parameter group
 * ------------------------------------------------------------------ */

function ParameterGroup({
  parameter,
  defaultOpen,
  onSelect,
  onAddCustom,
}: {
  parameter: VariantParameter;
  defaultOpen?: boolean;
  onSelect: (optionId: string) => void;
  onAddCustom: (option: ParameterOption) => void;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const current = selectedOption(parameter);

  const commit = () => {
    const parsed = parseCustom(parameter.id, draft);
    if (!parsed) return;
    onAddCustom(parsed);
    setDraft("");
    setAdding(false);
  };

  return (
    <section className={cn("rounded-lg border border-hairline", open && "bg-surface-alt/40")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
        )}
        <span className="flex-1 truncate text-[12.5px] font-semibold text-ink-900">
          {parameter.label}
        </span>
        <span className="shrink-0 text-[11.5px] font-medium text-brand-700">{current.label}</span>
      </button>

      {open && (
        <div className="px-2.5 pb-2.5">
          <p className="mb-1.5 text-[10.5px] text-ink-400">{parameter.hint}</p>
          <div
            role="radiogroup"
            aria-label={`${parameter.label} options`}
            className="flex flex-wrap gap-1"
          >
            {parameter.options.map((o) => {
              const active = o.id === parameter.selectedId;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSelect(o.id)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11.5px] transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                    active
                      ? "border-brand-500 bg-brand-50 font-medium text-brand-800"
                      : "border-hairline bg-surface text-ink-700 hover:border-ink-200 hover:bg-surface-alt",
                  )}
                >
                  {active && <Check className="h-2.5 w-2.5 shrink-0" aria-hidden />}
                  {o.label}
                </button>
              );
            })}

            {adding ? (
              <span className="inline-flex items-center gap-1">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") {
                      setAdding(false);
                      setDraft("");
                    }
                  }}
                  placeholder={placeholderFor(parameter.id)}
                  aria-label={`Custom ${parameter.label}`}
                  className="w-[92px] rounded-full border border-brand-700 bg-surface px-2 py-1 text-[11.5px] text-ink-900 outline-none focus:ring-2 focus:ring-brand-700/15"
                />
                <button
                  type="button"
                  onClick={commit}
                  aria-label={`Add custom ${parameter.label}`}
                  className="rounded-full bg-brand-700 p-1 text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                >
                  <Check className="h-2.5 w-2.5" />
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink-200 px-2 py-1 text-[11.5px] text-ink-500 transition-colors hover:border-brand-700 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                <Plus className="h-2.5 w-2.5" aria-hidden /> Custom
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

function NumberRow({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = 1,
  min,
  max,
  decimals = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
}) {
  const id = `commercial-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="flex items-center justify-between gap-2 px-1 py-1">
      <label htmlFor={id} className="text-[12px] text-ink-700">
        {label}
      </label>
      <div className="flex items-center gap-0.5 rounded-full border border-hairline bg-surface px-2 focus-within:border-brand-700 focus-within:ring-2 focus-within:ring-brand-700/15">
        {prefix && <span className="text-[11.5px] text-ink-500">{prefix}</span>}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Number(n.toFixed(decimals || 2)));
          }}
          className="w-[54px] bg-transparent py-1 text-right text-[12px] font-medium tabular-nums text-ink-900 outline-none"
        />
        {suffix && <span className="text-[11.5px] text-ink-500">{suffix}</span>}
      </div>
    </div>
  );
}

function Output({
  label,
  value,
  sub,
  live,
}: {
  label: string;
  value: string;
  sub: string;
  live?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[9.5px] font-medium uppercase tracking-[0.08em] text-ink-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 truncate text-[15px] font-semibold tabular-nums transition-colors",
          live ? "text-brand-600" : "text-ink-900",
        )}
      >
        {value}
      </div>
      <div className="truncate text-[9.5px] text-ink-400">{sub}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Custom value parsing
 * ------------------------------------------------------------------ */

export const placeholderFor = (id: ParameterId) =>
  id === "moq" ? "e.g. 7500" : id === "size" ? "e.g. 15 x 21" : "e.g. 280";

/**
 * Turn what the costing team typed into a real option. Anything unparseable is
 * rejected rather than silently added as a zero.
 */
export function parseCustom(id: ParameterId, raw: string): ParameterOption | null {
  const text = raw.trim();
  if (!text) return null;

  if (id === "size") {
    const m = text.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/i);
    if (!m) return null;
    const w = Number(m[1]);
    const l = Number(m[2]);
    if (!w || !l) return null;
    return { id: `size-${w}x${l}`, label: `${w}" × ${l}"`, value: [w, l], custom: true };
  }

  const n = Number(text.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;

  if (id === "moq") {
    return { id: `moq-${n}`, label: `${n.toLocaleString("en-IN")} pcs`, value: n, custom: true };
  }
  return { id: `gsm-${n}`, label: `${n} GSM`, value: n, custom: true };
}
