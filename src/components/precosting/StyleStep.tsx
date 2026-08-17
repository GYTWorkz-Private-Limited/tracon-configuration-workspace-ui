/**
 * Step 2 — what is being made?
 *
 * EXACTLY two paths, given equal standing:
 *
 *   1. Use existing style — the master, chosen through the costing sheet's own
 *      searchable dropdown so this screen behaves like every other picker in
 *      the product.
 *   2. Customize — start from an existing style or from scratch, then edit the
 *      attributes and parts. Starting from a master is inherited-then-modified,
 *      which is a different (and more trustworthy) provenance than typing a
 *      style out of nothing, so the chips say so.
 *
 * The selection preview is deliberately about INHERITANCE: it shows exactly
 * the attributes the costing sheet is about to receive, because a style is
 * chosen for what it carries, not for its name.
 */

import { useMemo, useState } from "react";
import { Layers, PencilRuler, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { cutSizeLabel, type StyleDef } from "@/lib/styleMaster";
import { FilterChip, FilterSelect, OptionPicker, type PickerOption } from "@/components/ui/pickers";
import { ProvenanceChip } from "./Provenance";
import {
  PART_TYPES,
  derivedCut,
  emptyPart,
  type DraftErrors,
  type PartDraft,
  type StyleDraft,
} from "./styleDraft";

/** Only two paths exist. There is no third tab. */
export type StylePath = "select" | "customize";

const ALL = "all";
const SCRATCH = "__scratch__";

/**
 * The seeded master is only four styles deep today, but this dropdown is the
 * way into the WHOLE style master (custom saves included), so its search is
 * part of the control rather than a reward for the list growing. The threshold
 * is named here instead of relying on the generic default.
 */
const STYLE_SEARCH_THRESHOLD = 3;

const styleOption = (s: StyleDef): PickerOption => ({
  id: s.id,
  label: s.name,
  detail: [s.code, s.product, s.category].filter(Boolean).join(" · "),
  trailing: `${s.parts.length} parts`,
});

export function StyleStep({
  styles,
  path,
  onPathChange,
  selectedId,
  onSelect,
  baseStyleId,
  onStartFrom,
  draft,
  onDraftChange,
  errors,
  showErrors,
}: {
  styles: StyleDef[];
  path: StylePath;
  onPathChange: (p: StylePath) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** the master the customisation started from — null means from scratch */
  baseStyleId: string | null;
  onStartFrom: (id: string | null) => void;
  draft: StyleDraft;
  onDraftChange: (d: StyleDraft) => void;
  errors: DraftErrors;
  showErrors: boolean;
}) {
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="How to set the style" className="flex gap-2">
        <PathTab
          active={path === "select"}
          onClick={() => onPathChange("select")}
          icon={<Layers className="h-3.5 w-3.5" aria-hidden />}
          label="Use existing style"
          hint="Parts, cut sizes and consumption arrive pre-filled"
        />
        <PathTab
          active={path === "customize"}
          onClick={() => onPathChange("customize")}
          icon={<PencilRuler className="h-3.5 w-3.5" aria-hidden />}
          label="Customize"
          hint="Start from a style or from scratch, then edit it"
        />
      </div>

      {path === "select" ? (
        <StylePicker styles={styles} selectedId={selectedId} onSelect={onSelect} />
      ) : (
        <StyleCustomizer
          styles={styles}
          baseStyleId={baseStyleId}
          onStartFrom={onStartFrom}
          draft={draft}
          onChange={onDraftChange}
          errors={errors}
          showErrors={showErrors}
        />
      )}
    </div>
  );
}

function PathTab({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
        active
          ? "border-brand-700/50 bg-brand-50/40 ring-1 ring-brand-700/25"
          : "border-hairline bg-surface hover:bg-surface-alt",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1.5 text-[12.5px] font-semibold",
          active ? "text-brand-700" : "text-ink-900",
        )}
      >
        {icon} {label}
      </span>
      <span className="mt-0.5 block text-[11px] text-ink-500">{hint}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Shared filter state — the same Product/Category narrowing serves the
 * "use existing" dropdown and the "start from" dropdown.
 * ------------------------------------------------------------------ */

function useStyleFilters(styles: StyleDef[]) {
  const [product, setProduct] = useState(ALL);
  const [category, setCategory] = useState(ALL);

  // Filter values come from the styles themselves: a hardcoded list drifts the
  // moment somebody saves a style in a product the list never heard of, and a
  // filter that hides real rows is worse than no filter.
  const products = useMemo(
    () => [...new Set(styles.map((s) => s.product).filter(Boolean) as string[])].sort(),
    [styles],
  );
  const categories = useMemo(
    () => [...new Set(styles.map((s) => s.category).filter(Boolean))].sort(),
    [styles],
  );

  const shown = useMemo(
    () =>
      styles.filter(
        (s) =>
          (product === ALL || s.product === product) &&
          (category === ALL || s.category === category),
      ),
    [styles, product, category],
  );

  const active = product !== ALL || category !== ALL;
  const clear = () => {
    setProduct(ALL);
    setCategory(ALL);
  };

  return { product, setProduct, category, setCategory, products, categories, shown, active, clear };
}

function StyleFilterRow({
  filters,
  count,
}: {
  filters: ReturnType<typeof useStyleFilters>;
  count: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
        Product
      </span>
      <FilterChip active={filters.product === ALL} onClick={() => filters.setProduct(ALL)}>
        All
      </FilterChip>
      {filters.products.map((p) => (
        <FilterChip key={p} active={filters.product === p} onClick={() => filters.setProduct(p)}>
          {p}
        </FilterChip>
      ))}
      <FilterSelect
        value={filters.category}
        onChange={filters.setCategory}
        label="Category"
        options={filters.categories}
      />
      <span className="ml-auto text-[11px] text-ink-500 tabular-nums">
        {count} {count === 1 ? "style" : "styles"}
      </span>
    </div>
  );
}

function NoStyles({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-alt/40 px-4 py-8 text-center">
      <p className="text-[12.5px] text-ink-500">Nothing matches those filters.</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-2 rounded-md border border-hairline bg-surface px-2.5 py-1 text-[11.5px] font-medium text-brand-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        Clear filters
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Path A — use an existing style
 * ------------------------------------------------------------------ */

function StylePicker({
  styles,
  selectedId,
  onSelect,
}: {
  styles: StyleDef[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const filters = useStyleFilters(styles);
  const selected = styles.find((s) => s.id === selectedId) ?? null;

  // A style already chosen stays reachable even when the filters would hide
  // it — a picker that silently forgets its own answer is a bug, not a filter.
  const options = useMemo(() => {
    const list = [...filters.shown];
    if (selected && !list.some((s) => s.id === selected.id)) list.unshift(selected);
    return list.map(styleOption);
  }, [filters.shown, selected]);

  return (
    <div className="space-y-2.5">
      <StyleFilterRow filters={filters} count={filters.shown.length} />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-surface-alt/40 px-3 py-2.5">
        <span className="text-[12px] text-ink-600">Style</span>
        <OptionPicker
          label="Style master"
          options={options}
          selectedId={selectedId ?? undefined}
          onPick={onSelect}
          placeholder="Select a style…"
          searchThreshold={STYLE_SEARCH_THRESHOLD}
          searchPlaceholder="Search by name, code or product…"
          width="w-[380px]"
        />
        {selected && <ProvenanceChip kind="master" />}
      </div>

      {filters.shown.length === 0 && !selected ? (
        <NoStyles onClear={filters.clear} />
      ) : selected ? (
        <InheritancePreview style={selected} />
      ) : (
        <p className="rounded-lg border border-hairline bg-surface-alt/40 px-3 py-6 text-center text-[12px] text-ink-500">
          Pick a style to see exactly what it brings into the costing sheet.
        </p>
      )}
    </div>
  );
}

/** Exactly what the costing sheet will receive if this style is confirmed. */
export function InheritancePreview({
  style,
  provenance = "master",
  modified = false,
}: {
  style: StyleDef;
  provenance?: "master" | "manual";
  modified?: boolean;
}) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-alt/40 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12.5px] font-semibold text-ink-900">{style.name}</span>
        <span className="text-[11px] text-ink-500 tabular-nums">{style.code}</span>
        <ProvenanceChip kind={provenance} />
        {modified && (
          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-amber-900 ring-1 ring-amber-200">
            Modified
          </span>
        )}
        <span className="ml-auto text-[11px] text-ink-500">Inherited into costing</span>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        <Field label="Product" value={style.product ?? "—"} />
        <Field label="Category" value={style.category} />
        <Field label="Construction" value={style.construction ?? "—"} />
        <Field label="Edge finish" value={style.edgeFinish ?? "—"} />
      </dl>

      <div className="mt-2.5 overflow-x-auto rounded-md border border-hairline bg-surface">
        <table className="w-full min-w-[520px] text-left text-[11.5px]">
          <thead className="bg-surface-alt/60 text-[10px] uppercase tracking-[0.06em] text-ink-400">
            <tr>
              <th className="px-2.5 py-1.5 font-medium">Part</th>
              <th className="px-2.5 py-1.5 font-medium">Finished</th>
              <th className="px-2.5 py-1.5 font-medium">Cut size</th>
              <th className="px-2.5 py-1.5 font-medium">Cons. m/pc</th>
              <th className="px-2.5 py-1.5 font-medium">Edge / workmanship</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {style.parts.map((p) => (
              <tr key={p.name}>
                <td className="px-2.5 py-1.5 text-ink-900">
                  {p.name}
                  <span className="ml-1.5 text-[10.5px] uppercase tracking-[0.05em] text-ink-400">
                    {p.slot}
                  </span>
                </td>
                <td className="px-2.5 py-1.5 text-ink-600 tabular-nums">
                  {p.finishedWidth}&quot; × {p.finishedLength}&quot;
                </td>
                <td className="px-2.5 py-1.5 text-ink-900 tabular-nums">{cutSizeLabel(p)}</td>
                <td className="px-2.5 py-1.5 text-ink-900 tabular-nums">{p.consumption}</td>
                <td className="px-2.5 py-1.5 text-ink-600">
                  {[p.edgeFinish, p.workmanship].filter(Boolean).join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {style.workmanship && style.workmanship.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {style.workmanship.map((w) => (
            <li key={w} className="text-[11px] text-ink-500">
              • {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-[0.06em] text-ink-400">{label}</dt>
      <dd className="truncate text-[12px] text-ink-900" title={value}>
        {value}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Path B — customize a style
 * ------------------------------------------------------------------ */

function StyleCustomizer({
  styles,
  baseStyleId,
  onStartFrom,
  draft,
  onChange,
  errors,
  showErrors,
}: {
  styles: StyleDef[];
  baseStyleId: string | null;
  onStartFrom: (id: string | null) => void;
  draft: StyleDraft;
  onChange: (d: StyleDraft) => void;
  errors: DraftErrors;
  showErrors: boolean;
}) {
  const filters = useStyleFilters(styles);
  const base = styles.find((s) => s.id === baseStyleId) ?? null;

  const set = <K extends keyof StyleDraft>(key: K, value: StyleDraft[K]) =>
    onChange({ ...draft, [key]: value });

  const setPart = (i: number, part: PartDraft) =>
    onChange({ ...draft, parts: draft.parts.map((p, j) => (j === i ? part : p)) });

  const options = useMemo<PickerOption[]>(() => {
    const list = [...filters.shown];
    if (base && !list.some((s) => s.id === base.id)) list.unshift(base);
    return [
      { id: SCRATCH, label: "Start from scratch", detail: "An empty style — nothing inherited" },
      ...list.map(styleOption),
    ];
  }, [filters.shown, base]);

  return (
    <div className="space-y-3">
      {/* ---- start from ---- */}
      <div className="space-y-2 rounded-lg border border-hairline bg-surface-alt/40 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-ink-600">Start from</span>
          <OptionPicker
            label="Start from"
            options={options}
            selectedId={base ? base.id : SCRATCH}
            onPick={(id) => onStartFrom(id === SCRATCH ? null : id)}
            placeholder="Start from scratch"
            searchThreshold={STYLE_SEARCH_THRESHOLD}
            searchPlaceholder="Search by name, code or product…"
            width="w-[380px]"
          />
          {base ? (
            <>
              <ProvenanceChip kind="master" />
              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-amber-900 ring-1 ring-amber-200">
                Modified
              </span>
            </>
          ) : (
            <ProvenanceChip kind="manual" />
          )}
        </div>

        <StyleFilterRow filters={filters} count={filters.shown.length} />

        <p className="text-[11.5px] text-ink-500">
          {base ? (
            <>
              Pre-filled from{" "}
              <span className="font-medium text-ink-700">
                {base.name} ({base.code})
              </span>
              . Every edit below departs from that master, and is labelled inherited-then-modified
              wherever it appears downstream.
            </>
          ) : (
            "Nothing here comes from a master — every value below is yours, and is labelled that way wherever it appears downstream."
          )}
        </p>

        {filters.shown.length === 0 && (
          <button
            type="button"
            onClick={filters.clear}
            className="rounded-md border border-hairline bg-surface px-2.5 py-1 text-[11.5px] font-medium text-brand-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            No style matches those filters — clear them
          </button>
        )}
      </div>

      {/* ---- the style itself ---- */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Text
          label="Style name"
          value={draft.name}
          onChange={(v) => set("name", v)}
          error={showErrors ? errors.name : undefined}
          required
        />
        <Text
          label="Style code"
          value={draft.code}
          onChange={(v) => set("code", v)}
          error={showErrors ? errors.code : undefined}
          placeholder="STY-XXX-000"
          required
        />
        <Text
          label="Product"
          value={draft.product}
          onChange={(v) => set("product", v)}
          placeholder="Placemat, Duvet Cover…"
        />
        <Text
          label="Category"
          value={draft.category}
          onChange={(v) => set("category", v)}
          placeholder="Table Linen, Bed Linen…"
        />
        <Text
          label="Construction"
          value={draft.construction}
          onChange={(v) => set("construction", v)}
          placeholder="Two-panel, bagged out"
        />
        <Text
          label="Edge finish"
          value={draft.edgeFinish}
          onChange={(v) => set("edgeFinish", v)}
          placeholder="Mitred border, piped seam"
        />
      </div>

      <Area
        label="Workmanship notes"
        hint="One per line — the spec sheet's own wording"
        value={draft.workmanship}
        onChange={(v) => set("workmanship", v)}
      />

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[12.5px] font-semibold text-ink-900">Parts</h3>
          <span className="text-[11px] text-ink-500">
            {draft.parts.length} {draft.parts.length === 1 ? "part" : "parts"} — each becomes a row
            on the costing sheet
          </span>
        </div>
        {showErrors && errors.parts && <FieldError message={errors.parts} />}

        {draft.parts.map((part, i) => (
          <PartEditor
            key={i}
            index={i}
            part={part}
            onChange={(p) => setPart(i, p)}
            onRemove={
              draft.parts.length > 1
                ? () => onChange({ ...draft, parts: draft.parts.filter((_, j) => j !== i) })
                : undefined
            }
            error={showErrors ? errors.part[i] : undefined}
          />
        ))}

        <button
          type="button"
          onClick={() => onChange({ ...draft, parts: [...draft.parts, emptyPart()] })}
          className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-brand-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden /> Add another part
        </button>
      </div>
    </div>
  );
}

function PartEditor({
  index,
  part,
  onChange,
  onRemove,
  error,
}: {
  index: number;
  part: PartDraft;
  onChange: (p: PartDraft) => void;
  onRemove?: () => void;
  error?: string;
}) {
  const set = <K extends keyof PartDraft>(key: K, value: PartDraft[K]) =>
    onChange({ ...part, [key]: value });
  const cut = derivedCut(part);

  return (
    <div className="rounded-lg border border-hairline bg-surface p-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-400">
          Part {index + 1}
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove part ${index + 1}`}
            className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-500 hover:bg-surface-alt hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="col-span-2">
          <Text
            label="Part name"
            value={part.name}
            onChange={(v) => set("name", v)}
            placeholder="Front Panel"
          />
        </div>
        <Choice
          label="Type"
          value={part.type}
          onChange={(v) => set("type", v)}
          options={PART_TYPES as unknown as string[]}
        />
        <Choice
          label="Slot"
          value={part.slot}
          onChange={(v) => set("slot", v as PartDraft["slot"])}
          options={["fabric", "trim"]}
        />

        <Text
          label='Finished W"'
          value={part.finishedWidth}
          onChange={(v) => set("finishedWidth", v)}
          numeric
        />
        <Text
          label='Finished L"'
          value={part.finishedLength}
          onChange={(v) => set("finishedLength", v)}
          numeric
        />
        {/* Cut size defaults from finished + allowances, but stays editable:
            a marker sometimes needs an allowance the formula does not know. */}
        <Text
          label='Cut W"'
          value={part.cutWidth}
          onChange={(v) => set("cutWidth", v)}
          numeric
          placeholder={String(cut.width)}
          hint="auto"
        />
        <Text
          label='Cut L"'
          value={part.cutLength}
          onChange={(v) => set("cutLength", v)}
          numeric
          placeholder={String(cut.length)}
          hint="auto"
        />

        <Text
          label="Consumption m/pc"
          value={part.consumption}
          onChange={(v) => set("consumption", v)}
          numeric
        />
        <Text
          label="Wastage %"
          value={part.wastagePct}
          onChange={(v) => set("wastagePct", v)}
          numeric
        />
        <Text label="Edge finish" value={part.edgeFinish} onChange={(v) => set("edgeFinish", v)} />
        <Text
          label="Workmanship"
          value={part.workmanship}
          onChange={(v) => set("workmanship", v)}
        />
        <div className="col-span-2 sm:col-span-4">
          <Text
            label="Spec"
            value={part.spec}
            onChange={(v) => set("spec", v)}
            placeholder="GSM, count, construction note"
          />
        </div>
      </div>

      {error && <FieldError message={error} className="mt-2" />}
    </div>
  );
}

/* ---- small form primitives, local so the flow keeps one visual voice ---- */

function Text({
  label,
  value,
  onChange,
  placeholder,
  numeric,
  error,
  required,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
  error?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.06em] text-ink-400">
        {label}
        {required && <span className="text-danger">*</span>}
        {hint && <span className="normal-case tracking-normal text-ink-300">({hint})</span>}
      </span>
      <input
        type="text"
        inputMode={numeric ? "decimal" : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-0.5 w-full rounded-md border bg-surface px-2 py-1.5 text-[12px] text-ink-900 placeholder:text-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
          error ? "border-danger" : "border-hairline",
          numeric && "tabular-nums",
        )}
      />
      {error && <FieldError message={error} className="mt-1" />}
    </label>
  );
}

function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.06em] text-ink-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12px] text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function Area({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.06em] text-ink-400">
        {label} {hint && <span className="normal-case tracking-normal text-ink-300">— {hint}</span>}
      </span>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12px] text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      />
    </label>
  );
}

function FieldError({ message, className }: { message: string; className?: string }) {
  return (
    <p role="alert" className={cn("text-[11px] font-medium text-danger", className)}>
      {message}
    </p>
  );
}
