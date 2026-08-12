// Scenario · Variant · Option, told apart at a glance.
//
// These three are NOT three products. A scenario is a whole costing position,
// a variant is a way of building the product inside it, and an option is one
// parameter changed inside a variant. The quotation has to make that hierarchy
// obvious, so each level gets its own shape, colour and prefix — and options
// are drawn indented under the variant they branched off.

import { GitBranch, Layers, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuildRef } from "@/lib/costingSelectionStore";
import type { Scenario } from "@/lib/scenarios";

export function ScenarioChip({ scenario, className }: { scenario: Scenario; className?: string }) {
  return (
    <span
      title={`Scenario — ${scenario.subtitle}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-brand-700 px-2 py-0.5 text-[10.5px] font-semibold text-white",
        className,
      )}
    >
      <Layers className="h-3 w-3" aria-hidden />
      {scenario.name}
    </span>
  );
}

export function BuildChip({ build, className }: { build: BuildRef; className?: string }) {
  const isOption = build.kind === "option";
  return (
    <span
      title={
        isOption
          ? "Option — one parameter changed inside the variant"
          : "Variant — a way of building this product"
      }
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
        isOption
          ? "border-ink-200 bg-surface text-ink-700"
          : "border-[var(--color-cfg)] bg-[var(--color-cfg-soft)] text-[var(--color-cfg-strong)]",
        className,
      )}
    >
      {isOption ? (
        <SlidersHorizontal className="h-3 w-3" aria-hidden />
      ) : (
        <GitBranch className="h-3 w-3" aria-hidden />
      )}
      <span className="text-ink-400">{isOption ? "Option" : "Variant"}</span>
      <span aria-hidden>·</span>
      {build.name}
    </span>
  );
}

/**
 * The full configuration of one quoted line, in hierarchy order.
 * Reads as: this scenario, built this way, with this parameter changed.
 */
export function ConfigChips({
  scenario,
  build,
  parentBuild,
  moq,
  size,
  className,
}: {
  scenario: Scenario;
  build: BuildRef;
  /** the variant an option branched off, so the nesting is visible */
  parentBuild?: BuildRef;
  moq?: number;
  size?: string;
  className?: string;
}) {
  return (
    <span className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <ScenarioChip scenario={scenario} />
      {parentBuild && build.kind === "option" && (
        <>
          <BuildChip build={parentBuild} />
          <span className="text-ink-300" aria-hidden>
            ›
          </span>
        </>
      )}
      <BuildChip build={build} />
      {size && (
        <span className="rounded bg-surface-alt px-1.5 py-0.5 text-[10.5px] text-ink-600">
          {size}
        </span>
      )}
      {moq !== undefined && (
        <span className="rounded bg-surface-alt px-1.5 py-0.5 text-[10.5px] tabular-nums text-ink-600">
          MOQ {moq.toLocaleString("en-IN")}
        </span>
      )}
    </span>
  );
}

/** Legend explaining the three levels — shown once, at the top of the quote. */
export function ConfigLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-ink-500",
        className,
      )}
    >
      <span className="font-medium text-ink-700">How to read a line:</span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-brand-700" aria-hidden />
        <strong className="font-semibold text-ink-700">Scenario</strong> — a whole costing position
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-full border-2 border-[var(--color-cfg)] bg-[var(--color-cfg-soft)]"
          aria-hidden
        />
        <strong className="font-semibold text-ink-700">Variant</strong> — a way of building it
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full border-2 border-ink-200 bg-surface" aria-hidden />
        <strong className="font-semibold text-ink-700">Option</strong> — one parameter changed
        inside a variant
      </span>
    </div>
  );
}
