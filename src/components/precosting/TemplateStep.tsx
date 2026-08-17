/**
 * Step 1 — which commercial structure does this order price against?
 *
 * The provisions a template pins (overheads, freight, finance, testing,
 * special packing) are exactly the ones that get silently under-applied, so
 * this step refuses to be a bare list of names: the selected template's actual
 * numbers are always on screen, beside the list, BEFORE it is committed.
 * Choosing a template is a commitment about money; it should never be made
 * from a label alone.
 *
 * The furniture is the workspace's own: the Component Library's search + chip
 * row and its list/preview split, and the Article Library's filter and sort
 * selects — imported from `@/components/ui/pickers` rather than re-drawn, so a
 * user meets one filter row across the product, not four lookalikes.
 */

import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { TEMPLATES, type CostTemplate } from "@/lib/costTemplates";
import { FilterChip, FilterSelect, SearchField, SortSelect } from "@/components/ui/pickers";
import { ProvenanceChip } from "./Provenance";

const pct = (n: number) => `${n}%`;
const inr = (n: number) => `₹${n % 1 === 0 ? n : n.toFixed(2)}`;

type Kind = "all" | "buyer" | "general";
type Sort = "match" | "name" | "overhead" | "testing";

const SORTS: { id: Sort; label: string }[] = [
  { id: "match", label: "Recommended" },
  { id: "name", label: "Name (A–Z)" },
  { id: "overhead", label: "Overhead %" },
  { id: "testing", label: "Testing %" },
];

const ALL = "all";

export function TemplateStep({
  buyer,
  selectedId,
  onSelect,
}: {
  buyer?: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [buyerFilter, setBuyerFilter] = useState<string>(ALL);
  const [sort, setSort] = useState<Sort>("match");

  const matches = (t: CostTemplate) => t.kind === "buyer" && !!buyer && t.buyer === buyer;

  // Filter values come from the template data itself: a hardcoded buyer list
  // drifts the moment a new agreement is added, and a filter that hides real
  // rows is worse than no filter at all.
  const buyers = useMemo(
    () => [...new Set(TEMPLATES.map((t) => t.buyer).filter(Boolean) as string[])].sort(),
    [],
  );

  const counts = useMemo(
    () => ({
      all: TEMPLATES.length,
      buyer: TEMPLATES.filter((t) => t.kind === "buyer").length,
      general: TEMPLATES.filter((t) => t.kind === "general").length,
    }),
    [],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = TEMPLATES.filter(
      (t) =>
        (kind === "all" || t.kind === kind) &&
        (buyerFilter === ALL || t.buyer === buyerFilter) &&
        (!q ||
          [t.name, t.buyer, t.description]
            .filter(Boolean)
            .some((v) => (v as string).toLowerCase().includes(q))),
    );

    const byName = (a: CostTemplate, b: CostTemplate) => a.name.localeCompare(b.name);
    switch (sort) {
      case "name":
        return list.sort(byName);
      case "overhead":
        return list.sort((a, b) => b.overheadPct - a.overheadPct || byName(a, b));
      case "testing":
        return list.sort((a, b) => b.testingPct - a.testingPct || byName(a, b));
      default:
        // The buyer's own agreed structure leads: it is almost always the right
        // answer, and the general fallback should take deliberate scrolling past.
        return list.sort((a, b) => Number(matches(b)) - Number(matches(a)) || byName(a, b));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, kind, buyerFilter, sort, buyer]);

  const filtered = query.trim() !== "" || kind !== "all" || buyerFilter !== ALL;
  const clearFilters = () => {
    setQuery("");
    setKind("all");
    setBuyerFilter(ALL);
  };

  // The preview always has something to say: the selected template if it
  // survived the filters, otherwise the first result. Nothing is committed by
  // looking — only the radio records a choice.
  const preview =
    TEMPLATES.find((t) => t.id === selectedId && shown.includes(t)) ?? shown[0] ?? null;

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

      {/* ---- search + filters + sort: the library modals' own row ---- */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            value={query}
            onChange={setQuery}
            label="Search cost templates"
            placeholder="Search by template, buyer or description…"
          />
          <FilterSelect
            value={buyerFilter}
            onChange={setBuyerFilter}
            label="Buyer"
            options={buyers}
          />
          <SortSelect value={sort} onChange={setSort} options={SORTS} />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip active={kind === "all"} onClick={() => setKind("all")}>
            All ({counts.all})
          </FilterChip>
          <FilterChip active={kind === "buyer"} onClick={() => setKind("buyer")}>
            Buyer-specific ({counts.buyer})
          </FilterChip>
          <FilterChip active={kind === "general"} onClick={() => setKind("general")}>
            General ({counts.general})
          </FilterChip>
          <span className="ml-auto text-[11px] text-ink-500 tabular-nums">
            {shown.length} {shown.length === 1 ? "template" : "templates"}
          </span>
        </div>
      </div>

      {/* ---- list + provisions preview, the Component Library's split ---- */}
      <div className="flex min-h-[236px] flex-col gap-2.5 sm:flex-row">
        <div
          role="radiogroup"
          aria-label="Cost templates"
          className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline sm:w-[330px] sm:shrink-0"
        >
          {shown.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-[12.5px] text-ink-500">Nothing matches those filters.</p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-2 rounded-md border border-hairline bg-surface px-2.5 py-1 text-[11.5px] font-medium text-brand-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                Clear filters
              </button>
            </div>
          ) : (
            shown.map((t) => (
              <TemplateRow
                key={t.id}
                template={t}
                matchesBuyer={matches(t)}
                buyer={buyer}
                selected={selectedId === t.id}
                onSelect={() => onSelect(t.id)}
              />
            ))
          )}
        </div>

        <div className="min-w-0 flex-1 rounded-lg border border-hairline bg-surface-alt/40 p-3.5">
          {preview ? (
            <TemplatePreview template={preview} matchesBuyer={matches(preview)} buyer={buyer} />
          ) : (
            <p className="text-[12.5px] text-ink-500">
              {filtered
                ? "No template to preview — clear the filters to see the full list."
                : "Select a template to read its provisions."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateRow({
  template: t,
  matchesBuyer,
  buyer,
  selected,
  onSelect,
}: {
  template: CostTemplate;
  matchesBuyer: boolean;
  buyer?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const isDefault = t.kind === "general";

  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 px-3 py-2.5 transition-colors",
        selected ? "bg-brand-50" : "bg-surface hover:bg-surface-alt",
      )}
    >
      <input
        type="radio"
        name="precosting-template"
        checked={selected}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand-700)]"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[12.5px] font-semibold text-ink-900">{t.name}</span>
          <span className="shrink-0 text-[11px] tabular-nums text-ink-600">
            OH {pct(t.overheadPct)}
          </span>
        </span>
        <span className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="truncate text-[11px] text-ink-400">{t.description}</span>
          <span className="shrink-0 text-[10.5px] tabular-nums text-ink-400">
            Test {pct(t.testingPct)}
          </span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1">
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
        </span>
      </span>
    </label>
  );
}

/** Everything the template pins, stated before it is committed. */
function TemplatePreview({
  template: t,
  matchesBuyer,
  buyer,
}: {
  template: CostTemplate;
  matchesBuyer: boolean;
  buyer?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <h3 className="text-[13px] font-semibold text-ink-900">{t.name}</h3>
        {t.buyer && <span className="text-[11px] text-ink-500">{t.buyer}</span>}
        {matchesBuyer && (
          <span className="rounded-full bg-brand-700 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-white">
            Matches {buyer}
          </span>
        )}
        <ProvenanceChip kind={t.kind === "general" ? "master" : "customer"} />
      </div>
      <p className="mt-1 text-[11.5px] text-ink-600">{t.description}</p>

      <h4 className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
        Provisions
      </h4>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-md border border-hairline bg-surface p-2.5 sm:grid-cols-3">
        <Provision label="Overheads" value={pct(t.overheadPct)} />
        <Provision label="Freight" value={pct(t.freightPct)} />
        <Provision label="Finance" value={pct(t.financePct)} />
        <Provision label="Testing" value={pct(t.testingPct)} />
        <Provision label="Special pack" value={`${inr(t.specialPackInr)}/pc`} />
      </dl>

      {t.notes && t.notes.length > 0 && (
        <>
          <h4 className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
            Notes
          </h4>
          <ul className="space-y-0.5">
            {t.notes.map((n) => (
              <li key={n} className="text-[11px] text-ink-500">
                • {n}
              </li>
            ))}
          </ul>
        </>
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
