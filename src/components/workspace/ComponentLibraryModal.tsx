// ComponentLibraryModal — the master list, browsable in its own right.
//
// Two panes: the catalogue on the left, the selected master on the right. The
// right pane is the point of the screen — it shows what a master actually says
// (its full attribute sheet) and HOW ITS CONSUMPTION IS DERIVED, so the library
// answers "what would this cost me and why" without anything being added.
//
// Adding is a deliberate second step: pick where it goes, then Add to sheet.

import { useMemo, useState } from "react";
import { BookOpen, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FABRIC_PATHS,
  FABRIC_SLOTS,
  FILLING_SLOTS,
  KIND_LABEL,
  LIBRARY,
  matchesQuery,
  SECTION_KINDS,
  type LibraryItem,
  type LibraryKind,
} from "@/lib/library";

type Target = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  /** the sheet section that opened it — pre-filters the catalogue */
  section?: string | null;
  /** components a process or trim can be attached to */
  targets: Target[];
  onAdd: (item: LibraryItem, targetComponentId: string | null, slot: string) => void;
};

const KIND_ORDER: LibraryKind[] = ["fabric", "filling", "process", "trim", "packaging", "testing"];

/** Kinds that attach to a component rather than sitting at product level. */
const NEEDS_TARGET: LibraryKind[] = ["process", "trim"];
/** Kinds that fill a named slot on the style. */
const NEEDS_SLOT: LibraryKind[] = ["fabric", "filling"];

export function ComponentLibraryModal({ open, onClose, section, targets, onAdd }: Props) {
  const allowed = useMemo<LibraryKind[]>(
    () => (section && SECTION_KINDS[section] ? SECTION_KINDS[section] : KIND_ORDER),
    [section],
  );

  const [kind, setKind] = useState<LibraryKind | "all">("all");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string>("");
  const [slot, setSlot] = useState<string>("");

  const pool = useMemo(() => LIBRARY.filter((i) => allowed.includes(i.kind)), [allowed]);

  const results = useMemo(
    () => pool.filter((i) => (kind === "all" || i.kind === kind) && matchesQuery(i, q)),
    [pool, kind, q],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, LibraryItem[]>();
    for (const item of results) {
      const key = `${KIND_LABEL[item.kind]} · ${item.group}`;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [results]);

  const selected = results.find((i) => i.id === selectedId) ?? results[0] ?? null;

  if (!open) return null;

  const kindsOnOffer = KIND_ORDER.filter((k) => allowed.includes(k));
  const needsTarget = selected ? NEEDS_TARGET.includes(selected.kind) : false;
  const needsSlot = selected ? NEEDS_SLOT.includes(selected.kind) : false;
  const slotChoices = selected?.kind === "filling" ? FILLING_SLOTS : FABRIC_SLOTS;
  const resolvedTarget = targetId || targets[0]?.id || "";
  const resolvedSlot = slot || selected?.slots[0] || slotChoices[0];
  const canAdd = Boolean(selected) && (!needsTarget || Boolean(resolvedTarget));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Component Library"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[min(760px,92vh)] w-[min(1080px,96vw)] flex-col overflow-hidden rounded-xl border border-hairline bg-surface shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline px-5 py-3.5">
          <div>
            <h2 className="flex items-center gap-2 text-[14px] font-semibold text-ink-900">
              <BookOpen className="h-4 w-4 text-brand-700" aria-hidden />
              Component Library
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-500">
              Every fabric, process, trim, packaging and test master. Browse to check a spec or its
              consumption logic — nothing changes until you add it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the component library"
            className="rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* ---- search + kind filter ---- */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline px-5 py-2.5">
          <label className="relative flex min-w-[260px] flex-1 items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-ink-400" />
            <span className="sr-only">Search the component library</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, code, composition, GSM, supplier, slot…"
              className="w-full rounded-md border border-hairline bg-surface py-1.5 pl-8 pr-2 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            />
          </label>
          <div className="flex flex-wrap items-center gap-1">
            <FilterChip active={kind === "all"} onClick={() => setKind("all")}>
              All ({pool.length})
            </FilterChip>
            {kindsOnOffer.map((k) => (
              <FilterChip key={k} active={kind === k} onClick={() => setKind(k)}>
                {KIND_LABEL[k]}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* ---- catalogue ---- */}
          <div className="w-[380px] shrink-0 overflow-y-auto border-r border-hairline">
            {!grouped.length && (
              <p className="px-5 py-10 text-center text-[12.5px] text-ink-500">
                Nothing matches “{q}”.
              </p>
            )}
            {grouped.map(([group, items]) => (
              <div key={group}>
                <div className="sticky top-0 z-10 border-b border-hairline bg-surface-alt px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
                  {group}
                </div>
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(item.id);
                      setSlot("");
                    }}
                    className={cn(
                      "block w-full border-b border-hairline px-4 py-2.5 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700",
                      selected?.id === item.id ? "bg-brand-50" : "hover:bg-surface-alt",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12.5px] font-medium text-ink-900">
                        {item.name}
                      </span>
                      <span className="shrink-0 text-[11.5px] tabular-nums text-ink-600">
                        ₹{item.rate.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-2">
                      <span className="truncate text-[11px] text-ink-400">{item.code}</span>
                      <span className="shrink-0 text-[10.5px] text-ink-400">{item.rateUnit}</span>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* ---- master detail ---- */}
          <div className="min-w-0 flex-1 overflow-y-auto p-5">
            {!selected ? (
              <p className="text-[12.5px] text-ink-500">Select an entry to read its master.</p>
            ) : (
              <MasterDetail item={selected} />
            )}
          </div>
        </div>

        {/* ---- add bar ---- */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-hairline bg-surface-alt px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {needsSlot && (
              <label className="flex items-center gap-1.5 text-[11.5px] text-ink-600">
                Slot
                <select
                  value={resolvedSlot}
                  onChange={(e) => setSlot(e.target.value)}
                  className="rounded-md border border-hairline bg-surface px-2 py-1 text-[12px] text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                >
                  {slotChoices.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {needsTarget && (
              <label className="flex items-center gap-1.5 text-[11.5px] text-ink-600">
                Apply to
                <select
                  value={resolvedTarget}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="rounded-md border border-hairline bg-surface px-2 py-1 text-[12px] text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                >
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!needsSlot && !needsTarget && selected && (
              <span className="text-[11.5px] text-ink-500">
                Costed at product level — no component to attach it to.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
            >
              Close — browsing only
            </button>
            <button
              type="button"
              disabled={!canAdd}
              onClick={() => {
                if (!selected || !canAdd) return;
                onAdd(selected, needsTarget ? resolvedTarget : null, resolvedSlot);
              }}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-3.5 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add to sheet
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Detail pane
 * ------------------------------------------------------------------ */

function MasterDetail({ item }: { item: LibraryItem }) {
  const path = item.pathId ? FABRIC_PATHS[item.pathId] : undefined;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink-900">{item.name}</h3>
          <p className="mt-0.5 text-[11.5px] text-ink-400">
            {item.code} · {KIND_LABEL[item.kind]} · {item.group}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[18px] font-semibold tabular-nums text-ink-900">
            ₹{item.rate.toLocaleString("en-IN")}
          </div>
          <div className="text-[10.5px] text-ink-400">{item.rateUnit}</div>
        </div>
      </div>

      <p className="mt-2 text-[12.5px] leading-relaxed text-ink-700">{item.summary}</p>

      {/* consumption logic — the reason to browse without adding */}
      <Block title="Consumption logic">
        <div className="rounded-lg border border-hairline bg-surface-alt p-3">
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11.5px]">
            <span className="text-ink-500">
              Method <span className="font-medium text-ink-900">{item.consumption.method}</span>
            </span>
            <span className="text-ink-500">
              Basis <span className="font-medium text-ink-900">{item.consumption.basis}</span>
            </span>
          </div>
          <code className="mt-2 block whitespace-pre-wrap rounded bg-surface px-2 py-1.5 text-[11px] leading-relaxed text-ink-700">
            {item.consumption.formula}
          </code>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {item.consumption.drivers.map((d) => (
              <li
                key={d}
                className="rounded-full bg-surface px-2 py-0.5 text-[10.5px] text-ink-600"
              >
                {d}
              </li>
            ))}
          </ul>
          {item.consumption.note && (
            <p className="mt-2 text-[11px] italic text-ink-500">{item.consumption.note}</p>
          )}
        </div>
      </Block>

      {path && (
        <Block title={`Fabric path — ${path.label}`}>
          <ol className="flex flex-wrap items-center gap-1.5">
            {path.chain.map((step, i) => (
              <li key={step} className="flex items-center gap-1.5">
                <span className="rounded bg-brand-50 px-2 py-0.5 text-[11px] text-brand-800">
                  {step}
                </span>
                {i < path.chain.length - 1 && (
                  <span className="text-[11px] text-ink-400" aria-hidden>
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {path.stages.map((s) => (
              <div key={s.stage} className="rounded-lg border border-hairline p-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
                  {s.stage}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-600">
                  {s.variables.join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </Block>
      )}

      <Block title="Master data">
        <dl className="grid grid-cols-[minmax(0,140px)_1fr] gap-x-4 gap-y-1.5">
          {item.attributes.map((a) => (
            <div key={`${a.label}-${a.value}`} className="contents">
              <dt className="truncate text-[11.5px] text-ink-500">{a.label}</dt>
              <dd className="text-[11.5px] font-medium text-ink-900">{a.value}</dd>
            </div>
          ))}
        </dl>
      </Block>

      <Block title="Fits these slots">
        <ul className="flex flex-wrap gap-1.5">
          {item.slots.map((s) => (
            <li
              key={s}
              className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-ink-600"
            >
              {s}
            </li>
          ))}
        </ul>
      </Block>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
        {title}
      </h4>
      {children}
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
        active
          ? "border-brand-700 bg-brand-50 font-medium text-brand-800"
          : "border-hairline bg-surface text-ink-600 hover:bg-surface-alt",
      )}
    >
      {children}
    </button>
  );
}
