/**
 * The style builder, as a side panel.
 *
 * It used to expand inside the step, which pushed the decision the user was
 * making off-screen and made a long parts repeater feel like a different page.
 * In a drawer the Style Configuration behind it stays readable, so "what am I
 * customising away from?" never needs a Back.
 *
 * The drawer is a pure editor: it holds no draft of its own, so the same panel
 * serves the pre-costing dialog and the POD creation route, and whoever owns
 * the draft also owns when it is committed.
 */

import { useEffect, useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StyleDef } from "@/lib/styleMaster";
import { OptionPicker, type PickerOption } from "@/components/ui/pickers";
import { DrawerShell } from "@/components/articles/DrawerShell";
import { ProvenanceChip } from "./Provenance";
import {
  PART_TYPES,
  derivedCut,
  emptyPart,
  type DraftErrors,
  type PartDraft,
  type StyleDraft,
} from "./styleDraft";

const SCRATCH = "__scratch__";
const STYLE_SEARCH_THRESHOLD = 3;

const styleOption = (s: StyleDef): PickerOption => ({
  id: s.id,
  label: s.name,
  detail: [s.code, s.product, s.category].filter(Boolean).join(" · "),
  trailing: `${s.parts.length} parts`,
});

export function StyleCustomizeDrawer({
  open,
  onClose,
  articleName,
  styles,
  baseStyleId,
  onStartFrom,
  draft,
  onDraftChange,
  errors,
  showErrors,
  onSave,
  saveToMaster,
  onSaveToMasterChange,
}: {
  open: boolean;
  onClose: () => void;
  articleName?: string;
  styles: StyleDef[];
  /** the master the customisation started from — null means from scratch */
  baseStyleId: string | null;
  onStartFrom: (id: string | null) => void;
  draft: StyleDraft;
  onDraftChange: (d: StyleDraft) => void;
  errors: DraftErrors;
  showErrors: boolean;
  /** returns true when the draft was accepted, so the drawer knows to close */
  onSave: () => boolean | void;
  /** omit to hide the promote-to-master toggle entirely */
  saveToMaster?: boolean;
  onSaveToMasterChange?: (v: boolean) => void;
}) {
  // The drawer sits over a dialog that also closes on Escape. Capturing the key
  // here — before the dialog's document listener bubbles — means Escape peels
  // off one layer, rather than throwing away the whole flow.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // The dialog underneath must not also close: Escape peels one layer.
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const base = styles.find((s) => s.id === baseStyleId) ?? null;

  const set = <K extends keyof StyleDraft>(key: K, value: StyleDraft[K]) =>
    onDraftChange({ ...draft, [key]: value });

  const setPart = (i: number, part: PartDraft) =>
    onDraftChange({ ...draft, parts: draft.parts.map((p, j) => (j === i ? part : p)) });

  const options = useMemo<PickerOption[]>(
    () => [
      { id: SCRATCH, label: "Start from scratch", detail: "An empty style — nothing inherited" },
      ...styles.map(styleOption),
    ],
    [styles],
  );

  if (!open) return null;

  return (
    // z-[60] lifts the whole drawer above the z-50 dialog it is opened from.
    <div className="relative z-[60]">
      <DrawerShell
        open={open}
        onClose={onClose}
        title="Customize style"
        subtitle={
          articleName
            ? `The style ${articleName} will be costed against.`
            : "The style this article will be costed against."
        }
        width="max-w-[980px]"
        footer={
          <>
            <div className="flex min-w-0 items-center gap-3">
              {onSaveToMasterChange && (
                <label className="flex items-center gap-2 text-[12px] text-ink-700">
                  <input
                    type="checkbox"
                    checked={Boolean(saveToMaster)}
                    onChange={(e) => onSaveToMasterChange(e.target.checked)}
                    className="h-3.5 w-3.5 accent-brand-700"
                  />
                  Save to the style master for reuse
                </label>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-hairline bg-surface px-3.5 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onSave() !== false) onClose();
                }}
                className="rounded-md bg-brand-700 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
              >
                Save style
              </button>
            </div>
          </>
        }
      >
        <div className="space-y-3 px-5 py-4">
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

            <p className="text-[11.5px] text-ink-500">
              {base ? (
                <>
                  Pre-filled from{" "}
                  <span className="font-medium text-ink-700">
                    {base.name} ({base.code})
                  </span>
                  . Every edit below departs from that master, and is labelled
                  inherited-then-modified wherever it appears downstream.
                </>
              ) : (
                "Nothing here comes from a master — every value below is yours, and is labelled that way wherever it appears downstream."
              )}
            </p>
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
                {draft.parts.length} {draft.parts.length === 1 ? "part" : "parts"} — each becomes a
                row on the costing sheet
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
                    ? () =>
                        onDraftChange({ ...draft, parts: draft.parts.filter((_, j) => j !== i) })
                    : undefined
                }
                error={showErrors ? errors.part[i] : undefined}
              />
            ))}

            <button
              type="button"
              onClick={() => onDraftChange({ ...draft, parts: [...draft.parts, emptyPart()] })}
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] font-medium text-brand-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add another part
            </button>
          </div>
        </div>
      </DrawerShell>
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
