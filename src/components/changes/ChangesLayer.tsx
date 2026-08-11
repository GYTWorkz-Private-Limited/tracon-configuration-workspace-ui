// ChangesLayer — global, route-independent layer for the Requested Changes
// workflow. Mounted once from __root so the fixed top actions and the
// persistent requested-changes dock stay consistent on Product,
// Configuration, Costing and Costing Report — and sit above any page drawer.

import { useEffect, useMemo, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Minus,
  MessageSquareWarning,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  closeChangesDock,
  completeApproval,
  expandChangesDock,
  markAllComplete,
  minimizeChangesDock,
  resubmitForApproval,
  setChangeStatus,
  stepForModule,
  useRequestedChanges,
  type ChangeStep,
  type RequestedChange,
} from "@/lib/requestedChangesStore";

import { RevisionHistoryModal } from "./RevisionHistoryModal";

const FLOW_ROUTES = ["/product/", "/config/", "/costing/", "/quotation/"];

/** Lets any module header open the revision modal without duplicating it. */
export const REVISION_HISTORY_EVENT = "tracon:open-revision-history";

export function ChangesLayer() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const s = useRequestedChanges();
  const [revisionsOpen, setRevisionsOpen] = useState(false);

  useEffect(() => {
    const open = () => setRevisionsOpen(true);
    window.addEventListener(REVISION_HISTORY_EVENT, open);
    return () => window.removeEventListener(REVISION_HISTORY_EVENT, open);
  }, []);

  const onFlowRoute = FLOW_ROUTES.some((p) => pathname.startsWith(p));

  const total = s.changes.length;
  const completed = s.changes.filter((c) => c.status === "Completed").length;
  const allDone = total > 0 && completed === total;

  // Each module renders its own grouped header actions (Revision history is the
  // only action added there once V2 starts), so this layer only owns the
  // persistent tray + the revision modal. Once everything is done and
  // resubmitted the store closes the dock, and the header button reopens it.
  const showTray = onFlowRoute && s.submitted && s.dockOpen;

  return (
    <>
      {showTray &&
        (s.dockMinimized ? (
          <MinimizedTray completed={completed} total={total} allDone={allDone} />
        ) : (
          <ChangesDock completed={completed} total={total} allDone={allDone} />
        ))}

      {revisionsOpen && <RevisionHistoryModal onClose={() => setRevisionsOpen(false)} />}
    </>
  );
}

/* --------------------------- minimized bottom strip --------------------------- */

function MinimizedTray({
  completed,
  total,
  allDone,
}: {
  completed: number;
  total: number;
  allDone: boolean;
}) {
  const pending = total - completed;
  return (
    <div className="fixed bottom-4 left-1/2 z-[86] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border border-hairline bg-white px-3 py-2 shadow-[0_10px_30px_rgba(16,24,40,0.16)]">
        <MessageSquareWarning
          className={cn("h-4 w-4", allDone ? "text-brand-700" : "text-red-600")}
        />
        <span className="text-[12.5px] font-semibold text-ink-900">Requested changes</span>
        <span className="h-4 w-px bg-hairline" />
        <span className="text-[12px] tabular-nums text-ink-600">
          <span className="font-semibold text-red-600">{pending}</span> pending ·{" "}
          <span className="font-semibold text-brand-700">{completed}</span> done · {total} total
        </span>
        <button
          onClick={expandChangesDock}
          aria-label="Expand requested changes"
          className="rounded-full p-1 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          onClick={closeChangesDock}
          aria-label="Close requested changes"
          className="rounded-full p-1 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* --------------------- persistent bottom-right tray --------------------- */

function ChangesDock({
  completed,
  total,
  allDone,
}: {
  completed: number;
  total: number;
  allDone: boolean;
}) {
  const { changes, workingVersion, approvalDone } = useRequestedChanges();
  const ordered = useMemo(
    () =>
      [...changes].sort(
        (a, b) => (a.status === "Pending" ? 0 : 1) - (b.status === "Pending" ? 0 : 1),
      ),
    [changes],
  );
  const pct = total ? Math.round((completed / total) * 100) : 0;

  const resubmit = () => {
    resubmitForApproval();
    // Demo: the same review team approves the resubmitted revision.
    completeApproval();
    toast.success("Resubmitted to the same approval team — quotation unlocked");
  };

  return (
    <aside className="fixed bottom-4 right-4 z-[86] flex h-[70vh] w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-[0_24px_60px_rgba(16,24,40,0.22)]">
      <div className="shrink-0 border-b border-hairline px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquareWarning className="h-4 w-4 text-red-600" />
          <span className="text-[13px] font-semibold text-ink-900">Requested changes</span>
          {workingVersion !== null && (
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10.5px] font-medium text-ink-700">
              V{workingVersion} · working copy
            </span>
          )}
          <button
            onClick={minimizeChangesDock}
            aria-label="Minimize requested changes"
            className="ml-auto rounded-md p-1 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            onClick={closeChangesDock}
            aria-label="Close requested changes"
            className="rounded-md p-1 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">
          Stays with you across Product, Configuration and Costing. Minimize it to keep working.
        </p>

        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                allDone ? "bg-brand-600" : "bg-ink-900",
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[11.5px] tabular-nums text-ink-600">
            {completed}/{total}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-2">
          {ordered.map((c) => (
            <DockChangeCard key={c.id} change={c} />
          ))}
        </div>
      </div>

      <div className="shrink-0 space-y-2 border-t border-hairline px-3 py-3">
        <button
          onClick={markAllComplete}
          disabled={allDone}
          className={cn(
            "inline-flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-medium",
            allDone
              ? "cursor-not-allowed border-hairline bg-surface-alt text-ink-400"
              : "border-ink-900 bg-ink-900 text-white hover:bg-ink-800",
          )}
        >
          <Check className="h-4 w-4" /> Mark all as complete
        </button>
        <button
          onClick={resubmit}
          disabled={!allDone || approvalDone}
          title={allDone ? "Resubmit to the same approval team" : "Complete every change first"}
          className={cn(
            "inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium text-white",
            allDone && !approvalDone
              ? "bg-brand-700 hover:bg-brand-800"
              : "cursor-not-allowed bg-ink-200",
          )}
        >
          <Send className="h-4 w-4" /> Resubmit for approval
        </button>
        {approvalDone && (
          <div className="flex items-center gap-1.5 text-[11.5px] text-brand-800">
            <CheckCircle2 className="h-3.5 w-3.5" /> 4/4 approved — Generate quotation is enabled.
          </div>
        )}
      </div>
    </aside>
  );
}

function DockChangeCard({ change: c }: { change: RequestedChange }) {
  const [open, setOpen] = useState(false);
  const done = c.status === "Completed";
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-hairline bg-surface",
        done && "opacity-80",
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-surface-alt/60"
      >
        <span
          className={cn(
            "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
            done ? "bg-brand-600" : "bg-red-500",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-wide text-ink-600">
              {c.module}
            </span>
            <span className="truncate text-[12.5px] font-medium text-ink-900">{c.field}</span>
          </span>
          <span className="mt-0.5 block text-[11px] text-ink-500">
            {stepForModule(c.module)} step · {c.requestedBy}
          </span>
        </span>
        {open ? (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
        ) : (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
        )}
      </button>

      {open && (
        <div className="space-y-2.5 border-t border-hairline px-3 py-3">
          <div className="grid grid-cols-2 gap-2">
            <ValueBox label="Current" value={c.currentValue} />
            <ValueBox label="Requested" value={c.requestedValue} tone="req" />
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
              Reviewer comment
            </div>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-700">{c.comment}</p>
          </div>
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
              Reason
            </div>
            <p className="mt-0.5 text-[12px] text-ink-700">{c.reason}</p>
          </div>
          <button
            onClick={() => setChangeStatus(c.id, done ? "Pending" : "Completed")}
            className={cn(
              "inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium",
              done
                ? "border border-hairline bg-surface text-ink-700 hover:bg-surface-alt"
                : "bg-brand-700 text-white hover:bg-brand-800",
            )}
          >
            <Check className="h-3.5 w-3.5" /> {done ? "Reopen change" : "Mark as complete"}
          </button>
        </div>
      )}
    </div>
  );
}

function ValueBox({ label, value, tone }: { label: string; value: string; tone?: "req" }) {
  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-1.5",
        tone === "req" ? "border-brand-200 bg-brand-50" : "border-hairline bg-surface-alt",
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-[12.5px] font-medium tabular-nums",
          tone === "req" ? "text-brand-800" : "text-ink-900",
        )}
      >
        {value}
      </div>
    </div>
  );
}
