// ComponentInspector — the right column: configure a component, then read the
// full derivation of its cost.
//
// Four tabs in calculation order: CONFIGURE (what it is made of — a searchable
// list of option cards when the component carries a choice) → MATERIAL INFO
// (what the master says) → CONSUMPTION RULES (how much of it) → COSTING (what
// that comes to). Component identity sits ABOVE the tabs, so switching tabs
// never loses track of which component is being read.

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Lock,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MoneyFormatter } from "@/lib/money";
import {
  accessoryCost,
  finalOf,
  isOverridden,
  processCost,
  type ProcessItem,
  type ResolvedComponent,
  type SourceType,
  type SpecField,
} from "@/lib/costingModel";
import type { OptionGroup } from "@/lib/costLines";

/**
 * The component's configurable choice, moved off the sheet's row and into this
 * panel: the option cards the reference design shows, staged behind an Apply.
 */
export type InspectorPicker = {
  group: OptionGroup;
  onPick: (optionId: string) => void;
};

type Props = {
  resolved: ResolvedComponent | null;
  productName: string;
  scenarioName: string;
  money: MoneyFormatter;
  /** present when this component's option can be changed from here */
  picker?: InspectorPicker;
  onClose: () => void;
};

/** The panel's four views, in calculation order. */
const TABS = [
  { id: "configure", label: "Configure" },
  { id: "material", label: "Material Info" },
  { id: "consumption", label: "Consumption Rules" },
  { id: "costing", label: "Costing" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ComponentInspector({
  resolved,
  productName,
  scenarioName,
  money,
  picker,
  onClose,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [tab, setTab] = useState<TabId>("configure");

  useEffect(() => {
    if (!resolved) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [resolved, onClose]);

  // A different component starts on Configure, scrolled to the top —
  // carrying the previous component's tab and position over would land
  // mid-way through an unrelated reading.
  useEffect(() => {
    setTab("configure");
    scrollRef.current?.scrollTo({ top: 0 });
  }, [resolved?.component.id]);

  // Switching tabs also starts at the top of the new one.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  if (!resolved) return null;
  const { component: c, material } = resolved;

  return (
    <aside
      role="region"
      aria-label={`${c.name} component details`}
      className="flex h-full w-[380px] shrink-0 flex-col border-l border-hairline bg-surface"
    >
      {/* ---- identity, above the tabs ---- */}
      <header className="shrink-0 border-b border-hairline px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-[14px] font-semibold text-ink-900">{c.name}</h2>
              <RequiredPill required={c.required} />
            </div>
            <p className="mt-0.5 truncate text-[11px] text-ink-500">
              Component #{c.sequence} · {c.usage}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close component details"
            title="Close (Esc)"
            className="shrink-0 rounded-md p-1 text-ink-400 transition-colors hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 truncate text-[10.5px] text-ink-400">
          {productName} · {scenarioName} · {material?.name ?? "Process only"}
        </p>
      </header>

      {/* ---- the four views, in calculation order: what it is made of →
              what the master says → how much of it → what that comes to ---- */}
      <nav
        role="tablist"
        aria-label="Component views"
        className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-hairline px-2"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "whitespace-nowrap border-b-2 px-2.5 py-2 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700",
              tab === t.id
                ? "border-brand-700 font-semibold text-ink-900"
                : "border-transparent text-ink-500 hover:text-ink-900",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {tab === "configure" &&
          (picker ? (
            <OptionCards key={c.id} componentName={c.name} picker={picker} onClose={onClose} />
          ) : (
            <ConfigureTab resolved={resolved} />
          ))}
        {tab === "material" && <MaterialTab resolved={resolved} money={money} />}
        {tab === "consumption" && <ConsumptionTab resolved={resolved} />}
        {tab === "costing" && <CostingTab resolved={resolved} money={money} />}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ *
 * The option picker — the sheet's dropdown, grown into cards
 * ------------------------------------------------------------------ */

/**
 * Every option the component can be, as a card: name, rate, spec line, with
 * the current selection ringed. The choice is STAGED — a click marks a card,
 * Apply commits it through the same store action the dropdown used — so
 * comparing five fabrics never re-costs the sheet five times on the way.
 */
function OptionCards({
  componentName,
  picker,
  onClose,
}: {
  componentName: string;
  picker: InspectorPicker;
  onClose: () => void;
}) {
  const { group, onPick } = picker;
  const currentId = group.selectedId;
  const [stagedId, setStagedId] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState("");
  const current = group.options.find((o) => o.id === currentId);
  const dirty = stagedId !== undefined && stagedId !== currentId;

  // The live selection moved — after our own Apply, or from another surface.
  // Either way the staging is void: a stale ring with an enabled Apply would
  // quietly revert somebody else's change.
  useEffect(() => {
    setStagedId(undefined);
  }, [currentId]);

  // The current selection stays visible even when the search would hide it —
  // a list that loses "what it is now" makes every comparison one-sided.
  const term = query.trim().toLowerCase();
  const visible = term
    ? group.options.filter(
        (o) =>
          o.id === currentId ||
          o.label.toLowerCase().includes(term) ||
          (o.detail ?? "").toLowerCase().includes(term),
      )
    : group.options;

  return (
    <div className="flex flex-col border-b border-hairline">
      {/* what is being chosen, and what it currently is */}
      <dl className="mx-4 mt-3 grid grid-cols-2 gap-3 rounded-lg bg-surface-alt px-3 py-2.5">
        <div>
          <dt className="text-[10.5px] text-ink-500">Component</dt>
          <dd className="mt-0.5 truncate text-[12.5px] font-medium text-ink-900">
            {componentName}
          </dd>
        </div>
        <div>
          <dt className="text-[10.5px] text-ink-500">Current selection</dt>
          <dd className="mt-0.5 truncate text-[12.5px] font-medium text-ink-900">
            {current?.label ?? "—"}
          </dd>
        </div>
      </dl>

      <p className="mx-4 mt-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-500">
        {group.label}
      </p>

      {/* the list is searchable — masters run long, and scrolling past forty
          fabrics to reach the one the mill quoted is not a comparison */}
      <label className="relative mx-4 mt-1.5 block">
        <span className="sr-only">Search {group.label.toLowerCase()} options</span>
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${group.label.toLowerCase()}…`}
          className="w-full rounded-md border border-hairline bg-surface py-1.5 pl-8 pr-2.5 text-[12px] text-ink-900 placeholder:text-ink-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-700/20"
        />
      </label>

      <div className="mx-4 mb-3 mt-1.5 space-y-1.5">
        {visible.length === 0 && (
          <p className="rounded-lg border border-dashed border-hairline px-3 py-4 text-center text-[11.5px] text-ink-500">
            Nothing matches “{query.trim()}”.
          </p>
        )}
        {visible.map((o) => {
          const isStaged = o.id === (stagedId ?? currentId);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setStagedId(o.id)}
              aria-pressed={isStaged}
              className={cn(
                "w-full rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700",
                isStaged
                  ? "border-brand-600 bg-brand-50/60 ring-1 ring-brand-600"
                  : "border-hairline bg-surface hover:bg-surface-alt",
              )}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  {isStaged && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-brand-700" strokeWidth={3} aria-hidden />
                  )}
                  <span className="truncate text-[13px] font-semibold text-ink-900">{o.label}</span>
                </span>
                <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-ink-900">
                  ₹{o.rate.toLocaleString("en-IN")}
                </span>
              </span>
              {o.detail && (
                <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-500">
                  {o.detail}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* the commit — nothing on the sheet moves until Apply */}
      <div className="flex items-center justify-between gap-2 border-t border-hairline bg-surface-alt/60 px-4 py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-hairline bg-surface px-4 py-1.5 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!dirty}
          onClick={() => stagedId && onPick(stagedId)}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
        >
          <Check className="h-3.5 w-3.5" aria-hidden /> Apply {group.label.toLowerCase()}
        </button>
      </div>
    </div>
  );
}

/**
 * The inspector shell for a line with a CHOICE but no component behind it —
 * packaging, carton and testing lines belong to the product, not to a
 * component, so they can never resolve in the rollup. Without this panel the
 * removal of the row dropdowns would have made their options unreachable.
 */
export function LineOptionPanel({
  title,
  context,
  picker,
  onClose,
}: {
  title: string;
  context?: string;
  picker: InspectorPicker;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      role="region"
      aria-label={`${title} options`}
      className="flex h-full w-[380px] shrink-0 flex-col border-l border-hairline bg-surface"
    >
      <header className="shrink-0 border-b border-hairline px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-semibold text-ink-900">{title}</h2>
            {context && <p className="mt-0.5 truncate text-[11px] text-ink-500">{context}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close options"
            title="Close (Esc)"
            className="shrink-0 rounded-md p-1 text-ink-400 transition-colors hover:bg-surface-alt hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <OptionCards key={title} componentName={title} picker={picker} onClose={onClose} />
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ *
 * A. CONFIGURE — pick what the component is made of
 * ------------------------------------------------------------------ */

function ConfigureTab({ resolved }: { resolved: ResolvedComponent }) {
  const { component: c, material } = resolved;
  const inherits = c.material?.relationship === "same-as-component";

  return (
    <>
      <Section title="Component Definition">
        <DefinitionFields resolved={resolved} />
      </Section>

      <div className="m-4 rounded-lg border border-hairline bg-surface-alt p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-700">
          <Lock className="h-3 w-3 shrink-0" aria-hidden />
          Configured on the sheet
        </p>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-600">
          {!material ? (
            <>
              This component has no material — its cost comes entirely from the processes applied to
              it. Select a process line on the sheet to change a step from this panel.
            </>
          ) : inherits ? (
            <>
              This slot is on{" "}
              <strong className="text-ink-900">{material.inheritedFrom ?? "its parent"}</strong>'s
              cloth. Select the parent's row on the sheet to change the fabric here, and this
              re-costs with it.
            </>
          ) : (
            <>
              <strong className="text-ink-900">{material.name}</strong> is selected from the
              Component Library. Every value below comes from that master — open the library to
              compare masters before you switch.
            </>
          )}
        </p>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * B. MATERIAL INFO
 * ------------------------------------------------------------------ */

function MaterialTab({ resolved, money }: { resolved: ResolvedComponent; money: MoneyFormatter }) {
  const { material, makingSpec } = resolved;

  if (!material) {
    return (
      <p className="px-4 py-6 text-[12px] text-ink-500">
        This component has no material — its cost is process only.
      </p>
    );
  }

  const m = material.master;
  return (
    <>
      <Section
        title="Material Information"
        badge={material.relationship === "same-as-component" ? "Inherited" : "From Master"}
      >
        {material.inheritedFrom && (
          <p className="mb-3 rounded-md bg-brand-50 px-3 py-2 text-[11px] leading-relaxed text-brand-800">
            Inherited from <strong>{material.inheritedFrom}</strong> — the relationship is stored,
            not a copy.
          </p>
        )}
        <FieldGrid>
          <Field label="Material" value={material.name} source="Material Master" />
          <Field label="Material Code" value={material.code} source="Material Master" />
          {m?.fabricType && <Field label="Fabric Type" value={m.fabricType} />}
          {m?.availability && <Field label="Availability" value={m.availability} />}
          {m?.construction && <Field label="Construction" value={m.construction} />}
          {m?.yarnCount && <Field label="Yarn Count" value={m.yarnCount} />}
          {m?.gsm !== undefined && <Field label="GSM" value={String(m.gsm)} />}
          {m?.composition && <Field label="Composition" value={m.composition} />}
          {m?.width !== undefined && <Field label="Width" value={`${m.width}"`} />}
          {m?.costingWidth !== undefined && (
            <Field label="Costing Width" value={`${m.costingWidth}"`} />
          )}
          {m?.colour && <Field label="Colour" value={m.colour} />}
          {m?.pantone && <Field label="Pantone" value={m.pantone} />}
          {m?.certification && <Field label="Certification" value={m.certification} span />}
          {m?.supplier && <Field label="Supplier" value={m.supplier} />}
          <Field
            label="Rate"
            value={`${money(finalOf(material.rate))} / ${material.rateUnit.replace("per ", "")}`}
            source={isOverridden(material.rate) ? "Costing Override" : "Rate Master"}
          />
        </FieldGrid>
        {m && (
          <button
            type="button"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-1.5 text-[11.5px] font-medium text-brand-700 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-700"
          >
            View Material Master <ExternalLink className="h-3 w-3" />
          </button>
        )}
      </Section>

      {makingSpec && makingSpec.fields.length > 0 && (
        <Section title="Making Specification" badge="From Master">
          <FieldGrid>
            {makingSpec.fields.map((f) => (
              <Field
                key={f.label}
                label={f.label}
                value={`${f.value}${f.unit ? ` ${f.unit}` : ""}`}
                source={f.source}
              />
            ))}
          </FieldGrid>
        </Section>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * C. CONSUMPTION RULES
 * ------------------------------------------------------------------ */

function ConsumptionTab({ resolved }: { resolved: ResolvedComponent }) {
  const rule = resolved.consumptionRule;
  const c = resolved.component;

  if (!rule) {
    return (
      <p className="px-4 py-6 text-[12px] text-ink-500">
        No consumption rule — this component does not consume material.
      </p>
    );
  }

  return (
    <Section title="Consumption Rule" badge={rule.source}>
      <FieldGrid>
        <Field label="Calculation Method" value={rule.method} />
        {rule.finishedWidth !== undefined && (
          <Field
            label="Finished Size (W × L)"
            value={`${rule.finishedWidth}" × ${rule.finishedLength}"`}
          />
        )}
        {rule.fabricWidth !== undefined && (
          <Field label="Fabric Width Used" value={`${rule.fabricWidth}"`} />
        )}
        {rule.seamAllowance !== undefined && (
          <Field
            label="Seam / Hem Allowance"
            value={`+${rule.seamAllowance}" / +${rule.hemAllowance ?? 0}"`}
          />
        )}
        <Field label="Shrinkage" value={`${rule.shrinkagePct ?? 0}%`} />
        <Field label="Wastage" value={`${rule.wastagePct}%`} />
        {rule.markerEfficiency !== undefined && (
          <Field label="Marker Efficiency" value={`${Math.round(rule.markerEfficiency * 100)}%`} />
        )}
        {rule.plies !== undefined && rule.plies > 1 && (
          <Field label="Plies / Panels" value={String(rule.plies)} />
        )}
      </FieldGrid>

      <div className="mt-3 rounded-lg border border-hairline bg-surface-alt p-3">
        <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">
          Formula{" "}
          <span className="font-normal normal-case tracking-normal">({rule.formulaVersion})</span>
        </div>
        <code className="mt-1.5 block whitespace-pre-wrap text-[11px] leading-relaxed text-ink-900">
          {rule.formula}
        </code>
      </div>

      <div className="mt-2 flex items-baseline justify-between rounded-lg bg-brand-50 px-3 py-2.5">
        <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-brand-800">
          Calculated
        </span>
        <span className="text-[14px] font-semibold tabular-nums text-brand-800">
          {resolved.consumptionPerOccurrence.toFixed(3)} {rule.unit} / occ.
        </span>
      </div>
      {c.quantity > 1 && (
        <p className="mt-1.5 text-[11px] text-ink-500">
          × {c.quantity} occurrences ={" "}
          <strong className="tabular-nums text-ink-900">
            {resolved.consumptionPerPiece.toFixed(3)} {rule.unit} / pc
          </strong>
        </p>
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ *
 * D. COSTING — processes, trims, the total, and every override
 * ------------------------------------------------------------------ */

function CostingTab({ resolved, money }: { resolved: ResolvedComponent; money: MoneyFormatter }) {
  return (
    <>
      {resolved.processes.length > 0 && (
        <Section title={`Processes Applied (${resolved.processes.length})`}>
          <ProcessChain processes={resolved.processes} money={money} />
        </Section>
      )}

      {resolved.accessories.length > 0 && (
        <Section title={`Accessories / Trims (${resolved.accessories.length})`}>
          <div className="space-y-2">
            {resolved.accessories.map((a) => (
              <div
                key={a.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-hairline p-3"
              >
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-ink-900">{a.name}</div>
                  <div className="mt-0.5 text-[10.5px] text-ink-500">{a.specification}</div>
                  <div className="mt-1 text-[10px] text-ink-400">
                    {a.accessoryType} · {a.quantity} × {money(finalOf(a.rate))}
                  </div>
                </div>
                <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink-900">
                  {money(accessoryCost(a))}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Costing & Rates">
        <div className="space-y-1.5">
          {resolved.consumptionRule && (
            <CostLine
              label="Consumption / pc"
              value={`${resolved.consumptionPerPiece.toFixed(3)} ${resolved.consumptionRule.unit}`}
            />
          )}
          {resolved.consumptionRule && (
            <CostLine label="Wastage" value={`${resolved.consumptionRule.wastagePct}%`} />
          )}
          {resolved.material && (
            <CostLine
              label="Rate"
              value={`${money(finalOf(resolved.material.rate))} / ${resolved.material.rateUnit.replace("per ", "")}`}
            />
          )}
          <div className="my-2 border-t border-hairline" />
          <CostLine label="Material cost" value={money(resolved.materialCost)} />
          <CostLine label="Process cost" value={money(resolved.processTotal)} />
          <CostLine label="Accessories / trims" value={money(resolved.accessoryTotal)} />
        </div>
        <div className="mt-3 flex items-baseline justify-between rounded-lg bg-brand-800 px-4 py-3">
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-white/80">
            Component Cost / pc
          </span>
          <span className="text-[17px] font-semibold tabular-nums text-white">
            {money(resolved.totalCost)}
          </span>
        </div>
      </Section>

      <Section title="Master Source & Overrides">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {sourcesUsed(resolved).map((s) => (
            <span
              key={s}
              className="rounded-full border border-hairline bg-surface-alt px-2 py-0.5 text-[10px] text-ink-600"
            >
              {s}
            </span>
          ))}
        </div>
        {resolved.overrides.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-ink-500">
            Every value comes straight from its master. No costing overrides are applied, and no
            master data has been altered.
          </p>
        ) : (
          <div className="space-y-2">
            {resolved.overrides.map((o) => (
              <div key={o.field} className="rounded-lg border border-gold-500/40 bg-gold-50 p-3">
                <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-900">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-gold-700" aria-hidden />
                  {o.field}
                  <span className="ml-auto shrink-0 rounded bg-gold-100 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-gold-700">
                    Override
                  </span>
                </div>
                <dl className="mt-2 space-y-1 text-[10.5px]">
                  <OverrideLine label="Master value" value={o.masterValue} />
                  <OverrideLine label="Override" value={o.overrideValue} />
                  <OverrideLine label="Final costing value" value={o.finalValue} strong />
                  {o.reason && <OverrideLine label="Reason" value={o.reason} />}
                </dl>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function ProcessChain({ processes, money }: { processes: ProcessItem[]; money: MoneyFormatter }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      {processes.map((p, i) => {
        const isOpen = open === p.id;
        return (
          <div key={p.id} className="rounded-lg border border-hairline">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : p.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-2 p-2.5 text-left transition-colors hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-700"
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[9.5px] font-semibold tabular-nums text-brand-700"
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-ink-900">
                  {p.name}
                </span>
                <span className="block truncate text-[10px] text-ink-500">
                  {p.quantity} {p.basis} × {money(finalOf(p.rate))}
                </span>
              </span>
              <span className="shrink-0 text-[12px] font-semibold tabular-nums text-ink-900">
                {money(processCost(p))}
              </span>
              {isOpen ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-400" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-400" />
              )}
            </button>
            {isOpen && (
              <div className="border-t border-hairline px-3 py-2.5">
                {p.description && (
                  <p className="mb-2 text-[10.5px] text-ink-500">{p.description}</p>
                )}
                <FieldGrid>
                  {p.params.map((f: SpecField) => (
                    <Field key={f.label} label={f.label} value={f.value} />
                  ))}
                  <Field label="Basis" value={p.basis} />
                  <Field
                    label="Rate"
                    value={`${money(finalOf(p.rate))} ${p.rateUnit}`}
                    source={isOverridden(p.rate) ? "Costing Override" : "Process Master"}
                  />
                </FieldGrid>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

function DefinitionFields({ resolved }: { resolved: ResolvedComponent }) {
  const c = resolved.component;
  return (
    <FieldGrid>
      <Field label="Type" value={c.type} />
      <Field label="Required" value={c.required ? "Required" : "Optional"} />
      <Field label="Quantity / Occurrence" value={String(c.quantity)} />
      <Field label="Usage / Position" value={c.usage} />
      <Field label="Description" value={c.description} span />
      {c.parentId && <Field label="Parent Component" value={c.parentId} />}
    </FieldGrid>
  );
}

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-hairline px-4 py-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-[12.5px] font-semibold text-ink-900">{title}</h3>
        {badge && (
          <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-brand-700">
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">{children}</dl>;
}

function Field({
  label,
  value,
  source,
  span,
}: {
  label: string;
  value: string;
  source?: SourceType;
  span?: boolean;
}) {
  return (
    <div className={cn("min-w-0", span && "col-span-2")}>
      <dt className="text-[9.5px] text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-[11.5px] font-medium text-ink-900">{value}</dd>
      {source && (
        <dd
          className={cn(
            "mt-0.5 inline-block rounded px-1 py-0.5 text-[8.5px] uppercase tracking-[0.06em]",
            source === "Costing Override"
              ? "bg-gold-100 text-gold-700"
              : "bg-surface-alt text-ink-400",
          )}
        >
          {source === "Costing Override" ? "Override" : `From ${source}`}
        </dd>
      )}
    </div>
  );
}

function CostLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11.5px]">
      <span className="text-ink-500">{label}</span>
      <span className="font-medium tabular-nums text-ink-900">{value}</span>
    </div>
  );
}

function OverrideLine({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-500">{label}</dt>
      <dd
        className={cn(
          "text-right tabular-nums",
          strong ? "font-semibold text-ink-900" : "text-ink-700",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function RequiredPill({ required }: { required: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-medium",
        required ? "bg-[#fbe6e2] text-[#8f2c22]" : "bg-gold-100 text-gold-700",
      )}
    >
      <span className={cn("h-1.5 w-1.5", required ? "rounded-full" : "rotate-45")} aria-hidden />
      {required ? "Required" : "Optional"}
    </span>
  );
}

/** Which masters actually fed this component — read off the data, not hardcoded. */
function sourcesUsed(resolved: ResolvedComponent): SourceType[] {
  const set = new Set<SourceType>();
  if (resolved.material) {
    set.add("Material Master");
    set.add(isOverridden(resolved.material.rate) ? "Costing Override" : "Rate Master");
  }
  if (resolved.makingSpec) set.add(resolved.makingSpec.source);
  if (resolved.consumptionRule) set.add("Consumption Rule");
  for (const p of resolved.processes) {
    set.add(isOverridden(p.rate) ? "Costing Override" : "Process Master");
  }
  for (const a of resolved.accessories) set.add(a.source);
  return [...set];
}
