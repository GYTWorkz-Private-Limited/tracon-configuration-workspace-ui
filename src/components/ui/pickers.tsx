/**
 * The configuration workspace's own controls, extracted so every screen uses
 * the SAME ones.
 *
 * These are not new components. The dropdown is the picker the costing sheet
 * has always used on its rows; the search field, filter chip and filter select
 * are the ones the Component Library and Article Library open with. They lived
 * privately inside those files and were already copied once — the kit's merged
 * table carried a second hand-made OptionPicker — which is how two surfaces
 * that look identical start behaving differently.
 *
 * Pulling them here fixes that duplication and gives the pre-costing flow the
 * costing table's language for free: the same popup, the same dropdown, the
 * same filter row, wherever a user meets them.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Dropdown
 * ------------------------------------------------------------------ */

export type PickerOption = {
  id: string;
  label: string;
  /** the second line — composition, code, category */
  detail?: string;
  /** right-aligned figure, already formatted (₹, %, metres…) */
  trailing?: string;
};

/**
 * The costing sheet's row dropdown.
 *
 * Search appears only once a list is long enough to need it: on a three-option
 * group a search box is furniture, on a forty-style master it is the only way
 * in. `searchThreshold` names that line rather than hiding it in a magic number.
 */
export function OptionPicker({
  label,
  options,
  selectedId,
  onPick,
  placeholder = "Select…",
  searchThreshold = 8,
  searchPlaceholder = "Search…",
  width = "w-[280px]",
  disabled,
}: {
  label: string;
  options: PickerOption[];
  selectedId?: string;
  onPick: (id: string) => void;
  placeholder?: string;
  searchThreshold?: number;
  searchPlaceholder?: string;
  /** popup width — a master list needs more room than a rate option */
  width?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.id === selectedId);
  const searchable = options.length >= searchThreshold;

  // Opening fresh must not inherit the last query — a filtered list that
  // remembers is a list that looks empty for no stated reason.
  useEffect(() => {
    if (!open) return setQ("");
    if (searchable) searchRef.current?.focus({ preventScroll: true });
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(term) ||
        (o.detail ?? "").toLowerCase().includes(term) ||
        (o.trailing ?? "").toLowerCase().includes(term),
    );
  }, [options, q]);

  return (
    <span className="relative inline-block max-w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label={`${label}: ${selected?.label ?? "not set"}. Change.`}
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-md border border-hairline bg-surface px-2 py-1 text-[12px] text-ink-800 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
          disabled ? "cursor-not-allowed opacity-50" : "hover:border-brand-700 hover:bg-brand-50",
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-ink-400" aria-hidden />
      </button>

      {open && (
        <>
          <span
            className="fixed inset-0 z-30"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <span
            className={cn(
              "absolute left-0 top-full z-40 mt-1 block overflow-hidden rounded-lg border border-hairline bg-surface shadow-2xl",
              width,
            )}
          >
            <span className="block border-b border-hairline px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-500">
              {label}
            </span>
            {searchable && (
              <span className="relative flex items-center border-b border-hairline px-2 py-1.5">
                <Search
                  className="pointer-events-none absolute left-4 h-3.5 w-3.5 text-ink-400"
                  aria-hidden
                />
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder={searchPlaceholder}
                  aria-label={`Search ${label}`}
                  className="w-full rounded-md border border-hairline bg-surface py-1.5 pl-7 pr-2 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                />
              </span>
            )}
            <span className="block max-h-[260px] overflow-y-auto p-1">
              {shown.map((o) => {
                const active = o.id === selectedId;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      onPick(o.id);
                    }}
                    className={cn(
                      "flex w-full items-start gap-1.5 rounded px-2 py-1.5 text-left transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                      active ? "bg-brand-50" : "hover:bg-surface-alt",
                    )}
                  >
                    <Check
                      className={cn(
                        "mt-0.5 h-3 w-3 shrink-0 text-brand-700",
                        !active && "opacity-0",
                      )}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-[12px]",
                          active ? "font-medium text-brand-800" : "text-ink-800",
                        )}
                      >
                        {o.label}
                      </span>
                      {o.detail && (
                        <span className="block truncate text-[10.5px] text-ink-400">
                          {o.detail}
                        </span>
                      )}
                    </span>
                    {o.trailing && (
                      <span className="shrink-0 text-[11px] tabular-nums text-ink-500">
                        {o.trailing}
                      </span>
                    )}
                  </button>
                );
              })}
              {shown.length === 0 && (
                <span className="block px-2 py-4 text-center text-[11.5px] text-ink-400">
                  Nothing matches “{q}”.
                </span>
              )}
            </span>
          </span>
        </>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Search + filter row
 * ------------------------------------------------------------------ */

/** The library modals' search field, to the pixel. */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="relative flex min-w-[220px] flex-1 items-center">
      <Search
        className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-ink-400"
        aria-hidden
      />
      <span className="sr-only">{label}</span>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-hairline bg-surface py-1.5 pl-8 pr-2 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      />
    </label>
  );
}

/** The library modals' filter chip. */
export function FilterChip({
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

/** The Article Library's filter select — used for filters AND for sort order. */
export function FilterSelect({
  value,
  onChange,
  label,
  options,
  render,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: string[];
  render?: (v: string) => string;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12px] text-ink-700",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
          value !== "all" && "border-brand-500 text-brand-700",
        )}
      >
        <option value="all">{label}: All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {label}: {render ? render(o) : o}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Sort control — same select, but every value is a real choice, so no "All". */
export function SortSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <label>
      <span className="sr-only">Sort by</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12px] text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            Sort: {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
