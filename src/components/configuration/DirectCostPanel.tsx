// DirectCostPanel — final section of the Configuration Workspace.
// Raw Material + Process + Packaging = Total Direct Manufacturing Cost.
// Deliberately excludes overheads, supplier margin, DBK, FX and selling price.

import { ArrowRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/fabricConfig";
import type { PhaseId, PhaseRollup } from "@/lib/configTree";

type Props = {
  phases: PhaseRollup[];
  directTotal: number;
  live: boolean;
  onJump: (phaseId: PhaseId, groupId?: string) => void;
};

export function DirectCostPanel({ phases, directTotal, live, onJump }: Props) {
  const costed = phases.filter((p) => p.amount > 0 || p.id !== "input");
  const max = Math.max(...costed.map((p) => p.amount), 0.0001);

  return (
    <div className="h-full overflow-y-auto bg-canvas px-6 py-6 lg:px-10">
      <div className="mx-auto max-w-[1080px]">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-semibold text-ink-900">Direct cost</h2>
            <p className="mt-0.5 max-w-[560px] text-[12.5px] leading-relaxed text-ink-500">
              Roll-up of everything configured in this workspace. Direct manufacturing cost only —
              overheads, supplier margin, duty drawback and pricing are handled outside configuration.
            </p>
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-[0.1em] text-ink-400">
              Total direct manufacturing cost
            </div>
            <div
              className={cn(
                "text-[34px] font-semibold leading-none tracking-tight tabular-nums transition-colors",
                live ? "text-brand-700" : "text-ink-900",
              )}
            >
              {inr(directTotal)}
            </div>
            <div className="mt-1 text-[11.5px] text-ink-400">per piece</div>
          </div>
        </header>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {costed
            .filter((p) => p.id !== "input")
            .map((p) => (
              <section
                key={p.id}
                className="rounded-xl border border-hairline bg-surface p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[13px] font-semibold text-ink-900">{p.label}</h3>
                  <span className="text-[15px] font-semibold tabular-nums text-ink-900">
                    {inr(p.amount)}
                  </span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-cfg"
                    style={{ width: `${Math.max((p.amount / max) * 100, 2)}%` }}
                  />
                </div>
                <dl className="mt-3 space-y-1.5">
                  {p.groups
                    .filter((g) => g.costed)
                    .map((g) => (
                      <button
                        key={g.id}
                        onClick={() => onJump(p.id, g.id)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left hover:bg-surface-alt"
                      >
                        <dt className="truncate text-[12.5px] text-ink-600">{g.label}</dt>
                        <dd className="shrink-0 text-[12.5px] tabular-nums text-ink-900">
                          {inr(g.amount)}
                        </dd>
                      </button>
                    ))}
                </dl>
                <button
                  onClick={() => onJump(p.id)}
                  className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-medium text-brand-700 hover:underline"
                >
                  Open {p.label} <ArrowRight className="h-3 w-3" />
                </button>
              </section>
            ))}
        </div>

        <div className="mt-5 rounded-xl border border-hairline bg-surface p-4">
          <dl className="space-y-2 text-[13px]">
            {costed
              .filter((p) => p.id !== "input")
              .map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3">
                  <dt className="text-ink-600">{p.label} subtotal</dt>
                  <dd className="tabular-nums text-ink-900">{inr(p.amount)}</dd>
                </div>
              ))}
            <div className="flex items-center justify-between gap-3 border-t border-hairline pt-2.5 text-[15px] font-semibold">
              <dt className="text-ink-900">Total direct manufacturing cost</dt>
              <dd className="tabular-nums text-ink-900">{inr(directTotal)}</dd>
            </div>
          </dl>
          <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            No overhead %, supplier margin, testing / certification %, DBK, provisions, FX conversion
            or selling price is applied in this workspace.
          </p>
        </div>
      </div>
    </div>
  );
}
