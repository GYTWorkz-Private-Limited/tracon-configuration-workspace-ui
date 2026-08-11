// LiveCostingRail — the costing companion that lives inside the Configuration
// workspace. It re-reads every phase / group as the user edits, so there is no
// separate "Costing" destination any more.

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { inr } from "@/lib/fabricConfig";
import type { PhaseId, PhaseRollup } from "@/lib/configTree";

type Props = {
  /** per-piece roll-up of every phase and its groups */
  phases: PhaseRollup[];
  /** raw material + process + packaging */
  directTotal: number;
  /** flash the numbers right after an edit */
  live: boolean;
  activePhase: PhaseId;
  activeGroupId?: string;
  onJump: (phaseId: PhaseId, groupId?: string) => void;
  /** open the direct-cost roll-up */
  onOpenSummary: () => void;
  /** narrow strip mode so an editing panel can share the space */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

export function LiveCostingRail({
  phases,
  directTotal,
  live,
  activePhase,
  activeGroupId,
  onJump,
  onOpenSummary,
  collapsed = false,
  onToggleCollapse,
}: Props) {
  const [openMix, setOpenMix] = useState(true);

  const costedPhases = phases.filter((p) => p.id !== "input");
  const maxAmount = Math.max(...costedPhases.map((p) => p.amount), 0.0001);
  const rawTotal = phases.find((p) => p.id === "raw")?.amount ?? 0;

  if (collapsed) {
    return (
      <aside className="flex h-full w-full flex-col items-center gap-3 border-l border-hairline bg-surface py-3">
        <button
          onClick={onToggleCollapse}
          aria-label="Expand live costing"
          className="rounded-md p-1.5 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <div
          className={cn("h-2 w-2 rounded-full", live ? "animate-pulse bg-brand-700" : "bg-ink-300")}
          aria-hidden
        />
        <div
          className={cn(
            "mt-1 [writing-mode:vertical-rl] text-[13px] font-semibold tabular-nums tracking-tight",
            live ? "text-brand-700" : "text-ink-900",
          )}
        >
          {inr(directTotal)}
        </div>
        <div className="[writing-mode:vertical-rl] text-[10px] uppercase tracking-[0.14em] text-ink-400">
          Direct cost
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col border-l border-hairline bg-surface">
      {/* Live direct cost */}
      <div className="shrink-0 border-b border-hairline px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            Live costing
          </span>
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                live ? "bg-brand-50 text-brand-700" : "bg-surface-alt text-ink-400",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  live ? "animate-pulse bg-brand-700" : "bg-ink-300",
                )}
                aria-hidden
              />
              {live ? "updating" : "in sync"}
            </span>
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                aria-label="Collapse live costing"
                className="rounded-md p-1 text-ink-400 hover:bg-surface-alt hover:text-ink-900"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 text-[11px] text-ink-400">Direct cost / piece</div>
        <div
          className={cn(
            "text-[30px] font-semibold leading-none tracking-tight tabular-nums transition-colors",
            live ? "text-brand-700" : "text-ink-900",
          )}
        >
          {inr(directTotal)}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {costedPhases.map((p) => (
            <Tile key={p.id} label={p.label} value={inr(p.amount)} />
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Phase / group mix */}
        <Section
          title="Direct cost by section"
          open={openMix}
          onToggle={() => setOpenMix((v) => !v)}
          right={inr(directTotal)}
        >
          <div className="space-y-3">
            {costedPhases.map((p) => (
              <div key={p.id}>
                <button
                  onClick={() => onJump(p.id)}
                  className={cn(
                    "w-full rounded-lg px-2 py-1.5 text-left transition-colors",
                    p.id === activePhase ? "bg-brand-50" : "hover:bg-surface-alt",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-[12.5px] font-medium",
                        p.id === activePhase ? "text-brand-700" : "text-ink-800",
                      )}
                    >
                      {p.label}
                    </span>
                    <span className="shrink-0 text-[12.5px] tabular-nums text-ink-900">
                      {inr(p.amount)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink-100">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        p.id === activePhase ? "bg-brand-700" : "bg-cfg",
                      )}
                      style={{ width: `${Math.max((p.amount / maxAmount) * 100, 2)}%` }}
                    />
                  </div>
                </button>

                <div className="mt-1 space-y-0.5 pl-2">
                  {p.groups
                    .filter((g) => g.costed)
                    .map((g) => (
                      <button
                        key={g.id}
                        onClick={() => onJump(p.id, g.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left",
                          g.id === activeGroupId && p.id === activePhase
                            ? "bg-brand-50 text-brand-700"
                            : "text-ink-500 hover:bg-surface-alt",
                        )}
                      >
                        <span className="truncate text-[12px]">{g.label}</span>
                        <span className="shrink-0 text-[12px] tabular-nums">{inr(g.amount)}</span>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Roll-up */}
        <div className="border-b border-hairline px-4 py-3">
          <dl className="space-y-1.5 text-[12.5px]">
            {costedPhases.map((p) => (
              <Row key={p.id} label={`${p.label} subtotal`} value={inr(p.amount)} />
            ))}
            <div className="flex items-center justify-between gap-2 border-t border-hairline pt-1.5 text-[13px] font-semibold">
              <dt className="text-ink-900">Direct manufacturing cost</dt>
              <dd className="tabular-nums text-ink-900">{inr(directTotal)}</dd>
            </div>
          </dl>
        </div>

        <div className="px-4 py-3">
          <div className="rounded-lg bg-brand-50 p-3">
            <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-brand-700">
              <Sparkles className="h-3 w-3" /> Live read
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-600">
              Raw material drives{" "}
              {directTotal > 0 ? `${((rawTotal / directTotal) * 100).toFixed(0)}%` : "—"} of the
              direct cost. Any change you make in a section lands here instantly.
            </p>
          </div>

          <button
            onClick={onOpenSummary}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[12.5px] font-medium text-ink-700 hover:bg-surface-alt"
          >
            <TrendingUp className="h-3.5 w-3.5" /> Open direct cost roll-up
          </button>
        </div>
      </div>
    </aside>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-alt px-2.5 py-1.5">
      <div className="truncate text-[10px] uppercase tracking-[0.08em] text-ink-400">{label}</div>
      <div className="text-[14px] font-semibold tabular-nums text-ink-900">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-ink-500">{label}</dt>
      <dd className="tabular-nums text-ink-900">{value}</dd>
    </div>
  );
}

function Section({
  title,
  right,
  open,
  onToggle,
  children,
}: {
  title: string;
  right?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-hairline">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-surface-alt"
      >
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {title}
        </span>
        {right && <span className="text-[12px] tabular-nums text-ink-700">{right}</span>}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}
