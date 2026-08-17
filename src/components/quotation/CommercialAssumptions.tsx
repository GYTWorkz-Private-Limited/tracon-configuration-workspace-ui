/**
 * The assumptions this quotation is priced under, stated once across the top.
 *
 * The working sheet does the same thing for the same reason: every line below
 * is priced under these figures, so an argument about a margin is usually an
 * argument about one of them. Putting them above the lines — rather than
 * folded into each row's detail — is what lets a reviewer change the exchange
 * rate once and watch the whole document move.
 *
 * Editing writes a real provision rate, so the recalculation runs through the
 * same engine Configuration uses. Nothing here is display-only arithmetic.
 */

import { useState } from "react";
import { ChevronDown, Package, RotateCcw, SlidersHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";
import { inr, pct, type ProvisionDef, type ProvisionRates } from "@/lib/commercialProvisions";
import {
  HEADLINE_ASSUMPTIONS,
  PAYMENT_TERMS,
  PAYMENT_TERMS_RATE,
  PROVISIONS_BY_SIDE,
  SPL_PACK,
  totalProvisionPct,
  type AssumptionDef,
  type PaymentTermsDays,
} from "@/lib/quotationAssumptions";

export function CommercialAssumptions({
  rates,
  fxRate,
  termsDays,
  readOnly,
  onRateChange,
  onTermsChange,
  onReset,
}: {
  /** every rate actually in force, house defaults already merged in */
  rates: ProvisionRates;
  fxRate: number;
  termsDays: PaymentTermsDays;
  readOnly: boolean;
  onRateChange: (id: ProvisionDef["id"], pct: number) => void;
  onTermsChange: (days: PaymentTermsDays) => void;
  onReset: () => void;
}) {
  const [allOpen, setAllOpen] = useState(false);
  const total = totalProvisionPct(rates);

  return (
    <section
      aria-label="Commercial assumptions"
      className="mb-4 overflow-hidden rounded-xl border border-hairline bg-surface"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-hairline bg-surface-alt px-4 py-2.5">
        <SlidersHorizontal className="h-3.5 w-3.5 text-ink-500" aria-hidden />
        <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-700">
          Commercial assumptions
        </h2>
        <span className="text-[11.5px] text-ink-500">applied to every line below</span>
        {!readOnly && (
          <button
            type="button"
            onClick={onReset}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1 text-[11.5px] font-medium text-ink-600 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <RotateCcw className="h-3 w-3" aria-hidden /> House defaults
          </button>
        )}
      </header>

      <div className="grid gap-4 px-4 py-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* The headline band — what a commercial review argues about. */}
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-3 lg:grid-cols-5">
          {HEADLINE_ASSUMPTIONS.map((a) => (
            <AssumptionCell
              key={a.key}
              def={a}
              rates={rates}
              fxRate={fxRate}
              termsDays={termsDays}
              total={total}
              readOnly={readOnly}
              onRateChange={onRateChange}
              onTermsChange={onTermsChange}
            />
          ))}
        </dl>

        <SplPackPanel />
      </div>

      {/* Every remaining provision, one panel down. The headline band is the
          short list on purpose; this is where the rest stays reachable. */}
      <div className="border-t border-hairline">
        <button
          type="button"
          onClick={() => setAllOpen((o) => !o)}
          aria-expanded={allOpen}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-surface-alt/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <ChevronDown
            aria-hidden
            className={cn("h-4 w-4 text-ink-500 transition-transform", !allOpen && "-rotate-90")}
          />
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-700">
            All provisions
          </span>
          <span className="text-[11.5px] text-ink-500">
            purchase {pct(sumOf(PROVISIONS_BY_SIDE.purchase, rates), 2)} · sale{" "}
            {pct(sumOf(PROVISIONS_BY_SIDE.sale, rates), 2)}
          </span>
        </button>

        {allOpen && (
          <div className="grid gap-px bg-hairline md:grid-cols-2">
            <ProvisionGroup
              title="Provision on purchase"
              hint="What it costs us to buy the goods"
              defs={PROVISIONS_BY_SIDE.purchase}
              rates={rates}
              readOnly={readOnly}
              onRateChange={onRateChange}
              termsDays={termsDays}
            />
            <ProvisionGroup
              title="Provision on sale"
              hint="What it costs us to ship and bill them"
              defs={PROVISIONS_BY_SIDE.sale}
              rates={rates}
              readOnly={readOnly}
              onRateChange={onRateChange}
              termsDays={termsDays}
            />
          </div>
        )}
      </div>
    </section>
  );
}

const sumOf = (defs: ProvisionDef[], rates: ProvisionRates) =>
  Math.round(defs.reduce((t, d) => t + (rates[d.id] ?? 0), 0) * 100) / 100;

/* ------------------------------------------------------------------ *
 * One assumption
 * ------------------------------------------------------------------ */

function AssumptionCell({
  def,
  rates,
  fxRate,
  termsDays,
  total,
  readOnly,
  onRateChange,
  onTermsChange,
}: {
  def: AssumptionDef;
  rates: ProvisionRates;
  fxRate: number;
  termsDays: PaymentTermsDays;
  total: number;
  readOnly: boolean;
  onRateChange: (id: ProvisionDef["id"], pct: number) => void;
  onTermsChange: (days: PaymentTermsDays) => void;
}) {
  const isTotal = def.kind === "total";

  return (
    <div className={cn("bg-surface px-3 py-2.5", isTotal && "bg-gold-50")}>
      <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-500">
        {def.label}
      </dt>

      <dd className="mt-1">
        {def.kind === "fx" && (
          // The exchange rate comes off the costing model the article was
          // priced under — changing it here would put the quotation on a
          // different rate to the costing it quotes.
          <span className="text-[15px] font-semibold tabular-nums text-ink-900">
            {inr(fxRate, 2)}
            <span className="ml-1 text-[11px] font-normal text-ink-500">/ USD</span>
          </span>
        )}

        {def.kind === "terms" && (
          <div className="flex items-center gap-1 rounded-full border border-hairline bg-surface p-0.5">
            {PAYMENT_TERMS.map((d) => (
              <button
                key={d}
                type="button"
                disabled={readOnly}
                onClick={() => onTermsChange(d)}
                aria-pressed={termsDays === d}
                title={`${d} days — carried as a ${PAYMENT_TERMS_RATE[d]}% provision`}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11.5px] font-medium transition-colors disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                  termsDays === d
                    ? "bg-brand-700 font-semibold text-white"
                    : "text-ink-600 hover:bg-surface-alt hover:text-ink-900",
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        )}

        {def.kind === "provision" && def.provision && (
          <RateInput
            id={def.provision}
            label={def.label}
            value={rates[def.provision] ?? 0}
            readOnly={readOnly}
            onChange={onRateChange}
          />
        )}

        {isTotal && (
          <span className="text-[15px] font-semibold tabular-nums text-gold-700">
            {pct(total, 2)}
          </span>
        )}
      </dd>

      {def.note && <p className="mt-0.5 text-[10.5px] leading-snug text-ink-400">{def.note}</p>}
    </div>
  );
}

function RateInput({
  id,
  label,
  value,
  readOnly,
  onChange,
}: {
  id: ProvisionDef["id"];
  label: string;
  value: number;
  readOnly: boolean;
  onChange: (id: ProvisionDef["id"], pct: number) => void;
}) {
  if (readOnly) {
    return (
      <span className="text-[15px] font-semibold tabular-nums text-ink-900">{pct(value)}</span>
    );
  }
  return (
    <span className="inline-flex items-baseline">
      <input
        type="number"
        step={0.05}
        value={value}
        aria-label={`${label} rate, percent`}
        onChange={(e) => onChange(id, Number(e.target.value))}
        className="w-[68px] rounded border border-hairline bg-surface px-1.5 py-0.5 text-[14px] font-semibold tabular-nums text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
      />
      <span className="pl-0.5 text-[12px] text-ink-500" aria-hidden>
        %
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * The full provision list
 * ------------------------------------------------------------------ */

function ProvisionGroup({
  title,
  hint,
  defs,
  rates,
  readOnly,
  onRateChange,
  termsDays,
}: {
  title: string;
  hint: string;
  defs: ProvisionDef[];
  rates: ProvisionRates;
  readOnly: boolean;
  onRateChange: (id: ProvisionDef["id"], pct: number) => void;
  termsDays: PaymentTermsDays;
}) {
  return (
    <div className="bg-surface px-4 py-3">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-700">{title}</h3>
      <p className="mt-0.5 text-[11px] text-ink-500">{hint}</p>

      <ul className="mt-2 divide-y divide-hairline">
        {defs.map((d) => {
          // The credit window is offered on the quotation, so the terms toggle
          // owns this rate. Two controls for one number is how they drift.
          const ownedByTerms = d.id === "paymentTerms";
          const value = rates[d.id] ?? 0;
          return (
            <li key={d.id} className="flex items-center gap-3 py-1.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] text-ink-800" title={d.hint}>
                  {d.label}
                </span>
                {ownedByTerms && (
                  <span className="text-[10.5px] text-ink-400">
                    set by the {termsDays}-day payment terms above
                  </span>
                )}
                {d.credit && !ownedByTerms && (
                  <span className="text-[10.5px] text-brand-700">credit — reduces loaded cost</span>
                )}
              </span>
              {readOnly || ownedByTerms ? (
                <span
                  className={cn(
                    "text-[12.5px] font-medium tabular-nums",
                    value < 0 ? "text-brand-700" : "text-ink-900",
                  )}
                >
                  {pct(value)}
                </span>
              ) : (
                <RateInput
                  id={d.id}
                  label={d.label}
                  value={value}
                  readOnly={false}
                  onChange={onRateChange}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Special packing
 * ------------------------------------------------------------------ */

/**
 * The one commercial input quoted in rupees rather than percent — so it sits
 * beside the percentage band instead of inside it, exactly as the sheet
 * carries it as a note in the margin.
 */
function SplPackPanel() {
  return (
    <div className="rounded-lg border border-hairline bg-surface-alt/50 px-3.5 py-3">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-700">
        <Package className="h-3.5 w-3.5 text-ink-500" aria-hidden /> Special packing
        <span className="font-normal normal-case tracking-normal text-ink-400">per unit</span>
      </h3>

      <ul className="mt-2 space-y-1.5">
        {SPL_PACK.map((p) => (
          <li key={p.code} className="flex items-baseline gap-2 text-[11.5px]">
            <span className="w-[68px] shrink-0 font-medium text-ink-800">{p.code}</span>
            <span className="min-w-0 flex-1 text-ink-500">
              {p.parts.map((x) => `${x.name} ${inr(x.inr)}`).join(" · ")}
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-ink-900">
              {inr(p.totalInr)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
