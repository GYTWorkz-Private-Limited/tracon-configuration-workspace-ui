/**
 * Where did this number come from?
 *
 * Pre-costing pulls values from three genuinely different places, and the
 * costing team is accountable for the difference: a master figure is safe to
 * trust, a buyer-specific one carries an agreement behind it, and a manually
 * configured one has nobody but the person typing it standing behind it.
 * Stating that on every surface — rather than implying it by where a value
 * happens to sit — is a product principle, so it gets one shared chip and one
 * legend instead of four ad-hoc phrasings.
 */

import { cn } from "@/lib/utils";

export type Provenance = "master" | "customer" | "manual";

const LABEL: Record<Provenance, string> = {
  master: "Inherited from Master",
  customer: "Customer-Specific",
  manual: "Manually Configured",
};

const TONE: Record<Provenance, string> = {
  master: "bg-ink-100 text-ink-700",
  customer: "bg-brand-50 text-brand-700 ring-1 ring-brand-700/25",
  manual: "bg-amber-50 text-amber-900 ring-1 ring-amber-200",
};

export function ProvenanceChip({
  kind,
  className,
  /** a shorter form for dense rows, where the full sentence would wrap */
  short,
}: {
  kind: Provenance;
  className?: string;
  short?: boolean;
}) {
  const text = short
    ? LABEL[kind].replace("Inherited from ", "").replace(" Configured", "")
    : LABEL[kind];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em]",
        TONE[kind],
        className,
      )}
    >
      {text}
    </span>
  );
}

/** Shown once per flow — the chips are only readable if the key is nearby. */
export function ProvenanceLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      <span className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-ink-400">
        Provenance
      </span>
      {(["master", "customer", "manual"] as Provenance[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1">
          <ProvenanceChip kind={k} />
        </span>
      ))}
    </div>
  );
}
