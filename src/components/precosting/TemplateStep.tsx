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
 * Two things are load-bearing in the layout:
 *
 *  1. Buyer-specific and General are separate SECTIONS, not two pills in one
 *     stream. A house default read as "the agreed structure" is the expensive
 *     mistake this screen exists to prevent, so the boundary is structural.
 *  2. The screen sizes itself to its container, not to the viewport. The same
 *     component renders full-width in the POD stepper and inside an 860px
 *     modal, so the split is a container query: one comfortable column plus a
 *     detail pane when there is room, a single stack when there is not.
 *
 * The furniture is the workspace's own: the Component Library's search + chip
 * row and its list/preview split, and the Article Library's filter and sort
 * selects — imported from `@/components/ui/pickers` rather than re-drawn, so a
 * user meets one filter row across the product, not four lookalikes.
 */

import { useMemo, useState } from "react";
import { Check, ClipboardList, Sparkles } from "lucide-react";
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

  // Sections, not badges. Within the buyer section the recommendation stays on
  // top whatever the sort, because "the structure we agreed with this buyer" is
  // an identity, not a ranking the user asked to reorder.
  const sections = useMemo(() => {
    const buyerTemplates = shown
      .filter((t) => t.kind === "buyer")
      .sort((a, b) => Number(matches(b)) - Number(matches(a)));
    const generalTemplates = shown.filter((t) => t.kind === "general");
    return [
      {
        id: "buyer",
        label: "Buyer templates",
        hint: "Agreed structures on file",
        items: buyerTemplates,
      },
      {
        id: "general",
        label: "General templates",
        hint: "House defaults",
        items: generalTemplates,
      },
    ].filter((s) => s.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, buyer]);

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
    <div className="@container space-y-3">
      <div className="flex items-start gap-2.5 rounded-lg border border-hairline bg-surface-alt/50 px-3.5 py-3">
        <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
        <p className="text-[12px] text-ink-600">
          The template you pick becomes the{" "}
          <span className="font-semibold text-ink-900">commercial baseline</span> for every costing
          under this order — overheads, freight, finance, testing and special packing are inherited
          from it rather than re-decided on each sheet.
        </p>
      </div>

      {/* ---- one deliberate toolbar: search/scope on top, narrowing beneath ---- */}
      <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
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

        <div className="flex flex-wrap items-center gap-1.5 border-t border-hairline bg-surface-alt/50 px-3 py-2">
          <FilterChip active={kind === "all"} onClick={() => setKind("all")}>
            All ({counts.all})
          </FilterChip>
          <FilterChip active={kind === "buyer"} onClick={() => setKind("buyer")}>
            Buyer-specific ({counts.buyer})
          </FilterChip>
          <FilterChip active={kind === "general"} onClick={() => setKind("general")}>
            General ({counts.general})
          </FilterChip>
          <span className="ml-auto text-[11px] tabular-nums text-ink-500">
            {shown.length} {shown.length === 1 ? "template" : "templates"}
          </span>
        </div>
      </div>

      {/* ---- list + provisions preview, the Component Library's split.
              The column is fixed at a readable width only once the container
              can afford both panes; below that everything stacks. ---- */}
      <div className="grid min-h-[236px] gap-3 @[820px]:grid-cols-[minmax(360px,400px)_minmax(0,1fr)] @[1200px]:grid-cols-[420px_minmax(0,1fr)]">
        <div
          role="radiogroup"
          aria-label="Cost templates"
          className="overflow-hidden rounded-lg border border-hairline bg-surface"
        >
          {sections.length === 0 ? (
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
            sections.map((section) => (
              <div key={section.id}>
                <div className="flex items-baseline justify-between gap-2 border-b border-hairline bg-surface-alt px-3.5 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
                    {section.label}
                  </span>
                  <span className="text-[10px] text-ink-400">{section.hint}</span>
                </div>
                {section.items.map((t) => (
                  <TemplateRow
                    key={t.id}
                    template={t}
                    recommended={matches(t)}
                    selected={selectedId === t.id}
                    onSelect={() => onSelect(t.id)}
                  />
                ))}
              </div>
            ))
          )}
        </div>

        <div className="min-w-0 rounded-lg border border-hairline bg-surface-alt/40 p-4">
          {preview ? (
            <TemplatePreview template={preview} recommended={matches(preview)} buyer={buyer} />
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

/**
 * A row has to answer "is this mine, and what does it cost me?" at a glance,
 * so the four figures sit inline and aligned rather than hiding in the detail
 * pane — comparing two templates should not require two clicks.
 */
function TemplateRow({
  template: t,
  recommended,
  selected,
  onSelect,
}: {
  template: CostTemplate;
  recommended: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2.5 border-b border-hairline px-3.5 py-2.5 transition-colors",
        // Selection is carried by tint AND a left rule AND the check — one
        // signal alone gets lost against the recommended badge.
        selected
          ? "border-l-2 border-l-brand-700 bg-brand-50 pl-3"
          : "border-l-2 border-l-transparent bg-surface pl-3 hover:bg-surface-alt",
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
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold text-ink-900">{t.name}</span>
          {selected && <Check className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden />}
          {recommended && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-700 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-white">
              <Sparkles className="h-2.5 w-2.5" aria-hidden />
              Recommended
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-[11.5px] text-ink-500">
          {t.buyer ? `${t.buyer} · ` : ""}
          {t.description}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-400">
          <Figure label="OH" value={pct(t.overheadPct)} />
          <Figure label="Frt" value={pct(t.freightPct)} />
          <Figure label="Test" value={pct(t.testingPct)} />
          <Figure label="Pack" value={inr(t.specialPackInr)} />
          <ProvenanceChip kind={t.kind === "general" ? "master" : "customer"} short />
        </span>
      </span>
    </label>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[10px] uppercase tracking-[0.06em] text-ink-400">{label}</span>
      <span className="font-medium tabular-nums text-ink-700">{value}</span>
    </span>
  );
}

/** Everything the template pins, stated before it is committed. */
function TemplatePreview({
  template: t,
  recommended,
  buyer,
}: {
  template: CostTemplate;
  recommended: boolean;
  buyer?: string;
}) {
  const isDefault = t.kind === "general";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold text-ink-900">{t.name}</h3>
          <p className="mt-0.5 text-[11px] text-ink-400">
            {isDefault ? "General template · house default" : `Buyer template · ${t.buyer}`}
          </p>
        </div>
        <ProvenanceChip kind={isDefault ? "master" : "customer"} />
      </div>

      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-700">{t.description}</p>

      {/* The recommendation earns a sentence, not just a badge: a user should
          know WHY this one is on top before accepting it. */}
      {recommended && (
        <p className="mt-2 flex items-start gap-1.5 rounded-md bg-brand-50 px-2.5 py-1.5 text-[11.5px] text-brand-800">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>
            Recommended — agreed structure on file for{" "}
            <span className="font-semibold">{buyer}</span>.
          </span>
        </p>
      )}
      {isDefault && (
        <p className="mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-900">
          House default. It carries no buyer agreement — use it only when this buyer has no agreed
          structure.
        </p>
      )}

      <h4 className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
        Provisions inherited by every costing
      </h4>
      <dl className="divide-y divide-hairline overflow-hidden rounded-md border border-hairline bg-surface">
        <Provision label="Overheads" value={pct(t.overheadPct)} note="on ex-factory cost" />
        <Provision label="Freight" value={pct(t.freightPct)} note="outbound, per shipment terms" />
        <Provision label="Finance" value={pct(t.financePct)} note="credit period carry" />
        <Provision label="Testing" value={pct(t.testingPct)} note="lab and inspection protocol" />
        <Provision
          label="Special packing"
          value={`${inr(t.specialPackInr)}/pc`}
          note={t.specialPackInr === 0 ? "standard packing only" : "buyer-mandated packing"}
        />
      </dl>

      {t.notes && t.notes.length > 0 && (
        <>
          <h4 className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
            Notes on this structure
          </h4>
          <ul className="space-y-1">
            {t.notes.map((n) => (
              <li key={n} className="flex items-start gap-1.5 text-[11.5px] text-ink-600">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-400" aria-hidden />
                {n}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Provision({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt className="min-w-0 text-[12px] font-medium text-ink-800">
        {label}
        <span className="block truncate text-[10.5px] font-normal text-ink-400">{note}</span>
      </dt>
      <dd className="shrink-0 text-[13px] font-semibold tabular-nums text-ink-900">{value}</dd>
    </div>
  );
}
