// Header action that opens the Requested Changes workspace.
// White secondary button + small red badge with the pending count.

import { MessageSquareWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePendingChangeCount } from "@/lib/requestedChangesStore";

export function RequestedChangesButton({
  onClick,
  active,
}: {
  onClick: () => void;
  active?: boolean;
}) {
  const pending = usePendingChangeCount();
  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] transition-colors",
          active
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
