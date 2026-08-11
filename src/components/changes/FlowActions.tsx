// Shared, grouped header actions for the approval flow.
// Order convention: secondary buttons first, primary button last.

import { useEffect } from "react";
import { History, MessageSquareWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  closeChangesDock,
  expandChangesDock,
  openChangesDock,
  registerActionHost,
  useRequestedChanges,
} from "@/lib/requestedChangesStore";
import { REVISION_HISTORY_EVENT } from "./ChangesLayer";

/** Mount inside an overlay that renders its own action group. */
export function useActionHost() {
  useEffect(() => registerActionHost(), []);
}

export function ActionGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>;
}

/** True once a V2 working copy exists — modules then show Revision history. */
export function useV2Started() {
  return useRequestedChanges().workingVersion !== null;
}

/** Revision history, rendered only after V2 starts. Use in module headers. */
export function ModuleRevisionAction({ compact }: { compact?: boolean }) {
  const started = useV2Started();
  if (!started) return null;
  return <RevisionHistoryAction compact={compact} />;
}


export function WorkingCopyChip() {
  const { workingVersion } = useRequestedChanges();
  if (workingVersion === null) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink-900 px-2 py-0.5 text-[11px] font-semibold text-white">
      V{workingVersion}
      <span className="font-normal text-white/70">working copy</span>
    </span>
  );
}

export function RequestedChangesAction() {
  const s = useRequestedChanges();
  const pending = s.changes.filter((c) => c.status === "Pending").length;
  const open = s.dockOpen && !s.dockMinimized;
  return (
    <div className="relative">
      <button
        onClick={() => {
          if (!s.dockOpen) openChangesDock();
          else if (s.dockMinimized) expandChangesDock();
          else closeChangesDock();
        }}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] transition-colors",
          open
            ? "border-ink-900 bg-surface text-ink-900"
            : "border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
        )}
      >
        <MessageSquareWarning className="h-4 w-4" /> Requested changes
      </button>
      {pending > 0 && (
        <span className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10.5px] font-semibold leading-none text-white ring-2 ring-surface">
          {pending}
        </span>
      )}
    </div>
  );
}

export function RevisionHistoryAction({ compact }: { compact?: boolean }) {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event(REVISION_HISTORY_EVENT))}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface text-ink-700 hover:bg-surface-alt",
        compact ? "h-8 px-3 text-[12px] font-medium" : "px-3 py-2 text-[13px]",
      )}
    >
      <History className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} /> Revision history
    </button>
  );
}

