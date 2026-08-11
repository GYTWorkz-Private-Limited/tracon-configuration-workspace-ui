// AddOptionModal — creates a new tab, nested under the active variant, that
// carries an alternative value for one or more configuration variables. Pick
// the variables from a searchable multi-select, set each one's value on its
// own row, then it opens alongside the variants it was branched from — same
// mechanics as duplicating a variant, scoped to a parameter change instead of
// a full copy.

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, PackagePlus, Search, X } from "lucide-react";
import { placeholderFor, parseCustom } from "@/components/workspace/ConfigurationRail";
import { cn } from "@/lib/utils";
import type { ParameterId, ParameterOption, VariantParameter } from "@/lib/costingModel";

export type OptionEntry = { parameterId: ParameterId; option: ParameterOption };

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AddOptionModal({
  open,
  onClose,
  parameters,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  parameters: VariantParameter[];
  onCreate: (name: string, entries: OptionEntry[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<ParameterId[]>([]);
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [values, setValues] = useState<Partial<Record<ParameterId, string>>>({});
  const [name, setName] = useState("");

  const dropdownRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Map<ParameterId, HTMLButtonElement>>(new Map());
  const valueInputRefs = useRef<Map<ParameterId, HTMLInputElement>>(new Map());
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  const wasDropdownOpen = useRef(false);

  /* ---- outside click closes the dropdown ---- */
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  /* ---- open: remember what had focus, then move focus into the dialog ---- */
  useEffect(() => {
    if (open) {
      restoreFocusTo.current = document.activeElement as HTMLElement | null;
      const raf = requestAnimationFrame(() => triggerRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
    restoreFocusTo.current?.focus();
  }, [open]);

  /**
   * When the dropdown closes, send focus to the first still-empty value row
   * — but only then. Doing this while the dropdown is open is what made the
   * list feel like it "disappeared": picking a variable would yank focus (and
   * scroll) straight out of the open listbox into a field below it.
   */
  useEffect(() => {
    if (wasDropdownOpen.current && !dropdownOpen) {
      const firstEmpty = selectedIds.find((id) => !(values[id] ?? "").trim());
      if (firstEmpty) valueInputRefs.current.get(firstEmpty)?.focus();
    }
    wasDropdownOpen.current = dropdownOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropdownOpen]);

  if (!open) return null;

  const reset = () => {
    setSelectedIds([]);
    setQuery("");
    setDropdownOpen(false);
    setValues({});
    setName("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const selected = parameters.filter((p) => selectedIds.includes(p.id));
  const results = parameters.filter(
    (p) =>
      p.label.toLowerCase().includes(query.toLowerCase()) ||
      p.hint.toLowerCase().includes(query.toLowerCase()),
  );

  const toggle = (id: ParameterId) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const setValueFor = (id: ParameterId, raw: string) =>
    setValues((prev) => ({ ...prev, [id]: raw }));

  const closeDropdown = () => {
    setDropdownOpen(false);
    triggerRef.current?.focus();
  };

  /** Arrow/Home/End roving focus across the listbox options. */
  const moveOption = (from: ParameterId | null, direction: 1 | -1 | "first" | "last") => {
    if (results.length === 0) return;
    const order = results.map((r) => r.id);
    let index: number;
    if (direction === "first") index = 0;
    else if (direction === "last") index = order.length - 1;
    else {
      const current = from ? order.indexOf(from) : -1;
      index = (current + direction + order.length) % order.length;
    }
    optionRefs.current.get(order[index])?.focus();
  };

  /** Every selected variable with a value that parses cleanly on its own row. */
  const parsedByVariable = selected
    .map((p) => ({ parameter: p, option: parseCustom(p.id, values[p.id] ?? "") }))
    .filter((r): r is { parameter: VariantParameter; option: ParameterOption } => Boolean(r.option));

  const canCreate = selectedIds.length > 0 && parsedByVariable.length > 0;

  /** e.g. "6,000 pcs · 260 GSM" — editable, but a sensible default on its own. */
  const suggestedName = parsedByVariable.map(({ option }) => option.label).join(" · ");

  const create = () => {
    if (!canCreate) return;
    onCreate(
      name.trim() || suggestedName,
      parsedByVariable.map(({ parameter, option }) => ({ parameterId: parameter.id, option })),
    );
    reset();
  };

  /** Tab/Shift+Tab wraps within the dialog; Escape closes the dropdown, then the dialog. */
  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (dropdownOpen) closeDropdown();
      else close();
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const helpTextId = "add-option-help";
  const nameFieldId = "add-option-name";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-option-title"
      aria-describedby={helpTextId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
      onClick={close}
      onKeyDown={handleDialogKeyDown}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        className="flex w-[min(480px,96vw)] flex-col overflow-visible rounded-xl border border-hairline bg-surface shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline px-5 py-3.5">
          <div>
            <h2
              id="add-option-title"
              className="flex items-center gap-2 text-[14px] font-semibold text-ink-900"
            >
              <PackagePlus className="h-4 w-4 text-brand-700" aria-hidden /> Add Option
            </h2>
            <p id={helpTextId} className="mt-0.5 text-[12px] text-ink-500">
              Opens as a new tab under this variant with an alternative value for one or more
              variables.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3.5 px-5 py-4">
          {/* ---- field 1: searchable multi-select ---- */}
          <div ref={dropdownRef} className="relative">
            <span id="add-option-variables-label" className="mb-1 block text-[11.5px] font-medium text-ink-700">
              Variables
            </span>
            {/*
              A <div role="button"> rather than a real <button> — the chips'
              own remove buttons live inside it, and a <button> cannot
              validly contain another <button> (invalid HTML that browsers
              silently un-nest, breaking both layout and the a11y tree).
            */}
            <div
              ref={triggerRef}
              role="button"
              tabIndex={0}
              onClick={() => setDropdownOpen((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  // Opens onto the search box (it autofocuses itself) rather
                  // than racing a ref lookup against the listbox's first
                  // paint — a second ArrowDown from there moves into the
                  // list once it actually exists in the DOM.
                  e.preventDefault();
                  setDropdownOpen(true);
                } else if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setDropdownOpen((v) => !v);
                }
              }}
              aria-haspopup="listbox"
              aria-expanded={dropdownOpen}
              aria-controls="add-option-listbox"
              aria-labelledby="add-option-variables-label"
              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-hairline bg-surface px-3 py-2 text-left text-[13px] text-ink-900 outline-none focus-visible:border-brand-700 focus-visible:ring-2 focus-visible:ring-brand-700/15"
            >
              {selected.length ? (
                <span className="flex flex-1 flex-wrap gap-1">
                  {selected.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2 pr-0.5 text-[11.5px] font-medium text-brand-800"
                    >
                      {p.label}
                      <button
                        type="button"
                        aria-label={`Remove ${p.label}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(p.id);
                        }}
                        className="rounded-full p-1 text-brand-800 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                      >
                        <X className="h-2.5 w-2.5" aria-hidden />
                      </button>
                    </span>
                  ))}
                </span>
              ) : (
                <span className="flex-1 text-ink-400">Search and select variables…</span>
              )}
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
            </div>

            {dropdownOpen && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-hairline bg-surface shadow-lg">
                <label className="relative flex items-center border-b border-hairline">
                  <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-ink-400" />
                  <span className="sr-only">Search variables</span>
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        moveOption(null, "first");
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        moveOption(null, "last");
                      }
                    }}
                    placeholder="Search variables…"
                    className="w-full bg-transparent py-2 pl-8 pr-3 text-[13px] text-ink-900 outline-none"
                  />
                </label>
                <div
                  role="listbox"
                  id="add-option-listbox"
                  aria-labelledby="add-option-variables-label"
                  aria-multiselectable="true"
                  className="max-h-56 overflow-y-auto py-1"
                >
                  {results.length === 0 && (
                    <p className="px-3 py-2 text-[12px] text-ink-400">No variables match.</p>
                  )}
                  {results.map((p) => {
                    const active = selectedIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        ref={(el) => {
                          if (el) optionRefs.current.set(p.id, el);
                          else optionRefs.current.delete(p.id);
                        }}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => toggle(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            moveOption(p.id, 1);
                          } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            moveOption(p.id, -1);
                          } else if (e.key === "Home") {
                            e.preventDefault();
                            moveOption(null, "first");
                          } else if (e.key === "End") {
                            e.preventDefault();
                            moveOption(null, "last");
                          } else if (e.key === "Enter" || e.key === " ") {
                            // Toggle explicitly rather than leaning on native
                            // button activation — keeps selection
                            // deterministic and lets the list stay open and
                            // focused for picking the next variable.
                            e.preventDefault();
                            toggle(p.id);
                          }
                        }}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:bg-brand-50/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700",
                          active && "bg-brand-50/60",
                        )}
                      >
                        <span>
                          <span className="block font-medium text-ink-900">{p.label}</span>
                          <span className="block text-[11px] text-ink-500">{p.hint}</span>
                        </span>
                        {active && <Check className="h-3.5 w-3.5 shrink-0 text-brand-700" aria-hidden />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ---- field 2: one value row per selected variable ---- */}
          {selected.length > 0 && (
            <div className="space-y-2">
              <span className="block text-[11.5px] font-medium text-ink-700">Values</span>
              <div className="space-y-1.5">
                {selected.map((p) => {
                  const inputId = `add-option-value-${p.id}`;
                  return (
                    <div key={p.id} className="flex items-center gap-2">
                      <label htmlFor={inputId} className="w-[92px] shrink-0 truncate text-[12.5px] font-medium text-ink-700">
                        {p.label}
                      </label>
                      <input
                        id={inputId}
                        ref={(el) => {
                          if (el) valueInputRefs.current.set(p.id, el);
                          else valueInputRefs.current.delete(p.id);
                        }}
                        value={values[p.id] ?? ""}
                        onChange={(e) => setValueFor(p.id, e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && create()}
                        placeholder={placeholderFor(p.id)}
                        className="w-full rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-900 outline-none focus-visible:border-brand-700 focus-visible:ring-2 focus-visible:ring-brand-700/15"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ---- field 3: name for the resulting tab ---- */}
          {parsedByVariable.length > 0 && (
            <div>
              <label htmlFor={nameFieldId} className="mb-1 block text-[11.5px] font-medium text-ink-700">
                Option name
              </label>
              <input
                id={nameFieldId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder={suggestedName}
                className="w-full rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-900 outline-none focus-visible:border-brand-700 focus-visible:ring-2 focus-visible:ring-brand-700/15"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-ink-400" aria-live="polite">
              {!canCreate && "Select a variable and enter a value that parses to continue."}
            </p>
            <button
              type="button"
              onClick={create}
              disabled={!canCreate}
              className="shrink-0 rounded-md bg-brand-700 px-3.5 py-2 text-[12.5px] font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Create Option
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
