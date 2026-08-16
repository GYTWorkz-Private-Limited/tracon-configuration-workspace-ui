/**
 * Step 2 — what is being made?
 *
 * Two paths, given equal standing. Most orders repeat a style the mill has
 * made before, so the master comes first; but a genuinely new style must not
 * force the user to leave the flow, so it can be built here and (on the next
 * step) promoted into the master for the order after this one.
 *
 * The selection preview is deliberately about INHERITANCE: it shows exactly
 * the attributes the costing sheet is about to receive, because a style is
 * chosen for what it carries, not for its name.
 */

import { useMemo, useState } from "react";
import { Layers, PencilRuler, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { cutSizeLabel, type StyleDef } from "@/lib/styleMaster";
import { ProvenanceChip } from "./Provenance";
import {
  PART_TYPES,
  derivedCut,
  emptyPart,
  type DraftErrors,
  type PartDraft,
  type StyleDraft,
} from "./styleDraft";

export type StylePath = "select" | "build";

const ALL = "__all__";

export function StyleStep({
  styles,
  path,
  onPathChange,
  selectedId,
  onSelect,
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
          label="Select from Style Master"
          hint="Parts, cut sizes and consumption arrive pre-filled"
        />
        <PathTab
          active={path === "build"}
          onClick={() => onPathChange("build")}
          icon={<PencilRuler className="h-3.5 w-3.5" aria-hidden />}
          label="Build manually"
          hint="A style the master does not carry yet"
        />
      </div>

      {path === "select" ? (
        <StylePicker styles={styles} selectedId={selectedId} onSelect={onSelect} />
      ) : (
        <StyleBuilder
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
 * Path A — select an existing style
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
  const [query, setQuery] = useState("");
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

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return styles.filter(
      (s) =>
        (product === ALL || s.product === product) &&
        (category === ALL || s.category === category) &&
        (!q ||
          [s.name, s.code, s.product, s.category, s.construction, s.description]
            .filter(Boolean)
            .some((v) => (v as string).toLowerCase().includes(q))),
    );
  }, [styles, query, product, category]);

  const selected = styles.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search styles by name, code or construction"
            aria-label="Search styles"
            className="w-full rounded-md border border-hairline bg-surface py-1.5 pl-8 pr-2.5 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          />
        </div>
        <Select label="Product" value={product} onChange={setProduct} options={products} />
        <Select label="Category" value={category} onChange={setCategory} options={categories} />
      </div>

      <ul className="max-h-[230px] divide-y divide-hairline overflow-y-auto rounded-lg border border-hairline">
        {shown.length === 0 && (
          <li className="px-3 py-6 text-center text-[12px] text-ink-500">
            No style matches that. Clear the filters, or build the style manually.
          </li>
        )}
        {shown.map((s) => {
          const active = s.id === selectedId;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-pressed={active}
                className={cn(
                  "w-full px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700",
                  active ? "bg-brand-700/5" : "bg-surface hover:bg-surface-alt",
                )}
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <span
                    aria-hidden
                    className={cn(
                      "h-3 w-3 shrink-0 rounded-full border",
                      active ? "border-brand-700 bg-brand-700" : "border-ink-300",
                    )}
                  />
                  <span className="text-[12.5px] font-semibold text-ink-900">{s.name}</span>
                  <span className="text-[11px] text-ink-500 tabular-nums">{s.code}</span>
                  {s.product && (
                    <span className="rounded-full border border-hairline bg-surface-alt/60 px-2 py-0.5 text-[10.5px] text-ink-600">
                      {s.product}
                    </span>
                  )}
                  <span className="ml-auto text-[11px] text-ink-500 tabular-nums">
                    {s.parts.length} parts
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected && <InheritancePreview style={selected} />}
    </div>
  );
}

function Select({
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
    <label className="flex items-center gap-1.5 text-[11.5px] text-ink-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12px] text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        <option value={ALL}>All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Exactly what the costing sheet will receive if this style is confirmed. */
export function InheritancePreview({ style }: { style: StyleDef }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-alt/40 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12.5px] font-semibold text-ink-900">{style.name}</span>
        <span className="text-[11px] text-ink-500 tabular-nums">{style.code}</span>
        <ProvenanceChip kind="master" />
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
 * Path B — build the style by hand
 * ------------------------------------------------------------------ */

function StyleBuilder({
  draft,
  onChange,
  errors,
  showErrors,
}: {
  draft: StyleDraft;
  onChange: (d: StyleDraft) => void;
  errors: DraftErrors;
  showErrors: boolean;
}) {
  const set = <K extends keyof StyleDraft>(key: K, value: StyleDraft[K]) =>
    onChange({ ...draft, [key]: value });

  const setPart = (i: number, part: PartDraft) =>
    onChange({ ...draft, parts: draft.parts.map((p, j) => (j === i ? part : p)) });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <ProvenanceChip kind="manual" />
        <p className="text-[11.5px] text-ink-500">
          Nothing here comes from a master — every value below is yours, and is labelled that way
          wherever it appears downstream.
        </p>
      </div>

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
            {draft.parts.length} added — each becomes a row on the costing sheet
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
