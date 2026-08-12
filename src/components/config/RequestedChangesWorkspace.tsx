// RequestedChangesWorkspace — review comments raised during approval.
// Reuses the app shell: same header + workflow stepper. Left = product/variant
// summary, center = requested-changes workspace (progress, revision, history),
// right = persistent Requested Changes panel.

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  GitBranch,
  History,
  MessageSquareWarning,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WorkflowStepper } from "@/components/layout/WorkflowStepper";
import {
  beginWorkingRevision,
  resubmitForApproval,
  completeApproval,
  markAllComplete,
  setChangeStatus,
  useRequestedChanges,
  type RequestedChange,
  type Revision,
} from "@/lib/requestedChangesStore";

type SummaryRow = { label: string; value: string };

type Props = {
  productName: string;
  podRef: string;
  buyer: string;
  buyerRef?: string;
  updatedAt?: string;
  variantName?: string;
  summaryRows?: SummaryRow[];
  onClose: () => void;
  navPodId?: string;
  navArticleId?: string;
  costingRef?: string;
};

export function RequestedChangesWorkspace({
  productName,
  podRef,
  buyer,
  buyerRef,
  updatedAt,
  variantName,
  summaryRows = [],
  onClose,
  navPodId,
  navArticleId,
  costingRef,
}: Props) {
  const { changes, revisions, workingVersion } = useRequestedChanges();

  // Working on requested changes always happens on a new revision.
  useEffect(() => {
    beginWorkingRevision();
  }, []);

  const completed = changes.filter((c) => c.status === "Completed").length;
  const total = changes.length;
  const allDone = total > 0 && completed === total;
  const pct = total ? Math.round((completed / total) * 100) : 0;

  const ordered = useMemo(() => {
    const rank = (c: RequestedChange) => (c.status === "Pending" ? 0 : 1);
    return [...changes].sort((a, b) => rank(a) - rank(b));
  }, [changes]);

  const [readOnlyRevision, setReadOnlyRevision] = useState<Revision | null>(null);

  const resubmit = () => {
    markAllComplete();
    resubmitForApproval();
    // Demo: the same review team approves the resubmitted revision immediately.
    completeApproval();
    toast.success("Resubmitted — all reviewers approved, quotation unlocked");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-canvas">
      {/* Header — same shell as Product / Configuration / Costing */}
      <header className="shrink-0 border-b border-hairline bg-surface px-6 py-3 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              onClick={onClose}
              aria-label="Close requested changes"
              className="mt-1 rounded-md p-1 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
            >
              <X className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[20px] font-semibold tracking-tight text-ink-900">{productName}</h1>
                <span
                  suppressHydrationWarning
                  className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-400"
                >
                  {podRef}
                </span>
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                  Changes requested
                </span>
                {workingVersion !== null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-700">
                    <GitBranch className="h-3 w-3" /> Version {workingVersion} · working copy
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12px] text-ink-500">
                <span>
                  Buyer <span className="text-ink-900">{buyer}</span>
                </span>
                {buyerRef && (
                  <span>
                    Buyer Ref <span className="text-ink-900">{buyerRef}</span>
                  </span>
                )}
                {updatedAt && (
                  <span>
                    Last updated <span className="text-ink-900">{updatedAt}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 py-2 text-[13px] text-ink-700">
              <Clock className="h-4 w-4 text-ink-400" />
              {completed} / {total} completed
            </span>
            <button
              onClick={resubmit}
              disabled={!allDone}
              title={
                allDone
                  ? "Resubmit for approval"
                  : "Mark every requested change as completed to resubmit"
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[13px] font-medium text-white transition-colors",
                allDone ? "bg-brand-700 hover:bg-brand-800" : "cursor-not-allowed bg-ink-200",
              )}
            >
              <Send className="h-4 w-4" /> Resubmit for approval
            </button>
          </div>
        </div>
      </header>

      <WorkflowStepper active="Quotation" podId={navPodId} articleId={navArticleId} costingRef={costingRef} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* LEFT — current product / variant summary */}
        <aside className="hidden w-[288px] shrink-0 overflow-y-auto border-r border-hairline bg-white lg:block">
          <div className="border-b border-hairline px-4 py-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
              Current product
            </div>
            <div className="mt-1 text-[14px] font-semibold leading-tight text-ink-900">{productName}</div>
            <div className="text-[11.5px] text-ink-600">
              {buyer}
              {buyerRef ? ` · ${buyerRef}` : ""}
            </div>
          </div>
          {variantName && (
            <div className="border-b border-hairline px-4 py-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
                Active variant
              </div>
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-1 text-[12.5px] font-medium text-brand-800">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
                {variantName}
              </div>
            </div>
          )}
          <div className="px-4 py-3">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">
              Summary
            </div>
            <dl className="space-y-0">
              {summaryRows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-baseline justify-between gap-3 border-b border-hairline/70 py-1.5 last:border-0"
                >
                  <dt className="text-[12px] text-ink-500">{r.label}</dt>
                  <dd className="text-[12.5px] font-medium tabular-nums text-ink-900">{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>

        {/* CENTER — requested changes workspace */}
        <main className="min-w-0 flex-1 overflow-y-auto px-6 py-6 lg:px-8">
          <div className="mx-auto max-w-[860px] space-y-5">
            {/* Progress */}
            <section className="rounded-xl border border-hairline bg-surface px-5 py-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-[16px] font-semibold text-ink-900">Requested changes</h2>
                  <p className="mt-0.5 max-w-[520px] text-[12.5px] leading-relaxed text-ink-500">
                    Reviewers raised {total} change requests. Open the Product, Configuration or
                    Costing workspace to make each update, then mark it completed here.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[26px] font-semibold leading-none tabular-nums text-ink-900">
                    {completed} / {total}
                  </div>
                  <div className="mt-1 text-[11.5px] text-ink-500">changes completed</div>
                </div>
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-ink-100">
                <div
                  className={cn("h-full rounded-full transition-all", allDone ? "bg-brand-600" : "bg-ink-900")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-3 flex items-center gap-2 text-[12px]">
                {allDone ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 font-medium text-brand-800">
                    <CheckCircle2 className="h-3.5 w-3.5" /> All changes completed — you can resubmit
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                    <AlertCircle className="h-3.5 w-3.5" /> {total - completed} pending — resubmit is
                    locked until all are completed
                  </span>
                )}
              </div>
            </section>

            {/* Versioning */}
            <section className="rounded-xl border border-hairline bg-surface px-5 py-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-ink-500" />
                <h3 className="text-[14px] font-semibold text-ink-900">Versioning</h3>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-500">
                A working copy was created automatically. All updates are made on Version{" "}
                {workingVersion ?? "—"}; the approved version stays unchanged.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
                <VersionChip label="Version 1" note="Approved" tone="ok" />
                <ChevronRight className="h-4 w-4 text-ink-300" />
                <VersionChip label="Changes requested" note={`${total} items`} tone="warn" />
                <ChevronRight className="h-4 w-4 text-ink-300" />
                <VersionChip
                  label={`Version ${workingVersion ?? 2}`}
                  note="Working copy"
                  tone="active"
                />
              </div>
            </section>

            {/* Revision history */}
            <section className="overflow-hidden rounded-xl border border-hairline bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex items-center gap-2 border-b border-hairline px-5 py-3.5">
                <History className="h-4 w-4 text-ink-500" />
                <h3 className="text-[14px] font-semibold text-ink-900">Revision history</h3>
                <span className="ml-auto text-[11.5px] tabular-nums text-ink-500">
                  {revisions.length} versions
                </span>
              </div>
              <ul>
                {[...revisions]
                  .sort((a, b) => b.version - a.version)
                  .map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-start gap-x-4 gap-y-1 border-b border-hairline px-5 py-3.5 last:border-0"
                    >
                      <div className="min-w-[92px]">
                        <div className="text-[13px] font-semibold text-ink-900">
                          Version {r.version}
                        </div>
                        <div className="text-[11px] text-ink-500" suppressHydrationWarning>
                          {r.createdAt}
                        </div>
                      </div>
                      <RevisionBadge status={r.status} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] text-ink-700">{r.comments}</div>
                        <div className="mt-0.5 text-[11px] text-ink-500">Created by {r.createdBy}</div>
                      </div>
                      <button
                        onClick={() => setReadOnlyRevision(r)}
                        className="shrink-0 rounded-md border border-hairline bg-surface px-2.5 py-1 text-[12px] text-ink-700 hover:bg-surface-alt"
                      >
                        Open read only
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          </div>
        </main>

        {/* RIGHT — persistent requested changes panel */}
        <aside className="hidden w-[364px] shrink-0 flex-col border-l border-hairline bg-white xl:flex">
          <div className="shrink-0 border-b border-hairline px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquareWarning className="h-4 w-4 text-red-600" />
              <span className="text-[13px] font-semibold text-ink-900">Requested changes</span>
              <span className="ml-auto rounded-full bg-ink-100 px-2 py-0.5 text-[11px] tabular-nums text-ink-700">
                {completed}/{total}
              </span>
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-500">
              Review comments only. Make the update in the relevant workspace, then mark it
              completed.
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-2">
              {ordered.map((c) => (
                <ChangeCard key={c.id} change={c} />
              ))}
            </div>
          </div>
        </aside>
      </div>

      {readOnlyRevision && (
        <RevisionReadOnly revision={readOnlyRevision} onClose={() => setReadOnlyRevision(null)} />
      )}
    </div>
  );
}

/* ------------------------------- pieces ------------------------------- */

function VersionChip({
  label,
  note,
  tone,
}: {
  label: string;
  note: string;
  tone: "ok" | "warn" | "active";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        tone === "ok" && "border-hairline bg-surface-alt",
        tone === "warn" && "border-red-100 bg-red-50",
        tone === "active" && "border-brand-200 bg-brand-50",
      )}
    >
      <div
        className={cn(
          "text-[12.5px] font-semibold",
          tone === "warn" ? "text-red-700" : tone === "active" ? "text-brand-800" : "text-ink-900",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "text-[11px]",
          tone === "warn" ? "text-red-600" : tone === "active" ? "text-brand-700" : "text-ink-500",
        )}
      >
        {note}
      </div>
    </div>
  );
}

function RevisionBadge({ status }: { status: Revision["status"] }) {
  const map: Record<Revision["status"], string> = {
    Approved: "bg-brand-50 text-brand-800",
    "Changes requested": "bg-red-50 text-red-700",
    "Working copy": "bg-ink-100 text-ink-700",
    "Submitted for approval": "bg-amber-50 text-amber-700",
  };
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", map[status])}>
      {status}
    </span>
  );
}

function ChangeCard({ change: c }: { change: RequestedChange }) {
  const [open, setOpen] = useState(false);
  const done = c.status === "Completed";
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-surface",
        done ? "border-hairline opacity-80" : "border-hairline",
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
            {c.requestedBy} · {c.requestedRole} · <span suppressHydrationWarning>{c.requestedAt}</span>
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
            done ? "bg-brand-50 text-brand-800" : "bg-amber-50 text-amber-700",
          )}
        >
          {c.status}
        </span>
        {open ? (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
        ) : (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-hairline px-3 py-3">
          <div className="grid grid-cols-2 gap-2">
            <ValueBox label="Current" value={c.currentValue} />
            <ValueBox label="Requested" value={c.requestedValue} accent />
          </div>
          <div className="mt-3">
            <Label>Reviewer comments</Label>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-700">{c.comment}</p>
          </div>
          <div className="mt-2.5">
            <Label>Reason</Label>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-700">{c.reason}</p>
          </div>
          {done && c.completedAt && (
            <p className="mt-2.5 text-[11px] text-brand-700" suppressHydrationWarning>
              Completed {c.completedAt}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            {done ? (
              <button
                onClick={() => setChangeStatus(c.id, "Pending")}
                className="rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[12px] text-ink-700 hover:bg-surface-alt"
              >
                Reopen
              </button>
            ) : (
              <button
                onClick={() => setChangeStatus(c.id, "Completed")}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-2.5 py-1.5 text-[12px] font-medium text-white hover:bg-brand-800"
              >
                <Check className="h-3.5 w-3.5" /> Mark completed
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">{children}</div>
  );
}

function ValueBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-2",
        accent ? "border-brand-200 bg-brand-50" : "border-hairline bg-surface-alt",
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-[13px] font-semibold tabular-nums",
          accent ? "text-brand-800" : "text-ink-900",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function RevisionReadOnly({ revision, onClose }: { revision: Revision; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink-900/40 px-4">
      <div className="w-full max-w-[560px] overflow-hidden rounded-xl border border-hairline bg-surface shadow-xl">
        <div className="flex items-center gap-2 border-b border-hairline px-5 py-3.5">
          <History className="h-4 w-4 text-ink-500" />
          <h3 className="text-[14px] font-semibold text-ink-900">Version {revision.version}</h3>
          <RevisionBadge status={revision.status} />
          <span className="ml-auto rounded-full bg-ink-100 px-2 py-0.5 text-[11px] text-ink-600">
            read only
          </span>
          <button
            onClick={onClose}
            aria-label="Close revision"
            className="rounded-md p-1 text-ink-500 hover:bg-surface-alt hover:text-ink-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <dl className="px-5 py-4">
          <Row label="Version" value={`Version ${revision.version}`} />
          <Row label="Created date" value={revision.createdAt} />
          <Row label="Status" value={revision.status} />
          <Row label="Created by" value={revision.createdBy} />
          <Row label="Comments" value={revision.comments} />
        </dl>
        <div className="border-t border-hairline px-5 py-3 text-[11.5px] text-ink-500">
          Previous revisions cannot be edited. Work continues on the current working copy.
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-hairline/70 py-2 last:border-0">
      <dt className="text-[12px] text-ink-500">{label}</dt>
      <dd className="max-w-[64%] text-right text-[12.5px] text-ink-900" suppressHydrationWarning>
        {value}
      </dd>
    </div>
  );
}
