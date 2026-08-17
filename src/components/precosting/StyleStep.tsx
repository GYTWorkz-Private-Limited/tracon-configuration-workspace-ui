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
 * The article's product is already decided by the time this step opens, so the
 * select path does NOT ask the user to filter by product or category again —
 * it narrows to the styles that fit THIS article and keeps an escape hatch to
 * the whole master, because a master with no match must never dead-end.
 *
 * The customise builder no longer expands inline: it lives in
 * `StyleCustomizeDrawer` so the page it is editing stays visible behind it.
 * This component therefore only chooses the path, runs the select path, and
 * summarises whatever the drawer produced.
 */

import { useMemo, useState } from "react";
import { Layers, PencilRuler } from "lucide-react";
import { cn } from "@/lib/utils";
import { cutSizeLabel, type StyleDef } from "@/lib/styleMaster";
import { OptionPicker, type PickerOption } from "@/components/ui/pickers";
import { ProvenanceChip } from "./Provenance";

/** Only two paths exist. There is no third tab. */
export type StylePath = "select" | "customize";

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
  detail: s.description || [s.code, s.product, s.category].filter(Boolean).join(" · "),
  trailing: `${s.parts.length} parts`,
});

/** What the drawer built, reduced to the one line this step needs to show. */
export type CustomStyleSummary = {
  name: string;
  parts: number;
  /** inherited-then-modified rather than typed from nothing */
  fromMaster?: boolean;
};

/* ------------------------------------------------------------------ *
 * Article ↔ style matching
 * ------------------------------------------------------------------ */

const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);

/**
 * A style fits the article when their product or category shares a real word.
 * Substring matching alone would pair "Apron" with "Aprons Table" by accident;
 * word overlap is the loosest rule that still means something to a costing
 * user reading the list.
 */
function stylesForArticle(styles: StyleDef[], articleName?: string): StyleDef[] {
  const target = words(articleName ?? "");
  if (target.length === 0) return [];
  return styles.filter((s) => {
    const hay = new Set([...words(s.product ?? ""), ...words(s.category), ...words(s.name)]);
    return target.some((w) => hay.has(w));
  });
}

export function StyleStep({
  styles,
  articleName,
  path,
  onPathChange,
  selectedId,
  onSelect,
  onOpenCustomize,
  customSummary,
}: {
  styles: StyleDef[];
  /** the article being styled — named on screen, and used to narrow the list */
  articleName?: string;
  path: StylePath;
  onPathChange: (p: StylePath) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** opens the customise drawer, which the CALLER owns and mounts */
  onOpenCustomize: () => void;
  /** the draft the drawer holds, if the customise path has produced one */
  customSummary?: CustomStyleSummary | null;
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
          onClick={() => {
            onPathChange("customize");
            onOpenCustomize();
          }}
          icon={<PencilRuler className="h-3.5 w-3.5" aria-hidden />}
          label="Customize"
          hint="Start from a style or from scratch, then edit it"
        />
      </div>

      {path === "select" ? (
        <StylePicker
          styles={styles}
          articleName={articleName}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : (
        <CustomSummaryCard summary={customSummary ?? null} onEdit={onOpenCustomize} />
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
 * Path A — use an existing style
 * ------------------------------------------------------------------ */

function StylePicker({
  styles,
  articleName,
  selectedId,
  onSelect,
}: {
  styles: StyleDef[];
  articleName?: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const matched = useMemo(() => stylesForArticle(styles, articleName), [styles, articleName]);
  // Narrowing is only offered when it would actually narrow to something. With
  // no match the list opens on the whole master rather than on an empty state
  // the user has to discover their way out of.
  const canNarrow = matched.length > 0 && matched.length < styles.length;
  const [showAll, setShowAll] = useState(false);
  const narrowed = canNarrow && !showAll;

  const selected = styles.find((s) => s.id === selectedId) ?? null;

  const options = useMemo(() => {
    const list = narrowed ? [...matched] : [...styles];
    // A style already chosen stays reachable even when narrowing would hide
    // it — a picker that silently forgets its own answer is a bug, not a filter.
    if (selected && !list.some((s) => s.id === selected.id)) list.unshift(selected);
    return list.map(styleOption);
  }, [narrowed, matched, styles, selected]);

  return (
    <div className="space-y-2.5">
      <div className="rounded-lg border border-hairline bg-surface-alt/40 px-3 py-2.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
            Styling
          </span>
          <span className="text-[12.5px] font-semibold text-ink-900">
            {articleName ?? "Article"}
          </span>
          <span className="ml-auto text-[11px] text-ink-500 tabular-nums">
            {options.length} {options.length === 1 ? "style" : "styles"}
            {narrowed ? " for this article" : " in the master"}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-ink-600">Style</span>
          <OptionPicker
            label={narrowed ? `Styles for ${articleName ?? "this article"}` : "Style master"}
            options={options}
            selectedId={selectedId ?? undefined}
            onPick={onSelect}
            placeholder="Select a style…"
            searchThreshold={STYLE_SEARCH_THRESHOLD}
            searchPlaceholder="Search by name, code or description…"
            width="w-[420px]"
          />
          {selected && <ProvenanceChip kind="master" />}
          {canNarrow && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="ml-auto rounded-md border border-hairline bg-surface px-2.5 py-1 text-[11.5px] font-medium text-brand-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              {narrowed
                ? "Show all styles"
                : `Show only styles for ${articleName ?? "this article"}`}
            </button>
          )}
        </div>
      </div>

      {selected ? (
        <InheritancePreview style={selected} />
      ) : (
        <p className="rounded-lg border border-hairline bg-surface-alt/40 px-3 py-6 text-center text-[12px] text-ink-500">
          Pick a style to see exactly what it brings into the costing sheet.
        </p>
      )}
    </div>
  );
}

/** What the customise path produced, without re-opening the whole builder. */
function CustomSummaryCard({
  summary,
  onEdit,
}: {
  summary: CustomStyleSummary | null;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-hairline bg-surface-alt/40 px-3 py-3">
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-ink-900">
          {summary?.name ? `Custom style — ${summary.name}` : "Custom style — not built yet"}
        </p>
        <p className="mt-0.5 text-[11.5px] text-ink-500">
          {summary
            ? `${summary.parts} ${summary.parts === 1 ? "part" : "parts"} · ${
                summary.fromMaster ? "inherited from a master, then modified" : "built from scratch"
              }`
            : "Open the builder to name the style and add its parts."}
        </p>
      </div>
      <ProvenanceChip kind={summary?.fromMaster ? "master" : "manual"} />
      <button
        type="button"
        onClick={onEdit}
        className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-brand-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        <PencilRuler className="h-3.5 w-3.5" aria-hidden />
        {summary ? "Edit" : "Open builder"}
      </button>
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

      {style.description && <p className="mt-1 text-[11.5px] text-ink-600">{style.description}</p>}

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
        <Field label="Product" value={style.product ?? "—"} />
        <Field label="Category" value={style.category} />
        <Field label="Construction" value={style.construction ?? "—"} />
        <Field label="Edge finish" value={style.edgeFinish ?? "—"} />
      </dl>

      <div className="mt-2.5 overflow-x-auto rounded-md border border-hairline bg-surface">
        <table className="w-full min-w-[560px] text-left text-[11.5px]">
          <caption className="sr-only">Parts inherited from {style.name}</caption>
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
                  {p.spec && <span className="block text-[10.5px] text-ink-400">{p.spec}</span>}
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
