/**
 * The template step of the entry flow, rendered wherever a POD is shown:
 *
 *   no template  →  amber prompt with the template library, pick one, Apply
 *   template set →  slim strip restating the pinned numbers, Change / Remove
 *
 * The prompt is deliberately loud (amber) and the confirmation deliberately
 * quiet: an unmapped POD is a risk — costings built under it can miss whole
 * commercial components — while a mapped one just needs its numbers visible.
 */

import { useState } from "react";
import { Check, ClipboardList, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TEMPLATES,
  clearTemplateFor,
  setTemplateFor,
  useTemplateFor,
  type CostTemplate,
} from "@/lib/costTemplates";

const pct = (n: number) => `${n}%`;
const inr = (n: number) => `₹${n % 1 === 0 ? n : n.toFixed(2)}`;

export function TemplateMappingCard({
  podId,
  buyer,
  compact,
}: {
  podId: string;
  buyer?: string;
  compact?: boolean;
}) {
  const mapped = useTemplateFor(podId);
  const [choosing, setChoosing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const closeChooser = () => {
    setChoosing(false);
    setSelected(null);
  };

  if (mapped && !choosing) {
    return <MappedStrip template={mapped} onChange={() => setChoosing(true)} podId={podId} />;
  }

  // Compact placements (tight headers) stay one line until asked — the full
  // library only unfolds on an explicit "Choose".
  if (compact && !choosing) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] text-amber-900">
        <ClipboardList className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 truncate font-medium">No cost template mapped</span>
        <button
          onClick={() => setChoosing(true)}
          className="ml-auto shrink-0 rounded-md border border-amber-200 bg-surface px-2 py-0.5 text-[11.5px] font-medium text-amber-900 hover:bg-surface-alt"
        >
          Choose
        </button>
      </div>
    );
  }

  // Matching-buyer templates lead the list because they are almost always the
  // right answer — the general fallback should take deliberate scrolling past
  // the buyer's own agreed structure. Array.sort is stable, so the seeded
  // order survives within each group.
  const matches = (t: CostTemplate) => t.kind === "buyer" && !!buyer && t.buyer === buyer;
  const ordered = [...TEMPLATES].sort((a, b) => Number(matches(b)) - Number(matches(a)));
  // Preselect the buyer's own template (or the current one when re-choosing)
  // so the common case is a single Apply click.
  const effective = selected ?? mapped?.id ?? ordered.find(matches)?.id ?? null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
      <div className="flex items-start gap-2">
        <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-amber-900" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-amber-900">Map a cost template</div>
          <p className="mt-0.5 text-[12px] text-amber-900/80">
            The template pins this order's commercial structure — overheads, freight, finance,
            testing, special packing — so no cost component is missed or under-applied.
          </p>
        </div>
        {choosing && (
          <button
            onClick={closeChooser}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-amber-900/70 hover:bg-amber-100 hover:text-amber-900"
            aria-label="Close template chooser"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="mt-3 space-y-1.5" role="radiogroup" aria-label="Cost templates">
        {ordered.map((t) => (
          <TemplateRow
            key={t.id}
            template={t}
            matchesBuyer={matches(t)}
            selected={effective === t.id}
            onSelect={() => setSelected(t.id)}
          />
        ))}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          disabled={!effective}
          onClick={() => {
            if (!effective) return;
            setTemplateFor(podId, effective);
            closeChooser();
          }}
          className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-brand-800 disabled:opacity-40"
        >
          <Check className="h-3 w-3" /> Apply template
        </button>
      </div>
    </div>
  );
}

function TemplateRow({
  template: t,
  matchesBuyer,
  selected,
  onSelect,
}: {
  template: CostTemplate;
  matchesBuyer: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border px-3 py-2 text-left transition-colors",
        selected
          ? "border-brand-700/50 bg-surface ring-1 ring-brand-700/30"
          : "border-hairline bg-surface hover:bg-surface-alt",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-brand-700" : "border-ink-300",
          )}
        >
          {selected && <span className="h-2 w-2 rounded-full bg-brand-700" />}
        </span>
        <span className="text-[12.5px] font-semibold text-ink-900">{t.name}</span>
        <KindPill kind={t.kind} />
        {matchesBuyer && (
          <span className="rounded-full bg-brand-700 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-white">
            Matches buyer
          </span>
        )}
        <span className="ml-auto hidden text-[11px] text-ink-500 sm:block">{t.description}</span>
      </div>
      <div className="mt-1 pl-5.5 text-[11.5px] text-ink-700 tabular-nums">
        Overheads {pct(t.overheadPct)} · Freight {pct(t.freightPct)} · Finance {pct(t.financePct)} ·
        Testing {pct(t.testingPct)} · Special pack {inr(t.specialPackInr)}
        <span className="text-ink-500">/pc</span>
      </div>
      {t.notes && t.notes.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-5.5">
          {t.notes.map((n) => (
            <li key={n} className="text-[10.5px] text-ink-500">
              • {n}
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}

function MappedStrip({
  podId,
  template: t,
  onChange,
}: {
  podId: string;
  template: CostTemplate;
  onChange: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-hairline bg-surface px-3 py-1.5">
      <Check className="h-3.5 w-3.5 shrink-0 text-brand-700" />
      <span className="text-[12.5px] font-semibold text-ink-900">{t.name}</span>
      <KindPill kind={t.kind} />
      <span className="min-w-0 truncate text-[11.5px] text-ink-500 tabular-nums">
        Overheads {pct(t.overheadPct)} · Freight {pct(t.freightPct)} · Finance {pct(t.financePct)} ·
        Testing {pct(t.testingPct)} · Special pack {inr(t.specialPackInr)}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-1">
        <button
          onClick={onChange}
          className="rounded-md border border-hairline bg-surface px-2 py-0.5 text-[11.5px] text-ink-700 hover:bg-surface-alt"
        >
          Change
        </button>
        <button
          onClick={() => clearTemplateFor(podId)}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-500 hover:bg-surface-alt hover:text-ink-900"
          aria-label="Remove template mapping"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    </div>
  );
}

function KindPill({ kind }: { kind: CostTemplate["kind"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em]",
        kind === "buyer"
          ? "bg-brand-50 text-brand-700 ring-1 ring-brand-700/25"
          : "bg-ink-100 text-ink-700",
      )}
    >
      {kind === "buyer" ? "Buyer" : "General"}
    </span>
  );
}
