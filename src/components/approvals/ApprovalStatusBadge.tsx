import { cn } from "@/lib/utils";
import type { ApprovalStatus, ApprovalPriority } from "@/lib/approvalsStore";
import { AlertCircle, CheckCircle2, Clock, RotateCcw, Ban } from "lucide-react";

export function ApprovalStatusBadge({ status, className }: { status: ApprovalStatus; className?: string }) {
  const map = {
    pending: {
      label: "Pending",
      cls: "bg-gold-50 text-gold-700 ring-gold-200",
      icon: Clock,
    },
    approved: {
      label: "Approved",
      cls: "bg-brand-50 text-brand-700 ring-brand-700/20",
      icon: CheckCircle2,
    },
    sent_back: {
      label: "Sent Back",
      cls: "bg-red-50 text-red-700 ring-red-200",
      icon: RotateCcw,
    },
    rejected: {
      label: "Rejected",
      cls: "bg-ink-900 text-white ring-ink-900",
      icon: Ban,
    },
  }[status];
  const Icon = map.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ring-1",
        map.cls,
        className,
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {map.label}
    </span>
  );
}

export function PriorityChip({ priority, className }: { priority: ApprovalPriority; className?: string }) {
  const map = {
    normal: { label: "Normal", cls: "bg-surface-alt text-ink-700 ring-hairline" },
    high: { label: "High", cls: "bg-gold-50 text-gold-700 ring-gold-200" },
    urgent: { label: "Urgent", cls: "bg-red-50 text-red-700 ring-red-200" },
  }[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider ring-1",
        map.cls,
        className,
      )}
    >
      {priority === "urgent" && <AlertCircle className="h-2.5 w-2.5" />}
      {map.label}
    </span>
  );
}
