/**
 * Step 1 — which commercial structure does this order price against?
 *
 * The provisions a template pins (overheads, freight, finance, testing,
 * special packing) are exactly the ones that get silently under-applied, so
 * this step refuses to be a bare list of names: every option can be expanded
 * to show the actual numbers BEFORE it is committed. Choosing a template is a
 * commitment about money; it should never be made from a label alone.
 */

import { useState } from "react";
import { ChevronDown, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { TEMPLATES, type CostTemplate } from "@/lib/costTemplates";
import { ProvenanceChip } from "./Provenance";

const pct = (n: number) => `${n}%`;
const inr = (n: number) => `₹${n % 1 === 0 ? n : n.toFixed(2)}`;

export function TemplateStep({
  buyer,
  selectedId,
  onSelect,
}: {
  buyer?: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const matches = (t: CostTemplate) => t.kind === "buyer" && !!buyer && t.buyer === buyer;
  // The buyer's own agreed structure leads: it is almost always the right
  // answer, and the general fallback should take deliberate scrolling past it.
  const ordered = [...TEMPLATES].sort((a, b) => Number(matches(b)) - Number(matches(a)));

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5 rounded-lg border border-hairline bg-surface-alt/50 px-3.5 py-3">
        <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
        <p className="text-[12px] text-ink-600">
          The template you pick becomes the{" "}
          <span className="font-semibold text-ink-900">commercial baseline</span> for every costing
          under this order — overheads, freight, finance, testing and special packing are inherited
          from it rather than re-decided on each sheet.
        </p>
      </div>

      <div role="radiogroup" aria-label="Cost templates" className="space-y-2">
        {ordered.map((t) => (
          <TemplateOption
            key={t.id}
            template={t}
            matchesBuyer={matches(t)}
            buyer={buyer}
            selected={selectedId === t.id}
            open={expanded === t.id}
            onToggle={() => setExpanded(expanded === t.id ? null : t.id)}
            onSelect={() => onSelect(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

function TemplateOption({
  template: t,
  matchesBuyer,
  buyer,
  selected,
  open,
  onSelect,
  onToggle,
}: {
  template: CostTemplate;
  matchesBuyer: boolean;
  buyer?: string;
  selected: boolean;
  open: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const isDefault = t.kind === "general";

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        selected
          ? "border-brand-700/50 bg-surface ring-1 ring-brand-700/30"
          : "border-hairline bg-surface",
      )}
    >
      <div className="flex items-start gap-2.5 px-3.5 py-3">
        <input
          type="radio"
          name="precosting-template"
          id={`tpl-${t.id}`}
          checked={selected}
          onChange={onSelect}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand-700)]"
        />
        <div className="min-w-0 flex-1">
          <label
            htmlFor={`tpl-${t.id}`}
            className="flex cursor-pointer flex-wrap items-center gap-1.5"
          >
            <span className="text-[13px] font-semibold text-ink-900">{t.name}</span>
            {/* The house fallback is named as such: a user with no buyer
                agreement must be able to see the safe answer, not infer it. */}
            {isDefault && (
              <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-ink-700">
                Default Template
              </span>
            )}
            {matchesBuyer && (
              <span className="rounded-full bg-brand-700 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-white">
                Matches {buyer}
              </span>
            )}
            <ProvenanceChip kind={isDefault ? "master" : "customer"} />
          </label>
          <p className="mt-0.5 text-[11.5px] text-ink-500">{t.description}</p>
        </div>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`tpl-preview-${t.id}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-hairline bg-surface px-2 py-1 text-[11.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          Preview
          <ChevronDown
            className={cn("h-3 w-3 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>

      {open && (
        <div id={`tpl-preview-${t.id}`} className="border-t border-hairline px-3.5 py-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-5">
            <Provision label="Overheads" value={pct(t.overheadPct)} />
            <Provision label="Freight" value={pct(t.freightPct)} />
            <Provision label="Finance" value={pct(t.financePct)} />
            <Provision label="Testing" value={pct(t.testingPct)} />
            <Provision label="Special pack" value={`${inr(t.specialPackInr)}/pc`} />
          </dl>
          {t.notes && t.notes.length > 0 && (
            <ul className="mt-2.5 space-y-0.5 border-t border-hairline pt-2.5">
              {t.notes.map((n) => (
                <li key={n} className="text-[11px] text-ink-500">
                  • {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Provision({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.06em] text-ink-400">{label}</dt>
      <dd className="text-[12.5px] font-semibold text-ink-900 tabular-nums">{value}</dd>
    </div>
  );
}
