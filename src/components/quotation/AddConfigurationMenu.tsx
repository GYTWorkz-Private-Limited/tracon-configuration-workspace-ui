// The "+" on a quoted product.
//
// It offers the scenarios that ALREADY EXIST for this article in Configuration
// & Costing — not a new list invented by the quotation — plus the escape hatch
// to create one without leaving the screen. A scenario created here lands in
// the same store Configuration reads, so the two screens keep one list.

import { useEffect, useRef, useState } from "react";
import { Check, Layers, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SCENARIO_PRESETS, type Scenario } from "@/lib/scenarios";
import type { BuildRef } from "@/lib/costingSelectionStore";

export function AddConfigurationMenu({
  scenarios,
  builds,
  usedKeys,
  onAdd,
  onCreateScenario,
  label = "Add scenario / variant",
}: {
  /** scenarios open for this article in Configuration */
  scenarios: Scenario[];
  /** variants and options open for this article */
  builds: BuildRef[];
  /** `${scenarioId}::${buildId}` already on the quote — offered but marked */
  usedKeys: Set<string>;
  onAdd: (input: { scenarioId: string; buildId: string }) => void;
  onCreateScenario: (scenario: Scenario) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [buildId, setBuildId] = useState(builds[0]?.id ?? "BASE");
  const [dropUp, setDropUp] = useState(false);
  const [maxHeight, setMaxHeight] = useState(380);
  const ref = useRef<HTMLDivElement>(null);

  // The trigger sits at the bottom edge of a card inside a scrolling page, so
  // a menu that always dropped downward would be cut off. Open it towards
  // whichever side has more room, and cap its height to that room so it can
  // never be clipped at either end.
  useEffect(() => {
    if (!open || !ref.current) return;
    const { top, bottom } = ref.current.getBoundingClientRect();
    const below = window.innerHeight - bottom;
    const up = below < 380 && top > below;
    setDropUp(up);
    setMaxHeight(Math.max(220, (up ? top : below) - 24));
  }, [open, creating]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The build list is rebuilt whenever Configuration publishes; keep the
  // picker pointed at something that still exists.
  useEffect(() => {
    if (!builds.some((b) => b.id === buildId)) setBuildId(builds[0]?.id ?? "BASE");
  }, [builds, buildId]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-ink-200 bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-600 transition-colors hover:border-brand-600 hover:bg-brand-50/50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden /> {label}
      </button>

      {open && (
        <div
          style={{ maxHeight }}
          className={cn(
            "absolute right-0 z-30 flex w-[340px] flex-col overflow-y-auto rounded-lg border border-hairline bg-surface shadow-lg",
            dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          {creating ? (
            <CreateScenarioForm
              onCancel={() => setCreating(false)}
              onCreate={(s) => {
                onCreateScenario(s);
                onAdd({ scenarioId: s.id, buildId });
                setCreating(false);
                setOpen(false);
              }}
            />
          ) : (
            <>
              <div className="border-b border-hairline px-3 py-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500">
                  Existing scenarios
                </h4>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  Already costed for this article in Configuration.
                </p>
              </div>

              {builds.length > 1 && (
                <div className="border-b border-hairline px-3 py-2">
                  <label
                    htmlFor="add-build"
                    className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-500"
                  >
                    Build
                  </label>
                  <select
                    id="add-build"
                    value={buildId}
                    onChange={(e) => setBuildId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12px] text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
                  >
                    {builds.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.kind === "option" ? "Option" : "Variant"} · {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <ul className="max-h-[260px] overflow-y-auto py-1">
                {scenarios.map((s) => {
                  const used = usedKeys.has(`${s.id}::${buildId}`);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onAdd({ scenarioId: s.id, buildId });
                          setOpen(false);
                        }}
                        className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700"
                      >
                        <Layers
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700"
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[12.5px] font-medium text-ink-900">
                            {s.name}
                          </span>
                          <span className="block text-[11px] text-ink-500">{s.subtitle}</span>
                        </span>
                        {used && (
                          <span className="mt-0.5 flex shrink-0 items-center gap-1 text-[10.5px] text-brand-700">
                            <Check className="h-3 w-3" aria-hidden /> on quote
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="border-t border-hairline p-2">
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[12.5px] font-medium text-brand-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Create New Scenario
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A scenario is a set of overrides on the base build, so creating one is a
 * matter of naming it and picking what it changes — not rebuilding the
 * product. Anything left alone is inherited from the base costing.
 */
function CreateScenarioForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (s: Scenario) => void;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [basedOn, setBasedOn] = useState("");
  const [margin, setMargin] = useState("");

  const preset = SCENARIO_PRESETS.find((s) => s.id === basedOn);

  // `autoFocus` would scroll the whole page to reach the field; this focuses it
  // where it already is.
  useEffect(() => {
    nameRef.current?.focus({ preventScroll: true });
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const marginPct = Number(margin);
    onCreate({
      id: `SCN-Q-${Date.now().toString(36).toUpperCase()}`,
      name: trimmed,
      subtitle: subtitle.trim() || "Created in Quotation",
      parameters: preset?.parameters ?? {},
      fabricMasterId: preset?.fabricMasterId,
      commercial: {
        ...(preset?.commercial ?? {}),
        ...(Number.isFinite(marginPct) && margin.trim() !== ""
          ? { targetMarginPct: marginPct }
          : {}),
      },
    });
  };

  return (
    <form onSubmit={submit} className="p-3">
      <div className="flex items-center gap-2">
        <h4 className="flex-1 text-[12.5px] font-semibold text-ink-900">New scenario</h4>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="rounded p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-0.5 text-[11px] text-ink-500">
        Overrides the base costing. Anything you leave alone is inherited.
      </p>

      <Field label="Name" htmlFor="scn-name">
        <input
          id="scn-name"
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Volume 7,500"
          className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
        />
      </Field>

      <Field label="Description" htmlFor="scn-sub">
        <input
          id="scn-sub"
          value={subtitle}
          onChange={(e) => setSubtitle(e.target.value)}
          placeholder="One line — what this position is"
          className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12.5px] text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
        />
      </Field>

      <Field label="Start from" htmlFor="scn-base">
        <select
          id="scn-base"
          value={basedOn}
          onChange={(e) => setBasedOn(e.target.value)}
          className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12.5px] text-ink-900 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
        >
          <option value="">Base costing — no overrides</option>
          {SCENARIO_PRESETS.filter((s) => !s.isBase).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.subtitle}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Target margin %" htmlFor="scn-margin" optional>
        <input
          id="scn-margin"
          type="number"
          step="0.5"
          value={margin}
          onChange={(e) => setMargin(e.target.value)}
          placeholder="Inherit"
          className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[12.5px] tabular-nums text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
        />
      </Field>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-md border border-hairline bg-surface px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-surface-alt"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim()}
          className="flex-1 rounded-md bg-brand-700 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Create & add
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2.5">
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-500"
      >
        {label}
        {optional && (
          <span className="ml-1 normal-case tracking-normal text-ink-300">optional</span>
        )}
      </label>
      {children}
    </div>
  );
}
