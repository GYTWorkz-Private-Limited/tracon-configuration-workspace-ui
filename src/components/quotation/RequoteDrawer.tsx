// Requote — pick a source version, choose which items carry forward, and
// decide per item whether it goes back to Costing for a real rebuild or is
// simply re-priced here against current costing.
//
// The source version is never touched; this always produces a new version.

import { useEffect, useMemo, useState } from "react";
import { X, Zap, Settings2, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  liveCostInr,
  lineMargin,
  type Quotation,
  type QuotationLine,
  type RequoteMode,
} from "@/lib/quotationsStore";
import { priceFor } from "@/lib/quotationCosting";

export function RequoteDrawer({
  quotation,
  open,
  onClose,
  onGenerate,
}: {
  quotation: Quotation;
  open: boolean;
  onClose: () => void;
  onGenerate: (input: {
    fromVersion: number;
    lineIds: string[];
    mode: Record<string, RequoteMode>;
    note: string;
  }) => void;
}) {
  const versionOptions = useMemo(
    () => [quotation.version, ...quotation.versions.map((v) => v.version)],
    [quotation],
  );
  const [fromVersion, setFromVersion] = useState(quotation.version);
  const sourceLines = useMemo(() => {
    if (fromVersion === quotation.version) return quotation.lines;
    return quotation.versions.find((v) => v.version === fromVersion)?.lines ?? [];
  }, [fromVersion, quotation]);

  const heads = sourceLines.filter((l) => !l.parentId);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Record<string, RequoteMode>>({});
  const [note, setNote] = useState("");

  // Preselect everything each time the drawer opens — line ids change as the
  // quotation is edited, so a selection captured at mount would go stale.
  useEffect(() => {
    if (!open) return;
    setPicked(new Set(quotation.lines.filter((l) => !l.parentId).map((l) => l.id)));
    setFromVersion(quotation.version);
    // Snapshot the lines as they stand when the drawer opens; re-running on
    // every store change would wipe a selection mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const lineIds = sourceLines
    .filter((l) => picked.has(l.id) || (l.parentId && picked.has(l.parentId)))
    .map((l) => l.id);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Generate requote"
    >
      <button className="absolute inset-0 bg-ink-900/30" aria-label="Close" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-[640px] flex-col border-l border-hairline bg-surface shadow-2xl">
        <header className="flex items-start gap-2 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-[16px] font-semibold text-ink-900">
              <Zap className="h-4 w-4 text-amber-600" aria-hidden /> Generate Requote
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-500">
              Creates <strong className="text-ink-900">v{quotation.version + 1}</strong>. The
              version you requote from stays intact and viewable.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {versionOptions.length > 1 && (
            <section>
              <label
                htmlFor="requote-version"
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400"
              >
                Requote from
              </label>
              <select
                id="requote-version"
                value={fromVersion}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setFromVersion(v);
                  const next =
                    v === quotation.version
                      ? quotation.lines
                      : (quotation.versions.find((x) => x.version === v)?.lines ?? []);
                  setPicked(new Set(next.filter((l) => !l.parentId).map((l) => l.id)));
                }}
                className="mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
              >
                {versionOptions.map((v) => (
                  <option key={v} value={v}>
                    v{v}
                    {v === quotation.version ? " — current" : ""}
                  </option>
                ))}
              </select>
            </section>
          )}

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
              Carry forward
            </h3>
            <p className="mt-1 text-[12px] text-ink-500">
              Pick the articles, sets and kits to bring into the new version — it does not have to
              be all of them.
            </p>

            <ul className="mt-3 space-y-2">
              {heads.map((l) => (
                <ItemRow
                  key={l.id}
                  line={l}
                  checked={picked.has(l.id)}
                  onToggle={() => toggle(l.id)}
                  mode={mode[l.id] ?? "high_level_override"}
                  onMode={(m) => setMode({ ...mode, [l.id]: m })}
                  childCount={sourceLines.filter((c) => c.parentId === l.id).length}
                />
              ))}
              {heads.length === 0 && (
                <li className="py-8 text-center text-[13px] text-ink-500">
                  That version has no lines to carry forward.
                </li>
              )}
            </ul>
          </section>

          <section>
            <label
              htmlFor="requote-note"
              className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400"
            >
              Reason for requote
            </label>
            <textarea
              id="requote-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Input costs up 11.3% since 20 Jun — repricing to hold 22% margin."
              className="mt-1.5 w-full rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
            />
          </section>
        </div>

        <footer className="flex items-center gap-2 border-t border-hairline px-5 py-3.5">
          <p className="text-[12px] text-ink-500">
            {picked.size} item{picked.size === 1 ? "" : "s"} → v{quotation.version + 1}
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
            >
              Cancel
            </button>
            <button
              disabled={picked.size === 0}
              onClick={() => onGenerate({ fromVersion, lineIds, mode, note: note.trim() })}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Zap className="h-3.5 w-3.5" /> Generate v{quotation.version + 1}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

function ItemRow({
  line,
  checked,
  onToggle,
  mode,
  onMode,
  childCount,
}: {
  line: QuotationLine;
  checked: boolean;
  onToggle: () => void;
  mode: RequoteMode;
  onMode: (m: RequoteMode) => void;
  childCount: number;
}) {
  const cost = liveCostInr(line);
  const heldMargin = lineMargin(line, line.costAtQuoteInr);
  const repriced = priceFor(heldMargin, cost, line.fxRate);
  const delta = repriced - line.priceUsd;

  return (
    <li
      className={cn(
        "rounded-lg border px-3.5 py-3",
        checked ? "border-brand-600 bg-brand-50/30" : "border-hairline bg-surface",
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand-700)]"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="text-[13px] font-semibold text-ink-900">
              {line.sr} · {line.name}
            </span>
            {childCount > 0 && (
              <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-600">
                +{childCount} linked line{childCount === 1 ? "" : "s"}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[11.5px] text-ink-500">
            {line.size} · MOQ {line.moq.toLocaleString("en-IN")} · quoted $
            {line.priceUsd.toFixed(2)}
          </span>
        </span>
      </label>

      {checked && (
        <div className="mt-3 space-y-2 border-t border-hairline pt-3">
          <ModeOption
            icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            active={mode === "high_level_override"}
            onClick={() => onMode("high_level_override")}
            title="High-Level Override Only"
            desc={`Stays in Quotation. Re-priced against current costing — $${repriced.toFixed(2)} (${delta >= 0 ? "+" : ""}$${delta.toFixed(2)}) holds ${heldMargin.toFixed(1)}% margin.`}
          />
          <ModeOption
            icon={<Settings2 className="h-3.5 w-3.5" />}
            active={mode === "full_reconfiguration"}
            onClick={() => onMode("full_reconfiguration")}
            title="Full Reconfiguration"
            desc="Routes this item back to Costing & Configuration for a real rebuild. Its line stays in the new version, flagged until the new costing lands."
          />
        </div>
      )}
    </li>
  );
}

function ModeOption({
  icon,
  active,
  onClick,
  title,
  desc,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-start gap-2.5 rounded-md border px-3 py-2 text-left transition-colors",
        active
          ? "border-brand-600 bg-surface ring-1 ring-brand-700/20"
          : "border-hairline bg-surface hover:bg-surface-alt",
      )}
    >
      <span className={cn("mt-0.5 shrink-0", active ? "text-brand-700" : "text-ink-400")}>
        {icon}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-[12.5px] font-semibold",
            active ? "text-brand-700" : "text-ink-900",
          )}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-500">{desc}</span>
      </span>
    </button>
  );
}
